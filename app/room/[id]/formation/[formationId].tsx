import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Modal, Alert, ScrollView, ActivityIndicator, Pressable, Image } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { Dancer, FormationScene, TimelineEntry, Position, Formation, FormationSettings } from '../../../../types';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, useDerivedValue, withSpring, withTiming, makeMutable, Easing, cancelAnimation, useAnimatedReaction } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');
const PX_PER_SEC = 60; 
const TIMELINE_CONTAINER_WIDTH = width - 30;
const CENTER_OFFSET = TIMELINE_CONTAINER_WIDTH / 2;
const COLORS = ['#FF3366', '#FF9F43', '#F7D794', '#4ECDC4', '#45B7D1', '#A06CD5', '#1B9CFC', '#E056FD', '#686DE0', '#30336B'];

const GUIDE_STEPS = [
  {
    title: '댄서 관리',
    description: '1. 하단의 "댄서 추가" 버튼으로 멤버를 무대에 올릴 수 있습니다.\n2. 무대 위 댄서 노드를 탭하면 이름 변경, 고유 색상 지정, 삭제가 가능합니다.',
    image: null
  },
  {
    title: '대형 생성 (Create Mode)',
    description: '1. "대형 생성" 탭을 선택하세요.\n2. 하단의 "대형 목록"에서 대형을 추가(+)하거나 선택하세요.\n3. 무대 위 댄서들을 드래그하여 원하는 위치에 배치하세요.',
    image: null
  },
  {
    title: '대형 배치 (Place Mode)',
    description: '1. "대형 배치" 탭을 선택하세요.\n2. 재생 바(타임라인)를 터치하여 원하는 시점에 대형을 추가하세요.\n3. 생성된 블록의 좌우 핸들을 드래그하여 유지 시간을 조절할 수 있습니다.',
    image: require('../../../../example/transitionexample.jpg')
  }
];

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
      const h = 2 + (getVal(i) * 30 * multiplier);
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

