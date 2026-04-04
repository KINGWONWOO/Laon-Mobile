import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Modal, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { Dancer, FormationScene, TimelineEntry, Position, Formation } from '../../../../types';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, useDerivedValue, SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const { width, height } = Dimensions.get('window');
const STAGE_WIDTH = width - 40;
const STAGE_HEIGHT = STAGE_WIDTH * 0.8;

type EditorMode = 'setup' | 'play';

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
  activeScenePositions
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
}) => {
  const isDragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Position interpolation for PLAY mode
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
      runOnJS(onDragEnd)(dancer.id, { x: dragX.value, y: dragY.value });
    });

  const tapGesture = Gesture.Tap().onEnd(() => { runOnJS(onPress)(); });
  const composed = Gesture.Exclusive(panGesture, tapGesture);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolatedX.value - 15 }, { translateY: interpolatedY.value - 15 }, { scale: isDragging.value ? 1.2 : 1 }],
    zIndex: isSelected || isDragging.value ? 100 : 1
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.dancerNode, { backgroundColor: dancer.color, borderColor: isSelected ? '#FFF' : '#000', borderWidth: isSelected ? 3 : 1 }, style]}>
        <Text style={styles.dancerInitial}>{dancer.name[0]}</Text>
      </Animated.View>
    </GestureDetector>
  );
};

