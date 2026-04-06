import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Modal, Alert, ScrollView, ActivityIndicator, Pressable, FlatList, Platform, Image } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, MaterialIcons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { Dancer, FormationScene, TimelineEntry, Position, Formation, FormationSettings } from '../../../../types';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, useDerivedValue, SharedValue, withSpring, withTiming, interpolate, makeMutable } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const COLORS = ['#FF3366', '#FF9F43', '#F7D794', '#4ECDC4', '#45B7D1', '#A06CD5', '#1B9CFC', '#E056FD', '#686DE0', '#30336B'];

type EditorMode = 'create' | 'place'; // 대형 생성 | 대형 배치

const GUIDE_STEPS = [
  {
    title: '댄서 관리',
    description: '좌측 하단의 "댄서 추가" 버튼으로 멤버를 늘릴 수 있습니다. 생성된 댄서 노드를 탭하면 이름과 고유 색상을 변경하거나 삭제할 수 있습니다.',
    image: null
  },
  {
    title: '대형 생성 (Create Mode)',
    description: '하단의 "대형 목록"에서 대형을 선택하거나 추가(+)하세요. 무대 위 댄서들을 드래그하여 위치를 잡을 수 있습니다. 격자 설정을 통해 정밀한 배치가 가능합니다.',
    image: null
  },
  {
    title: '대형 배치 (Place Mode)',
    description: '음악을 재생하며 원하는 타이밍에 "배치" 버튼을 누르세요. 현재 선택된 대형이 해당 시점에 추가됩니다. 타임라인의 블록을 통해 순서와 길이를 조절하세요.',
    image: null
  },
  {
    title: '격자 및 무대 설정',
    description: '그리드 설정에서 격자 크기를 조절할 수 있습니다. 현재 격자 교차점뿐만 아니라 그 사이 중간 지점(네모 중앙)에도 자석처럼 착 달라붙어 더 세밀한 정렬이 가능합니다.',
    image: null
  },
  {
    title: '내보내기 및 공유',
    description: '작업이 완료되면 상단의 공유 버튼을 눌러보세요. 동선이 피드백 영상 형태로 변환되어 팀원들과 함께 보고 의견을 나눌 수 있습니다.',
    image: null
  }
];

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
  index,
  settings,
  createModeX,
  createModeY,
  stageWidth,
  stageHeight,
  cellSize,
  zoomLevel
}: { 
  dancer: Dancer; 
  currentTimeMs: SharedValue<number>; 
  scenes: FormationScene[];
  timeline: TimelineEntry[];
  onDragEnd: (id: string, pos: Position) => void;
  isSelected: boolean;
  onPress: () => void;
  mode: EditorMode;
  index: number;
  settings: FormationSettings;
  createModeX: SharedValue<number>;
  createModeY: SharedValue<number>;
  stageWidth: number;
  stageHeight: number;
  cellSize: number;
  zoomLevel: number;
}) => {
  const isDragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Position is stored as normalized 0~1 in shared values
  const interpolatedX = useDerivedValue(() => {
    if (isDragging.value) return dragX.value;
    if (mode === 'create') return createModeX.value;

    if (timeline.length === 0) return 0.5;
    const time = currentTimeMs.value;
    let prevEntry: TimelineEntry | null = null;
    let nextEntry: TimelineEntry | null = null;

    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].timestampMillis <= time) prevEntry = timeline[i];
      else { nextEntry = timeline[i]; break; }
    }

    if (!prevEntry) return scenes.find(s => s.id === timeline[0].sceneId)?.positions[dancer.id]?.x ?? 0.5;
    const prevScene = scenes.find(s => s.id === prevEntry!.sceneId);
    if (!prevScene) return 0.5;

    if (time <= prevEntry.timestampMillis + prevEntry.durationMillis) {
      return prevScene.positions[dancer.id]?.x ?? 0.5;
    }

    if (nextEntry) {
      const nextScene = scenes.find(s => s.id === nextEntry!.sceneId);
      if (!nextScene) return prevScene.positions[dancer.id]?.x ?? 0.5;
      const progress = (time - (prevEntry.timestampMillis + prevEntry.durationMillis)) / (nextEntry.timestampMillis - (prevEntry.timestampMillis + prevEntry.durationMillis));
      const sX = prevScene.positions[dancer.id]?.x ?? 0.5;
      const eX = nextScene.positions[dancer.id]?.x ?? 0.5;
      return sX + (eX - sX) * progress;
    }
    return prevScene.positions[dancer.id]?.x ?? 0.5;
  });

  const interpolatedY = useDerivedValue(() => {
    if (isDragging.value) return dragY.value;
    if (mode === 'create') return createModeY.value;

    if (timeline.length === 0) return 0.5;
    const time = currentTimeMs.value;
    let prevEntry: TimelineEntry | null = null;
    let nextEntry: TimelineEntry | null = null;

    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].timestampMillis <= time) prevEntry = timeline[i];
      else { nextEntry = timeline[i]; break; }
    }

    if (!prevEntry) return scenes.find(s => s.id === timeline[0].sceneId)?.positions[dancer.id]?.y ?? 0.5;
    const prevScene = scenes.find(s => s.id === prevEntry!.sceneId);
    if (!prevScene) return 0.5;

    if (time <= prevEntry.timestampMillis + prevEntry.durationMillis) {
      return prevScene.positions[dancer.id]?.y ?? 0.5;
    }

    if (nextEntry) {
      const nextScene = scenes.find(s => s.id === nextEntry!.sceneId);
      if (!nextScene) return prevScene.positions[dancer.id]?.y ?? 0.5;
      const progress = (time - (prevEntry.timestampMillis + prevEntry.durationMillis)) / (nextEntry.timestampMillis - (prevEntry.timestampMillis + prevEntry.durationMillis));
      const sY = prevScene.positions[dancer.id]?.y ?? 0.5;
      const eY = nextScene.positions[dancer.id]?.y ?? 0.5;
      return sY + (eY - sY) * progress;
    }
    return prevScene.positions[dancer.id]?.y ?? 0.5;
  });

  const nodeSize = 30 * zoomLevel;

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
      // Calculate change in normalized units
      let nx = startX.value + (e.translationX / stageWidth);
      let ny = startY.value + (e.translationY / stageHeight);
      
      // Clamp within stage
      nx = Math.max(0.02, Math.min(0.98, nx));
      ny = Math.max(0.02, Math.min(0.98, ny));
      
      dragX.value = nx;
      dragY.value = ny;
    })
    .onEnd(() => {
      isDragging.value = false;
      let fx = dragX.value;
      let fy = dragY.value;
      
      if (settings.snapToGrid) {
        // Snap logic in normalized coordinates
        const stepX = (1 / settings.gridCols) / 2;
        const stepY = (1 / settings.gridRows) / 2;
        fx = Math.round(fx / stepX) * stepX;
        fy = Math.round(fy / stepY) * stepY;
      }
      
      runOnJS(onDragEnd)(dancer.id, { x: fx, y: fy });
    });

  const tapGesture = Gesture.Tap().onEnd(() => { runOnJS(onPress)(); });
  const composed = Gesture.Exclusive(panGesture, tapGesture);

  const style = useAnimatedStyle(() => ({
    width: nodeSize,
    height: nodeSize + (15 * zoomLevel),
    transform: [
      { translateX: (interpolatedX.value * stageWidth) - (nodeSize / 2) },
      { translateY: (interpolatedY.value * stageHeight) - (nodeSize / 2) },
      { scale: isDragging.value ? 1.1 : withSpring(1) }
    ],
    zIndex: isSelected || isDragging.value ? 100 : 1
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.dancerNode, style]}>
        <View style={[
          styles.dancerCircle, 
          { 
            backgroundColor: dancer.color, 
            borderColor: isSelected ? '#FFF' : 'rgba(0,0,0,0.2)',
            width: nodeSize,
            height: nodeSize,
            borderRadius: nodeSize / 2,
            borderWidth: 2 * zoomLevel
          }
        ]}>
          <Text style={[styles.dancerInitial, { fontSize: 12 * zoomLevel }]}>{index + 1}</Text>
        </View>
        <Text style={[styles.dancerNameText, { color: isSelected ? '#FFF' : '#AAA', fontSize: 10 * zoomLevel, marginTop: 4 * zoomLevel }]} numberOfLines={1}>{dancer.name}</Text>
      </Animated.View>
    </GestureDetector>
  );
};