const formatTime = (ms: number) => {
  if (typeof ms !== 'number' || isNaN(ms)) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const TransitionX = ({ width, left }: { width: number, left: number }) => {
  if (width <= 5) return null;
  const height = 45; 
  const angle = Math.atan2(height, width) * (180 / Math.PI);
  const length = Math.sqrt(width * width + height * height);
  return (
    <View style={[styles.transitionXContainer, { left, width, height, top: 10 }]} pointerEvents="none">
      <View style={[styles.xLine, { width: length, top: height/2, left: (width-length)/2, transform: [{ rotate: `${angle}deg` }] }]} />
      <View style={[styles.xLine, { width: length, top: height/2, left: (width-length)/2, transform: [{ rotate: `-${angle}deg` }] }]} />
    </View>
  );
};

const ResizeHandle = ({ direction, onDragStart, onDrag }: any) => {
  const pan = Gesture.Pan()
    .onStart(() => { if(onDragStart) runOnJS(onDragStart)(); })
    .onUpdate((e) => { if(onDrag) runOnJS(onDrag)(e.translationX); });
  return (
    <GestureDetector gesture={pan}>
      <View style={direction === 'left' ? styles.resizeHandleLeft : styles.resizeHandleRight}>
        <View style={styles.handleCircle}><Ionicons name={direction === 'left' ? "chevron-back" : "chevron-forward"} size={14} color="#000" /></View>
      </View>
    </GestureDetector>
  );
};

const DancerNode = ({ dancer, dancerPos, isSelected, onPress, scale, index, settings, stageWidth, stageHeight, cellSize, mode, onDragEnd }: any) => {
  const isDragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pos = useDerivedValue(() => isDragging.value ? { x: dragX.value, y: dragY.value } : dancerPos.value);

  const panGesture = Gesture.Pan().enabled(mode === 'create')
    .onStart(() => { isDragging.value = true; startX.value = dancerPos.value.x; startY.value = dancerPos.value.y; })
    .onUpdate((e) => {
      dragX.value = Math.max(0.01, Math.min(0.99, startX.value + (e.translationX / (stageWidth * scale.value))));
      dragY.value = Math.max(0.01, Math.min(0.99, startY.value + (e.translationY / (stageHeight * scale.value))));
    })
    .onEnd(() => {
      isDragging.value = false;
      let fx = dragX.value, fy = dragY.value;
      if (settings.snapToGrid) {
        const stepX = (1 / (settings.gridCols + 4)) / 2, stepY = (1 / settings.gridRows) / 2;
        fx = Math.round(fx / stepX) * stepX; fy = Math.round(fy / stepY) * stepY;
      }
      dancerPos.value = { x: fx, y: fy };
      runOnJS(onDragEnd)(dancer.id, { x: fx, y: fy });
    });

  const style = useAnimatedStyle(() => ({
    width: cellSize * 2.5,
    transform: [
      { translateX: (pos.value.x * stageWidth) - (cellSize * 1.25) },
      { translateY: (pos.value.y * stageHeight) - (cellSize * 0.35) },
      { scale: withSpring(isSelected || isDragging.value ? 1.1 : 1) }
    ],
    zIndex: isSelected || isDragging.value ? 100 : 1
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(panGesture, Gesture.Tap().onEnd(() => runOnJS(onPress)()))}>
      <Animated.View style={[styles.dancerNode, style]} pointerEvents="box-none">
        <View style={[styles.dancerCircle, { backgroundColor: dancer.color, borderColor: isSelected ? '#FFF' : 'rgba(0,0,0,0.2)', width: cellSize * 0.7, height: cellSize * 0.7, borderRadius: (cellSize * 0.7) / 2, borderWidth: 1.5 }]}><Text style={[styles.dancerInitial, { fontSize: cellSize * 0.3 }]}>{index + 1}</Text></View>
        <Text style={[styles.dancerNameText, { color: isSelected ? '#FFF' : '#AAA', fontSize: (settings.dancerNameSize || 8) }]} numberOfLines={1}>{dancer.name}</Text>
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

  const [mode, setMode] = useState<'create' | 'place'>('create');
  const [dancers, setDancers] = useState<Dancer[]>(formation?.data?.dancers || []);
  const [scenes, setScenes] = useState<FormationScene[]>(formation?.data?.scenes || []);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(formation?.data?.timeline || []);
  const [settings, setSettings] = useState<FormationSettings>(formation?.settings || { gridRows: 10, gridCols: 10, stageDirection: 'top', snapToGrid: true, dancerNameSize: 8 });
  const [activeSceneId, setActiveSceneId] = useState<string | null>(formation?.data?.scenes?.[0]?.id || null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showDancerSheet, setShowDancerSheet] = useState(false);
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [sceneModalMode, setSceneModalMode] = useState<'add' | 'rename'>('add');
  const [targetSceneId, setTargetSceneId] = useState<string | null>(null);
  const [inputName, setInputName] = useState('');
  const [guideIndex, setGuideIndex] = useState(0);
  const [touchTimeMs, setTouchTimeMs] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [zoomUI, setZoomUI] = useState(100);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      let newScale = Math.max(0.5, Math.min(5, savedScale.value * e.scale));
      if (Math.abs(newScale - 1) < 0.07) newScale = 1; // 100% snap
      scale.value = newScale;
      runOnJS(setZoomUI)(Math.round(newScale * 100));
    })
    .onEnd(() => { savedScale.value = scale.value; });

  const panGesture = Gesture.Pan().minPointers(1).maxPointers(2)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const stageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }]
  }));

  const player = useAudioPlayer(formation?.audioUrl || '');
  const status = useAudioPlayerStatus(player);
  const currentTimeMs = useSharedValue(0);
  const [currentTimeUI, setCurrentTimeUI] = useState(0);
  const timelineScrollViewRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);

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

  useEffect(() => {
    let interval = setInterval(() => {
      runOnJS(setCurrentTimeUI)(currentTimeMs.value);
      if (status.playing && !isUserScrolling.current) {
        timelineScrollViewRef.current?.scrollTo({ x: (currentTimeMs.value / 1000) * PX_PER_SEC, animated: false });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [status.playing]);

  const dancerPositions = useMemo(() => {
    const dict: any = {};
    dancers.forEach(d => { dict[d.id] = makeMutable({ x: 0.5, y: 0.5 }); });
    return dict;
  }, [dancers]);

  useAnimatedReaction(() => ({ scenes, mode, activeId: activeSceneId }), (data, prev) => {
    if (data.mode === 'create' && (prev?.activeId !== data.activeId || prev?.mode !== data.mode)) {
      const targetScene = data.scenes.find(s => s.id === data.activeId);
      if (targetScene) dancers.forEach(d => { dancerPositions[d.id].value = withTiming(targetScene.positions[d.id] || { x: 0.5, y: 0.5 }, { duration: 400, easing: Easing.out(Easing.quad) }); });
    }
  }, [activeSceneId, mode, dancers, scenes]);

  useAnimatedReaction(() => ({ time: currentTimeMs.value, timeline, mode, scenes }), (data) => {
    if (data.mode === 'place') {
      const sorted = [...data.timeline].sort((a, b) => a.timestampMillis - b.timestampMillis);
      let prevE = null, nextE = null;
      for (let e of sorted) { if (e.timestampMillis <= data.time) prevE = e; else { nextE = e; break; } }
      dancers.forEach(d => {
        let p = { x: 0.5, y: 0.5 };
        const getScenePos = (sId: string) => data.scenes.find(s => s.id === sId)?.positions[d.id] || { x: 0.5, y: 0.5 };
        if (!prevE) p = sorted.length > 0 ? getScenePos(sorted[0]?.sceneId) : { x: 0.5, y: 0.5 };
        else {
          const prevPos = getScenePos(prevE.sceneId);
          if (data.time <= prevE.timestampMillis + prevE.durationMillis) p = prevPos;
          else if (nextE) {
            const nextPos = getScenePos(nextE.sceneId);
            const gapStart = prevE.timestampMillis + prevE.durationMillis, gapEnd = nextE.timestampMillis;
            const progress = Math.max(0, Math.min(1, (data.time - gapStart) / (gapEnd - gapStart)));
            const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            p = { x: prevPos.x + (nextPos.x - prevPos.x) * ease, y: prevPos.y + (nextPos.y - prevPos.y) * ease };
          } else p = prevPos;
        }
        dancerPositions[d.id].value = p;
      });
    }
  }, [mode, timeline, scenes, dancers]);

  const openTimelineMenuAt = (x: number) => {
    if (scenes.length === 0) { runOnJS(Alert.alert)('알림', '먼저 대형 생성 탭에서 대형을 추가해주세요.'); return; }
    let t = Math.floor((x / PX_PER_SEC) * 1000);
    setTouchTimeMs(t);
    setShowTimelineMenu(true);
  };

  const handleAddTimelineEntry = (sceneId: string) => {
    const newEntry: TimelineEntry = { id: Math.random().toString(36).substr(2, 9), sceneId, timestampMillis: touchTimeMs, durationMillis: 3000 };
    setTimeline([...timeline, newEntry]);
    setShowTimelineMenu(false);
  };

  const dragStartMs = useSharedValue(0);
  const dragStartDuration = useSharedValue(0);

  const handleDragStart = (ts: number, dur: number, id: string | null) => {
    dragStartMs.value = ts;
    dragStartDuration.value = dur;
    if(id) setSelectedEntryId(id);
  };

  const handleMoveBlock = (entryId: string, dx: number) => {
    const deltaMs = (dx / PX_PER_SEC) * 1000;
    const current = timeline.find(e => e.id === entryId);
    if (!current) return;
    const newStart = Math.max(0, dragStartMs.value + deltaMs);
    setTimeline(prevT => prevT.map(e => e.id === entryId ? { ...e, timestampMillis: newStart } : e));
  };

  const handleResize = (entryId: string, dx: number, dir: 'left' | 'right') => {
    const deltaMs = (dx / PX_PER_SEC) * 1000;
    const current = timeline.find(e => e.id === entryId);
    if (!current) return;
    if (dir === 'left') {
      let newStart = Math.max(0, dragStartMs.value + deltaMs);
      let newDuration = Math.max(500, dragStartDuration.value - deltaMs);
      setTimeline(prevT => prevT.map(e => e.id === entryId ? { ...e, timestampMillis: newStart, durationMillis: newDuration } : e));
    } else {
      let newDuration = Math.max(500, dragStartDuration.value + deltaMs);
      setTimeline(prevT => prevT.map(e => e.id === entryId ? { ...e, durationMillis: newDuration } : e));
    }
  };

  const handleSceneAction = () => {
    if (sceneModalMode === 'add') {
      const nid = Math.random().toString(36).substr(2,9), last = scenes[scenes.length-1];
      const nScenes = [...scenes, { id: nid, name: inputName.trim() || `대형 ${scenes.length+1}`, positions: last ? JSON.parse(JSON.stringify(last.positions)) : {} }];
      setScenes(nScenes); setActiveSceneId(nid);
    } else if (sceneModalMode === 'rename' && targetSceneId) setScenes(prev => prev.map(s => s.id === targetSceneId ? {...s, name: inputName.trim() || s.name} : s));
    setShowSceneModal(false); setInputName('');
  };

  const addDancer = () => {
    const newDancer: Dancer = { id: Math.random().toString(36).substr(2, 9), name: `댄서 ${dancers.length + 1}`, color: COLORS[dancers.length % COLORS.length] };
    setDancers([...dancers, newDancer]);
  };

  const handleSave = async () => { try { await updateFormation(formationId!, { settings, data: { dancers, scenes, timeline } }); Alert.alert('저장 완료'); } catch (e: any) { Alert.alert('오류', e.message); } };

  const handleTimelineScroll = (e: any) => {
    if (isUserScrolling.current && !status.playing) {
      const offset = e.nativeEvent.contentOffset.x;
      const newTimeMs = (offset / PX_PER_SEC) * 1000;
      currentTimeMs.value = newTimeMs;
      setCurrentTimeUI(newTimeMs);
      runOnJS(player.seekTo)(newTimeMs / 1000);
    }
  };

  const resetStage = () => { scale.value = withSpring(1); translateX.value = withSpring(0); translateY.value = withSpring(0); savedScale.value = 1; savedTranslateX.value = 0; savedTranslateY.value = 0; setZoomUI(100); };

  const exportAsFile = async () => {
    const data = { title: formation?.title, settings, data: { dancers, scenes, timeline } };
    const filePath = `${FileSystem.documentDirectory}formation_${formationId}.json`;
    try { await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data)); await Sharing.shareAsync(filePath); } catch (e) { Alert.alert('오류', '파일 추출 실패'); }
  };

  const exportAsVideo = async () => {
    setIsExporting(true);
    try { await updateFormation(formationId!, { settings, data: { dancers, scenes, timeline } }); await publishFormationAsFeedback(id!, formationId!, formation!.title); Alert.alert('성공', '피드백 영상 업로드 완료'); } catch (e: any) { Alert.alert('오류', e.message); }
    finally { setIsExporting(false); }
  };

  const showExportOptions = () => { Alert.alert('내보내기', '방식을 선택하세요.', [{ text: 'JSON 파일 추출', onPress: exportAsFile }, { text: '피드백 영상 업로드', onPress: exportAsVideo }, { text: '취소', style: 'cancel' }]); };

  if (!formation) return null;
  const STAGE_CELL_SIZE = (width - 40) / (settings.gridCols + 4);
  const STAGE_WIDTH = (settings.gridCols + 4) * STAGE_CELL_SIZE;
  const STAGE_HEIGHT = settings.gridRows * STAGE_CELL_SIZE;

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
        <View style={styles.modeToggle}><TouchableOpacity onPress={() => setMode('create')} style={[styles.modeTab, mode === 'create' && styles.activeTab]}><Text style={styles.tabText}>대형 생성</Text></TouchableOpacity><TouchableOpacity onPress={() => setMode('place')} style={[styles.modeTab, mode === 'place' && styles.activeTab]}><Text style={styles.tabText}>대형 배치</Text></TouchableOpacity></View>
        <View style={{ flexDirection: 'row', gap: 15 }}><TouchableOpacity onPress={showExportOptions} disabled={isExporting}>{isExporting ? <ActivityIndicator size="small" /> : <Ionicons name="share-outline" size={24} color={theme.primary} />}</TouchableOpacity><TouchableOpacity onPress={handleSave}><Ionicons name="save-outline" size={24} color={theme.primary} /></TouchableOpacity></View>
      </View>

      <View style={styles.stageSection}>
        <View style={styles.zoomControls}><TouchableOpacity style={styles.zoomBtn} onPress={resetStage}><Text style={styles.zoomText}>{zoomUI}%</Text></TouchableOpacity><TouchableOpacity style={styles.zoomBtn} onPress={() => { scale.value = withTiming(Math.min(5, scale.value + 0.5)); savedScale.value = Math.min(5, scale.value + 0.5); runOnJS(setZoomUI)(Math.round(Math.min(5, scale.value + 0.5) * 100)); }}><Ionicons name="add" size={20} color="#FFF" /></TouchableOpacity><TouchableOpacity style={styles.zoomBtn} onPress={() => { scale.value = withTiming(Math.max(0.5, scale.value - 0.5)); savedScale.value = Math.max(0.5, scale.value - 0.5); runOnJS(setZoomUI)(Math.round(Math.max(0.5, scale.value - 0.5) * 100)); }}><Ionicons name="remove" size={20} color="#FFF" /></TouchableOpacity></View>
        <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
          <View style={styles.stageWrapper}><Animated.View style={[styles.stage, { width: STAGE_WIDTH, height: STAGE_HEIGHT }, stageAnimatedStyle]}><View style={[styles.offStageArea, { left: 0, width: STAGE_CELL_SIZE * 2 }]} /><View style={[styles.offStageArea, { right: 0, width: STAGE_CELL_SIZE * 2 }]} /><View style={styles.gridLayer}>{Array.from({length: settings.gridRows + 1}).map((_, i) => <View key={i} style={[styles.gridH, { top: `${(i/settings.gridRows)*100}%` }]} />)}{Array.from({length: settings.gridCols + 5}).map((_, i) => <View key={i} style={[styles.gridV, { left: `${(i/(settings.gridCols+4))*100}%` }]} />)}</View>{dancers.map((d, i) => (<DancerNode key={d.id} index={i} dancer={d} dancerPos={dancerPositions[d.id]} isSelected={selectedDancerId === d.id} onPress={() => { setSelectedDancerId(d.id); setShowDancerSheet(true); }} mode={mode} settings={settings} stageWidth={STAGE_WIDTH} stageHeight={STAGE_HEIGHT} cellSize={STAGE_CELL_SIZE} scale={scale} onDragEnd={(id:string, p:Position) => { if(activeSceneId) setScenes(prev => prev.map(s => s.id === activeSceneId ? {...s, positions: {...s.positions, [id]: p}} : s)); }} />))}</Animated.View></View>
        </GestureDetector>
      </View>

      <View style={[styles.bottomDock, { paddingBottom: insets.bottom + 10 }]}>
        {mode === 'place' ? (
          <View style={styles.placeDock}>
            <View style={styles.timelineWrapper}>
              <ScrollView ref={timelineScrollViewRef} horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={handleTimelineScroll} contentContainerStyle={{ paddingHorizontal: CENTER_OFFSET }} onScrollBeginDrag={() => { isUserScrolling.current = true; cancelAnimation(currentTimeMs); runOnJS(setSelectedEntryId)(null); }} onScrollEndDrag={() => isUserScrolling.current = false}>
                <GestureDetector gesture={Gesture.Tap().onEnd((e) => runOnJS(openTimelineMenuAt)(e.x))}>
                  <View style={{ width: (status.duration || 60) * PX_PER_SEC, height: 80 }}><WaveformBackground duration={status.duration || 60} seed={formation?.audioUrl || 'default'} /><TimeMarkers duration={status.duration || 60} /><View style={styles.timelineTrack}>
                      {[...timeline].sort((a,b)=>a.timestampMillis-b.timestampMillis).map((e, idx, arr) => (
                        <React.Fragment key={e.id}>
                          <GestureDetector gesture={Gesture.Exclusive(Gesture.Pan().onStart(() => { runOnJS(handleDragStart)(e.timestampMillis, e.durationMillis, e.id); }).onUpdate((g) => runOnJS(handleMoveBlock)(e.id, g.translationX)), Gesture.Tap().onEnd(() => { if (selectedEntryId === e.id) { runOnJS(Alert.alert)('삭제', '제거할까요?', [{text:'취소'}, {text:'삭제', onPress:()=>setTimeline(prev=>prev.filter(x=>x.id!==e.id))}]); } else runOnJS(setSelectedEntryId)(e.id); }))}>
                            <View style={[styles.block, { left: (e.timestampMillis/1000)*PX_PER_SEC, width: (e.durationMillis/1000)*PX_PER_SEC, backgroundColor: selectedEntryId === e.id ? theme.primary : '#AAA' }]}><Text style={[styles.blockText, { color: selectedEntryId === e.id ? '#000' : '#FFF' }]} numberOfLines={1}>{scenes.find(s=>s.id===e.sceneId)?.name}</Text>
                              {selectedEntryId === e.id && (<><ResizeHandle direction="left" onDragStart={() => handleDragStart(e.timestampMillis, e.durationMillis, null)} onDrag={(dx:number) => handleResize(e.id, dx, 'left')} /><ResizeHandle direction="right" onDragStart={() => handleDragStart(e.timestampMillis, e.durationMillis, null)} onDrag={(dx:number) => handleResize(e.id, dx, 'right')} /></>)}
                            </View>
                          </GestureDetector>
                          {idx < arr.length - 1 && <TransitionX left={((e.timestampMillis+e.durationMillis)/1000)*PX_PER_SEC} width={(arr[idx+1].timestampMillis - (e.timestampMillis+e.durationMillis))/1000*PX_PER_SEC} />}
                        </React.Fragment>
                      ))}</View></View>
                </GestureDetector>
              </ScrollView>
              <View style={styles.needle} />
            </View>
            <View style={styles.controls}><TouchableOpacity onPress={() => { if(status.playing) player.pause(); else { player.seekTo(currentTimeUI / 1000); player.play(); } }} style={[styles.playBtn, { backgroundColor: theme.primary }]}><Ionicons name={status.playing ? "pause" : "play"} size={32} color="#000" /></TouchableOpacity><Text style={styles.timeText}>{formatTime(currentTimeUI)}</Text></View>
          </View>
        ) : (
          <View style={styles.createDock}>
            <View style={styles.createToolbar}><TouchableOpacity style={styles.toolBtn} onPress={addDancer}><Ionicons name="person-add" size={24} color={theme.primary} /><Text style={styles.toolBtnText}>댄서 추가</Text></TouchableOpacity><TouchableOpacity style={styles.toolBtn} onPress={() => setShowStageSettings(true)}><Ionicons name="settings-outline" size={24} color="#AAA" /><Text style={styles.toolBtnText}>무대 설정</Text></TouchableOpacity><TouchableOpacity style={styles.toolBtn} onPress={() => { setGuideIndex(0); setShowGuide(true); }}><Ionicons name="help-circle-outline" size={24} color="#AAA" /><Text style={styles.toolBtnText}>가이드</Text></TouchableOpacity></View>
            <View style={styles.sceneSection}><TouchableOpacity style={styles.addSceneBtnWide} onPress={() => { setSceneModalMode('add'); setInputName(''); setShowSceneModal(true); }}><Ionicons name="add-circle" size={20} color="#000" /><Text style={styles.addSceneText}>대형 추가</Text></TouchableOpacity><ScrollView horizontal showsHorizontalScrollIndicator={false}>{scenes.map(s => (<TouchableOpacity key={s.id} onLongPress={() => { Alert.alert(s.name, '작업', [{ text: '이름 변경', onPress: () => { setSceneModalMode('rename'); setTargetSceneId(s.id); setInputName(s.name); setShowSceneModal(true); } }, { text: '삭제', style: 'destructive', onPress: () => setScenes(scenes.filter(x => x.id !== s.id)) }, { text: '취소' }]); }} onPress={() => setActiveSceneId(s.id)} style={[styles.scenePill, activeSceneId === s.id && { backgroundColor: theme.primary }]}><Text style={{color: activeSceneId === s.id ? '#000' : '#FFF'}}>{s.name}</Text></TouchableOpacity>))}</ScrollView></View>
          </View>
        )}
      </View>

      <Modal visible={showTimelineMenu} transparent animationType="fade"><Pressable style={styles.modalBg} onPress={() => setShowTimelineMenu(false)}><View style={styles.menu}><Text style={styles.menuTitle}>대형 선택 ({formatTime(touchTimeMs)})</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{scenes.map(s => <TouchableOpacity key={s.id} onPress={() => handleAddTimelineEntry(s.id)} style={styles.menuItem}><Text style={{color:'#FFF'}}>{s.name}</Text></TouchableOpacity>)}</ScrollView></View></Pressable></Modal>
      <Modal visible={showSceneModal} transparent animationType="fade"><View style={styles.modalBg}><View style={styles.menu}><Text style={styles.menuTitle}>{sceneModalMode === 'add' ? '대형 추가' : '이름 변경'}</Text><TextInput style={styles.sheetInput} value={inputName} onChangeText={setInputName} placeholder="대형 이름" autoFocus /><View style={{flexDirection:'row', justifyContent:'flex-end', gap:20}}><TouchableOpacity onPress={() => setShowSceneModal(false)}><Text style={{color:'#888'}}>취소</Text></TouchableOpacity><TouchableOpacity onPress={handleSceneAction}><Text style={{color:theme.primary, fontWeight:'bold'}}>{sceneModalMode === 'add' ? '추가' : '저장'}</Text></TouchableOpacity></View></View></View></Modal>
      <Modal visible={showDancerSheet} transparent animationType="slide"><Pressable style={styles.modalBg} onPress={() => setShowDancerSheet(false)}><View style={styles.sheet}><TextInput style={styles.sheetInput} value={dancers.find(d => d.id === selectedDancerId)?.name} onChangeText={val => setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, name: val } : d))} /><View style={styles.colorRow}>{COLORS.map(c => <TouchableOpacity key={c} style={[styles.colorChip, { backgroundColor: c }, dancers.find(d => d.id === selectedDancerId)?.color === c && { borderWidth: 3, borderColor: '#FFF' }]} onPress={() => setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, color: c } : d))} />)}</View><TouchableOpacity style={styles.deleteBtn} onPress={() => { setDancers(dancers.filter(d => d.id !== selectedDancerId)); setSelectedDancerId(null); setShowDancerSheet(false); }}><Ionicons name="trash" size={20} color="#FF4444" /><Text style={{ color: '#FF4444', marginLeft: 10 }}>댄서 삭제</Text></TouchableOpacity></View></Pressable></Modal>
      <Modal visible={showStageSettings} transparent animationType="fade"><View style={styles.modalBg}><View style={styles.menu}><Text style={styles.menuTitle}>무대 설정</Text><View style={styles.settingRow}><Text style={{color:'#FFF'}}>격자 스냅</Text><TouchableOpacity onPress={() => setSettings({...settings, snapToGrid: !settings.snapToGrid})}><Ionicons name={settings.snapToGrid ? "checkbox" : "square-outline"} size={24} color={theme.primary} /></TouchableOpacity></View><TouchableOpacity style={styles.doneBtn} onPress={() => setShowStageSettings(false)}><Text style={{fontWeight:'bold'}}>확인</Text></TouchableOpacity></View></View></Modal>
      <Modal visible={showGuide} transparent animationType="fade"><View style={styles.modalBg}><View style={[styles.menu, {width:'90%'}]}><Text style={styles.menuTitle}>{GUIDE_STEPS[guideIndex].title}</Text><Text style={{color:'#CCC', marginVertical:15}}>{GUIDE_STEPS[guideIndex].description}</Text><View style={{flexDirection:'row', justifyContent:'space-between'}}><TouchableOpacity onPress={() => setGuideIndex(prev => Math.max(0, prev-1))}><Text style={{color:'#FFF'}}>이전</Text></TouchableOpacity><TouchableOpacity onPress={() => { if(guideIndex < 2) setGuideIndex(prev=>prev+1); else setShowGuide(false); }}><Text style={{color:theme.primary}}>{guideIndex === 2 ? '닫기' : '다음'}</Text></TouchableOpacity></View></View></View></Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  modeToggle: { flexDirection: 'row', backgroundColor: '#222', borderRadius: 20, padding: 4 },
  modeTab: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 18 },
  activeTab: { backgroundColor: '#444' },
  tabText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  stageSection: { flex: 1, overflow: 'hidden', position: 'relative' },
  stageWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#333' },
  offStageArea: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.05)', zIndex: 1 },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  dancerNode: { position: 'absolute', alignItems: 'center' },
  dancerCircle: { justifyContent: 'center', alignItems: 'center' },
  dancerInitial: { color: '#FFF', fontWeight: 'bold' },
  dancerNameText: { color: '#AAA', marginTop: 4 },
  bottomDock: { backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#222' },
  placeDock: { padding: 15 },
  timelineWrapper: { height: 80, position: 'relative', marginBottom: 15, backgroundColor: '#111', borderRadius: 10, overflow: 'hidden' },
  waveformContainer: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 5 },
  waveformBar: { width: 3, backgroundColor: '#FFF', borderRadius: 1.5 },
  timeMarkersLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 20 },
  timeMarker: { position: 'absolute', bottom: 0, alignItems: 'center' },
  timeMarkerLine: { width: 1, height: 5, backgroundColor: '#444' },
  timeMarkerText: { color: '#444', fontSize: 9, marginTop: 2, fontWeight: 'bold' },
  timelineTrack: { flex: 1, position: 'relative' },
  block: { position: 'absolute', top: 10, bottom: 25, borderRadius: 4, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, zIndex: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  blockText: { fontSize: 10, fontWeight: 'bold' },
  needle: { position: 'absolute', top: 0, bottom: 0, left: CENTER_OFFSET, width: 2, backgroundColor: '#FFD700', zIndex: 100 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  playBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  timeText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  createDock: { padding: 15 },
  createToolbar: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  toolBtn: { alignItems: 'center', gap: 4 },
  toolBtnText: { color: '#888', fontSize: 11 },
  sceneSection: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addSceneBtnWide: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, gap: 6 },
  addSceneText: { color: '#000', fontWeight: 'bold', fontSize: 12 },
  scenePill: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#222', borderRadius: 15, marginRight: 10 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  menu: { backgroundColor: '#1A1A1A', padding: 25, borderRadius: 20, width: '80%' },
  menuTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  menuItem: { padding: 15, backgroundColor: '#333', borderRadius: 10, marginRight: 10 },
  transitionXContainer: { position: 'absolute', zIndex: 15 },
  xLine: { position: 'absolute', height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  resizeHandleLeft: { position: 'absolute', left: -15, top: 0, bottom: 0, width: 30, justifyContent: 'center', alignItems: 'center', zIndex: 60 },
  resizeHandleRight: { position: 'absolute', right: -15, top: 0, bottom: 0, width: 30, justifyContent: 'center', alignItems: 'center', zIndex: 60 },
  handleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  sheet: { backgroundColor: '#111', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, width: '100%', position: 'absolute', bottom: 0 },
  sheetInput: { backgroundColor: '#000', color: '#FFF', padding: 15, borderRadius: 12, marginBottom: 15 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorChip: { width: 30, height: 30, borderRadius: 15 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  doneBtn: { backgroundColor: '#333', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  zoomControls: { position: 'absolute', top: 15, right: 15, zIndex: 100, flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 20, padding: 4, borderWidth: 1, borderColor: '#333' },
  zoomBtn: { paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' }
});
