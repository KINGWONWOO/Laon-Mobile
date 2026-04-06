import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Modal, Alert, ScrollView, ActivityIndicator, Pressable, Platform, Image } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { Dancer, FormationScene, TimelineEntry, Position, Formation, FormationSettings } from '../../../../types';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, useDerivedValue, SharedValue, withSpring, withTiming, makeMutable, Easing, cancelAnimation, useAnimatedReaction } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

const { width } = Dimensions.get('window');
const COLORS = ['#FF3366', '#FF9F43', '#F7D794', '#4ECDC4', '#45B7D1', '#A06CD5', '#1B9CFC', '#E056FD', '#686DE0', '#30336B'];
const PX_PER_SEC = 60; 
const TIMELINE_CONTAINER_WIDTH = width - 30;
const CENTER_OFFSET = TIMELINE_CONTAINER_WIDTH / 2;

type EditorMode = 'create' | 'place';

const GUIDE_STEPS = [
  {
    title: '댄서 관리',
    description: '1. 하단의 "댄서 추가" 버튼으로 멤버를 무대에 올릴 수 있습니다.\n2. 무대 위 댄서 노드를 탭하면 이름 변경, 고유 색상 지정, 삭제가 가능합니다.',
    image: null
  },
  {
    title: '대형 생성 (Create Mode)',
    description: '1. "대형 생성" 탭을 선택하세요.\n2. 하단의 "대형 목록"에서 대형을 추가(+)하거나 선택하세요.\n3. 무대 위 댄서들을 드래그하여 원하는 위치에 배치하세요.\n4. 설정에서 "격자 스냅"을 켜면 정밀한 배치가 가능합니다.',
    image: null
  },
  {
    title: '대형 배치 (Place Mode)',
    description: '1. "대형 배치" 탭을 선택하세요.\n2. 재생 바(타임라인)를 터치하여 원하는 시점에 대형을 추가하세요.\n3. 생성된 블록의 좌우 핸들을 드래그하여 유지 시간을 조절할 수 있습니다.\n4. 블록 사이의 빈 공간은 자동으로 동선 이동(보간) 구간이 됩니다.',
    image: require('../../../../example/transitionexample.jpg')
  },
  {
    title: '저장 및 내보내기',
    description: '1. 우측 상단의 저장 아이콘으로 작업 내용을 수시로 저장하세요.\n2. 배치 모드 하단의 "공유" 아이콘을 누르면 동선이 피드백 영상으로 변환되어 팀원들에게 공유됩니다.',
    image: null
  }
];

const formatTime = (ms: number) => {
  if (typeof ms !== 'number' || isNaN(ms)) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// --- Single Bar Waveform Component ---
const WaveformBackground = ({ duration, seed = 'default' }: { duration: number, seed?: string }) => {
  const barsCount = Math.max(20, Math.floor(duration * 6));
  const bars = useMemo(() => {
    const getVal = (i: number) => {
      const x = Math.sin(i * 0.5 + seed.length) * 10000;
      return x - Math.floor(x);
    };

    return Array.from({ length: barsCount }).map((_, i) => {
      const progress = i / barsCount;
      const isChorus = (progress > 0.25 && progress < 0.45) || (progress > 0.65 && progress < 0.85);
      let multiplier = isChorus ? 1.2 : 0.5;
      if (progress < 0.1) multiplier = 0.2;

      const noise = getVal(i);
      const h = 2 + (noise * 30 * multiplier);
      return { height: Math.min(35, h), opacity: isChorus ? 0.6 : 0.3 };
    });
  }, [barsCount, seed]);

  return (
    <View style={[styles.waveformContainer, { width: duration * PX_PER_SEC }]}>
      {bars.map((bar, i) => (
        <View key={i} style={[styles.waveformBar, { height: bar.height, opacity: bar.opacity, backgroundColor: bar.opacity > 0.3 ? '#FFF' : '#888' }]} />
      ))}
    </View>
  );
};

const TimeMarkers = ({ duration }: { duration: number }) => {
  const markers = useMemo(() => {
    const list = [];
    for (let i = 0; i <= duration; i += 5) {
      list.push(
        <View key={i} style={[styles.timeMarker, { left: i * PX_PER_SEC }]}>
          <View style={styles.timeMarkerLine} /><Text style={styles.timeMarkerText}>{Math.floor(i / 60)}:{(i % 60).toString().padStart(2, '0')}</Text>
        </View>
      );
    }
    return list;
  }, [duration]);
  return <View style={styles.timeMarkersLayer}>{markers}</View>;
};

const ResizeHandle = ({ direction, onDragEnd }: { direction: 'left' | 'right', onDragEnd: (delta: number) => void }) => {
  const translationX = useSharedValue(0);
  const pan = Gesture.Pan()
    .onUpdate((e) => { translationX.value = e.translationX; })
    .onEnd((e) => { runOnJS(onDragEnd)(e.translationX / PX_PER_SEC * 1000); translationX.value = 0; });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: translationX.value }] }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[direction === 'left' ? styles.resizeHandleLeft : styles.resizeHandleRight, style]}>
        <Ionicons name={direction === 'left' ? "caret-back" : "caret-forward"} size={14} color="#000" />
      </Animated.View>
    </GestureDetector>
  );
};