// --- Main Editor Screen ---
export default function FormationEditorScreen() {
  const { id, formationId } = useGlobalSearchParams<{ id: string, formationId: string }>();
  const { formations, updateFormation, publishFormationAsFeedback, theme } = useAppContext();
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

  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Calculate dynamic stage dimensions based on 100% zoom (fits screen width)
  const BASE_STAGE_SIZE = width - 40;
  const STAGE_WIDTH = BASE_STAGE_SIZE * zoomLevel;
  const STAGE_HEIGHT = (BASE_STAGE_SIZE * (settings.gridRows / settings.gridCols)) * zoomLevel;
  const CELL_SIZE = STAGE_WIDTH / settings.gridCols;

  // Smooth transition values for Create mode (stored as normalized 0~1)
  const dancerPositionsX = useRef<Record<string, SharedValue<number>>>({}).current;
  const dancerPositionsY = useRef<Record<string, SharedValue<number>>>({}).current;

  // Initialize shared values stably with normalized coordinates
  dancers.forEach(d => {
    if (!dancerPositionsX[d.id]) {
      const activePositions = scenes.find(s => s.id === activeSceneId)?.positions || {};
      dancerPositionsX[d.id] = makeMutable(activePositions[d.id]?.x ?? 0.5);
      dancerPositionsY[d.id] = makeMutable(activePositions[d.id]?.y ?? 0.5);
    }
  });

  useEffect(() => {
    if (activeSceneId && mode === 'create') {
      const activePositions = scenes.find(s => s.id === activeSceneId)?.positions || {};
      dancers.forEach(d => {
        if (dancerPositionsX[d.id]) {
          dancerPositionsX[d.id].value = withTiming(activePositions[d.id]?.x ?? 0.5, { duration: 500 });
          dancerPositionsY[d.id].value = withTiming(activePositions[d.id]?.y ?? 0.5, { duration: 500 });
        }
      });
    }
  }, [activeSceneId, mode]);

  // Modals
  const [showDancerSheet, setShowDancerSheet] = useState(false);
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [showSceneNameModal, setShowSceneNameModal] = useState(false);
  const [sceneModalMode, setSceneModalMode] = useState<'add' | 'rename'>('add');
  const [targetSceneId, setTargetSceneId] = useState<string | null>(null);
  const [inputName, setInputName] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [guideIndex, setGuideIndex] = useState(0);

  // Reset guide index on open
  useEffect(() => { if (showGuide) setGuideIndex(0); }, [showGuide]);

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
    // Position here is already normalized (0~1)
    setScenes(prev => prev.map(s => s.id === activeSceneId ? {
      ...s, positions: { ...s.positions, [dancerId]: pos }
    } : s));
    
    if (dancerPositionsX[dancerId]) {
      dancerPositionsX[dancerId].value = pos.x;
      dancerPositionsY[dancerId].value = pos.y;
    }
  };

  const addDancer = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newDancer: Dancer = { id: newId, name: `댄서 ${dancers.length + 1}`, color: COLORS[dancers.length % COLORS.length] };
    setDancers([...dancers, newDancer]);
    setScenes(prev => prev.map(s => ({ ...s, positions: { ...s.positions, [newId]: { x: 0.5, y: 0.5 } } })));
  };

  const handleSceneAction = () => {
    if (sceneModalMode === 'add') {
      const newId = Math.random().toString(36).substr(2, 9);
      const lastScene = scenes[scenes.length - 1];
      const newScene: FormationScene = { id: newId, name: inputName.trim() || `대형 ${scenes.length + 1}`, positions: lastScene ? { ...lastScene.positions } : {} };
      setScenes([...scenes, newScene]);
      setActiveSceneId(newId);
    } else if (sceneModalMode === 'rename' && targetSceneId) {
      setScenes(prev => prev.map(s => s.id === targetSceneId ? { ...s, name: inputName.trim() || s.name } : s));
    }
    setShowSceneNameModal(false);
    setInputName('');
    setTargetSceneId(null);
  };

  const deleteScene = (sid: string) => {
    if (scenes.length <= 1) return Alert.alert('삭제 불가', '최소 하나의 대형은 있어야 합니다.');
    Alert.alert('대형 삭제', '이 대형을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => {
        setScenes(prev => {
          const updated = prev.filter(s => s.id !== sid);
          if (activeSceneId === sid) setActiveSceneId(updated[0]?.id || null);
          return updated;
        });
        setTimeline(prev => prev.filter(e => e.sceneId !== sid));
      }}
    ]);
  };

  const duplicateScene = (sid: string) => {
    const sceneToDup = scenes.find(s => s.id === sid);
    if (!sceneToDup) return;
    const newId = Math.random().toString(36).substr(2, 9);
    const newScene: FormationScene = { ...sceneToDup, id: newId, name: `${sceneToDup.name} (복사)` };
    setScenes(prev => {
      const idx = prev.findIndex(s => s.id === sid);
      const updated = [...prev];
      updated.splice(idx + 1, 0, newScene);
      return updated;
    });
    setActiveSceneId(newId);
  };

  const openSceneMenu = (s: FormationScene) => {
    Alert.alert(s.name, '수행할 작업을 선택하세요.', [
      { text: '이름 변경', onPress: () => { setSceneModalMode('rename'); setTargetSceneId(s.id); setInputName(s.name); setShowSceneNameModal(true); }},
      { text: '대형 복사', onPress: () => duplicateScene(s.id) },
      { text: '삭제', style: 'destructive', onPress: () => deleteScene(s.id) },
      { text: '취소', style: 'cancel' }
    ]);
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
      Alert.alert('저장 완료', '로컬 저장소에 저장되었습니다.');
    } catch (e: any) { Alert.alert('오류', e.message); }
  };

  const handleExport = async () => {
    try {
      await publishFormationAsFeedback(id!, formationId!, formation.title);
      Alert.alert('내보내기 성공', '피드백 영상 목록에 동선이 업로드되었습니다.');
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
      <View style={[styles.topBar, { paddingTop: insets.top + 15 }]}>
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
        <TouchableOpacity onPress={handleExport} style={styles.topBtn}>
          <Ionicons name="share-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.stageSection}>
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}><Ionicons name="remove" size={20} color="#FFF" /></TouchableOpacity>
          <Text style={styles.zoomText}>{Math.round(zoomLevel * 100)}%</Text>
          <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomLevel(prev => Math.min(3, prev + 0.1))}><Ionicons name="add" size={20} color="#FFF" /></TouchableOpacity>
        </View>

        <ScrollView horizontal style={{ flex: 1, width: '100%' }}>
          <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ padding: 40, alignItems: 'center', justifyContent: 'center', minWidth: width, minHeight: 400 }}>
            <Text style={styles.directionLabel}>{settings.stageDirection === 'top' ? 'AUDIENCE' : 'BACKSTAGE'}</Text>
            <View style={[styles.stage, { width: STAGE_WIDTH, height: STAGE_HEIGHT, borderColor: 'rgba(255,255,255,0.1)' }]}>
              {/* Center Marker */}
              <View style={[styles.centerMarkerH, { width: STAGE_WIDTH }]} />
              <View style={[styles.centerMarkerV, { height: STAGE_HEIGHT }]} />
              
              <View style={styles.gridLayer}>
                {Array.from({length: settings.gridCols + 1}).map((_, i) => (
                  <View key={`v-${i}`} style={[styles.gridLineV, { left: `${(i/settings.gridCols)*100}%`, opacity: i % 5 === 0 ? 0.3 : 0.1 }]} />
                ))}
                {Array.from({length: settings.gridRows + 1}).map((_, i) => (
                  <View key={`h-${i}`} style={[styles.gridLineH, { top: `${(i/settings.gridRows)*100}%`, opacity: i % 5 === 0 ? 0.3 : 0.1 }]} />
                ))}
              </View>
              {dancers.map((d, i) => (
                <DancerNode 
                  key={d.id} index={i} dancer={d} currentTimeMs={currentTimeMs} scenes={scenes} timeline={timeline}
                  onDragEnd={handleDragEnd} isSelected={selectedDancerId === d.id} onPress={() => { setSelectedDancerId(d.id); setShowDancerSheet(true); }}
                  mode={mode} index={i} settings={settings}
                  createModeX={dancerPositionsX[d.id]} createModeY={dancerPositionsY[d.id]}
                  stageWidth={STAGE_WIDTH} stageHeight={STAGE_HEIGHT} cellSize={CELL_SIZE} zoomLevel={zoomLevel}
                />
              ))}
            </View>
            <Text style={styles.directionLabel}>{settings.stageDirection === 'top' ? 'BACKSTAGE' : 'AUDIENCE'}</Text>
          </ScrollView>
        </ScrollView>
      </View>

      {/* --- Mode Specific Toolbar --- */}
      {mode === 'create' ? (
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolItem} onPress={addDancer}><View style={styles.toolIconCircle}><Ionicons name="person-add" size={20} color="#FFF" /></View><Text style={styles.toolText}>댄서 추가</Text></TouchableOpacity>
          <TouchableOpacity style={styles.toolItem} onPress={() => setShowGuide(true)}><View style={styles.toolIconCircle}><Ionicons name="help-circle-outline" size={20} color="#FFF" /></View><Text style={styles.toolText}>사용방법</Text></TouchableOpacity>
          <TouchableOpacity style={styles.toolItem} onPress={() => setShowStageSettings(true)}><View style={styles.toolIconCircle}><Ionicons name="grid" size={20} color="#FFF" /></View><Text style={styles.toolText}>그리드 설정</Text></TouchableOpacity>
          <TouchableOpacity style={styles.toolItem} onPress={handleSave}><View style={styles.toolIconCircle}><Ionicons name="save-outline" size={20} color={theme.primary} /></View><Text style={styles.toolText}>저장</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.toolbarSpacer} />
      )}

      {/* --- Bottom Dynamic Area --- */}
      <View style={[styles.bottomDock, { paddingBottom: insets.bottom + 20 }]}>
        {mode === 'create' ? (
          <View style={styles.createModeContent}>
            <View style={styles.scenesHeader}><Text style={styles.dockTitle}>대형 목록</Text><TouchableOpacity onPress={() => { setSceneModalMode('add'); setInputName(''); setShowSceneNameModal(true); }}><Ionicons name="add-circle" size={24} color={theme.primary} /></TouchableOpacity></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scenesScroll}>
              {scenes.map((s, idx) => (
                <TouchableOpacity key={s.id} onLongPress={() => openSceneMenu(s)} style={[styles.scenePill, activeSceneId === s.id && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => setActiveSceneId(s.id)}>
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

      {/* --- Dancer Sheet --- */}
      <Modal visible={showDancerSheet} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDancerSheet(false)}>
          <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 25 }]}>
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
            
            <View style={styles.settingCol}>
              <Text style={styles.settingLabel}>그리드 크기 (가로 x 세로)</Text>
              <View style={styles.gridInputRow}>
                <TextInput style={styles.gridInput} keyboardType="numeric" value={settings.gridCols.toString()} onChangeText={v => setSettings({...settings, gridCols: parseInt(v) || 1})} />
                <Text style={{ color: '#FFF' }}>x</Text>
                <TextInput style={styles.gridInput} keyboardType="numeric" value={settings.gridRows.toString()} onChangeText={v => setSettings({...settings, gridRows: parseInt(v) || 1})} />
              </View>
            </View>

            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: theme.primary }]} onPress={() => setShowStageSettings(false)}><Text style={{ fontWeight: 'bold' }}>확인</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- Scene Name Modal --- */}
      <Modal visible={showSceneNameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <Text style={styles.modalTitle}>{sceneModalMode === 'add' ? '대형 추가' : '대형 이름 변경'}</Text>
            <TextInput style={styles.modalInput} value={inputName} onChangeText={setInputName} placeholder="예: 후렴 1" placeholderTextColor="#555" autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20 }}><TouchableOpacity onPress={() => setShowSceneNameModal(false)}><Text style={{ color: '#888' }}>취소</Text></TouchableOpacity><TouchableOpacity onPress={handleSceneAction}><Text style={{ color: theme.primary, fontWeight: 'bold' }}>{sceneModalMode === 'add' ? '추가' : '저장'}</Text></TouchableOpacity></View>
          </View>
        </View>
      </Modal>

      {/* --- Usage Guide Modal --- */}
      <Modal visible={showGuide} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.settingsModal, { width: '90%', maxHeight: '85%' }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>동선 가이드 ({guideIndex + 1}/{GUIDE_STEPS.length})</Text>
              <TouchableOpacity onPress={() => setShowGuide(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
            </View>
            
            <View style={styles.guideContent}>
              <View style={styles.guideImagePlaceholder}>
                {GUIDE_STEPS[guideIndex].image ? (
                  <Image source={GUIDE_STEPS[guideIndex].image} style={styles.guideImage} resizeMode="contain" />
                ) : (
                  <View style={styles.emptyImage}><Ionicons name="image-outline" size={40} color="#333" /><Text style={{ color: '#333', marginTop: 10 }}>이미지 준비 중</Text></View>
                )}
              </View>
              <Text style={styles.guideStepTitle}>{GUIDE_STEPS[guideIndex].title}</Text>
              <Text style={styles.guideDescription}>{GUIDE_STEPS[guideIndex].description}</Text>
            </View>

            <View style={styles.guideNav}>
              <TouchableOpacity style={[styles.navBtn, guideIndex === 0 && { opacity: 0.3 }]} disabled={guideIndex === 0} onPress={() => setGuideIndex(prev => prev - 1)}>
                <Ionicons name="chevron-back" size={20} color="#FFF" /><Text style={styles.navBtnText}>이전</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navBtn, guideIndex === GUIDE_STEPS.length - 1 && { backgroundColor: theme.primary }]} onPress={() => { if (guideIndex < GUIDE_STEPS.length - 1) setGuideIndex(prev => prev + 1); else setShowGuide(false); }}>
                <Text style={[styles.navBtnText, guideIndex === GUIDE_STEPS.length - 1 && { color: '#000' }]}>{guideIndex === GUIDE_STEPS.length - 1 ? '완료' : '다음'}</Text>
                {guideIndex < GUIDE_STEPS.length - 1 && <Ionicons name="chevron-forward" size={20} color="#FFF" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 10 },
  topBtn: { padding: 10 },
  modeToggle: { flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 25, padding: 4, borderWidth: 1, borderColor: '#333' },
  modeTab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  activeModeTab: { backgroundColor: '#333' },
  modeTabText: { color: '#666', fontSize: 13, fontWeight: 'bold' },
  activeModeTabText: { color: '#FFF' },
  stageSection: { flex: 1, position: 'relative' },
  zoomControls: { position: 'absolute', top: 10, right: 15, zIndex: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 20, padding: 5, borderWidth: 1, borderColor: '#333' },
  zoomBtn: { padding: 5 },
  zoomText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginHorizontal: 8 },
  directionLabel: { color: '#333', fontSize: 10, fontWeight: 'bold', letterSpacing: 4, marginVertical: 15 },
  stage: { backgroundColor: '#0A0A0A', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  centerMarkerH: { position: 'absolute', top: '50%', height: 1, backgroundColor: 'rgba(255,255,255,0.15)', zIndex: 0 },
  centerMarkerV: { position: 'absolute', left: '50%', width: 1, backgroundColor: 'rgba(255,255,255,0.15)', zIndex: 0 },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#FFF' },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#FFF' },
  dancerNode: { position: 'absolute', alignItems: 'center' },
  dancerCircle: { justifyContent: 'center', alignItems: 'center' },
  dancerInitial: { color: '#FFF', fontWeight: 'bold' },
  dancerNameText: { color: '#AAA', fontWeight: '500', textAlign: 'center' },
  toolbar: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginVertical: 10 },
  toolbarSpacer: { height: 44, marginVertical: 10 },
  toolItem: { alignItems: 'center', gap: 6 },
  toolIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  toolText: { color: '#888', fontSize: 11 },
  bottomDock: { borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#000' },
  createModeContent: { padding: 15 },
  dockTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  scenesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  scenesScroll: { gap: 10 },
  scenePill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: '#333', backgroundColor: '#111' },
  scenePillText: { color: '#AAA', fontWeight: 'bold', fontSize: 13 },
  placeModeContent: { padding: 15 },
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
  settingCol: { gap: 10 },
  settingLabel: { color: '#AAA', fontSize: 15 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  gridInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' },
  gridInput: { backgroundColor: '#000', color: '#FFF', width: 60, textAlign: 'center', padding: 10, borderRadius: 8 },
  doneBtn: { padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  modalInput: { backgroundColor: '#000', color: '#FFF', padding: 15, borderRadius: 12, fontSize: 16, marginBottom: 10 },
  guideContent: { alignItems: 'center', gap: 15 },
  guideImagePlaceholder: { width: '100%', height: 200, backgroundColor: '#000', borderRadius: 15, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  guideImage: { width: '100%', height: '100%' },
  emptyImage: { alignItems: 'center' },
  guideStepTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  guideDescription: { color: '#CCC', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  guideNav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, width: '100%' },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#333' },
  navBtnText: { color: '#FFF', fontWeight: 'bold' }
});