// --- Main Editor ---
export default function FormationEditorScreen() {
  const { id, formationId } = useGlobalSearchParams<{ id: string, formationId: string }>();
  const { formations, updateFormation, theme, getUserById } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const formation = formations.find(f => f.id === formationId);
  
  // States
  const [mode, setMode] = useState<EditorMode>('setup');
  const [dancers, setDancers] = useState<Dancer[]>(formation?.data?.dancers || []);
  const [scenes, setScenes] = useState<FormationScene[]>(formation?.data?.scenes || []);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(formation?.data?.timeline || []);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(formation?.data?.scenes?.[0]?.id || null);
  
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const [showAddDancer, setShowAddDancer] = useState(false);
  const [showAddScene, setShowAddScene] = useState(false);
  const [newInputName, setNewInputName] = useState('');

  // Audio
  const player = useAudioPlayer(formation?.audioUrl || '');
  const status = useAudioPlayerStatus(player);
  const currentTimeMs = useSharedValue(0);
  const [currentTimeUI, setCurrentTimeUI] = useState(0);

  useEffect(() => {
    if (status.currentTime) {
      const ms = status.currentTime * 1000;
      currentTimeMs.value = ms;
      setCurrentTimeUI(ms);
    }
  }, [status.currentTime]);

  const togglePlay = () => {
    if (status.playing) player.pause();
    else {
      setMode('play');
      player.play();
    }
  };

  const activeScene = useMemo(() => scenes.find(s => s.id === activeSceneId), [scenes, activeSceneId]);
  const activeScenePositions = useMemo(() => activeScene?.positions || {}, [activeScene]);

  // Handlers
  const handleDragEnd = (dancerId: string, pos: Position) => {
    if (mode !== 'setup' || !activeSceneId) return;
    setScenes(prev => prev.map(s => s.id === activeSceneId ? {
      ...s, positions: { ...s.positions, [dancerId]: pos }
    } : s));
  };

  const addDancer = () => {
    if (!newInputName.trim()) return;
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7D794', '#A06CD5', '#FF9F43'];
    const newDancer: Dancer = { id: Math.random().toString(36).substr(2, 9), name: newInputName.trim(), color: colors[dancers.length % colors.length] };
    setDancers([...dancers, newDancer]);
    
    // Add to all scenes
    setScenes(prev => prev.map(s => ({
      ...s, positions: { ...s.positions, [newDancer.id]: { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 } }
    })));

    setNewInputName('');
    setShowAddDancer(false);
  };

  const addScene = () => {
    if (!newInputName.trim()) return;
    const lastScene = scenes[scenes.length - 1];
    const newScene: FormationScene = {
      id: Math.random().toString(36).substr(2, 9),
      name: newInputName.trim(),
      positions: lastScene ? { ...lastScene.positions } : {}
    };
    setScenes([...scenes, newScene]);
    setActiveSceneId(newScene.id);
    setNewInputName('');
    setShowAddScene(false);
  };

  const addTimelineEntry = () => {
    if (!activeSceneId) return;
    const time = Math.floor(currentTimeMs.value / 100) * 100;
    const newEntry: TimelineEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestampMillis: time,
      sceneId: activeSceneId
    };
    setTimeline(prev => [...prev, newEntry].sort((a, b) => a.timestampMillis - b.timestampMillis));
  };

  const saveFormation = async () => {
    try {
      await updateFormation(formationId!, { data: { dancers, scenes, timeline } });
      Alert.alert('성공', '동선이 저장되었습니다.');
    } catch (e: any) { Alert.alert('오류', e.message); }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  };

  if (!formation) return null;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => { player.pause(); router.back(); }} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{formation.title}</Text>
        <TouchableOpacity onPress={saveFormation} style={styles.saveBtn}>
          <Text style={{ color: theme.primary, fontWeight: 'bold' }}>저장</Text>
        </TouchableOpacity>
      </View>

      {/* Mode Switcher */}
      <View style={styles.modeSwitcher}>
        <TouchableOpacity onPress={() => { player.pause(); setMode('setup'); }} style={[styles.modeBtn, mode === 'setup' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}>
          <Text style={[styles.modeBtnText, { color: mode === 'setup' ? theme.primary : theme.textSecondary }]}>대형 편집 (SETUP)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('play')} style={[styles.modeBtn, mode === 'play' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}>
          <Text style={[styles.modeBtnText, { color: mode === 'play' ? theme.primary : theme.textSecondary }]}>동선 플레이 (PLAY)</Text>
        </TouchableOpacity>
      </View>

      {/* Scenes List (Horizontal) */}
      <View style={[styles.scenesContainer, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scenesScroll}>
          {scenes.map(s => (
            <TouchableOpacity 
              key={s.id} 
              style={[styles.sceneCard, { backgroundColor: activeSceneId === s.id ? theme.primary : theme.card, borderColor: theme.border }]}
              onPress={() => { setActiveSceneId(s.id); setMode('setup'); }}
            >
              <Text style={[styles.sceneCardText, { color: activeSceneId === s.id ? theme.background : theme.text }]} numberOfLines={1}>{s.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.addSceneBtn, { borderColor: theme.primary }]} onPress={() => setShowAddScene(true)}>
            <Ionicons name="add" size={20} color={theme.primary} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Stage */}
      <View style={styles.stageWrapper}>
        <View style={[styles.stage, { borderColor: theme.border }]}>
          <View style={styles.gridOverlay}>
            {Array.from({length: 10}).map((_, i) => <View key={`v-${i}`} style={[styles.gridV, { left: `${(i+1)*10}%`, borderColor: theme.border + '11' }]} />)}
            {Array.from({length: 8}).map((_, i) => <View key={`h-${i}`} style={[styles.gridH, { top: `${(i+1)*12.5}%`, borderColor: theme.border + '11' }]} />)}
          </View>
          {dancers.map(d => (
            <DancerNode 
              key={d.id} dancer={d} currentTimeMs={currentTimeMs} scenes={scenes} timeline={timeline}
              onDragEnd={handleDragEnd} isSelected={selectedDancerId === d.id} onPress={() => setSelectedDancerId(d.id)}
              mode={mode} activeScenePositions={activeScenePositions}
            />
          ))}
          <View style={styles.frontLabel}><Text style={{ color: theme.textSecondary, fontSize: 10, opacity: 0.5 }}>FRONT / AUDIENCE</Text></View>
        </View>
      </View>

      {/* Bottom Panel */}
      <View style={[styles.bottomPanel, { backgroundColor: theme.card, paddingBottom: insets.bottom + 10, borderTopColor: theme.border }]}>
        <View style={styles.playbackControls}>
          <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, { backgroundColor: theme.primary }]}>
            <Ionicons name={status.playing ? "pause" : "play"} size={28} color={theme.background} />
          </TouchableOpacity>
          <View style={styles.timeInfo}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>{formatTime(currentTimeUI)}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}> / {formatTime(status.duration * 1000 || 0)}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity 
            style={[styles.addKeyframeBtn, { backgroundColor: theme.primary + '22' }]} 
            onPress={addTimelineEntry}
            disabled={!activeSceneId}
          >
            <Ionicons name="location" size={16} color={theme.primary} />
            <Text style={{ color: theme.primary, fontSize: 12, fontWeight: 'bold', marginLeft: 5 }}>배치</Text>
          </TouchableOpacity>
        </View>

        {/* Timeline Scrubber */}
        <View style={styles.timelineScrubber}>
          <View style={[styles.timelineTrack, { backgroundColor: theme.border }]} />
          <View style={[styles.timelineFill, { backgroundColor: theme.primary, width: `${(status.currentTime / (status.duration || 1)) * 100}%` }]} />
          {timeline.map(entry => (
            <TouchableOpacity 
              key={entry.id} 
              style={[styles.timelinePoint, { left: `${(entry.timestampMillis / ((status.duration || 60) * 1000)) * 100}%` }]}
              onPress={() => {
                player.seek(entry.timestampMillis / 1000);
                setActiveSceneId(entry.sceneId);
              }}
            >
              <View style={[styles.timelinePointDot, { backgroundColor: theme.primary }]} />
              <Text style={styles.timelinePointLabel} numberOfLines={1}>
                {scenes.find(s => s.id === entry.sceneId)?.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: theme.border }]} onPress={() => setShowAddDancer(true)}>
            <Ionicons name="person-add" size={18} color={theme.text} />
            <Text style={{ color: theme.text, marginLeft: 8, fontSize: 13 }}>인원 추가</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: theme.border }]} onPress={() => {
            if (selectedDancerId) {
              setDancers(dancers.filter(d => d.id !== selectedDancerId));
              setScenes(prev => prev.map(s => {
                const newPos = { ...s.positions };
                delete newPos[selectedDancerId];
                return { ...s, positions: newPos };
              }));
              setSelectedDancerId(null);
            } else Alert.alert('팁', '무대에서 댄서를 터치하여 선택한 후 삭제하세요.');
          }}>
            <Ionicons name="trash" size={18} color={theme.error} />
            <Text style={{ color: theme.error, marginLeft: 8, fontSize: 13 }}>선택 삭제</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals */}
      <Modal visible={showAddDancer} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>댄서 이름</Text>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} value={newInputName} onChangeText={setNewInputName} placeholder="이름" placeholderTextColor="#888" autoFocus />
            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setShowAddDancer(false)}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={addDancer}><Text style={{ color: theme.primary, fontWeight: 'bold' }}>추가</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddScene} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>대형 이름</Text>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} value={newInputName} onChangeText={setNewInputName} placeholder="예: 1절 코러스" placeholderTextColor="#888" autoFocus />
            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setShowAddScene(false)}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={addScene}><Text style={{ color: theme.primary, fontWeight: 'bold' }}>생성</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 10, borderBottomWidth: 1 },
  iconBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  saveBtn: { padding: 10 },
  
  modeSwitcher: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)' },
  modeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  modeBtnText: { fontSize: 12, fontWeight: 'bold' },

  scenesContainer: { height: 60, borderBottomWidth: 1 },
  scenesScroll: { alignItems: 'center', paddingHorizontal: 15 },
  sceneCard: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, marginRight: 10, borderWidth: 1, maxWidth: 120 },
  sceneCardText: { fontSize: 12, fontWeight: '600' },
  addSceneBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },

  stageWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, borderWidth: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#080808', position: 'relative' },
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridV: { position: 'absolute', top: 0, bottom: 0, borderLeftWidth: 1 },
  gridH: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1 },
  frontLabel: { position: 'absolute', bottom: 5, width: '100%', alignItems: 'center' },

  dancerNode: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', position: 'absolute' },
  dancerInitial: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },

  bottomPanel: { padding: 15, borderTopWidth: 1 },
  playbackControls: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  playBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  timeInfo: { flexDirection: 'row', alignItems: 'baseline' },
  addKeyframeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },

  timelineScrubber: { height: 40, justifyContent: 'center', marginBottom: 15, position: 'relative' },
  timelineTrack: { height: 4, borderRadius: 2, width: '100%' },
  timelineFill: { height: 4, borderRadius: 2, position: 'absolute', left: 0 },
  timelinePoint: { position: 'absolute', alignItems: 'center', width: 60, marginLeft: -30, top: 0 },
  timelinePointDot: { width: 6, height: 12, borderRadius: 3, marginBottom: 4 },
  timelinePointLabel: { fontSize: 9, color: '#888' },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, marginHorizontal: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 25, borderRadius: 20 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 20 },
  input: { borderWidth: 1, padding: 12, borderRadius: 10, fontSize: 15 }
});
