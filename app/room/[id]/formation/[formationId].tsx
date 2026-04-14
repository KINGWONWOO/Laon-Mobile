import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Modal, Alert, ActivityIndicator, Pressable, Image, ScrollView, Platform } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { Dancer, FormationScene, TimelineEntry, Position, Formation, FormationSettings } from '../../../../types';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, useDerivedValue, withSpring, withTiming, makeMutable, Easing, cancelAnimation, useAnimatedReaction, useAnimatedRef, scrollTo } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { storageService } from '../../../../services/storageService';

const { width } = Dimensions.get('window');
const PX_PER_SEC = 60; 
const TIMELINE_CONTAINER_WIDTH = width - 30;
const CENTER_OFFSET = TIMELINE_CONTAINER_WIDTH / 2;
const COLORS = ['#FF3366', '#FF9F43', '#F7D794', '#4ECDC4', '#45B7D1', '#A06CD5', '#1B9CFC', '#E056FD', '#686DE0', '#30336B'];

const formatTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

const PlaybackTimeDisplay = React.memo(function PlaybackTimeDisplay({ player }: { player: any }) {
  const status = useAudioPlayerStatus(player);
  const { theme } = useAppContext();
  return <Text style={[styles.timeText, { color: theme.text }]}>{formatTime(status.currentTime * 1000)}</Text>;
});

const PlayButton = React.memo(function PlayButton({ player, theme, currentTimeMs }: { player: any, theme: any, currentTimeMs: any }) {
  const status = useAudioPlayerStatus(player);
  return (
    <TouchableOpacity 
      onPress={() => { 
        if(status.playing) player.pause(); 
        else {
          player.seekTo(currentTimeMs.value / 1000);
          player.play();
        }
      }} 
      style={[styles.playBtn, { backgroundColor: theme.primary }]}
    >
      <Ionicons name={status.playing ? "pause" : "play"} size={32} color={theme.background} />
    </TouchableOpacity>
  );
});

const WaveformBackground = React.memo(function WaveformBackground({ duration, seed = 'default' }: { duration: number, seed?: string }) {
  const { theme } = useAppContext();
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
        <View key={i} style={[styles.waveformBar, { height: bar.height, opacity: bar.opacity, backgroundColor: bar.opacity > 0.3 ? theme.text : theme.textSecondary }]} />
      ))}
    </View>
  );
});

const TimeMarkers = React.memo(function TimeMarkers({ duration }: { duration: number }) {
  const { theme } = useAppContext();
  const markers = useMemo(() => {
    const list = [];
    for (let i = 0; i <= duration; i += 5) {
      list.push(
        <View key={i} style={[styles.timeMarker, { left: i * PX_PER_SEC }]}>
          <View style={[styles.timeMarkerLine, { backgroundColor: theme.border }]} /><Text style={[styles.timeMarkerText, { color: theme.textSecondary }]}>{Math.floor(i / 60)}:{(i % 60).toString().padStart(2, '0')}</Text>
        </View>
      );
    }
    return list;
  }, [duration, theme]);
  return <View style={styles.timeMarkersLayer}>{markers}</View>;
});

const MiniFormationPreview = React.memo(function MiniFormationPreview({ scene, dancers, settings }: { scene: FormationScene, dancers: Dancer[], settings: FormationSettings }) {
  const aspectRatio = settings.gridCols / settings.gridRows;
  return (
    <View style={{ flex: 1, width: '100%', padding: 8, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: '100%', height: '100%', aspectRatio, maxHeight: '100%', maxWidth: '100%', position: 'relative' }}>
        {dancers.map(d => {
          const pos = scene.positions[d.id] || { x: 0.5, y: 0.5 };
          return <View key={d.id} style={[styles.miniDancer, { backgroundColor: d.color, left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }]} />;
        })}
      </View>
    </View>
  );
});

const TransitionX = React.memo(function TransitionX({ width, left }: { width: number, left: number }) {
  const safeWidth = Math.max(0, width);
  if (safeWidth <= 5) return null;
  const height = 85; 
  const angle = Math.atan2(height, safeWidth) * (180 / Math.PI);
  const length = Math.sqrt(safeWidth * safeWidth + height * height);
  const { theme } = useAppContext();
  return (
    <View style={[styles.transitionXContainer, { left, width: safeWidth, height, top: 10 }]} pointerEvents="none">
      <View style={[styles.xLine, { width: length, top: height/2, left: (safeWidth-length)/2, transform: [{ rotate: `${angle}deg` }], backgroundColor: theme.textSecondary + '33' }]} />
      <View style={[styles.xLine, { width: length, top: height/2, left: (safeWidth-length)/2, transform: [{ rotate: `-${angle}deg` }], backgroundColor: theme.textSecondary + '33' }]} />
    </View>
  );
});

