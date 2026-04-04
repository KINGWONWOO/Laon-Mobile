import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Modal, Alert, ScrollView, ActivityIndicator, Pressable, FlatList, Platform } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, MaterialIcons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { Dancer, FormationScene, TimelineEntry, Position, Formation, FormationSettings } from '../../../../types';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, useDerivedValue, SharedValue, withSpring, withTiming, interpolate } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const STAGE_WIDTH = width - 40;
const STAGE_HEIGHT = STAGE_WIDTH * 0.75;

const ACCENT_COLOR = '#FF3366';
const COLORS = ['#FF3366', '#FF9F43', '#F7D794', '#4ECDC4', '#45B7D1', '#A06CD5', '#1B9CFC', '#E056FD', '#686DE0', '#30336B'];

type EditorMode = 'create' | 'place'; // 대형 생성 | 대형 배치

// --- Dancer Node ---
const DancerNode = ({ 
  dancer, 
  currentTimeMs, 
  scenes,
  timeline,
  onDragEnd, 
  isSelected,
  onPress,
  mode,
  activeScenePositions,
  index,
  settings
}: { 
  dancer: Dancer; 
  currentTimeMs: SharedValue<number>; 
  scenes: FormationScene[];
  timeline: TimelineEntry[];
  onDragEnd: (id: string, pos: Position) => void;
  isSelected: boolean;
  onPress: () => void;
  mode: EditorMode;
  activeScenePositions: Record<string, Position>;
  index: number;
  settings: FormationSettings;
}) => {
  const isDragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const interpolatedX = useDerivedValue(() => {
    if (isDragging.value) return dragX.value;
    if (mode === 'create') return activeScenePositions[dancer.id]?.x ?? STAGE_WIDTH / 2;

    if (timeline.length === 0) return STAGE_WIDTH / 2;
    const time = currentTimeMs.value;
    let prevEntry: TimelineEntry | null = null;
    let nextEntry: TimelineEntry | null = null;

    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].timestampMillis <= time) prevEntry = timeline[i];
      else { nextEntry = timeline[i]; break; }
    }

    if (!prevEntry) return scenes.find(s => s.id === timeline[0].sceneId)?.positions[dancer.id]?.x ?? STAGE_WIDTH / 2;
    const prevScene = scenes.find(s => s.id === prevEntry!.sceneId);
    if (!prevScene) return STAGE_WIDTH / 2;

    if (time <= prevEntry.timestampMillis + prevEntry.durationMillis) {
      return prevScene.positions[dancer.id]?.x ?? STAGE_WIDTH / 2;
    }

    if (nextEntry) {
      const nextScene = scenes.find(s => s.id === nextEntry!.sceneId);
      if (!nextScene) return prevScene.positions[dancer.id]?.x ?? STAGE_WIDTH / 2;
      const progress = (time - (prevEntry.timestampMillis + prevEntry.durationMillis)) / (nextEntry.timestampMillis - (prevEntry.timestampMillis + prevEntry.durationMillis));
      const sX = prevScene.positions[dancer.id]?.x ?? STAGE_WIDTH / 2;
      const eX = nextScene.positions[dancer.id]?.x ?? STAGE_WIDTH / 2;
      return sX + (eX - sX) * progress;
    }
    return prevScene.positions[dancer.id]?.x ?? STAGE_WIDTH / 2;
  });

  const interpolatedY = useDerivedValue(() => {
    if (isDragging.value) return dragY.value;
    if (mode === 'create') return activeScenePositions[dancer.id]?.y ?? STAGE_HEIGHT / 2;

    if (timeline.length === 0) return STAGE_HEIGHT / 2;
    const time = currentTimeMs.value;
    let prevEntry: TimelineEntry | null = null;
    let nextEntry: TimelineEntry | null = null;

    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].timestampMillis <= time) prevEntry = timeline[i];
      else { nextEntry = timeline[i]; break; }
    }

    if (!prevEntry) return scenes.find(s => s.id === timeline[0].sceneId)?.positions[dancer.id]?.y ?? STAGE_HEIGHT / 2;
    const prevScene = scenes.find(s => s.id === prevEntry!.sceneId);
    if (!prevScene) return STAGE_HEIGHT / 2;

    if (time <= prevEntry.timestampMillis + prevEntry.durationMillis) {
      return prevScene.positions[dancer.id]?.y ?? STAGE_HEIGHT / 2;
    }

    if (nextEntry) {
      const nextScene = scenes.find(s => s.id === nextEntry!.sceneId);
      if (!nextScene) return prevScene.positions[dancer.id]?.y ?? STAGE_HEIGHT / 2;
      const progress = (time - (prevEntry.timestampMillis + prevEntry.durationMillis)) / (nextEntry.timestampMillis - (prevEntry.timestampMillis + prevEntry.durationMillis));
      const sY = prevScene.positions[dancer.id]?.y ?? STAGE_HEIGHT / 2;
      const eY = nextScene.positions[dancer.id]?.y ?? STAGE_HEIGHT / 2;
      return sY + (eY - sY) * progress;
    }
    return prevScene.positions[dancer.id]?.y ?? STAGE_HEIGHT / 2;
  });

  const panGesture = Gesture.Pan()
    .enabled(mode === 'create')
    .onStart(() => {
      isDragging.value = true;
      dragX.value = interpolatedX.value;
      dragY.value = interpolatedY.value;
      startX.value = interpolatedX.value;
      startY.value = interpolatedY.value;
    })
    .onUpdate((e) => {
      let nx = startX.value + e.translationX;
      let ny = startY.value + e.translationY;
      nx = Math.max(15, Math.min(STAGE_WIDTH - 15, nx));
      ny = Math.max(15, Math.min(STAGE_HEIGHT - 15, ny));
      dragX.value = nx;
      dragY.value = ny;
    })
    .onEnd(() => {
      isDragging.value = false;
      let fx = dragX.value;
      let fy = dragY.value;
      if (settings.snapToGrid) {
        const sx = STAGE_WIDTH / settings.gridCols;
        const sy = STAGE_HEIGHT / settings.gridRows;
        fx = Math.round(fx / sx) * sx;
        fy = Math.round(fy / sy) * sy;
      }
      runOnJS(onDragEnd)(dancer.id, { x: fx, y: fy });
    });

  const tapGesture = Gesture.Tap().onEnd(() => { runOnJS(onPress)(); });
  const composed = Gesture.Exclusive(panGesture, tapGesture);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolatedX.value - 15 }, { translateY: interpolatedY.value - 15 }, { scale: isDragging.value ? 1.2 : withSpring(1) }],
    zIndex: isSelected || isDragging.value ? 100 : 1
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.dancerNode, style]}>
        <View style={[styles.dancerCircle, { backgroundColor: dancer.color, borderColor: isSelected ? '#FFF' : 'rgba(0,0,0,0.2)' }]}>
          <Text style={styles.dancerInitial}>{index + 1}</Text>
        </View>
        <Text style={[styles.dancerNameText, { color: isSelected ? '#FFF' : '#AAA' }]} numberOfLines={1}>{dancer.name}</Text>
      </Animated.View>
    </GestureDetector>
  );
};