const DancerNode = ({ dancer, dancerPos, isSelected, onPress, zoomLevel, index, settings, stageWidth, stageHeight, cellSize, mode, onDragEnd }: any) => {
  const isDragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const pos = useDerivedValue(() => {
    if (isDragging.value) return { x: dragX.value, y: dragY.value };
    return dancerPos.value;
  });

  const panGesture = Gesture.Pan()
    .enabled(mode === 'create')
    .onStart(() => {
      isDragging.value = true;
      startX.value = dancerPos.value.x;
      startY.value = dancerPos.value.y;
    })
    .onUpdate((e) => {
      dragX.value = Math.max(0.01, Math.min(0.99, startX.value + (e.translationX / stageWidth)));
      dragY.value = Math.max(0.01, Math.min(0.99, startY.value + (e.translationY / stageHeight)));
    })
    .onEnd(() => {
      isDragging.value = false;
      let fx = dragX.value, fy = dragY.value;
      if (settings.snapToGrid) {
        const stepX = (1 / (settings.gridCols + 4)) / 2, stepY = (1 / settings.gridRows) / 2;
        fx = Math.round(fx / stepX) * stepX; fy = Math.round(fy / stepY) * stepY;
      }
      dancerPos.value = { x: fx, y: fy }; // Immediately update shared value
      runOnJS(onDragEnd)(dancer.id, { x: fx, y: fy });
    });

  const style = useAnimatedStyle(() => ({
    width: cellSize * 2.5,
    height: cellSize * 0.7 + (25 * zoomLevel),
    transform: [
      { translateX: (pos.value.x * stageWidth) - (cellSize * 1.25) },
      { translateY: (pos.value.y * stageHeight) - (cellSize * 0.35) },
      { scale: withSpring(isSelected || isDragging.value ? 1.1 : 1) }
    ],
    zIndex: isSelected || isDragging.value ? 100 : 1
  }));

  const composed = Gesture.Exclusive(panGesture, Gesture.Tap().onEnd(() => { runOnJS(onPress)(); }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.dancerNode, style]} pointerEvents="box-none">
        <View style={[styles.dancerCircle, { backgroundColor: dancer.color, borderColor: isSelected ? '#FFF' : 'rgba(0,0,0,0.2)', width: cellSize * 0.7, height: cellSize * 0.7, borderRadius: (cellSize * 0.7) / 2, borderWidth: 1.5 * zoomLevel }]}>
          <Text style={[styles.dancerInitial, { fontSize: cellSize * 0.3 }]}>{index + 1}</Text>
        </View>
        <Text style={[styles.dancerNameText, { color: isSelected ? '#FFF' : '#AAA', fontSize: (settings.dancerNameSize || 8) * zoomLevel }]} numberOfLines={1}>{dancer.name}</Text>
      </Animated.View>
    </GestureDetector>
  );
};