const ResizeHandle = ({ direction, localX, localWidth, startX, startW, minX, maxX, onCommit }: any) => {
  const { theme } = useAppContext();
  const pan = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startX.value = localX.value;
      startW.value = localWidth.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (direction === 'left') {
        const newX = Math.max(minX, Math.min(startX.value + e.translationX, startX.value + startW.value - 10));
        const actualDiff = newX - startX.value;
        localX.value = newX;
        localWidth.value = startW.value - actualDiff;
      } else {
        localWidth.value = Math.max(10, Math.min(startW.value + e.translationX, maxX - localX.value));
      }
    })
    .onEnd((e) => {
      'worklet';
      runOnJS(onCommit)(e.translationX);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={direction === 'left' ? styles.resizeHandleLeft : styles.resizeHandleRight}>
        <View style={[styles.handleCircle, { backgroundColor: theme.text }]}>
          <Ionicons name={direction === 'left' ? "chevron-back" : "chevron-forward"} size={14} color={theme.background} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const TimelineBlock = React.memo(function TimelineBlock({ entry, isSelected, sceneName, theme, minX, maxX, onSelect, onCommitMove, onCommitResize, onDelete, dancers, scenes, settings }: any) {
  const localX = useSharedValue((entry.timestampMillis / 1000) * PX_PER_SEC);
  const localWidth = useSharedValue((entry.durationMillis / 1000) * PX_PER_SEC);
  const startX = useSharedValue(0);

  useEffect(() => {
    localX.value = (entry.timestampMillis / 1000) * PX_PER_SEC;
    localWidth.value = (entry.durationMillis / 1000) * PX_PER_SEC;
  }, [entry.timestampMillis, entry.durationMillis]);

  const scene = scenes.find((s: any) => s.id === entry.sceneId);

  const animatedStyle = useAnimatedStyle(() => ({
    left: localX.value,
    width: localWidth.value,
    backgroundColor: isSelected ? (theme.primary + 'AA') : (theme.card + 'CC'),
    borderColor: isSelected ? theme.primary : theme.border,
    zIndex: isSelected ? 100 : 50
  }));

  const pan = Gesture.Pan()
    .enabled(isSelected)
    .onStart(() => {
      'worklet';
      startX.value = localX.value;
    })
    .onUpdate((g) => {
      'worklet';
      const newX = startX.value + g.translationX;
      localX.value = Math.max(minX, Math.min(newX, maxX - localWidth.value));
    })
    .onEnd((g) => {
      'worklet';
      runOnJS(onCommitMove)(entry.id, g.translationX);
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      if (isSelected) {
        Alert.alert('삭제', '제거할까요?', [{ text: '취소' }, { text: '삭제', onPress: () => onDelete(entry.id) }]);
      } else {
        onSelect(entry.id);
      }
    });

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View style={[styles.block, animatedStyle, { borderWidth: 1 }]}>
        {scene && (
          <View style={styles.blockPreview}>
            <MiniFormationPreview scene={scene} dancers={dancers} settings={settings} />
          </View>
        )}
        <Text style={[styles.blockText, { color: isSelected ? theme.background : theme.text }]} numberOfLines={1}>{sceneName}</Text>
        {isSelected && (
          <>
            <ResizeHandle 
              direction="left" 
              localX={localX} localWidth={localWidth} startX={startX} startW={localWidth}
              minX={minX} maxX={maxX}
              onCommit={(dx: number) => onCommitResize(entry.id, dx, 'left')}
            />
            <ResizeHandle 
              direction="right" 
              localX={localX} localWidth={localWidth} startX={startX} startW={localWidth}
              minX={minX} maxX={maxX}
              onCommit={(dx: number) => onCommitResize(entry.id, dx, 'right')}
            />
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
});

const DancerNode = React.memo(function DancerNode({ dancer, dancerPos, isSelected, onPress, scale, index, settings, stageWidth, stageHeight, cellSize, mode, onDragEnd, canDragInPlace }: any) {
  const isDragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  
  const pos = useDerivedValue(() => {
    if (isDragging.value) return { x: dragX.value, y: dragY.value };
    return dancerPos?.value || { x: 0.5, y: 0.5 };
  });

  const canDrag = mode === 'create' || (mode === 'place' && canDragInPlace);

  const panGesture = Gesture.Pan().enabled(canDrag)
    .onStart(() => { 
      'worklet';
      isDragging.value = true; 
      startX.value = dancerPos?.value?.x || 0.5; 
      startY.value = dancerPos?.value?.y || 0.5; 
    })
    .onUpdate((e) => {
      'worklet';
      dragX.value = Math.max(0.01, Math.min(0.99, startX.value + (e.translationX / (stageWidth * scale.value))));
      dragY.value = Math.max(0.01, Math.min(0.99, startY.value + (e.translationY / (stageHeight * scale.value))));
    })
    .onEnd(() => {
      'worklet';
      isDragging.value = false;
      let fx = dragX.value, fy = dragY.value;
      if (settings.snapToGrid) {
        const stepX = (1 / settings.gridCols) / 2, stepY = (1 / settings.gridRows) / 2;
        fx = Math.round(fx / stepX) * stepX; fy = Math.round(fy / stepY) * stepY;
      }
      if (dancerPos) dancerPos.value = { x: fx, y: fy };
      runOnJS(onDragEnd)(dancer.id, { x: fx, y: fy });
    });

  const style = useAnimatedStyle(() => ({
    width: cellSize * 2.5,
    transform: [
      { translateX: (pos.value.x * stageWidth) - (cellSize * 1.25) },
      { translateY: (pos.value.y * stageHeight) - (cellSize * 0.35) },
      { scale: withSpring(isSelected || isDragging.value ? 1.1 : 1) }
    ],
    opacity: mode === 'place' ? (canDragInPlace ? 1 : 0.4) : 1,
    zIndex: isSelected || isDragging.value ? 100 : 1
  }));

  const { theme } = useAppContext();

  return (
    <GestureDetector gesture={Gesture.Exclusive(panGesture, Gesture.Tap().runOnJS(true).onEnd(() => {
      if (canDrag) onPress();
    }))}>
      <Animated.View style={[styles.dancerNode, style]} pointerEvents="box-none">
        <View style={[styles.dancerCircle, { backgroundColor: dancer.color, borderColor: isSelected ? theme.text : 'rgba(0,0,0,0.2)', width: cellSize * 0.7, height: cellSize * 0.7, borderRadius: (cellSize * 0.7) / 2, borderWidth: 1.5 }]}><Text style={[styles.dancerInitial, { fontSize: cellSize * 0.3 }]}>{index + 1}</Text></View>
        <Text style={[styles.dancerNameText, { color: isSelected ? theme.text : theme.textSecondary, fontSize: (settings.dancerNameSize || 8) }]} numberOfLines={1}>{dancer.name}</Text>
      </Animated.View>
    </GestureDetector>
  );
});

const GhostDancer = React.memo(function GhostDancer({ dancer, pos, stageWidth, stageHeight, cellSize }: any) {
  return (
    <View 
      style={[
        styles.dancerNode, 
        { 
          position: 'absolute',
          width: cellSize * 2.5,
          transform: [
            { translateX: (pos.x * stageWidth) - (cellSize * 1.25) },
            { translateY: (pos.y * stageHeight) - (cellSize * 0.35) }
          ],
          opacity: 0.2,
          zIndex: 0
        }
      ]} 
      pointerEvents="none"
    >
      <View style={[styles.dancerCircle, { backgroundColor: dancer.color, borderColor: 'rgba(255,255,255,0.2)', width: cellSize * 0.7, height: cellSize * 0.7, borderRadius: (cellSize * 0.7) / 2, borderWidth: 1 }]} />
    </View>
  );
});

const GridLayer = React.memo(function GridLayer({ settings }: { settings: FormationSettings }) {
  return (
    <View style={styles.gridLayer}>
      {Array.from({ length: settings.gridRows + 1 }).map((_, i) => (
        <View key={`h-${i}`} style={[styles.gridH, { top: `${(i / settings.gridRows) * 100}%` }]} />
      ))}
      {Array.from({ length: settings.gridCols + 1 }).map((_, i) => (
        <View key={`v-${i}`} style={[styles.gridV, { left: `${(i / settings.gridCols) * 100}%` }]} />
      ))}
    </View>
  );
});

const GUIDE_STEPS = [
  { title: '대형 생성', description: '댄서를 추가하고 드래그하여 원하는 위치에 배치하세요. 아래 씬 목록에서 대형을 전환하거나 관리할 수 있습니다.' },
  { title: '대형 배치', description: '음악의 특정 시점에 대형을 배치하세요. 배치된 블록의 길이를 조절하여 대형 유지 시간을 설정할 수 있습니다.' },
  { title: '애니메이션', description: '배치된 대형 사이에는 자동으로 부드러운 이동 애니메이션이 적용됩니다. 재생 버튼을 눌러 확인해 보세요!' }
];

interface HistoryState {
  dancers: Dancer[];
  scenes: FormationScene[];
  timeline: TimelineEntry[];
}

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
  const [settings, setSettings] = useState<FormationSettings>(formation?.settings || { gridRows: 10, gridCols: 20, stageDirection: 'top', snapToGrid: true, dancerNameSize: 8 });
  const [activeSceneId, setActiveSceneId] = useState<string | null>(formation?.data?.scenes?.[0]?.id || null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showDancerSheet, setShowDancerSheet] = useState(false);
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [showMirrorModal, setShowMirrorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishTitle, setPublishTitle] = useState('');
  const [selectedMirrorType, setSelectedMirrorType] = useState<'horizontal' | 'vertical' | 'both'>('horizontal');
  const [sceneModalMode, setSceneModalMode] = useState<'add' | 'rename'>('add');
  const [targetSceneId, setTargetSceneId] = useState<string | null>(null);
  const [inputName, setInputName] = useState('');
  const [guideIndex, setGuideIndex] = useState(0);
  const [touchTimeMs, setTouchTimeMs] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [zoomUI, setZoomUI] = useState(100);

  const [tempRows, setTempRows] = useState('');
  const [tempCols, setTempCols] = useState('');

  // SharedValues 및 Refs 선언
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const currentTimeMs = useSharedValue(0);
  const isPlayerPlayingSV = useSharedValue(false);
  const isUserScrollingSV = useSharedValue(false);
  const timelineScrollViewRef = useAnimatedRef<Animated.ScrollView>();

  const player = useAudioPlayer(formation?.audioUrl || '');
  const status = useAudioPlayerStatus(player);

  const dancerPositionsRef = useRef<Record<string, any>>({});
  dancers.forEach(d => {
    if (!dancerPositionsRef.current[d.id]) {
      const activeScene = scenes.find(s => s.id === activeSceneId);
      const initialPos = activeScene?.positions[d.id] || { x: 0.5, y: 0.5 };
      dancerPositionsRef.current[d.id] = makeMutable(initialPos);
    }
  });
  const dancerPositions = dancerPositionsRef.current;

  // 히스토리 관리 (모드별 분리)
  const [createPast, setCreatePast] = useState<HistoryState[]>([]);
  const [createFuture, setCreateFuture] = useState<HistoryState[]>([]);
  const [placePast, setPlacePast] = useState<HistoryState[]>([]);
  const [placeFuture, setPlaceFuture] = useState<HistoryState[]>([]);

  const [nextSceneId, setNextSceneId] = useState<string | null>(null);
  const [activeEntryIdInPlace, setActiveEntryIdInPlace] = useState<string | null>(null);

  useAnimatedReaction(
    () => {
      const sorted = [...timeline].sort((a, b) => a.timestampMillis - b.timestampMillis);
      const next = sorted.find(e => e.timestampMillis > currentTimeMs.value);
      
      let currentEntryId = null;
      for (let e of sorted) {
        // 재생바가 블록 범위 내에 정확히 있을 때만 에디팅 활성화
        if (currentTimeMs.value >= e.timestampMillis && currentTimeMs.value < e.timestampMillis + e.durationMillis) {
          currentEntryId = e.id;
          break;
        }
      }
      return { nextId: next?.sceneId || null, currentEntryId };
    },
    (data) => {
      if (data.nextId !== nextSceneId) {
        runOnJS(setNextSceneId)(data.nextId);
      }
      if (data.currentEntryId !== activeEntryIdInPlace) {
        runOnJS(setActiveEntryIdInPlace)(data.currentEntryId);
      }
    },
    [timeline]
  );

  const activeSceneIdToEdit = useMemo(() => {
    if (mode === 'create') return activeSceneId;
    if (mode === 'place' && activeEntryIdInPlace) {
      return timeline.find(e => e.id === activeEntryIdInPlace)?.sceneId || null;
    }
    return null;
  }, [mode, activeSceneId, activeEntryIdInPlace, timeline]);

  const pushHistory = useCallback(() => {
    const current: HistoryState = { dancers: JSON.parse(JSON.stringify(dancers)), scenes: JSON.parse(JSON.stringify(scenes)), timeline: JSON.parse(JSON.stringify(timeline)) };
    if (mode === 'create') { setCreatePast(prev => [...prev, current].slice(-30)); setCreateFuture([]); }
    else { setPlacePast(prev => [...prev, current].slice(-30)); setPlaceFuture([]); }
  }, [dancers, scenes, timeline, mode]);

  const onDragEnd = useCallback((dancerId: string, pos: Position) => {
    const targetId = activeSceneIdToEdit;
    if (!targetId) return;

    setScenes(prev => prev.map(s => s.id === targetId ? {
      ...s,
      positions: { ...s.positions, [dancerId]: pos }
    } : s));
    pushHistory();
  }, [activeSceneIdToEdit, pushHistory]);

  const undo = () => {
    if (mode === 'create') {
      if (createPast.length === 0) return;
      const previous = createPast[createPast.length - 1];
      const current: HistoryState = { dancers, scenes, timeline };
      setCreateFuture(prev => [current, ...prev]); setCreatePast(prev => prev.slice(0, -1));
      setDancers(previous.dancers); setScenes(previous.scenes); setTimeline(previous.timeline);
      const active = previous.scenes.find(s => s.id === activeSceneId);
      if (active) Object.keys(active.positions).forEach(dId => { if (dancerPositions[dId]) dancerPositions[dId].value = active.positions[dId]; });
    } else {
      if (placePast.length === 0) return;
      const previous = placePast[placePast.length - 1];
      const current: HistoryState = { dancers, scenes, timeline };
      setPlaceFuture(prev => [current, ...prev]); setPlacePast(prev => prev.slice(0, -1));
      setDancers(previous.dancers); setScenes(previous.scenes); setTimeline(previous.timeline);
    }
  };

  const redo = () => {
    if (mode === 'create') {
      if (createFuture.length === 0) return;
      const next = createFuture[0];
      const current: HistoryState = { dancers, scenes, timeline };
      setCreatePast(prev => [...prev, current]); setCreateFuture(prev => prev.slice(1));
      setDancers(next.dancers); setScenes(next.scenes); setTimeline(next.timeline);
      const active = next.scenes.find(s => s.id === activeSceneId);
      if (active) Object.keys(active.positions).forEach(dId => { if (dancerPositions[dId]) dancerPositions[dId].value = active.positions[dId]; });
    } else {
      if (placeFuture.length === 0) return;
      const next = placeFuture[0];
      const current: HistoryState = { dancers, scenes, timeline };
      setPlacePast(prev => [...prev, current]); setPlaceFuture(prev => prev.slice(1));
      setDancers(next.dancers); setScenes(next.scenes); setTimeline(next.timeline);
    }
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      let newScale = Math.max(0.5, Math.min(5, savedScale.value * e.scale));
      if (Math.abs(newScale - 1) < 0.07) newScale = 1; 
      scale.value = newScale;
      runOnJS(setZoomUI)(Math.round(newScale * 100));
    })
    .onEnd(() => { savedScale.value = scale.value; });

  const panGesture = Gesture.Pan().minPointers(1).maxPointers(2)
    .onUpdate((e) => { translateX.value = savedTranslateX.value + e.translationX; translateY.value = savedTranslateY.value + e.translationY; })
    .onEnd(() => { savedTranslateX.value = translateX.value; savedTranslateY.value = translateY.value; });

  const stageAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }] }));

  useEffect(() => {
    isPlayerPlayingSV.value = status.playing;
    if (status.playing && status.duration > 0) {
      const remaining = (status.duration - status.currentTime) * 1000;
      currentTimeMs.value = status.currentTime * 1000;
      currentTimeMs.value = withTiming(status.duration * 1000, { duration: Math.max(0, remaining), easing: Easing.linear });
    } else {
      cancelAnimation(currentTimeMs);
      if (status.currentTime !== undefined) { currentTimeMs.value = status.currentTime * 1000; }
    }
  }, [status.playing]);

  useAnimatedReaction(() => ({ time: currentTimeMs.value, isPlaying: isPlayerPlayingSV.value, isScrolling: isUserScrollingSV.value }), (data) => {
    if (data.isPlaying && !data.isScrolling) { scrollTo(timelineScrollViewRef, (data.time / 1000) * PX_PER_SEC, 0, false); }
  });

  const handleTimelineScroll = (e: any) => {
    if (isUserScrollingSV.value) {
      const offset = e.nativeEvent.contentOffset.x;
      const newTimeMs = (offset / PX_PER_SEC) * 1000;
      cancelAnimation(currentTimeMs);
      currentTimeMs.value = newTimeMs;
      runOnJS((t: number) => { player.seekTo(t / 1000); })(newTimeMs);
    }
  };

  const onScrollEnd = (e: any) => {
    isUserScrollingSV.value = false;
    if (isPlayerPlayingSV.value) {
      const time = (e.nativeEvent.contentOffset.x / PX_PER_SEC) * 1000;
      const remaining = (status.duration * 1000) - time;
      currentTimeMs.value = withTiming(status.duration * 1000, { duration: Math.max(0, remaining), easing: Easing.linear });
    }
  };

  useAnimatedReaction(() => ({ scenes, mode, activeId: activeSceneId }), (data) => {
    if (data.mode === 'create') {
      const targetScene = data.scenes.find(s => s.id === data.activeId);
      if (targetScene) { dancers.forEach(d => { if (dancerPositions[d.id]) { dancerPositions[d.id].value = withTiming(targetScene.positions[d.id] || { x: 0.5, y: 0.5 }, { duration: 400, easing: Easing.out(Easing.quad) }); } }); }
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
        if (dancerPositions[d.id]) dancerPositions[d.id].value = p;
      });
    }
  }, [mode, timeline, scenes, dancers]);

  const openTimelineMenuAt = (x: number) => { if (scenes.length === 0) { Alert.alert('알림', '먼저 대형 생성 탭에서 대형을 추가해주세요.'); return; } setTouchTimeMs(currentTimeMs.value); setShowTimelineMenu(true); };
  const handleAddTimelineEntry = (sceneId: string) => { pushHistory(); const newEntry: TimelineEntry = { id: Math.random().toString(36).substr(2, 9), sceneId, timestampMillis: touchTimeMs, durationMillis: 3000 }; setTimeline([...timeline, newEntry]); setShowTimelineMenu(false); };
  const handleCommitMove = useCallback((entryId: string, totalDx: number) => { pushHistory(); const deltaMs = (totalDx / PX_PER_SEC) * 1000; setTimeline(prev => { const idx = prev.findIndex(x => x.id === entryId); if (idx === -1) return prev; const target = prev[idx], sorted = [...prev].sort((a,b) => a.timestampMillis - b.timestampMillis), sIdx = sorted.findIndex(x => x.id === entryId), prevBlock = sorted[sIdx-1], nextBlock = sorted[sIdx+1]; let newTs = Math.max(0, target.timestampMillis + deltaMs); const minTs = prevBlock ? prevBlock.timestampMillis + prevBlock.durationMillis : 0, maxTs = nextBlock ? nextBlock.timestampMillis - target.durationMillis : Infinity; newTs = Math.max(minTs, Math.min(newTs, maxTs)); return prev.map(e => e.id === entryId ? { ...e, timestampMillis: newTs } : e); }); }, [pushHistory]);
  const handleCommitResize = useCallback((entryId: string, totalDx: number, dir: 'left' | 'right') => { pushHistory(); const deltaMs = (totalDx / PX_PER_SEC) * 1000; setTimeline(prev => { const sorted = [...prev].sort((a,b) => a.timestampMillis - b.timestampMillis), sIdx = sorted.findIndex(x => x.id === entryId), target = sorted[sIdx], prevBlock = sorted[sIdx-1], nextBlock = sorted[sIdx+1]; if (dir === 'left') { const minTs = prevBlock ? prevBlock.timestampMillis + prevBlock.durationMillis : 0, newStart = Math.max(minTs, Math.min(target.timestampMillis + deltaMs, target.timestampMillis + target.durationMillis - 500)), diff = target.timestampMillis - newStart; return prev.map(e => e.id === entryId ? { ...e, timestampMillis: newStart, durationMillis: target.durationMillis + diff } : e); } else { const maxTs = nextBlock ? nextBlock.timestampMillis : Infinity, newDur = Math.max(500, Math.min(target.durationMillis + deltaMs, maxTs - target.timestampMillis)); return prev.map(e => e.id === entryId ? { ...e, durationMillis: newDur } : e); } }); }, [pushHistory]);
  const handleDeleteEntry = useCallback((entryId: string) => { pushHistory(); setTimeline(prev => prev.filter(x => x.id !== entryId)); }, [pushHistory]);
  const handleSceneAction = () => { pushHistory(); if (sceneModalMode === 'add') { const nid = Math.random().toString(36).substr(2,9), last = scenes[scenes.length-1], nScenes = [...scenes, { id: nid, name: inputName.trim() || `대형 ${scenes.length+1}`, positions: last ? JSON.parse(JSON.stringify(last.positions)) : {} }]; setScenes(nScenes); setActiveSceneId(nid); } else if (sceneModalMode === 'rename' && targetSceneId) setScenes(prev => prev.map(s => s.id === targetSceneId ? {...s, name: inputName.trim() || s.name} : s)); setShowSceneModal(false); setInputName(''); };
  const copyActiveScene = () => {
    if (!activeSceneId) return;
    pushHistory();
    const activeIdx = scenes.findIndex(s => s.id === activeSceneId);
    if (activeIdx === -1) return;
    const activeScene = scenes[activeIdx];
    const newId = Math.random().toString(36).substr(2, 9);
    const newScene: FormationScene = {
      id: newId,
      name: `${activeScene.name} 복사본`,
      positions: JSON.parse(JSON.stringify(activeScene.positions))
    };
    const newScenes = [...scenes];
    newScenes.splice(activeIdx + 1, 0, newScene);
    setScenes(newScenes);
    setActiveSceneId(newId);
  };
  const deleteActiveScene = () => { if (!activeSceneId || scenes.length <= 1) { Alert.alert('알림', '최소 하나의 대형은 유지되어야 합니다.'); return; } pushHistory(); const newScenes = scenes.filter(s => s.id !== activeSceneId), newTimeline = timeline.filter(e => e.sceneId !== activeSceneId); setScenes(newScenes); setTimeline(newTimeline); setActiveSceneId(newScenes[0].id); setShowDeleteModal(false); };
  const addDancer = () => { pushHistory(); const newDancer: Dancer = { id: Math.random().toString(36).substr(2, 9), name: `댄서 ${dancers.length + 1}`, color: COLORS[dancers.length % COLORS.length] }; setDancers([...dancers, newDancer]); };
  const handleApplySettings = () => { const r = parseInt(tempRows), c = parseInt(tempCols); if (isNaN(r) || isNaN(c) || r <= 0 || c <= 0) { Alert.alert('입력 오류', '격자 행과 열은 1 이상의 숫자여야 합니다.'); return; } setSettings({ ...settings, gridRows: r, gridCols: c }); setShowStageSettings(false); };
  const applyMirror = (allScenes: boolean) => { pushHistory(); const flipPos = (pos: Position) => ({ x: (selectedMirrorType === 'horizontal' || selectedMirrorType === 'both') ? Math.max(0.01, Math.min(0.99, 1 - pos.x)) : pos.x, y: (selectedMirrorType === 'vertical' || selectedMirrorType === 'both') ? Math.max(0.01, Math.min(0.99, 1 - pos.y)) : pos.y }); if (allScenes) { setScenes(prev => { const next = prev.map(s => { const nPos = { ...s.positions }; Object.keys(nPos).forEach(dId => { nPos[dId] = flipPos(nPos[dId]); }); return { ...s, positions: nPos }; }); const current = next.find(s => s.id === activeSceneId); if (current) Object.keys(current.positions).forEach(dId => { if (dancerPositions[dId]) dancerPositions[dId].value = current.positions[dId]; }); return next; }); } else if (activeSceneId) { setScenes(prev => prev.map(s => { if (s.id !== activeSceneId) return s; const nPos = { ...s.positions }; Object.keys(nPos).forEach(dId => { nPos[dId] = flipPos(nPos[dId]); }); Object.keys(nPos).forEach(dId => { if (dancerPositions[dId]) dancerPositions[dId].value = nPos[dId]; }); return { ...s, positions: nPos }; })); } setShowMirrorModal(false); };
  const handleSave = async () => { try { await updateFormation(formationId!, { settings, data: { dancers, scenes, timeline } }); Alert.alert('성공', '로컬에 저장되었습니다.'); } catch (e: any) { Alert.alert('오류', e.message); } };
  
  const handleExportJSON = async () => {
    try {
      const data = { title: formation?.title, audioUrl: formation?.audioUrl, settings, data: { dancers, scenes, timeline } };
      const safeId = (formationId || 'new').replace(/[^a-z0-9]/gi, '_');
      const filePath = `${FileSystem.documentDirectory}formation_${safeId}.json`;
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data), { encoding: 'utf8' });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('오류', '이 기기에서는 공유 기능을 사용할 수 없습니다.');
        return;
      }
      await Sharing.shareAsync(filePath, { mimeType: 'application/json', dialogTitle: '동선 파일 내보내기', UTI: 'public.json' });
    } catch (e: any) {
      Alert.alert('오류', `파일 추출 실패: ${e.message}`);
    }
  };

  const handlePublish = async () => {
    if (!publishTitle.trim()) { Alert.alert('알림', '피드백 제목을 입력해주세요.'); return; }
    try {
      setIsExporting(true);
      await publishFormationAsFeedback(id!, formationId!, publishTitle, { settings, data: { dancers, scenes, timeline } });
      setShowPublishModal(false);
      Alert.alert('성공', '피드백이 성공적으로 발행되었습니다.');
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const showExportOptions = () => {
    Alert.alert('내보내기', '동선을 내보낼 방식을 선택하세요.', [
      { text: 'JSON 파일로 추출', onPress: handleExportJSON },
      { text: '피드백 영상으로 발행', onPress: () => { setPublishTitle(`${formation?.title || '새 대형'} 피드백`); setShowPublishModal(true); } },
      { text: '취소', style: 'cancel' }
    ]);
  };

  const resetStage = () => { scale.value = withSpring(1); translateX.value = withSpring(0); translateY.value = withSpring(0); savedScale.value = 1; savedTranslateX.value = 0; savedTranslateY.value = 0; setZoomUI(100); };

  const sortedTimeline = useMemo(() => [...timeline].sort((a, b) => a.timestampMillis - b.timestampMillis), [timeline]);
  const sceneNamesMap = useMemo(() => { const map: any = {}; scenes.forEach(s => { map[s.id] = s.name; }); return map; }, [scenes]);

  if (!formation) return null;
  const STAGE_CELL_SIZE = (width - 40) / settings.gridCols;
  const STAGE_WIDTH = settings.gridCols * STAGE_CELL_SIZE;
  const STAGE_HEIGHT = settings.gridRows * STAGE_CELL_SIZE;

  const hasPast = mode === 'create' ? createPast.length > 0 : placePast.length > 0;
  const hasFuture = mode === 'create' ? createFuture.length > 0 : placeFuture.length > 0;

  const controlTop = insets.top + 100;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={theme.text} /></TouchableOpacity>
        <View style={[styles.modeToggle, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={() => setMode('create')} style={[styles.modeTab, mode === 'create' && { backgroundColor: theme.primary }]}><Text style={[styles.tabText, { color: mode === 'create' ? theme.background : theme.textSecondary }]}>대형 생성</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('place')} style={[styles.modeTab, mode === 'place' && { backgroundColor: theme.primary }]}><Text style={[styles.tabText, { color: mode === 'place' ? theme.background : theme.textSecondary }]}>대형 배치</Text></TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 15 }}>
          <TouchableOpacity onPress={handleSave}><Ionicons name="save-outline" size={24} color={theme.primary} /></TouchableOpacity>
          <TouchableOpacity onPress={showExportOptions}>
            <Ionicons name="share-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.historyControls, { top: controlTop, backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity style={[styles.zoomBtn, { borderRightWidth: 1, borderColor: theme.border }]} onPress={undo} disabled={!hasPast}><Ionicons name="arrow-undo" size={20} color={!hasPast ? theme.border : theme.text} /></TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={redo} disabled={!hasFuture}><Ionicons name="arrow-redo" size={20} color={!hasFuture ? theme.border : theme.text} /></TouchableOpacity>
      </View>
      <View style={[styles.zoomControls, { top: controlTop, backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity style={styles.zoomBtn} onPress={resetStage}><Text style={[styles.zoomText, { color: theme.text }]}>{zoomUI}%</Text></TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => { const nextScale = Math.min(5, (Math.floor(scale.value * 4) + 1) / 4); if (nextScale === 1) resetStage(); else { scale.value = withTiming(nextScale); savedScale.value = nextScale; runOnJS(setZoomUI)(Math.round(nextScale * 100)); } }}><Ionicons name="add" size={20} color={theme.text} /></TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => { const nextScale = Math.max(0.5, (Math.ceil(scale.value * 4) - 1) / 4); if (nextScale === 1) resetStage(); else { scale.value = withTiming(nextScale); savedScale.value = nextScale; runOnJS(setZoomUI)(Math.round(nextScale * 100)); } }}><Ionicons name="remove" size={20} color={theme.text} /></TouchableOpacity>
      </View>

      <View style={styles.stageSection}>
        <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
          <View style={[styles.stageWrapper, { paddingTop: 40 }]}>
            <Animated.View style={[styles.stage, { width: STAGE_WIDTH, height: STAGE_HEIGHT, backgroundColor: theme.card, borderColor: theme.border }, stageAnimatedStyle]}>
              <View style={{ position: 'absolute', top: -45, left: 0, right: 0, alignSelf: 'center' }}>
                <Text style={[styles.directionLabelText, { color: theme.text, textAlign: 'center' }]}>
                  {settings.stageDirection === 'top' ? 'FRONT (앞)' : 'BACK (뒤)'}
                </Text>
              </View>
              <GridLayer settings={settings} />
              
              {/* Ghost Dancers */}
              {mode === 'create' && activeSceneId && scenes.find(s => s.id === activeSceneId)?.positions && 
                dancers.map(d => {
                  const pos = scenes.find(s => s.id === activeSceneId)?.positions[d.id];
                  if (!pos) return null;
                  return <GhostDancer key={`ghost-${d.id}`} dancer={d} pos={pos} stageWidth={STAGE_WIDTH} stageHeight={STAGE_HEIGHT} cellSize={STAGE_CELL_SIZE} />;
                })
              }
              {mode === 'place' && nextSceneId && scenes.find(s => s.id === nextSceneId)?.positions &&
                dancers.map(d => {
                  const pos = scenes.find(s => s.id === nextSceneId)?.positions[d.id];
                  if (!pos) return null;
                  return <GhostDancer key={`ghost-${d.id}`} dancer={d} pos={pos} stageWidth={STAGE_WIDTH} stageHeight={STAGE_HEIGHT} cellSize={STAGE_CELL_SIZE} />;
                })
              }

              {dancers.map((d, i) => (
                <DancerNode key={d.id} index={i} dancer={d} dancerPos={dancerPositions[d.id]} isSelected={selectedDancerId === d.id} onPress={() => { setSelectedDancerId(d.id); setShowDancerSheet(true); }} mode={mode} settings={settings} stageWidth={STAGE_WIDTH} stageHeight={STAGE_HEIGHT} cellSize={STAGE_CELL_SIZE} scale={scale} onDragEnd={onDragEnd} canDragInPlace={!!activeEntryIdInPlace} />
              ))}
              <View style={{ position: 'absolute', bottom: -45, left: 0, right: 0, alignSelf: 'center' }}>
                <Text style={[styles.directionLabelText, { color: theme.text, textAlign: 'center' }]}>
                  {settings.stageDirection === 'bottom' ? 'FRONT (앞)' : 'BACK (뒤)'}
                </Text>
              </View>
            </Animated.View>
          </View>
        </GestureDetector>
      </View>

      <View style={[styles.bottomDock, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        {mode === 'place' ? (
          <View style={styles.placeDock}>
            <View style={[styles.timelineWrapper, { backgroundColor: theme.card }]}>
              <Animated.ScrollView ref={timelineScrollViewRef} horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={handleTimelineScroll} onScrollBeginDrag={() => { isUserScrollingSV.value = true; cancelAnimation(currentTimeMs); runOnJS(setSelectedEntryId)(null); }} onMomentumScrollBegin={() => { isUserScrollingSV.value = true; }} onScrollEndDrag={(e) => { if (!e.nativeEvent.velocity || e.nativeEvent.velocity.x === 0) onScrollEnd(e); }} onMomentumScrollEnd={onScrollEnd} contentContainerStyle={{ paddingHorizontal: CENTER_OFFSET }}>
                <GestureDetector gesture={Gesture.Tap().runOnJS(true).onEnd((e) => openTimelineMenuAt(e.x))}>
                  <View style={{ width: (status.duration || 60) * PX_PER_SEC, height: 120 }}>
                    <WaveformBackground duration={status.duration || 60} seed={formation?.audioUrl || 'default'} />
                    <TimeMarkers duration={status.duration || 60} />
                    <View style={styles.timelineTrack}>
                      {sortedTimeline.map((e, idx, arr) => (
                        <React.Fragment key={e.id}>
                          <TimelineBlock entry={e} isSelected={selectedEntryId === e.id} sceneName={sceneNamesMap[e.sceneId]} theme={theme} minX={arr[idx-1] ? (arr[idx-1].timestampMillis + arr[idx-1].durationMillis) / 1000 * PX_PER_SEC : 0} maxX={arr[idx+1] ? arr[idx+1].timestampMillis / 1000 * PX_PER_SEC : (status.duration || 60) * PX_PER_SEC} onSelect={setSelectedEntryId} onCommitMove={handleCommitMove} onCommitResize={handleCommitResize} onDelete={handleDeleteEntry} dancers={dancers} scenes={scenes} settings={settings} />
                          {idx < arr.length - 1 && <TransitionX left={((e.timestampMillis+e.durationMillis)/1000)*PX_PER_SEC} width={(arr[idx+1].timestampMillis - (e.timestampMillis+e.durationMillis))/1000*PX_PER_SEC} />}
                        </React.Fragment>
                      ))}
                    </View>
                  </View>
                </GestureDetector>
              </Animated.ScrollView>
              <View style={[styles.needle, { left: CENTER_OFFSET }]} pointerEvents="none" />
            </View>
            <View style={styles.controls}>
              <TouchableOpacity onPress={() => {}} style={styles.toolBtnSmall}><Ionicons name="musical-notes" size={24} color={theme.textSecondary} /><Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>노래 변경</Text></TouchableOpacity>
              <PlayButton player={player} theme={theme} currentTimeMs={currentTimeMs} />
              <PlaybackTimeDisplay player={player} />
            </View>
          </View>
        ) : (
          <View style={styles.createDock}>
            <View style={styles.createToolbar}><TouchableOpacity style={styles.toolBtn} onPress={addDancer}><Ionicons name="person-add" size={24} color={theme.primary} /><Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>댄서 추가</Text></TouchableOpacity><TouchableOpacity style={styles.toolBtn} onPress={() => { setTempRows(String(settings.gridRows)); setTempCols(String(settings.gridCols)); setShowStageSettings(true); }}><Ionicons name="settings-outline" size={24} color={theme.textSecondary} /><Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>무대 설정</Text></TouchableOpacity><TouchableOpacity style={styles.toolBtn} onPress={() => { setGuideIndex(0); setShowGuide(true); }}><Ionicons name="help-circle-outline" size={24} color={theme.textSecondary} /><Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>가이드</Text></TouchableOpacity></View>
            <View style={styles.sceneSection}>
              <View style={styles.actionColumn}>
                <TouchableOpacity style={[styles.addSceneBtnWide, { backgroundColor: theme.primary }]} onPress={() => { setSceneModalMode('add'); setInputName(''); setShowSceneModal(true); }}><Ionicons name="add-circle" size={16} color={theme.background} /><Text style={[styles.addSceneText, { color: theme.background }]}>대형 추가</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.addSceneBtnWide, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]} onPress={() => setShowMirrorModal(true)}><Ionicons name="swap-horizontal" size={16} color={theme.text} /><Text style={[styles.addSceneText, { color: theme.text }]}>대형 반전</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.addSceneBtnWide, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]} onPress={copyActiveScene}><Ionicons name="copy-outline" size={16} color={theme.text} /><Text style={[styles.addSceneText, { color: theme.text }]}>대형 복사</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.addSceneBtnWide, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]} onPress={() => setShowDeleteModal(true)}><Ionicons name="trash-outline" size={16} color={theme.error} /><Text style={[styles.addSceneText, { color: theme.error }]}>대형 삭제</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center' }}>
                {scenes.map(s => (
                  <TouchableOpacity key={s.id} onLongPress={() => { Alert.alert(s.name, '작업', [{ text: '이름 변경', onPress: () => { setSceneModalMode('rename'); setTargetSceneId(s.id); setInputName(s.name); setShowSceneModal(true); } }, { text: '삭제', style: 'destructive', onPress: () => { pushHistory(); setScenes(scenes.filter(x => x.id !== s.id)); } }, { text: '취소' }]); }} onPress={() => {
                    if (activeSceneId === s.id) {
                      setSceneModalMode('rename');
                      setTargetSceneId(s.id);
                      setInputName(s.name);
                      setShowSceneModal(true);
                    } else {
                      setActiveSceneId(s.id);
                    }
                  }} style={[styles.sceneCard, { backgroundColor: theme.card, borderColor: activeSceneId === s.id ? theme.primary : theme.border }, activeSceneId === s.id && { backgroundColor: theme.primary + '11' }]}>
                    <MiniFormationPreview scene={s} dancers={dancers} settings={settings} />
                    <View style={[styles.sceneCardLabel, { backgroundColor: theme.border + '11' }]}><Text style={[styles.sceneCardText, { color: activeSceneId === s.id ? theme.primary : theme.textSecondary }]}>{s.name}</Text></View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
        <View style={{ height: 15 }} />
      </View>

      <Modal visible={showPublishModal} transparent animationType="fade" onRequestClose={() => setShowPublishModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.menu, { backgroundColor: theme.card }]}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>피드백 발행</Text>
            <Text style={{ color: theme.textSecondary, marginBottom: 10, fontSize: 12 }}>발행할 피드백의 제목을 입력하세요.</Text>
            <TextInput style={[styles.sheetInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={publishTitle} onChangeText={setPublishTitle} placeholder="피드백 제목" placeholderTextColor={theme.textSecondary} autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 10 }}>
              <TouchableOpacity onPress={() => setShowPublishModal(false)}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handlePublish} disabled={isExporting}>
                {isExporting ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={{ color: theme.primary, fontWeight: 'bold' }}>발행</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.menu, { width: '80%', paddingBottom: 25, backgroundColor: theme.card }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={[styles.menuTitle, { marginBottom: 0, color: theme.text }]}>대형 삭제</Text>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', marginVertical: 15 }}>
              <Ionicons name="trash" size={32} color={theme.error} />
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: 'bold', marginTop: 10 }}>현재 대형을 삭제할까요?</Text>
            </View>
            <View style={{ gap: 8 }}>
              <TouchableOpacity style={[styles.mirrorApplyBtn, { backgroundColor: theme.background, padding: 12, borderWidth: 1, borderColor: theme.border }]} onPress={() => setShowDeleteModal(false)}><Text style={[styles.mirrorApplyText, { color: theme.textSecondary }]}>취소</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.mirrorApplyBtn, { backgroundColor: theme.error, padding: 12 }]} onPress={deleteActiveScene}><Text style={[styles.mirrorApplyText, { color: '#FFF' }]}>삭제 확인</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showTimelineMenu} transparent animationType="fade"><Pressable style={styles.modalBg} onPress={() => setShowTimelineMenu(false)}><View style={[styles.menu, { backgroundColor: theme.card }]}><Text style={[styles.menuTitle, { color: theme.text }]}>대형 선택</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{scenes.map(s => <TouchableOpacity key={s.id} onPress={() => handleAddTimelineEntry(s.id)} style={[styles.menuItem, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}><Text style={{color:theme.text}}>{s.name}</Text></TouchableOpacity>)}</ScrollView></View></Pressable></Modal>
      <Modal visible={showSceneModal} transparent animationType="fade"><View style={styles.modalBg}><View style={[styles.menu, { backgroundColor: theme.card }]}><Text style={[styles.menuTitle, { color: theme.text }]}>{sceneModalMode === 'add' ? '대형 추가' : '이름 변경'}</Text><TextInput style={[styles.sheetInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={inputName} onChangeText={setInputName} placeholder="대형 이름" placeholderTextColor={theme.textSecondary} autoFocus /><View style={{flexDirection:'row', justifyContent:'flex-end', gap:20}}><TouchableOpacity onPress={() => setShowSceneModal(false)}><Text style={{color:theme.textSecondary}}>취소</Text></TouchableOpacity><TouchableOpacity onPress={handleSceneAction}><Text style={{color:theme.primary, fontWeight:'bold'}}>{sceneModalMode === 'add' ? '추가' : '저장'}</Text></TouchableOpacity></View></View></View></Modal>
      <Modal visible={showDancerSheet} transparent animationType="slide"><Pressable style={styles.modalBg} onPress={() => setShowDancerSheet(false)}><View style={[styles.sheet, { backgroundColor: theme.card }]}><TextInput style={[styles.sheetInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={dancers.find(d => d.id === selectedDancerId)?.name} onChangeText={val => { pushHistory(); setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, name: val } : d)); }} placeholderTextColor={theme.textSecondary} /><View style={styles.colorRow}>{COLORS.map(c => <TouchableOpacity key={c} style={[styles.colorChip, { backgroundColor: c }, dancers.find(d => d.id === selectedDancerId)?.color === c && { borderWidth: 3, borderColor: theme.text }]} onPress={() => { pushHistory(); setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, color: c } : d)); }} />)}</View><TouchableOpacity style={styles.deleteBtn} onPress={() => { pushHistory(); setDancers(dancers.filter(d => d.id !== selectedDancerId)); setSelectedDancerId(null); setShowDancerSheet(false); }}><Ionicons name="trash" size={20} color={theme.error} /><Text style={{ color: theme.error, marginLeft: 10 }}>댄서 삭제</Text></TouchableOpacity></View></Pressable></Modal>
      <Modal visible={showStageSettings} transparent animationType="fade"><View style={styles.modalBg}><View style={[styles.menu, { backgroundColor: theme.card }]}><Text style={[styles.menuTitle, { color: theme.text }]}>무대 설정</Text><View style={styles.settingRow}><Text style={{color:theme.text}}>격자 행 (세로)</Text><TextInput style={[styles.smallInput, { backgroundColor: theme.background, color: theme.primary, borderColor: theme.border, borderWidth: 1 }]} keyboardType="number-pad" value={tempRows} onChangeText={setTempRows} /></View><View style={styles.settingRow}><Text style={{color:theme.text}}>격자 열 (가로)</Text><TextInput style={[styles.smallInput, { backgroundColor: theme.background, color: theme.primary, borderColor: theme.border, borderWidth: 1 }]} keyboardType="number-pad" value={tempCols} onChangeText={setTempCols} /></View><View style={styles.settingRow}><Text style={{color:theme.text}}>Audience 위치</Text><TouchableOpacity style={[styles.toggleBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]} onPress={() => setSettings({...settings, stageDirection: settings.stageDirection === 'top' ? 'bottom' : 'top'})}><Text style={{color: theme.primary, fontWeight: 'bold'}}>{settings.stageDirection === 'top' ? '상단 (Top)' : '하단 (Bottom)'}</Text></TouchableOpacity></View><View style={styles.settingRow}><Text style={{color:theme.text}}>격자 스냅</Text><TouchableOpacity onPress={() => setSettings({...settings, snapToGrid: !settings.snapToGrid})}><Ionicons name={settings.snapToGrid ? "checkbox" : "square-outline"} size={24} color={theme.primary} /></TouchableOpacity></View><TouchableOpacity style={[styles.doneBtn, { backgroundColor: theme.primary }]} onPress={handleApplySettings}><Text style={{fontWeight:'bold', color: theme.background}}>확인</Text></TouchableOpacity></View></View></Modal>
      <Modal visible={showMirrorModal} transparent animationType="fade" onRequestClose={() => setShowMirrorModal(false)}><View style={styles.modalBg}><View style={[styles.menu, { width: '90%', paddingBottom: 30, backgroundColor: theme.card }]}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}><Text style={[styles.menuTitle, { marginBottom: 0, color: theme.text }]}>대형 반전</Text><TouchableOpacity onPress={() => setShowMirrorModal(false)}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity></View><Text style={[styles.settingLabel, { color: theme.textSecondary }]}>반전 방식</Text><View style={styles.mirrorRow}><TouchableOpacity style={[styles.mirrorBox, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }, selectedMirrorType === 'horizontal' && { borderColor: theme.primary, backgroundColor: theme.primary + '11' }]} onPress={() => setSelectedMirrorType('horizontal')}><Ionicons name="resize" size={24} color={selectedMirrorType === 'horizontal' ? theme.primary : theme.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} /><Text style={[styles.mirrorText, { color: theme.textSecondary }, selectedMirrorType === 'horizontal' && { color: theme.primary }]}>좌우</Text></TouchableOpacity><TouchableOpacity style={[styles.mirrorBox, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }, selectedMirrorType === 'vertical' && { borderColor: theme.primary, backgroundColor: theme.primary + '11' }]} onPress={() => setSelectedMirrorType('vertical')}><Ionicons name="resize" size={24} color={selectedMirrorType === 'vertical' ? theme.primary : theme.textSecondary} /><Text style={[styles.mirrorText, { color: theme.textSecondary }, selectedMirrorType === 'vertical' && { color: theme.primary }]}>상하</Text></TouchableOpacity><TouchableOpacity style={[styles.mirrorBox, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }, selectedMirrorType === 'both' && { borderColor: theme.primary, backgroundColor: theme.primary + '11' }]} onPress={() => setSelectedMirrorType('both')}><Ionicons name="sync" size={24} color={selectedMirrorType === 'both' ? theme.primary : theme.textSecondary} /><Text style={[styles.mirrorText, { color: theme.textSecondary }, selectedMirrorType === 'both' && { color: theme.primary }]}>완전</Text></TouchableOpacity></View><Text style={[styles.settingLabel, { marginTop: 25, color: theme.textSecondary }]}>적용 대상</Text><View style={{ gap: 10 }}><TouchableOpacity style={[styles.mirrorApplyBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]} onPress={() => applyMirror(false)}><Text style={[styles.mirrorApplyText, { color: theme.text }]}>현재 대형만</Text><Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /></TouchableOpacity><TouchableOpacity style={[styles.mirrorApplyBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]} onPress={() => applyMirror(true)}><Text style={[styles.mirrorApplyText, { color: theme.text }]}>모든 대형 일괄 적용</Text><Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /></TouchableOpacity></View></View></View></Modal>
      <Modal visible={showGuide} transparent animationType="fade"><Pressable style={styles.modalBg} onPress={() => setShowGuide(false)}><View style={[styles.menu, {width:'90%', backgroundColor: theme.card}]}><Text style={[styles.menuTitle, { color: theme.text }]}>{GUIDE_STEPS[guideIndex].title}</Text><Text style={{color:theme.textSecondary, marginVertical:15}}>{GUIDE_STEPS[guideIndex].description}</Text><View style={{flexDirection:'row', justifyContent:'space-between'}}><TouchableOpacity onPress={() => setGuideIndex(prev => Math.max(0, prev-1))}><Text style={{color:theme.text}}>이전</Text></TouchableOpacity><TouchableOpacity onPress={() => { if(guideIndex < 2) setGuideIndex(prev=>prev+1); else setShowGuide(false); }}><Text style={{color:theme.primary, fontWeight: 'bold'}}>{guideIndex === 2 ? '닫기' : '다음'}</Text></TouchableOpacity></View></View></Pressable></Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  modeToggle: { flexDirection: 'row', borderRadius: 20, padding: 4 },
  modeTab: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 18 },
  activeTab: { },
  tabText: { fontWeight: 'bold', fontSize: 13 },
  stageSection: { flex: 1, overflow: 'hidden', position: 'relative' },
  stageWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { borderWidth: 1, overflow: 'visible' },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  dancerNode: { position: 'absolute', alignItems: 'center' },
  dancerCircle: { justifyContent: 'center', alignItems: 'center' },
  dancerInitial: { color: '#FFF', fontWeight: 'bold' },
  dancerNameText: { color: '#AAA', marginTop: 4 },
  bottomDock: { borderTopWidth: 1 },
  placeDock: { padding: 15, height: 220 },
  timelineWrapper: { height: 120, position: 'relative', marginBottom: 15, borderRadius: 10, overflow: 'hidden' },
  waveformContainer: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 5 },
  waveformBar: { width: 3, borderRadius: 1.5 },
  timeMarkersLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 20 },
  timeMarker: { position: 'absolute', bottom: 0, alignItems: 'center' },
  timeMarkerLine: { width: 1, height: 5 },
  timeMarkerText: { fontSize: 9, marginTop: 2, fontWeight: 'bold' },
  timelineTrack: { flex: 1, position: 'relative' },
  block: { position: 'absolute', top: 10, bottom: 25, borderRadius: 4, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, zIndex: 50, overflow: 'hidden' },
  blockPreview: { width: '100%', height: 55, marginBottom: 4, pointerEvents: 'none', alignItems: 'center' },
  blockText: { fontSize: 9, fontWeight: 'bold' },
  needle: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#FFD700', zIndex: 100, marginLeft: -1 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toolBtnSmall: { alignItems: 'center', width: 60 },
  playBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  timeText: { fontSize: 16, fontWeight: 'bold', width: 60, textAlign: 'right' },
  createDock: { paddingHorizontal: 12, paddingTop: 15, paddingBottom: 5, height: 240 },
  createToolbar: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  toolBtn: { alignItems: 'center', gap: 4 },
  toolBtnText: { fontSize: 11 },
  sceneSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 },
  actionColumn: { gap: 6, width: 85, justifyContent: 'center' },
  addSceneBtnWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 32, borderRadius: 8, gap: 4 },
  addSceneText: { fontWeight: 'bold', fontSize: 10 },
  sceneCard: { width: 100, height: 112, borderRadius: 12, borderWidth: 2, marginRight: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  miniStage: { flex: 1, backgroundColor: 'transparent', position: 'relative' },
  miniDancer: { position: 'absolute', width: 6, height: 6, borderRadius: 3, marginLeft: -3, marginTop: -3 },
  sceneCardLabel: { height: 28, width: '100%', justifyContent: 'center', alignItems: 'center' },
  sceneCardText: { fontSize: 10, fontWeight: 'bold' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  menu: { padding: 25, borderRadius: 20, width: '80%' },
  menuTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  menuItem: { padding: 15, borderRadius: 10, marginRight: 10 },
  sheet: { padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, width: '100%', position: 'absolute', bottom: 0 },
  sheetInput: { padding: 15, borderRadius: 12, marginBottom: 15 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorChip: { width: 30, height: 30, borderRadius: 15 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  smallInput: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, width: 60, textAlign: 'center', fontWeight: 'bold' },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  doneBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  zoomControls: { position: 'absolute', right: 15, zIndex: 100, flexDirection: 'row', borderRadius: 20, padding: 4, borderWidth: 1 },
  historyControls: { position: 'absolute', left: 15, zIndex: 100, flexDirection: 'row', borderRadius: 20, padding: 4, borderWidth: 1 },
  zoomBtn: { paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontSize: 11, fontWeight: 'bold' },
  settingLabel: { fontSize: 12, marginBottom: 12, fontWeight: 'bold' },
  mirrorRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  mirrorBox: { flex: 1, height: 80, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  mirrorText: { fontSize: 11, marginTop: 8, fontWeight: 'bold' },
  mirrorApplyBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderRadius: 15 },
  mirrorApplyText: { fontWeight: 'bold', fontSize: 14 },
  transitionXContainer: { position: 'absolute', zIndex: 15, alignItems: 'center', justifyContent: 'center' },
  xLine: { position: 'absolute', height: 1 },
  resizeHandleLeft: { position: 'absolute', left: -15, top: 0, bottom: 0, width: 30, justifyContent: 'center', alignItems: 'center', zIndex: 60 },
  resizeHandleRight: { position: 'absolute', right: -15, top: 0, bottom: 0, width: 30, justifyContent: 'center', alignItems: 'center', zIndex: 60 },
  handleCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 },
  directionLabelBox: { position: 'absolute', paddingHorizontal: 15, paddingVertical: 4, borderRadius: 12 },
  directionLabelText: { fontSize: 10, fontWeight: '900', letterSpacing: 2 }
});