// --- Main Editor Screen ---
export default function FormationEditorScreen() {
  const { id, formationId } = useGlobalSearchParams<{ id: string, formationId: string }>();
  const { formations, updateFormation, theme } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const formation = formations.find(f => f.id === formationId);
  
  // States
  const [mode, setMode] = useState<EditorMode>('create');
  const [dancers, setDancers] = useState<Dancer[]>(formation?.data?.dancers || []);
  const [scenes, setScenes] = useState<FormationScene[]>(formation?.data?.scenes || []);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(formation?.data?.timeline || []);
  const [settings, setSettings] = useState<FormationSettings>(formation?.settings || { gridRows: 10, gridCols: 10, stageDirection: 'top', snapToGrid: true });
  
  const [activeSceneId, setActiveSceneId] = useState<string | null>(formation?.data?.scenes?.[0]?.id || null);
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Modals
  const [showDancerSheet, setShowDancerSheet] = useState(false);
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [showSceneNameModal, setShowSceneNameModal] = useState(false);
  const [inputName, setInputName] = useState('');

  // Audio & Animation
  const player = useAudioPlayer(formation?.audioUrl || '');
  const status = useAudioPlayerStatus(player);
  const currentTimeMs = useSharedValue(0);
  const [currentTimeUI, setCurrentTimeUI] = useState(0);

  useEffect(() => {
    if (status.currentTime !== undefined) {
      const ms = status.currentTime * 1000;
      currentTimeMs.value = ms;
      setCurrentTimeUI(ms);
    }
  }, [status.currentTime]);

  const activeScene = useMemo(() => scenes.find(s => s.id === activeSceneId), [scenes, activeSceneId]);
  const activeScenePositions = useMemo(() => activeScene?.positions || {}, [activeScene]);

  const handleDragEnd = (dancerId: string, pos: Position) => {
    if (mode !== 'create' || !activeSceneId) return;
    setScenes(prev => prev.map(s => s.id === activeSceneId ? {
      ...s, positions: { ...s.positions, [dancerId]: pos }
    } : s));
  };

  const addDancer = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newDancer: Dancer = { id: newId, name: `댄서 ${dancers.length + 1}`, color: COLORS[dancers.length % COLORS.length] };
    setDancers([...dancers, newDancer]);
    setScenes(prev => prev.map(s => ({ ...s, positions: { ...s.positions, [newId]: { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 } } })));
  };

  const addScene = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const lastScene = scenes[scenes.length - 1];
    const newScene: FormationScene = { id: newId, name: inputName.trim() || `대형 ${scenes.length + 1}`, positions: lastScene ? { ...lastScene.positions } : {} };
    setScenes([...scenes, newScene]);
    setActiveSceneId(newId);
    setShowSceneNameModal(false);
    setInputName('');
  };

  const addTimelineEntry = () => {
    if (!activeSceneId) return;
    const time = Math.floor(currentTimeMs.value / 100) * 100;
    const newEntry: TimelineEntry = { id: Math.random().toString(36).substr(2, 9), timestampMillis: time, durationMillis: 2000, sceneId: activeSceneId };
    setTimeline(prev => [...prev, newEntry].sort((a, b) => a.timestampMillis - b.timestampMillis));
  };

  const updateEntryDuration = (entryId: string, delta: number) => {
    setTimeline(prev => prev.map(e => e.id === entryId ? { ...e, durationMillis: Math.max(500, e.durationMillis + delta) } : e));
  };

  const updateEntryStart = (entryId: string, delta: number) => {
    setTimeline(prev => prev.map(e => e.id === entryId ? { ...e, timestampMillis: Math.max(0, e.timestampMillis + delta) } : e).sort((a, b) => a.timestampMillis - b.timestampMillis));
  };

  const handleSave = async () => {
    try {
      await updateFormation(formationId!, { settings, data: { dancers, scenes, timeline } });
      Alert.alert('성공', '저장되었습니다.');
    } catch (e: any) { Alert.alert('오류', e.message); }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}.${Math.floor((ms%1000)/100)}`;
  };

  if (!formation) return null;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: '#050505' }]}>
      {/* --- Top Bar --- */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => { player.pause(); router.back(); }} style={styles.topBtn}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.modeToggle}>
          <TouchableOpacity onPress={() => setMode('create')} style={[styles.modeTab, mode === 'create' && styles.activeModeTab]}>
            <Text style={[styles.modeTabText, mode === 'create' && styles.activeModeTabText]}>대형 생성</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('place')} style={[styles.modeTab, mode === 'place' && styles.activeModeTab]}>
            <Text style={[styles.modeTabText, mode === 'place' && styles.activeModeTabText]}>대형 배치</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleSave} style={styles.topBtn}>
          <Text style={{ color: theme.primary, fontWeight: 'bold' }}>저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled={false}>
        {/* --- Main Stage --- */}
        <View style={styles.stageSection}>
          <Text style={styles.directionLabel}>{settings.stageDirection === 'top' ? 'BACKSTAGE' : 'AUDIENCE'}</Text>
          <View style={[styles.stage, { borderColor: 'rgba(255,255,255,0.1)' }]}>
            <View style={styles.gridLayer}>
              {Array.from({length: settings.gridCols + 1}).map((_, i) => (
                <View key={`v-${i}`} style={[styles.gridLineV, { left: `${(i/settings.gridCols)*100}%`, opacity: i % 5 === 0 ? 0.3 : 0.1 }]} />
              ))}
              {Array.from({length: settings.gridRows + 1}).map((_, i) => (
                <View key={`h-${i}`} style={[styles.gridLineH, { top: `${(i/settings.gridRows)*100}%`, opacity: i % 5 === 0 ? 0.3 : 0.1 }]} />
              ))}
            </View>
            <View style={styles.centerCross}><Ionicons name="add" size={20} color="rgba(255,255,255,0.2)" /></View>
            {dancers.map((d, i) => (
              <DancerNode 
                key={d.id} index={i} dancer={d} currentTimeMs={currentTimeMs} scenes={scenes} timeline={timeline}
                onDragEnd={handleDragEnd} isSelected={selectedDancerId === d.id} onPress={() => { setSelectedDancerId(d.id); setShowDancerSheet(true); }}
                mode={mode} activeScenePositions={activeScenePositions} settings={settings}
              />
            ))}
          </View>
          <Text style={styles.directionLabel}>{settings.stageDirection === 'top' ? 'AUDIENCE' : 'BACKSTAGE'}</Text>
        </View>

        {/* --- Toolbar --- */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolItem} onPress={addDancer}><View style={styles.toolIconCircle}><Ionicons name="person-add" size={20} color="#FFF" /></View><Text style={styles.toolText}>댄서 추가</Text></TouchableOpacity>
          <TouchableOpacity style={styles.toolItem} onPress={() => setShowStageSettings(true)}><View style={styles.toolIconCircle}><Ionicons name="grid" size={20} color="#FFF" /></View><Text style={styles.toolText}>그리드 설정</Text></TouchableOpacity>
          <TouchableOpacity style={styles.toolItem} onPress={() => {/* Auto-layout logic */}}><View style={styles.toolIconCircle}><Ionicons name="flash" size={20} color="#FFF" /></View><Text style={styles.toolText}>자동 배치</Text></TouchableOpacity>
        </View>

        {/* --- Bottom Dynamic Area --- */}
        <View style={[styles.bottomDock, { paddingBottom: insets.bottom + 10 }]}>
          {mode === 'create' ? (
            <View style={styles.createModeContent}>
              <View style={styles.scenesHeader}><Text style={styles.dockTitle}>대형 목록</Text><TouchableOpacity onPress={() => setShowSceneNameModal(true)}><Ionicons name="add-circle" size={24} color={theme.primary} /></TouchableOpacity></View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scenesScroll}>
                {scenes.map((s, idx) => (
                  <TouchableOpacity key={s.id} style={[styles.scenePill, activeSceneId === s.id && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => setActiveSceneId(s.id)}>
                    <Text style={[styles.scenePillText, activeSceneId === s.id && { color: '#000' }]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.placeModeContent}>
              <View style={styles.playbackControls}>
                <TouchableOpacity onPress={() => player.seekTo(status.currentTime - 2)}><Ionicons name="play-back" size={24} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity onPress={() => status.playing ? player.pause() : player.play()} style={[styles.mainPlayBtn, { backgroundColor: theme.primary }]}><Ionicons name={status.playing ? "pause" : "play"} size={32} color="#000" /></TouchableOpacity>
                <TouchableOpacity onPress={() => player.seekTo(status.currentTime + 2)}><Ionicons name="play-forward" size={24} color="#FFF" /></TouchableOpacity>
                <View style={styles.timeInfo}><Text style={styles.timeText}>{formatTime(currentTimeUI)}</Text></View>
                <TouchableOpacity style={styles.addPointBtn} onPress={addTimelineEntry}><Ionicons name="pin" size={20} color={theme.primary} /><Text style={{ color: theme.primary, marginLeft: 5, fontWeight: 'bold' }}>배치</Text></TouchableOpacity>
              </View>
              <View style={styles.timelineContainer}>
                <View style={styles.timelineTrack} />
                <View style={[styles.timelineProgress, { width: `${(status.currentTime / (status.duration || 1)) * 100}%`, backgroundColor: theme.primary }]} />
                {timeline.map(entry => {
                  const startPos = (entry.timestampMillis / ((status.duration || 60) * 1000)) * 100;
                  const widthPos = (entry.durationMillis / ((status.duration || 60) * 1000)) * 100;
                  const isSelected = selectedEntryId === entry.id;
                  return (
                    <TouchableOpacity key={entry.id} activeOpacity={0.9} onPress={() => setSelectedEntryId(entry.id)} style={[styles.timelineBlock, { left: `${startPos}%`, width: `${widthPos}%`, backgroundColor: isSelected ? theme.primary : 'rgba(255,255,255,0.2)' }]}>
                      <Text style={[styles.blockLabel, isSelected && { color: '#000' }]} numberOfLines={1}>{scenes.find(s => s.id === entry.sceneId)?.name}</Text>
                      {isSelected && (
                        <>
                          <TouchableOpacity style={styles.resizeHandleLeft} onPress={() => updateEntryStart(entry.id, -500)}><Ionicons name="chevron-back" size={14} color="#000" /></TouchableOpacity>
                          <TouchableOpacity style={styles.resizeHandleRight} onPress={() => updateEntryDuration(entry.id, 500)}><Ionicons name="chevron-forward" size={14} color="#000" /></TouchableOpacity>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* --- Dancer Sheet --- */}
      <Modal visible={showDancerSheet} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDancerSheet(false)}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>댄서 편집</Text><TouchableOpacity onPress={() => setShowDancerSheet(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity></View>
            {selectedDancerId && (
              <View style={styles.sheetContent}>
                <Text style={styles.label}>이름</Text>
                <TextInput style={styles.sheetInput} value={dancers.find(d => d.id === selectedDancerId)?.name} onChangeText={val => setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, name: val } : d))} />
                <Text style={styles.label}>색상</Text>
                <View style={styles.colorRow}>{COLORS.map(c => <TouchableOpacity key={c} style={[styles.colorChip, { backgroundColor: c }, dancers.find(d => d.id === selectedDancerId)?.color === c && { borderWidth: 3, borderColor: '#FFF' }]} onPress={() => setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, color: c } : d))} />)}</View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => { setDancers(dancers.filter(d => d.id !== selectedDancerId)); setSelectedDancerId(null); setShowDancerSheet(false); }}><Ionicons name="trash" size={20} color="#FF4444" /><Text style={{ color: '#FF4444', marginLeft: 10, fontWeight: 'bold' }}>삭제</Text></TouchableOpacity>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* --- Stage Settings Modal --- */}
      <Modal visible={showStageSettings} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <Text style={styles.modalTitle}>무대 설정</Text>
            <View style={styles.settingRow}><Text style={styles.settingLabel}>격자 스냅</Text><TouchableOpacity onPress={() => setSettings({...settings, snapToGrid: !settings.snapToGrid})}><Ionicons name={settings.snapToGrid ? "checkbox" : "square-outline"} size={24} color={theme.primary} /></TouchableOpacity></View>
            <View style={styles.settingRow}><Text style={styles.settingLabel}>무대 앞 방향</Text><TouchableOpacity style={[styles.toggleBtn, { backgroundColor: theme.primary }]} onPress={() => setSettings({...settings, stageDirection: settings.stageDirection === 'top' ? 'bottom' : 'top'})}><Text style={{ fontWeight: 'bold' }}>{settings.stageDirection === 'top' ? '상단' : '하단'}</Text></TouchableOpacity></View>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: theme.primary }]} onPress={() => setShowStageSettings(false)}><Text style={{ fontWeight: 'bold' }}>확인</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- Scene Name Modal --- */}
      <Modal visible={showSceneNameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <Text style={styles.modalTitle}>대형 이름</Text>
            <TextInput style={styles.modalInput} value={inputName} onChangeText={setInputName} placeholder="예: 후렴 1" placeholderTextColor="#555" autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20 }}><TouchableOpacity onPress={() => setShowSceneNameModal(false)}><Text style={{ color: '#888' }}>취소</Text></TouchableOpacity><TouchableOpacity onPress={addScene}><Text style={{ color: theme.primary, fontWeight: 'bold' }}>추가</Text></TouchableOpacity></View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15 },
  topBtn: { padding: 10 },
  modeToggle: { flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 25, padding: 4, borderWidth: 1, borderColor: '#333' },
  modeTab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  activeModeTab: { backgroundColor: '#333' },
  modeTabText: { color: '#666', fontSize: 13, fontWeight: 'bold' },
  activeModeTabText: { color: '#FFF' },
  stageSection: { alignItems: 'center', paddingVertical: 10 },
  directionLabel: { color: '#333', fontSize: 10, fontWeight: 'bold', letterSpacing: 4, marginVertical: 8 },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, backgroundColor: '#0A0A0A', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#FFF' },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#FFF' },
  centerCross: { position: 'absolute', top: STAGE_HEIGHT/2 - 10, left: STAGE_WIDTH/2 - 10 },
  dancerNode: { position: 'absolute', alignItems: 'center', width: 60, marginLeft: -30 },
  dancerCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  dancerInitial: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  dancerNameText: { color: '#AAA', fontSize: 10, marginTop: 4, fontWeight: '500' },
  toolbar: { flexDirection: 'row', justifyContent: 'center', gap: 30, marginVertical: 15 },
  toolItem: { alignItems: 'center', gap: 6 },
  toolIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  toolText: { color: '#888', fontSize: 11 },
  bottomDock: { borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#000' },
  createModeContent: { padding: 20 },
  dockTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  scenesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  scenesScroll: { gap: 10 },
  scenePill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: '#333', backgroundColor: '#111' },
  scenePillText: { color: '#AAA', fontWeight: 'bold', fontSize: 13 },
  placeModeContent: { padding: 20 },
  playbackControls: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 20 },
  mainPlayBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  timeInfo: { backgroundColor: '#1A1A1A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  timeText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  addPointBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', padding: 10 },
  timelineContainer: { height: 50, justifyContent: 'center', position: 'relative' },
  timelineTrack: { height: 6, backgroundColor: '#1A1A1A', borderRadius: 3, width: '100%' },
  timelineProgress: { height: 6, position: 'absolute', borderRadius: 3 },
  timelineBlock: { position: 'absolute', height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  blockLabel: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  resizeHandleLeft: { position: 'absolute', left: -5, top: 0, bottom: 0, width: 20, justifyContent: 'center', alignItems: 'center' },
  resizeHandleRight: { position: 'absolute', right: -5, top: 0, bottom: 0, width: 20, justifyContent: 'center', alignItems: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  bottomSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, backgroundColor: '#111' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  sheetTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  sheetContent: { gap: 15 },
  label: { color: '#666', fontSize: 13, fontWeight: 'bold' },
  sheetInput: { backgroundColor: '#000', color: '#FFF', padding: 15, borderRadius: 12, fontSize: 16 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorChip: { width: 36, height: 36, borderRadius: 18 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 },
  settingsModal: { backgroundColor: '#1A1A1A', padding: 25, borderRadius: 25, gap: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLabel: { color: '#AAA', fontSize: 15 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  doneBtn: { padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  modalInput: { backgroundColor: '#000', color: '#FFF', padding: 15, borderRadius: 12, fontSize: 16, marginBottom: 10 }
});
