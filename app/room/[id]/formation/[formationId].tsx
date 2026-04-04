import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Modal, Alert, ScrollView, ActivityIndicator, Pressable, FlatList } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { Dancer, FormationScene, TimelineEntry, Position, Formation, FormationSettings } from '../../../../types';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, useDerivedValue, SharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const STAGE_WIDTH = width - 40;
const STAGE_HEIGHT = STAGE_WIDTH * 0.75;

// --- Constants ---
const COLORS = ['#FF3366', '#FF9F43', '#F7D794', '#4ECDC4', '#45B7D1', '#A06CD5', '#1B9CFC', '#E056FD', '#686DE0', '#30336B'];

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
  mode: 'setup' | 'play';
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
    if (mode === 'setup') return activeScenePositions[dancer.id]?.x ?? STAGE_WIDTH / 2;

    if (timeline.length === 0) return STAGE_WIDTH / 2;
    const time = currentTimeMs.value;
    let prevEntry = timeline[0];
    let nextEntry = timeline[timeline.length - 1];

    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].timestampMillis <= time) prevEntry = timeline[i];
      if (timeline[i].timestampMillis > time) { nextEntry = timeline[i]; break; }
    }

    const prevScene = scenes.find(s => s.id === prevEntry.sceneId);
    const nextScene = scenes.find(s => s.id === nextEntry.sceneId);

    if (!prevScene || !nextScene || prevEntry.id === nextEntry.id || time >= nextEntry.timestampMillis) {
      return prevScene?.positions[dancer.id]?.x ?? STAGE_WIDTH / 2;
    }

    const progress = (time - prevEntry.timestampMillis) / (nextEntry.timestampMillis - prevEntry.timestampMillis);
    const s = prevScene.positions[dancer.id]?.x ?? STAGE_WIDTH / 2;
    const e = nextScene.positions[dancer.id]?.x ?? STAGE_WIDTH / 2;
    return s + (e - s) * progress;
  });

  const interpolatedY = useDerivedValue(() => {
    if (isDragging.value) return dragY.value;
    if (mode === 'setup') return activeScenePositions[dancer.id]?.y ?? STAGE_HEIGHT / 2;

    if (timeline.length === 0) return STAGE_HEIGHT / 2;
    const time = currentTimeMs.value;
    let prevEntry = timeline[0];
    let nextEntry = timeline[timeline.length - 1];

    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].timestampMillis <= time) prevEntry = timeline[i];
      if (timeline[i].timestampMillis > time) { nextEntry = timeline[i]; break; }
    }

    const prevScene = scenes.find(s => s.id === prevEntry.sceneId);
    const nextScene = scenes.find(s => s.id === nextEntry.sceneId);

    if (!prevScene || !nextScene || prevEntry.id === nextEntry.id || time >= nextEntry.timestampMillis) {
      return prevScene?.positions[dancer.id]?.y ?? STAGE_HEIGHT / 2;
    }

    const progress = (time - prevEntry.timestampMillis) / (nextEntry.timestampMillis - prevEntry.timestampMillis);
    const s = prevScene.positions[dancer.id]?.y ?? STAGE_HEIGHT / 2;
    const e = nextScene.positions[dancer.id]?.y ?? STAGE_HEIGHT / 2;
    return s + (e - s) * progress;
  });

  const panGesture = Gesture.Pan()
    .enabled(mode === 'setup')
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
      let finalX = dragX.value;
      let finalY = dragY.value;

      if (settings.snapToGrid) {
        const stepX = STAGE_WIDTH / settings.gridCols;
        const stepY = STAGE_HEIGHT / settings.gridRows;
        finalX = Math.round(finalX / stepX) * stepX;
        finalY = Math.round(finalY / stepY) * stepY;
      }
      runOnJS(onDragEnd)(dancer.id, { x: finalX, y: finalY });
    });

  const tapGesture = Gesture.Tap().onEnd(() => { runOnJS(onPress)(); });
  const composed = Gesture.Exclusive(panGesture, tapGesture);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolatedX.value - 15 }, { translateY: interpolatedY.value - 15 }, { scale: isDragging.value ? 1.2 : withSpring(1) }],
    zIndex: isSelected || isDragging.value ? 100 : 1
  }));

  const spotlightStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSelected ? 0.3 : 0),
    transform: [{ scale: withSpring(isSelected ? 2.5 : 1) }]
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.dancerNode, style]}>
        <Animated.View style={[styles.spotlight, spotlightStyle]} />
        <View style={[styles.dancerCircle, { backgroundColor: dancer.color, borderColor: isSelected ? '#FFF' : 'rgba(0,0,0,0.3)' }]}>
          <Text style={styles.dancerInitial}>{index + 1}</Text>
        </View>
        <Text style={[styles.dancerName, { color: isSelected ? '#FFF' : '#888' }]} numberOfLines={1}>{dancer.name}</Text>
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
  
  // Data States
  const [dancers, setDancers] = useState<Dancer[]>(formation?.data?.dancers || []);
  const [scenes, setScenes] = useState<FormationScene[]>(formation?.data?.scenes || []);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(formation?.data?.timeline || []);
  const [settings, setSettings] = useState<FormationSettings>(formation?.settings || { gridRows: 10, gridCols: 10, stageDirection: 'top', snapToGrid: true });
  
  // History for Undo
  const [history, setHistory] = useState<FormationScene[][]>([]);

  // UI States
  const [mode, setMode] = useState<'setup' | 'play'>('setup');
  const [activeSceneId, setActiveSceneId] = useState<string | null>(formation?.data?.scenes?.[0]?.id || null);
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const [showDancerEditor, setShowDancerEdit] = useState(false);
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [showSceneEditor, setShowSceneEditor] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [inputBuffer, setInputName] = useState('');

  // Audio
  const player = useAudioPlayer(formation?.audioUrl || '');
  const audioStatus = useAudioPlayerStatus(player);
  const currentTimeMs = useSharedValue(0);
  const [currentTimeUI, setCurrentTimeUI] = useState(0);

  useEffect(() => {
    if (audioStatus.currentTime !== undefined) {
      const ms = audioStatus.currentTime * 1000;
      currentTimeMs.value = ms;
      setCurrentTimeUI(ms);
    }
  }, [audioStatus.currentTime]);

  const activeScene = useMemo(() => scenes.find(s => s.id === activeSceneId), [scenes, activeSceneId]);
  const activeScenePositions = useMemo(() => activeScene?.positions || {}, [activeScene]);

  // Methods
  const pushHistory = () => {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(scenes))]); // Limit to 20
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setScenes(prev);
    setHistory(history.slice(0, -1));
  };

  const handleDragEnd = (dancerId: string, pos: Position) => {
    if (mode !== 'setup' || !activeSceneId) return;
    pushHistory();
    setScenes(prev => prev.map(s => s.id === activeSceneId ? {
      ...s, positions: { ...s.positions, [dancerId]: pos }
    } : s));
  };

  const onAddDancer = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newDancer: Dancer = {
      id: newId,
      name: `댄서 ${dancers.length + 1}`,
      color: COLORS[dancers.length % COLORS.length]
    };
    setDancers([...dancers, newDancer]);
    setScenes(prev => prev.map(s => ({
      ...s, positions: { ...s.positions, [newId]: { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 } }
    })));
  };

  const onAddScene = (name: string) => {
    const newId = Math.random().toString(36).substr(2, 9);
    const lastScene = scenes[scenes.length - 1];
    const newScene: FormationScene = {
      id: newId,
      name: name.trim() || `형성 ${scenes.length + 1}`,
      positions: lastScene ? { ...lastScene.positions } : {}
    };
    setScenes([...scenes, newScene]);
    setActiveSceneId(newId);
    setShowSceneEditor(false);
  };

  const applyPreset = (type: 'circle' | 'v' | 'line') => {
    if (!activeSceneId) return;
    pushHistory();
    const count = dancers.length;
    if (count === 0) return;

    const newPositions: Record<string, Position> = {};
    dancers.forEach((d, i) => {
      let x = STAGE_WIDTH / 2;
      let y = STAGE_HEIGHT / 2;

      if (type === 'circle') {
        const radius = STAGE_HEIGHT * 0.3;
        const angle = (i / count) * 2 * Math.PI;
        x += Math.cos(angle) * radius;
        y += Math.sin(angle) * radius;
      } else if (type === 'v') {
        const mid = (count - 1) / 2;
        const spacing = STAGE_WIDTH / (count + 1);
        x = (i + 1) * spacing;
        y = STAGE_HEIGHT * 0.3 + Math.abs(i - mid) * (STAGE_HEIGHT * 0.1);
      } else if (type === 'line') {
        const spacing = STAGE_WIDTH / (count + 1);
        x = (i + 1) * spacing;
        y = STAGE_HEIGHT / 2;
      }
      newPositions[d.id] = { x, y };
    });

    setScenes(prev => prev.map(s => s.id === activeSceneId ? { ...s, positions: newPositions } : s));
    setShowPresets(false);
  };

  const toggleTimelinePoint = () => {
    if (!activeSceneId) return;
    const time = Math.floor(currentTimeMs.value / 100) * 100;
    setTimeline(prev => {
      const existingIdx = prev.findIndex(e => Math.abs(e.timestampMillis - time) < 50);
      if (existingIdx >= 0) {
        const newTimeline = [...prev];
        newTimeline[existingIdx] = { ...newTimeline[existingIdx], sceneId: activeSceneId };
        return newTimeline;
      }
      return [...prev, { id: Math.random().toString(36).substr(2, 9), timestampMillis: time, sceneId: activeSceneId }]
        .sort((a, b) => a.timestampMillis - b.timestampMillis);
    });
  };

  const handleSave = async () => {
    try {
      await updateFormation(formationId!, {
        settings,
        data: { dancers, scenes, timeline }
      });
      Alert.alert('저장 완료', '작업한 동선이 저장되었습니다.');
    } catch (e: any) { Alert.alert('오류', e.message); }
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const ds = Math.floor((ms % 1000) / 100);
    return `${m}:${s.toString().padStart(2, '0')}.${ds}`;
  };

  const scrubberGesture = Gesture.Pan().onUpdate((e) => {
    const progress = Math.max(0, Math.min(1, e.x / width));
    runOnJS(player.seek)(progress * (audioStatus.duration || 60));
  });

  if (!formation) return null;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: '#0A0A0A' }]}>
      {/* --- Top Navbar --- */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => { player.pause(); router.back(); }} style={styles.topBtn}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>{formation.title}</Text>
          <View style={styles.modeCapsule}>
            <TouchableOpacity onPress={() => { player.pause(); setMode('setup'); }} style={[styles.modeTab, mode === 'setup' && styles.activeModeTab]}>
              <Text style={[styles.modeTabText, mode === 'setup' && styles.activeModeTabText]}>디자인</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode('play')} style={[styles.modeTab, mode === 'play' && styles.activeModeTab]}>
              <Text style={[styles.modeTabText, mode === 'play' && styles.activeModeTabText]}>플레이</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity onPress={handleSave} style={styles.topBtn}>
          <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 16 }}>저장</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled={false}>
        {/* --- Setup Scene Bar --- */}
        <View style={styles.scenesBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scenesScroll}>
            {scenes.map((s, i) => (
              <TouchableOpacity 
                key={s.id} 
                style={[styles.scenePill, activeSceneId === s.id && { backgroundColor: theme.primary }]}
                onPress={() => { setActiveSceneId(s.id); setMode('setup'); }}
              >
                <Text style={[styles.scenePillText, activeSceneId === s.id && { color: '#000' }]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addSceneBtn} onPress={() => setShowSceneEditor(true)}>
              <Ionicons name="add" size={20} color="#FFF" />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* --- Stage Designer --- */}
        <View style={styles.stageContainer}>
          <View style={styles.stageHeader}>
            <Text style={styles.stageDirectionLabel}>{settings.stageDirection === 'top' ? 'BACKSTAGE' : 'AUDIENCE'}</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.historyBtn} onPress={handleUndo} disabled={history.length === 0}>
              <Ionicons name="arrow-undo" size={20} color={history.length > 0 ? '#FFF' : '#444'} />
            </TouchableOpacity>
          </View>

          <View style={[styles.stage, { borderColor: 'rgba(255,255,255,0.1)' }]}>
            <LinearGradient colors={['#1A1A1A', '#111']} style={StyleSheet.absoluteFill} />
            {/* Grid */}
            <View style={styles.gridLayer}>
              {Array.from({length: settings.gridCols + 1}).map((_, i) => (
                <View key={`v-${i}`} style={[styles.gridV, { left: `${(i/settings.gridCols)*100}%`, backgroundColor: i === Math.floor(settings.gridCols/2) ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)' }]} />
              ))}
              {Array.from({length: settings.gridRows + 1}).map((_, i) => (
                <View key={`h-${i}`} style={[styles.gridH, { top: `${(i/settings.gridRows)*100}%`, backgroundColor: i === Math.floor(settings.gridRows/2) ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)' }]} />
              ))}
            </View>

            {/* Dancers */}
            {dancers.map((d, i) => (
              <DancerNode 
                key={d.id} index={i} dancer={d} currentTimeMs={currentTimeMs} scenes={scenes} timeline={timeline}
                onDragEnd={handleDragEnd} isSelected={selectedDancerId === d.id} onPress={() => { setSelectedDancerId(d.id); setShowDancerEdit(true); }}
                mode={mode} activeScenePositions={activeScenePositions} settings={settings}
              />
            ))}
          </View>
          <Text style={styles.stageDirectionLabel}>{settings.stageDirection === 'top' ? 'AUDIENCE' : 'BACKSTAGE'}</Text>
        </View>

        {/* --- Playback Area --- */}
        <View style={styles.playbackArea}>
          <View style={styles.playbackHeader}>
            <View style={styles.timeInfo}>
              <Text style={styles.timeMain}>{formatTime(currentTimeUI)}</Text>
              <Text style={styles.timeSub}> / {formatTime(audioStatus.duration * 1000 || 0)}</Text>
            </View>
            <TouchableOpacity style={[styles.actionBtnSecondary, { borderColor: theme.primary }]} onPress={toggleTimelinePoint}>
              <Ionicons name="pin" size={16} color={theme.primary} />
              <Text style={{ color: theme.primary, marginLeft: 6, fontWeight: 'bold', fontSize: 12 }}>배치</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mainPlayerRow}>
            <TouchableOpacity style={styles.miniCtrl} onPress={() => player.seek(audioStatus.currentTime - 2)}>
              <MaterialCommunityIcons name="rewind-2" size={28} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                if (audioStatus.playing) player.pause();
                else { setMode('play'); player.play(); }
              }} 
              style={[styles.bigPlayBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name={audioStatus.playing ? "pause" : "play"} size={36} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniCtrl} onPress={() => player.seek(audioStatus.currentTime + 2)}>
              <MaterialCommunityIcons name="fast-forward-2" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Draggable Scrubber */}
          <GestureDetector gesture={scrubberGesture}>
            <View style={styles.scrubberContainer}>
              <View style={[styles.scrubberTrack, { backgroundColor: '#222' }]} />
              <View style={[styles.scrubberProgress, { width: `${(audioStatus.currentTime / (audioStatus.duration || 1)) * 100}%`, backgroundColor: theme.primary }]} />
              
              {timeline.map(entry => (
                <TouchableOpacity 
                  key={entry.id} 
                  style={[styles.kfMarker, { left: `${(entry.timestampMillis / ((audioStatus.duration || 60) * 1000)) * 100}%` }]}
                  onPress={() => { player.seek(entry.timestampMillis / 1000); setActiveSceneId(entry.sceneId); setMode('setup'); }}
                >
                  <View style={[styles.kfDot, { backgroundColor: theme.primary }]} />
                </TouchableOpacity>
              ))}
            </View>
          </GestureDetector>
        </View>

        {/* --- Utility Toolbar --- */}
        <View style={[styles.utilityToolbar, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity style={styles.utilBtn} onPress={onAddDancer}>
            <Feather name="plus-circle" size={24} color="#FFF" />
            <Text style={styles.utilText}>댄서추가</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilBtn} onPress={() => setShowPresets(true)}>
            <MaterialCommunityIcons name="auto-fix" size={24} color="#FFF" />
            <Text style={styles.utilText}>자동배치</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilBtn} onPress={() => setShowStageSettings(true)}>
            <Feather name="settings" size={24} color="#FFF" />
            <Text style={styles.utilText}>무대설정</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* --- Modals --- */}
      
      {/* Dancer Property Sheet */}
      <Modal visible={showDancerEditor} transparent animationType="slide">
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowDancerEdit(false)}>
          <View style={[styles.sheet, { backgroundColor: '#1A1A1A' }]}>
            <View style={styles.dragHandle} />
            <Text style={styles.sheetTitle}>댄서 프로필</Text>
            {selectedDancerId && (
              <View style={{ gap: 20 }}>
                <TextInput 
                  style={[styles.sheetInput, { borderBottomColor: theme.primary }]}
                  value={dancers.find(d => d.id === selectedDancerId)?.name}
                  onChangeText={(val) => setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, name: val } : d))}
                  placeholder="이름 입력" placeholderTextColor="#555"
                />
                <View style={styles.colorPalette}>
                  {COLORS.map(c => (
                    <TouchableOpacity 
                      key={c} 
                      style={[styles.colorChip, { backgroundColor: c }, dancers.find(d => d.id === selectedDancerId)?.color === c && { borderWidth: 3, borderColor: '#FFF' }]} 
                      onPress={() => setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, color: c } : d))}
                    />
                  ))}
                </View>
                <TouchableOpacity 
                  style={styles.dangerBtn}
                  onPress={() => {
                    setDancers(dancers.filter(d => d.id !== selectedDancerId));
                    setScenes(prev => prev.map(s => { const n = {...s.positions}; delete n[selectedDancerId]; return {...s, positions: n}; }));
                    setSelectedDancerId(null);
                    setShowDancerEdit(false);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF4444" />
                  <Text style={{ color: '#FF4444', fontWeight: 'bold', marginLeft: 8 }}>이 댄서 삭제</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Formation Presets */}
      <Modal visible={showPresets} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: '#1E1E1E' }]}>
            <Text style={styles.modalTitle}>기본 대형 프리셋</Text>
            <Text style={styles.modalDesc}>현재 선택된 형성({activeScene?.name})에 대형을 적용합니다.</Text>
            <View style={styles.presetGrid}>
              <TouchableOpacity style={styles.presetItem} onPress={() => applyPreset('circle')}>
                <MaterialCommunityIcons name="circle-outline" size={32} color={theme.primary} />
                <Text style={styles.presetLabel}>원형</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetItem} onPress={() => applyPreset('v')}>
                <MaterialCommunityIcons name="vector-triangle" size={32} color={theme.primary} />
                <Text style={styles.presetLabel}>V자형</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetItem} onPress={() => applyPreset('line')}>
                <MaterialCommunityIcons name="minus" size={32} color={theme.primary} />
                <Text style={styles.presetLabel}>일자형</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShowPresets(false)} style={styles.modalCloseBtn}><Text style={{ color: '#888' }}>닫기</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Stage Settings */}
      <Modal visible={showStageSettings} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: '#1E1E1E' }]}>
            <Text style={styles.modalTitle}>무대 환경 설정</Text>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>격자 스냅</Text>
              <TouchableOpacity onPress={() => setSettings({...settings, snapToGrid: !settings.snapToGrid})}>
                <Ionicons name={settings.snapToGrid ? "checkbox" : "square-outline"} size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>무대 앞 방향</Text>
              <TouchableOpacity style={styles.togglePill} onPress={() => setSettings({...settings, stageDirection: settings.stageDirection === 'top' ? 'bottom' : 'top'})}>
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 12 }}>{settings.stageDirection === 'top' ? '상단' : '하단'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.gridConfig}>
              <Text style={styles.labelSmall}>격자 칸수 (가로 x 세로)</Text>
              <View style={styles.rowCenter}>
                <TextInput style={styles.numInput} keyboardType="numeric" value={settings.gridCols.toString()} onChangeText={v => setSettings({...settings, gridCols: parseInt(v) || 1})} />
                <Text style={{ color: '#FFF', marginHorizontal: 10 }}>x</Text>
                <TextInput style={styles.numInput} keyboardType="numeric" value={settings.gridRows.toString()} onChangeText={v => setSettings({...settings, gridRows: parseInt(v) || 1})} />
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowStageSettings(false)} style={[styles.doneBtn, { backgroundColor: theme.primary }]}><Text style={{ fontWeight: 'bold' }}>저장</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Scene Modal */}
      <Modal visible={showSceneEditor} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: '#1E1E1E' }]}>
            <Text style={styles.modalTitle}>새 대형 형성</Text>
            <TextInput style={styles.modalInput} placeholder="예: 코러스 1" placeholderTextColor="#555" onChangeText={setInputName} autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowSceneEditor(false)}><Text style={{ color: '#AAA' }}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => onAddScene(inputBuffer)}><Text style={{ color: theme.primary, fontWeight: 'bold' }}>생성</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 15, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  topBtn: { padding: 10 },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle: { color: '#FFF', fontSize: 14, opacity: 0.6, marginBottom: 6 },
  modeCapsule: { flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 20, padding: 3, borderWidth: 1, borderColor: '#333' },
  modeTab: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 16 },
  activeModeTab: { backgroundColor: '#333' },
  modeTabText: { color: '#666', fontSize: 12, fontWeight: 'bold' },
  activeModeTabText: { color: '#FFF' },

  scenesBar: { height: 50, backgroundColor: '#000' },
  scenesScroll: { paddingHorizontal: 15, alignItems: 'center' },
  scenePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWeight: 1, borderColor: '#333', marginRight: 10 },
  scenePillText: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  addSceneBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A1A1A', borderStyle: 'dashed', borderWidth: 1, borderColor: '#444', justifyContent: 'center', alignItems: 'center' },

  stageContainer: { alignItems: 'center', paddingVertical: 10 },
  stageHeader: { width: STAGE_WIDTH, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stageDirectionLabel: { color: '#444', fontSize: 9, fontWeight: 'bold', letterSpacing: 3, paddingVertical: 5 },
  historyBtn: { padding: 5 },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, borderRadius: 12, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1 },

  dancerNode: { position: 'absolute', alignItems: 'center', width: 60, marginLeft: -30 },
  spotlight: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF', top: 0 },
  dancerCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  dancerInitial: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  dancerLabelContainer: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  dancerLabelText: { color: '#FFF', fontSize: 9, fontWeight: '600' },

  playbackArea: { paddingHorizontal: 20, paddingTop: 10 },
  playbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  timeInfo: { flexDirection: 'row', alignItems: 'baseline' },
  timeMain: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  timeSub: { color: '#555', fontSize: 14 },
  actionBtnSecondary: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  mainPlayerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40, marginBottom: 20 },
  bigPlayBtn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  miniCtrl: { opacity: 0.8 },

  scrubberContainer: { height: 30, justifyContent: 'center', position: 'relative' },
  scrubberTrack: { height: 4, borderRadius: 2, width: '100%' },
  scrubberProgress: { height: 4, borderRadius: 2, position: 'absolute' },
  kfMarker: { position: 'absolute', width: 20, height: 20, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  kfDot: { width: 6, height: 6, borderRadius: 3 },

  utilityToolbar: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#222', backgroundColor: '#000', paddingTop: 10 },
  utilBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  utilText: { color: '#666', fontSize: 10, marginTop: 4 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  dragHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#333', alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  sheetInput: { borderBottomWidth: 1, color: '#FFF', fontSize: 20, paddingVertical: 10, marginBottom: 20 },
  colorPalette: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 30 },
  colorChip: { width: 36, height: 36, borderRadius: 18 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 },
  modalBox: { padding: 25, borderRadius: 24 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  modalDesc: { color: '#666', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  presetGrid: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 },
  presetItem: { alignItems: 'center', gap: 8 },
  presetLabel: { color: '#AAA', fontSize: 12 },
  modalCloseBtn: { alignSelf: 'center', marginTop: 10 },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  settingLabel: { color: '#AAA', fontSize: 15 },
  togglePill: { backgroundColor: theme?.primary || '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  gridConfig: { marginTop: 10, gap: 15 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  numInput: { backgroundColor: '#000', color: '#FFF', width: 60, padding: 10, borderRadius: 10, textAlign: 'center' },
  doneBtn: { marginTop: 30, padding: 16, borderRadius: 16, alignItems: 'center' },
  modalInput: { backgroundColor: '#000', color: '#FFF', padding: 15, borderRadius: 12, marginBottom: 20, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 }
});
