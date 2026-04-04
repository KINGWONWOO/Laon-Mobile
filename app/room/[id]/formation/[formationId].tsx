import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Modal, Alert, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { Dancer, FormationScene, TimelineEntry, Position, Formation } from '../../../../types';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, useDerivedValue, SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const STAGE_WIDTH = width - 40;
const STAGE_HEIGHT = STAGE_WIDTH * 0.7;
const GRID_SIZE = 10; // 10x10 grid

const ACCENT_COLOR = '#FF3366'; // Pink accent from reference

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
  activeScenePositions,
  index
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
      nx = Math.max(12, Math.min(STAGE_WIDTH - 12, nx));
      ny = Math.max(12, Math.min(STAGE_HEIGHT - 12, ny));
      dragX.value = nx;
      dragY.value = ny;
    })
    .onEnd(() => {
      isDragging.value = false;
      // Snap to Grid calculation
      const stepX = STAGE_WIDTH / GRID_SIZE;
      const stepY = STAGE_HEIGHT / GRID_SIZE;
      const snappedX = Math.round(dragX.value / stepX) * stepX;
      const snappedY = Math.round(dragY.value / stepY) * stepY;
      runOnJS(onDragEnd)(dancer.id, { x: snappedX, y: snappedY });
    });

  const tapGesture = Gesture.Tap().onEnd(() => { runOnJS(onPress)(); });
  const composed = Gesture.Exclusive(panGesture, tapGesture);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolatedX.value - 12 }, { translateY: interpolatedY.value - 12 }, { scale: isDragging.value ? 1.2 : 1 }],
    zIndex: isSelected || isDragging.value ? 100 : 1
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.dancerNodeWrapper, style]}>
        <View style={[styles.dancerCircle, { backgroundColor: dancer.color || ACCENT_COLOR, borderColor: isSelected ? '#FFF' : 'rgba(0,0,0,0.3)' }]}>
          <Text style={styles.dancerNumber}>{index + 1}</Text>
        </View>
        <Text style={[styles.dancerName, { color: isSelected ? '#FFF' : '#BBB' }]} numberOfLines={1}>{dancer.name}</Text>
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
  const [showSettings, setShowSettings] = useState(false);
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
    const colors = ['#FF3366', '#4ECDC4', '#45B7D1', '#F7D794', '#A06CD5', '#FF9F43'];
    const newDancer: Dancer = { id: Math.random().toString(36).substr(2, 9), name: newInputName.trim(), color: colors[dancers.length % colors.length] };
    setDancers([...dancers, newDancer]);
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
      Alert.alert('저장 완료', '서버에 반영되었습니다.');
    } catch (e: any) { Alert.alert('오류', e.message); }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  };

  if (!formation) return null;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: '#121212' }]}>
      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => { player.pause(); router.back(); }} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{formation.title}</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerIcon}>
          <Ionicons name="settings-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled={false}>
        {/* Stage Area */}
        <View style={styles.stageSection}>
          <Text style={styles.stageLabel}>무대 뒤에서</Text>
          
          <View style={[styles.stage, { borderColor: ACCENT_COLOR }]}>
            {/* Grid */}
            <View style={styles.gridOverlay}>
              {Array.from({length: GRID_SIZE}).map((_, i) => <View key={`v-${i}`} style={[styles.gridLineV, { left: `${(i/GRID_SIZE)*100}%` }]} />)}
              {Array.from({length: GRID_SIZE}).map((_, i) => <View key={`h-${i}`} style={[styles.gridLineH, { top: `${(i/GRID_SIZE)*100}%` }]} />)}
            </View>
            
            {/* Center Cross */}
            <View style={styles.centerMarker}>
              <Ionicons name="close" size={20} color={ACCENT_COLOR} />
            </View>

            {/* Dancers */}
            {dancers.map((d, i) => (
              <DancerNode 
                key={d.id} index={i} dancer={d} currentTimeMs={currentTimeMs} scenes={scenes} timeline={timeline}
                onDragEnd={handleDragEnd} isSelected={selectedDancerId === d.id} onPress={() => setSelectedDancerId(d.id)}
                mode={mode} activeScenePositions={activeScenePositions}
              />
            ))}
          </View>
          
          <Text style={styles.stageLabel}>청중</Text>
        </View>

        {/* Quick Actions (Floating) */}
        <View style={styles.floatingActions}>
          <View style={styles.historyGroup}>
            <TouchableOpacity style={styles.historyBtn}><Ionicons name="arrow-undo" size={20} color="#AAA" /></TouchableOpacity>
            <TouchableOpacity style={styles.historyBtn}><Ionicons name="arrow-redo" size={20} color="#AAA" /></TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.musicFloatBtn, { backgroundColor: ACCENT_COLOR }]}>
            <Ionicons name="musical-notes" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Formation Selection Area */}
        <View style={styles.formationNav}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.formationScroll}>
            {scenes.map((s, idx) => (
              <TouchableOpacity 
                key={s.id} 
                style={[styles.formationTab, activeSceneId === s.id && styles.activeFormationTab]}
                onPress={() => { setActiveSceneId(s.id); setMode('setup'); }}
              >
                <Text style={[styles.formationTabText, activeSceneId === s.id && styles.activeFormationTabText]}>
                  형성 {idx + 1}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addFormationBtn} onPress={() => setShowAddScene(true)}>
              <Ionicons name="add" size={20} color="#FFF" />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Timeline or Toolbar based on mode */}
        <View style={[styles.bottomDock, { paddingBottom: insets.bottom + 10 }]}>
          {mode === 'play' ? (
            <View style={styles.playModeUI}>
              <View style={styles.playbackBar}>
                <TouchableOpacity onPress={togglePlay} style={styles.playPauseBtn}>
                  <Ionicons name={status.playing ? "pause" : "play"} size={32} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.playTimeInfo}>
                  <Text style={styles.timePrimary}>{formatTime(currentTimeUI)}</Text>
                  <Text style={styles.timeSecondary}> / {formatTime(status.duration * 1000 || 0)}</Text>
                </View>
                <TouchableOpacity style={styles.addTimelinePoint} onPress={addTimelineEntry}>
                  <Ionicons name="add-circle" size={24} color={ACCENT_COLOR} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.visualTimeline}>
                <View style={styles.timelineBaseLine} />
                <View style={[styles.timelineProgressLine, { width: `${(status.currentTime / (status.duration || 1)) * 100}%`, backgroundColor: ACCENT_COLOR }]} />
                {timeline.map(entry => (
                  <View key={entry.id} style={[styles.timelineMark, { left: `${(entry.timestampMillis / ((status.duration || 60) * 1000)) * 100}%` }]}>
                    <View style={[styles.timelineMarkNode, { backgroundColor: ACCENT_COLOR }]} />
                    <Text style={styles.timelineMarkText}>{scenes.findIndex(s => s.id === entry.sceneId) + 1}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.setupModeUI}>
              <View style={styles.toolRow}>
                <TouchableOpacity style={styles.toolItem} onPress={() => setShowAddDancer(true)}>
                  <MaterialCommunityIcons name="account-group" size={24} color="#FFF" />
                  <Text style={styles.toolLabel}>댄서</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={() => setMode('play')}>
                  <MaterialCommunityIcons name="play-circle-outline" size={24} color="#FFF" />
                  <Text style={styles.toolLabel}>플레이</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={saveFormation}>
                  <Ionicons name="cloud-upload-outline" size={24} color="#FFF" />
                  <Text style={styles.toolLabel}>저장</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={() => {
                  if (selectedDancerId) {
                    setDancers(dancers.filter(d => d.id !== selectedDancerId));
                    setScenes(prev => prev.map(s => { const n = {...s.positions}; delete n[selectedDancerId]; return {...s, positions: n}; }));
                    setSelectedDancerId(null);
                  } else Alert.alert('인원 삭제', '무대에서 인원을 선택해주세요.');
                }}>
                  <Ionicons name="trash-outline" size={24} color={ACCENT_COLOR} />
                  <Text style={[styles.toolLabel, { color: ACCENT_COLOR }]}>삭제</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals (Dancer, Scene, Settings) */}
      <Modal visible={showAddDancer} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#1E1E1E' }]}>
            <Text style={styles.modalTitle}>새 댄서 추가</Text>
            <TextInput style={styles.modalInput} value={newInputName} onChangeText={setNewInputName} placeholder="이름" placeholderTextColor="#666" autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowAddDancer(false)}><Text style={{ color: '#AAA' }}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={addDancer}><Text style={{ color: ACCENT_COLOR, fontWeight: 'bold' }}>추가</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddScene} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#1E1E1E' }]}>
            <Text style={styles.modalTitle}>새 대형 이름</Text>
            <TextInput style={styles.modalInput} value={newInputName} onChangeText={setNewInputName} placeholder="예: 벌스 1" placeholderTextColor="#666" autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowAddScene(false)}><Text style={{ color: '#AAA' }}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={addScene}><Text style={{ color: ACCENT_COLOR, fontWeight: 'bold' }}>생성</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15 },
  headerIcon: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', flex: 1, textAlign: 'center' },
  saveBtn: { paddingHorizontal: 15 },

  stageSection: { alignItems: 'center', paddingVertical: 20 },
  stageLabel: { color: '#888', fontSize: 12, marginVertical: 10, fontWeight: '600' },
  stage: { 
    width: STAGE_WIDTH, 
    height: STAGE_HEIGHT, 
    backgroundColor: '#1A1A1A', 
    borderWidth: 2, 
    borderRadius: 20, 
    overflow: 'hidden',
    position: 'relative',
    shadowColor: ACCENT_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10
  },
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  centerMarker: { position: 'absolute', top: STAGE_HEIGHT/2 - 10, left: STAGE_WIDTH/2 - 10, opacity: 0.5 },

  dancerNodeWrapper: { position: 'absolute', alignItems: 'center', width: 60, marginLeft: -30 },
  dancerCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  dancerNumber: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  dancerName: { fontSize: 10, marginTop: 2, fontWeight: '500', width: 50, textAlign: 'center' },

  floatingActions: { position: 'absolute', right: 20, bottom: 240, alignItems: 'flex-end' },
  historyGroup: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15, flexDirection: 'row', padding: 5, marginBottom: 15 },
  historyBtn: { padding: 10 },
  musicFloatBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5 },

  formationNav: { height: 70, borderTopWidth: 1, borderTopColor: '#222' },
  formationScroll: { paddingHorizontal: 15, alignItems: 'center' },
  formationTab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#2A2A2A', marginRight: 10, borderWidth: 1, borderColor: '#333' },
  activeFormationTab: { backgroundColor: 'rgba(255, 51, 102, 0.2)', borderColor: ACCENT_COLOR },
  formationTabText: { color: '#AAA', fontWeight: 'bold', fontSize: 14 },
  activeFormationTabText: { color: ACCENT_COLOR },
  addFormationBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },

  bottomDock: { backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#222' },
  setupModeUI: { paddingVertical: 15 },
  toolRow: { flexDirection: 'row', justifyContent: 'space-around' },
  toolItem: { alignItems: 'center' },
  toolLabel: { color: '#888', fontSize: 11, marginTop: 5 },

  playModeUI: { padding: 15 },
  playbackBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  playPauseBtn: { marginRight: 15 },
  playTimeInfo: { flexDirection: 'row', alignItems: 'baseline' },
  timePrimary: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  timeSecondary: { color: '#666', fontSize: 12 },
  addTimelinePoint: { marginLeft: 'auto' },

  visualTimeline: { height: 40, justifyContent: 'center', position: 'relative' },
  timelineBaseLine: { height: 2, backgroundColor: '#333', width: '100%', borderRadius: 1 },
  timelineProgressLine: { height: 2, position: 'absolute', left: 0 },
  timelineMark: { position: 'absolute', alignItems: 'center', top: 5 },
  timelineMarkNode: { width: 8, height: 8, borderRadius: 4 },
  timelineMarkText: { color: '#888', fontSize: 10, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 25, borderRadius: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  modalInput: { backgroundColor: '#000', color: '#FFF', padding: 15, borderRadius: 12, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 }
});