export default function FormationEditorScreen() {
  const { id, formationId } = useGlobalSearchParams<{ id: string, formationId: string }>();
  const { formations, updateFormation, publishFormationAsFeedback, theme } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const formation = formations.find(f => f.id === formationId);
  
  const [mode, setMode] = useState<EditorMode>('create');
  const [dancers, setDancers] = useState<Dancer[]>(formation?.data?.dancers || []);
  const [scenes, setScenes] = useState<FormationScene[]>(formation?.data?.scenes || []);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(formation?.data?.timeline || []);
  const [settings, setSettings] = useState<FormationSettings>(formation?.settings || { gridRows: 10, gridCols: 10, stageDirection: 'top', snapToGrid: true, dancerNameSize: 8 });
  const [activeSceneId, setActiveSceneId] = useState<string | null>(formation?.data?.scenes?.[0]?.id || null);
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [targetSceneId, setTargetSceneId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [touchTimeMs, setTouchTimeMs] = useState(0);
  
  const STAGE_MARGIN = zoomLevel === 1 ? 0 : 40;
  const CELL_SIZE = ((width - 40) / (settings.gridCols + 4)) * zoomLevel;
  const STAGE_WIDTH = (settings.gridCols + 4) * CELL_SIZE;
  const STAGE_HEIGHT = settings.gridRows * CELL_SIZE;

  const player = useAudioPlayer(formation?.audioUrl || '');
  const status = useAudioPlayerStatus(player);
  const currentTimeMs = useSharedValue(0);
  const [currentTimeUI, setCurrentTimeUI] = useState(0);
  const isUserScrolling = useRef(false);

  const scenesSV = useSharedValue(scenes);
  useEffect(() => { scenesSV.value = scenes; }, [scenes]);
  const timelineSV = useSharedValue(timeline);
  useEffect(() => { timelineSV.value = timeline; }, [timeline]);

  const dancerPositions = useMemo(() => {
    const dict: any = {};
    dancers.forEach(d => { dict[d.id] = makeMutable({ x: 0.5, y: 0.5 }); });
    return dict;
  }, [dancers]);

  // Reaction for Create Mode: Animates positions ONLY when scene or mode changes.
  useAnimatedReaction(
    () => ({ scenes: scenesSV.value, mode, activeId: activeSceneId }),
    (data, prev) => {
      const { scenes, mode, activeId } = data;
      if (mode === 'create') {
        if (prev?.activeId !== activeId || prev?.mode !== mode) {
          const targetScene = scenes.find(s => s.id === activeId);
          if (targetScene) {
            dancers.forEach(d => {
              const p = targetScene.positions[d.id] || { x: 0.5, y: 0.5 };
              dancerPositions[d.id].value = withTiming(p, { duration: 400, easing: Easing.out(Easing.quad) });
            });
          }
        }
      }
    },
    [activeSceneId, mode, dancers]
  );

  // Reaction for Place Mode: Handles real-time interpolation during playback.
  useAnimatedReaction(
    () => ({ time: currentTimeMs.value, scenes: scenesSV.value, timeline: timelineSV.value, mode }),
    (data) => {
      const { time, scenes, timeline, mode } = data;
      if (mode === 'place') {
        const sorted = [...timeline].sort((a, b) => a.timestampMillis - b.timestampMillis);
        let prevE = null, nextE = null;
        for (let e of sorted) { if (e.timestampMillis <= time) prevE = e; else { nextE = e; break; } }
        dancers.forEach(d => {
          let p = { x: 0.5, y: 0.5 };
          if (!prevE) {
            const s = scenes.find(s => s.id === sorted[0]?.sceneId);
            p = s?.positions[d.id] || { x: 0.5, y: 0.5 };
          } else {
            const prevScene = scenes.find(s => s.id === prevE.sceneId);
            if (time <= prevE.timestampMillis + prevE.durationMillis) {
              p = prevScene?.positions[d.id] || { x: 0.5, y: 0.5 };
            } else if (nextE) {
              const nextScene = scenes.find(s => s.id === nextE.sceneId);
              const progress = (time - (prevE.timestampMillis + prevE.durationMillis)) / (nextE.timestampMillis - (prevE.timestampMillis + prevE.durationMillis));
              const sP = prevScene?.positions[d.id] || { x: 0.5, y: 0.5 }, eP = nextScene?.positions[d.id] || { x: 0.5, y: 0.5 };
              p = { x: sP.x + (eP.x - sP.x) * progress, y: sP.y + (eP.y - sP.y) * progress };
            } else {
              p = prevScene?.positions[d.id] || { x: 0.5, y: 0.5 };
            }
          }
          dancerPositions[d.id].value = p;
        });
      }
    },
    [mode, dancers]
  );

  useEffect(() => {
    if (status.playing && status.duration > 0) {
      const remaining = (status.duration - status.currentTime) * 1000;
      currentTimeMs.value = status.currentTime * 1000;
      currentTimeMs.value = withTiming(status.duration * 1000, { duration: remaining, easing: Easing.linear });
    } else {
      cancelAnimation(currentTimeMs);
      if (status.currentTime !== undefined) currentTimeMs.value = status.currentTime * 1000;
    }
  }, [status.playing, status.currentTime]);

  const timelineScrollViewRef = useRef<ScrollView>(null);
  useEffect(() => {
    let interval = setInterval(() => {
      const val = currentTimeMs.value;
      runOnJS(setCurrentTimeUI)(val);
      if (status.playing && !isUserScrolling.current) {
        timelineScrollViewRef.current?.scrollTo({ x: (val / 1000) * PX_PER_SEC, animated: false });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [status.playing]);

  const handleScroll = (e: any) => {
    if (isUserScrolling.current) {
      const newTime = e.nativeEvent.contentOffset.x / PX_PER_SEC;
      if (!status.playing) { player.seekTo(newTime); currentTimeMs.value = newTime * 1000; setCurrentTimeUI(newTime * 1000); }
    }
  };

  const [showDancerSheet, setShowDancerSheet] = useState(false);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [showSceneNameModal, setShowSceneNameModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideIndex, setGuideIndex] = useState(0);
  const [sceneModalMode, setSceneModalMode] = useState<'add' | 'rename'>('add');
  const [inputName, setInputName] = useState('');
  const [isPickingAudio, setIsPickingAudio] = useState(false);

  const handleDragEnd = (dancerId: string, pos: Position) => {
    if (mode !== 'create' || !activeSceneId) return;
    setScenes(prev => prev.map(s => s.id === activeSceneId ? { ...s, positions: { ...s.positions, [dancerId]: { ...pos } } } : s));
  };

  const handleSave = async () => { try { await updateFormation(formationId!, { settings, data: { dancers, scenes, timeline } }); Alert.alert('저장 완료'); } catch (e: any) { Alert.alert('오류', e.message); } };
  const handleExport = async () => { try { await publishFormationAsFeedback(id!, formationId!, formation!.title); Alert.alert('내보내기 성공'); } catch (e: any) { Alert.alert('오류', e.message); } };

  const addDancer = () => {
    const newDancer: Dancer = {
      id: Math.random().toString(36).substr(2, 9),
      name: `댄서 ${dancers.length + 1}`,
      color: COLORS[dancers.length % COLORS.length]
    };
    setDancers([...dancers, newDancer]);
  };

  const handleSceneAction = () => {
    if (sceneModalMode === 'add') {
      const newId = Math.random().toString(36).substr(2, 9);
      const lastScene = scenes[scenes.length - 1];
      const initialPositions = lastScene ? JSON.parse(JSON.stringify(lastScene.positions)) : {};
      setScenes([...scenes, { id: newId, name: inputName.trim() || `대형 ${scenes.length + 1}`, positions: initialPositions }]);
      setActiveSceneId(newId);
    } else if (sceneModalMode === 'rename' && targetSceneId) {
      setScenes(prev => prev.map(s => s.id === targetSceneId ? { ...s, name: inputName.trim() || s.name } : s));
    }
    setShowSceneNameModal(false); setInputName('');
  };

  const pickAudioFile = async () => {
    setIsPickingAudio(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const localUri = `${FileSystem.documentDirectory}${result.assets[0].name}`;
      await FileSystem.copyAsync({ from: result.assets[0].uri, to: localUri });
      await updateFormation(formationId!, { audioUrl: localUri });
      router.replace({ pathname: `/room/[id]/formation/[formationId]`, params: { id, formationId } });
    } catch (e) { Alert.alert('오류', '파일 처리 실패'); } finally { setIsPickingAudio(false); }
  };

  const openTimelineMenuAt = (x: number) => {
    const time = Math.floor((x / PX_PER_SEC) * 1000 / 100) * 100;
    setTouchTimeMs(time);
    setShowTimelineMenu(true);
  };

  const timelineTap = Gesture.Tap().onEnd((e) => {
    runOnJS(openTimelineMenuAt)(e.x);
  });

  if (!formation) return null;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: '#050505' }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 15 }]}>
        <TouchableOpacity onPress={() => { player.pause(); router.back(); }} style={styles.topBtn}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
        <View style={styles.modeToggle}>
          <TouchableOpacity onPress={() => setMode('create')} style={[styles.modeTab, mode === 'create' && styles.activeModeTab]}><Text style={[styles.modeTabText, mode === 'create' && styles.activeModeTabText]}>대형 생성</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('place')} style={[styles.modeTab, mode === 'place' && styles.activeModeTab]}><Text style={[styles.modeTabText, mode === 'place' && styles.activeModeTabText]}>대형 배치</Text></TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleSave} style={styles.topBtn}><Ionicons name="save-outline" size={24} color={theme.primary} /></TouchableOpacity>
      </View>

      <View style={styles.stageSection}>
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}><Ionicons name="remove" size={20} color="#FFF" /></TouchableOpacity>
          <Text style={styles.zoomText}>{Math.round(zoomLevel * 100)}%</Text>
          <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomLevel(prev => Math.min(3, prev + 0.1))}><Ionicons name="add" size={20} color="#FFF" /></TouchableOpacity>
        </View>

        <ScrollView horizontal contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ScrollView contentContainerStyle={{ padding: STAGE_MARGIN, alignItems: 'center', justifyContent: 'center', minWidth: STAGE_WIDTH }}>
            <View style={[styles.stage, { width: STAGE_WIDTH, height: STAGE_HEIGHT }]}>
              <View style={[styles.offStageLeft, { width: 2 * CELL_SIZE }]} /><View style={[styles.offStageRight, { width: 2 * CELL_SIZE }]} />
              <View style={styles.deadCenterPoint}><View style={[styles.centerCrossLineH, { width: 30 * zoomLevel }]} /><View style={[styles.centerCrossLineV, { height: 30 * zoomLevel }]} /></View>
              <View style={styles.gridLayer}>
                {Array.from({length: settings.gridCols + 5}).map((_, i) => <View key={`v-${i}`} style={[styles.gridLineV, { left: `${(i/(settings.gridCols+4))*100}%` }]} />)}
                {Array.from({length: settings.gridRows + 1}).map((_, i) => <View key={`h-${i}`} style={[styles.gridLineH, { top: `${(i/settings.gridRows)*100}%` }]} />)}
              </View>
              {dancers.map((d, i) => (
                <DancerNode key={d.id} index={i} dancer={d} dancerPos={dancerPositions[d.id]} isSelected={selectedDancerId === d.id} onPress={() => { setSelectedDancerId(d.id); setShowDancerSheet(true); }} mode={mode} settings={settings} stageWidth={STAGE_WIDTH} stageHeight={STAGE_HEIGHT} cellSize={CELL_SIZE} zoomLevel={zoomLevel} onDragEnd={handleDragEnd} />
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      <View style={[styles.bottomDock, { paddingBottom: insets.bottom + 20 }]}>
        {mode === 'create' ? (
          <View style={styles.createModeContent}>
            <View style={styles.toolbar}>
              <TouchableOpacity style={styles.toolItem} onPress={addDancer}>
                <View style={styles.toolIconCircle}><Ionicons name="person-add" size={20} color={theme.primary} /></View>
                <Text style={styles.toolText}>댄서 추가</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolItem} onPress={() => setShowStageSettings(true)}>
                <View style={styles.toolIconCircle}><Ionicons name="settings-outline" size={20} color="#AAA" /></View>
                <Text style={styles.toolText}>무대 설정</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolItem} onPress={() => { setGuideIndex(0); setShowGuide(true); }}>
                <View style={styles.toolIconCircle}><Ionicons name="help-circle-outline" size={20} color="#AAA" /></View>
                <Text style={styles.toolText}>가이드</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.scenesHeader}><Text style={styles.dockTitle}>대형 목록</Text><TouchableOpacity onPress={() => { setSceneModalMode('add'); setInputName(''); setShowSceneNameModal(true); }}><Ionicons name="add-circle" size={24} color={theme.primary} /></TouchableOpacity></View>
            <ScrollView horizontal contentContainerStyle={styles.scenesScroll}>
              {scenes.map(s => <TouchableOpacity key={s.id} onLongPress={() => { Alert.alert(s.name, '작업', [{ text: '이름 변경', onPress: () => { setSceneModalMode('rename'); setTargetSceneId(s.id); setInputName(s.name); setShowSceneNameModal(true); } }, { text: '삭제', style: 'destructive', onPress: () => setScenes(scenes.filter(x => x.id !== s.id)) }, { text: '취소' }]); }} style={[styles.scenePill, activeSceneId === s.id && { backgroundColor: theme.primary }]} onPress={() => setActiveSceneId(s.id)}><Text style={[styles.scenePillText, activeSceneId === s.id && { color: '#000' }]}>{s.name}</Text></TouchableOpacity>)}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.placeModeContent}>
            <View style={styles.rectangleTimelineContainer}>
              <ScrollView 
                ref={timelineScrollViewRef} horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={handleScroll}
                onScrollBeginDrag={() => { isUserScrolling.current = true; }} onScrollEndDrag={() => { isUserScrolling.current = false; }} contentContainerStyle={{ paddingHorizontal: CENTER_OFFSET }}
              >
                <GestureDetector gesture={timelineTap}>
                  <View style={{ width: (status.duration || 60) * PX_PER_SEC }}>
                    <WaveformBackground duration={status.duration || 60} seed={formation?.audioUrl || 'default'} />
                    <TimeMarkers duration={status.duration || 60} />
                    <View style={styles.rectangleTimelineTrack}>
                      {[...timeline].sort((a,b)=>a.timestampMillis-b.timestampMillis).map((e, idx, arr) => (
                        <React.Fragment key={e.id}>
                          <TouchableOpacity onPress={() => setSelectedEntryId(selectedEntryId === e.id ? null : e.id)} style={[styles.timelineBlock, { left: (e.timestampMillis/1000)*PX_PER_SEC, width: (e.durationMillis/1000)*PX_PER_SEC, backgroundColor: selectedEntryId === e.id ? theme.primary : 'rgba(255,255,255,0.3)' }]}>
                            <Text style={[styles.blockLabel, selectedEntryId === e.id && { color: '#000' }]} numberOfLines={1}>{scenes.find(s => s.id === e.sceneId)?.name}</Text>
                            {selectedEntryId === e.id && <><ResizeHandle direction="left" onDragEnd={(d) => setTimeline(prev => prev.map(x => x.id === e.id ? { ...x, timestampMillis: Math.max(0, x.timestampMillis + d), durationMillis: Math.max(500, x.durationMillis - d) } : x))} /><ResizeHandle direction="right" onDragEnd={(d) => setTimeline(prev => prev.map(x => x.id === e.id ? { ...x, durationMillis: Math.max(500, x.durationMillis + d) } : x))} /></>}
                          </TouchableOpacity>
                          {idx < arr.length - 1 && <View style={[styles.transitionX, { left: ((e.timestampMillis+e.durationMillis)/1000)*PX_PER_SEC, width: (arr[idx+1].timestampMillis - (e.timestampMillis+e.durationMillis))/1000*PX_PER_SEC }]}><Ionicons name="close" size={14} color="rgba(255,255,255,0.2)" /></View>}
                        </React.Fragment>
                      ))}
                    </View>
                  </View>
                </GestureDetector>
              </ScrollView>
              <View style={styles.centerNeedle} />
            </View>
            <View style={styles.centeredControls}>
              <View style={styles.playbackRow}>
                <TouchableOpacity onPress={pickAudioFile}>{isPickingAudio ? <ActivityIndicator size="small" /> : <Ionicons name="musical-notes" size={22} color="#AAA" />}</TouchableOpacity>
                <TouchableOpacity onPress={() => player.seekTo(status.currentTime - 2)}><Ionicons name="play-back" size={24} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity onPress={() => status.playing ? player.pause() : player.play()} style={[styles.mainPlayBtn, { backgroundColor: theme.primary }]}><Ionicons name={status.playing ? "pause" : "play"} size={32} color="#000" /></TouchableOpacity>
                <TouchableOpacity onPress={() => player.seekTo(status.currentTime + 2)}><Ionicons name="play-forward" size={24} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity onPress={handleExport}><Ionicons name="share-outline" size={24} color={theme.primary} /></TouchableOpacity>
              </View>
              <Text style={styles.timeText}>{formatTime(currentTimeUI)}</Text>
            </View>
          </View>
        )}
      </View>

      <Modal visible={showDancerSheet} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDancerSheet(false)}>
          <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 25 }]}>
            <TextInput style={styles.sheetInput} value={dancers.find(d => d.id === selectedDancerId)?.name} onChangeText={val => setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, name: val } : d))} />
            <View style={styles.colorRow}>{COLORS.map(c => <TouchableOpacity key={c} style={[styles.colorChip, { backgroundColor: c }, dancers.find(d => d.id === selectedDancerId)?.color === c && { borderWidth: 3, borderColor: '#FFF' }]} onPress={() => setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, color: c } : d))} />)}</View>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => { setDancers(dancers.filter(d => d.id !== selectedDancerId)); setSelectedDancerId(null); setShowDancerSheet(false); }}><Ionicons name="trash" size={20} color="#FF4444" /><Text style={{ color: '#FF4444', marginLeft: 10 }}>삭제</Text></TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showTimelineMenu} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTimelineMenu(false)}>
          <View style={styles.settingsModal}>
            <Text style={styles.modalTitle}>대형 추가/삭제 ({formatTime(touchTimeMs)})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{scenes.map(s => <TouchableOpacity key={s.id} style={styles.scenePillSmall} onPress={() => { setTimeline([...timeline, { id: Math.random().toString(36).substr(2,9), timestampMillis: touchTimeMs, durationMillis: 3000, sceneId: s.id }]); setShowTimelineMenu(false); }}><Text style={styles.scenePillTextSmall}>{s.name}</Text></TouchableOpacity>)}</ScrollView>
            {selectedEntryId && <TouchableOpacity style={styles.deleteBtn} onPress={() => { setTimeline(timeline.filter(e => e.id !== selectedEntryId)); setSelectedEntryId(null); setShowTimelineMenu(false); }}><Ionicons name="trash" size={20} color="#FF4444" /><Text style={{ color: '#FF4444', marginLeft: 10 }}>블록 삭제</Text></TouchableOpacity>}
            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowTimelineMenu(false)}><Text style={{ color: '#FFF' }}>닫기</Text></TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showSceneNameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <Text style={styles.modalTitle}>{sceneModalMode === 'add' ? '대형 추가' : '대형 이름 변경'}</Text>
            <TextInput style={styles.modalInput} value={inputName} onChangeText={setInputName} placeholder="대형 이름" autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20 }}><TouchableOpacity onPress={() => setShowSceneNameModal(false)}><Text style={{ color: '#888' }}>취소</Text></TouchableOpacity><TouchableOpacity onPress={handleSceneAction}><Text style={{ color: theme.primary, fontWeight: 'bold' }}>{sceneModalMode === 'add' ? '추가' : '저장'}</Text></TouchableOpacity></View>
          </View>
        </View>
      </Modal>

      <Modal visible={showStageSettings} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <Text style={styles.modalTitle}>무대 설정</Text>
            <View style={styles.settingRow}><Text style={styles.settingLabel}>격자 스냅</Text><TouchableOpacity onPress={() => setSettings({...settings, snapToGrid: !settings.snapToGrid})}><Ionicons name={settings.snapToGrid ? "checkbox" : "square-outline"} size={24} color={theme.primary} /></TouchableOpacity></View>
            <View style={styles.settingRow}><Text style={styles.settingLabel}>무대 앞 방향</Text><TouchableOpacity style={[styles.toggleBtn, { backgroundColor: theme.primary }]} onPress={() => setSettings({...settings, stageDirection: settings.stageDirection === 'top' ? 'bottom' : 'top'})}><Text style={{ fontWeight: 'bold' }}>{settings.stageDirection === 'top' ? '상단' : '하단'}</Text></TouchableOpacity></View>
            <View style={styles.settingCol}>
              <Text style={styles.settingLabel}>댄서 이름 크기 ({settings.dancerNameSize || 8})</Text>
              <View style={styles.gridInputRow}>
                <TouchableOpacity onPress={() => setSettings({...settings, dancerNameSize: Math.max(4, (settings.dancerNameSize || 8) - 1)})}><Ionicons name="remove-circle-outline" size={24} color={theme.primary} /></TouchableOpacity>
                <TextInput style={[styles.gridInput, { width: 50 }]} keyboardType="numeric" value={(settings.dancerNameSize || 8).toString()} onChangeText={v => setSettings({...settings, dancerNameSize: parseInt(v) || 8})} />
                <TouchableOpacity onPress={() => setSettings({...settings, dancerNameSize: Math.min(20, (settings.dancerNameSize || 8) + 1)})}><Ionicons name="add-circle-outline" size={24} color={theme.primary} /></TouchableOpacity>
              </View>
            </View>
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

      <Modal visible={showGuide} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.settingsModal, { width: '90%', maxHeight: '85%' }]}>
            <View style={styles.sheetHeader}><Text style={styles.modalTitle}>동선 가이드 ({guideIndex + 1}/{GUIDE_STEPS.length})</Text><TouchableOpacity onPress={() => setShowGuide(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity></View>
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={styles.guideContent}>
                <View style={styles.guideImagePlaceholder}>
                  {GUIDE_STEPS[guideIndex].image ? <Image source={GUIDE_STEPS[guideIndex].image} style={styles.guideImage} resizeMode="contain" /> : <View style={styles.emptyImage}><Ionicons name="image-outline" size={40} color="#333" /><Text style={{ color: '#333', marginTop: 10 }}>이미지 준비 중</Text></View>}
                </View>
                <Text style={styles.guideStepTitle}>{GUIDE_STEPS[guideIndex].title}</Text>
                <Text style={styles.guideDescription}>{GUIDE_STEPS[guideIndex].description}</Text>
              </View>
            </ScrollView>
            <View style={styles.guideNav}>
              <TouchableOpacity style={[styles.navBtn, guideIndex === 0 && { opacity: 0.3 }]} disabled={guideIndex === 0} onPress={() => setGuideIndex(prev => prev - 1)}><Ionicons name="chevron-back" size={20} color="#FFF" /><Text style={styles.navBtnText}>이전</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.navBtn, guideIndex === GUIDE_STEPS.length - 1 && { backgroundColor: theme.primary }]} onPress={() => { if (guideIndex < GUIDE_STEPS.length - 1) setGuideIndex(prev => prev + 1); else setShowGuide(false); }}><Text style={[styles.navBtnText, guideIndex === GUIDE_STEPS.length - 1 && { color: '#000' }]}>{guideIndex === GUIDE_STEPS.length - 1 ? '완료' : '다음'}</Text>{guideIndex < GUIDE_STEPS.length - 1 && <Ionicons name="chevron-forward" size={20} color="#FFF" />}</TouchableOpacity>
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
  stage: { backgroundColor: '#0A0A0A', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  offStageLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.03)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)' },
  offStageRight: { position: 'absolute', right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.03)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' },
  stageBorder: { position: 'absolute', top: 0, bottom: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', pointerEvents: 'none' },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dancerNode: { position: 'absolute', alignItems: 'center' },
  dancerCircle: { justifyContent: 'center', alignItems: 'center' },
  dancerInitial: { color: '#FFF', fontWeight: 'bold' },
  dancerNameText: { color: '#AAA', fontWeight: '500', textAlign: 'center', marginTop: 4 },
  transitionBar: { paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#0A0A0A' },
  transitionInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  transitionSceneName: { color: '#FFF', fontSize: 12, fontWeight: 'bold', width: 60, textAlign: 'center' },
  transitionProgressTrack: { flex: 1, height: 4, backgroundColor: '#222', borderRadius: 2, position: 'relative', justifyContent: 'center' },
  transitionProgressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  transitionArrow: { position: 'absolute', right: -18 },
  fixedSceneContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fixedSceneText: { color: '#888', fontSize: 13, fontWeight: '500' },
  bottomDock: { borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#000' },
  createModeContent: { padding: 15 },
  dockTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  scenesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  scenesScroll: { gap: 10 },
  scenePill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: '#333', backgroundColor: '#111' },
  scenePillText: { color: '#AAA', fontWeight: 'bold', fontSize: 13 },
  placeModeContent: { padding: 15 },
  rectangleTimelineContainer: { height: 80, backgroundColor: '#111', borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#333', position: 'relative', overflow: 'hidden' },
  waveformContainer: { height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 5 },
  waveformBar: { width: 3, backgroundColor: '#FFF', borderRadius: 1.5 },
  timeMarkersLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 20 },
  timeMarker: { position: 'absolute', bottom: 0, alignItems: 'center' },
  timeMarkerLine: { width: 1, height: 5, backgroundColor: '#444' },
  timeMarkerText: { color: '#444', fontSize: 9, marginTop: 2, fontWeight: 'bold' },
  rectangleTimelineTrack: { height: '100%', position: 'relative' },
  timelineBlock: { position: 'absolute', top: 5, bottom: 20, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 2, borderRightWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  blockLabel: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  transitionX: { position: 'absolute', top: 5, bottom: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 4 },
  resizeHandleLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 25, justifyContent: 'center', alignItems: 'center' },
  resizeHandleRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 25, justifyContent: 'center', alignItems: 'center' },
  centerNeedle: { position: 'absolute', top: 0, bottom: 0, left: CENTER_OFFSET, width: 2, backgroundColor: '#FFD700', zIndex: 20 },
  centeredControls: { alignItems: 'center', gap: 10 },
  playbackRow: { flexDirection: 'row', alignItems: 'center', gap: 30 },
  mainPlayBtn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  timeInfoCenter: { backgroundColor: '#1A1A1A', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 15 },
  timeText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  bottomSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, backgroundColor: '#111' },
  sheetInput: { backgroundColor: '#000', color: '#FFF', padding: 15, borderRadius: 12, fontSize: 16, marginBottom: 15 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorChip: { width: 36, height: 36, borderRadius: 18 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 },
  settingsModal: { backgroundColor: '#1A1A1A', padding: 25, borderRadius: 25, gap: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  doneBtn: { padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 10, backgroundColor: '#333' },
  modalInput: { backgroundColor: '#000', color: '#FFF', padding: 15, borderRadius: 12, fontSize: 16, marginBottom: 10 },
  scenePillSmall: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, backgroundColor: '#333', marginRight: 10 },
  scenePillTextSmall: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  toolbar: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginVertical: 10 },
  toolItem: { alignItems: 'center', gap: 6 },
  toolIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  toolText: { color: '#888', fontSize: 11 },
  zoomControls: { position: 'absolute', top: 10, right: 15, zIndex: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 20, padding: 5, borderWidth: 1, borderColor: '#333' },
  zoomBtn: { padding: 5 },
  zoomText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginHorizontal: 8 },
  deadCenterPoint: { position: 'absolute', top: '50%', left: '50%', justifyContent: 'center', alignItems: 'center', zIndex: 0 },
  centerCrossLineH: { position: 'absolute', height: 1, backgroundColor: 'rgba(255,255,255,0.4)' },
  centerCrossLineV: { position: 'absolute', width: 1, backgroundColor: 'rgba(255,255,255,0.4)' },
  sideControlBtn: { padding: 10 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingCol: { gap: 10 },
  settingLabel: { color: '#AAA', fontSize: 15 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  gridInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' },
  gridInput: { backgroundColor: '#000', color: '#FFF', width: 60, textAlign: 'center', padding: 10, borderRadius: 8 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#333' },
  navBtnText: { color: '#FFF', fontWeight: 'bold' },
  guideContent: { alignItems: 'center', gap: 15 },
  guideImagePlaceholder: { width: '100%', height: 200, backgroundColor: '#000', borderRadius: 15, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  guideImage: { width: '100%', height: '100%' },
  guideStepTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  guideDescription: { color: '#CCC', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  guideNav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, width: '100%' },
  emptyImage: { alignItems: 'center', justifyContent: 'center' }
});
