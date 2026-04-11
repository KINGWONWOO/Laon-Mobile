import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Modal, Alert, ActivityIndicator, Pressable, Image, ScrollView } from 'react-native';
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

// 헬퍼 함수
const formatTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

// 시간 표시부 독립 컴포넌트 (리렌더링 최적화)
const PlaybackTimeDisplay = React.memo(({ player }: { player: any }) => {
  const status = useAudioPlayerStatus(player);
  return <Text style={styles.timeText}>{formatTime(status.currentTime * 1000)}</Text>;
});

// 재생 버튼 독립 컴포넌트
const PlayButton = React.memo(({ player, theme, currentTimeMs }: { player: any, theme: any, currentTimeMs: any }) => {
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
      <Ionicons name={status.playing ? "pause" : "play"} size={32} color="#000" />
    </TouchableOpacity>
  );
});

// 메모이제이션된 정적 컴포넌트
const WaveformBackground = React.memo(({ duration, seed = 'default' }: { duration: number, seed?: string }) => {
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
});

const TimeMarkers = React.memo(({ duration }: { duration: number }) => {
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
});

const TransitionX = React.memo(({ width, left }: { width: number, left: number }) => {
  const safeWidth = Math.max(0, width);
  if (safeWidth <= 5) return null;
  const height = 45; 
  const angle = Math.atan2(height, safeWidth) * (180 / Math.PI);
  const length = Math.sqrt(safeWidth * safeWidth + height * height);
  return (
    <View style={[styles.transitionXContainer, { left, width: safeWidth, height, top: 10 }]} pointerEvents="none">
      <View style={[styles.xLine, { width: length, top: height/2, left: (safeWidth-length)/2, transform: [{ rotate: `${angle}deg` }] }]} />
      <View style={[styles.xLine, { width: length, top: height/2, left: (safeWidth-length)/2, transform: [{ rotate: `-${angle}deg` }] }]} />
    </View>
  );
});

const ResizeHandle = ({ direction, localX, localWidth, startX, startW, minX, maxX, onCommit }: any) => {
  const pan = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startX.value = localX.value;
      startW.value = localWidth.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (direction === 'left') {
        // 왼쪽으로 늘릴 때는 minX까지만, 오른쪽으로 줄일 때는 현재 위치 + 너비 - 10px까지만
        const newX = Math.max(minX, Math.min(startX.value + e.translationX, startX.value + startW.value - 10));
        const actualDiff = newX - startX.value;
        localX.value = newX;
        localWidth.value = startW.value - actualDiff;
      } else {
        // 오른쪽으로 늘릴 때는 maxX까지만, 왼쪽으로 줄일 때는 최소 10px
        const newW = Math.max(10, Math.min(startW.value + e.translationX, maxX - localX.value));
        localWidth.value = newW;
      }
    })
    .onEnd((e) => {
      'worklet';
      runOnJS(onCommit)(e.translationX);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={direction === 'left' ? styles.resizeHandleLeft : styles.resizeHandleRight}>
        <View style={styles.handleCircle}>
          <Ionicons name={direction === 'left' ? "chevron-back" : "chevron-forward"} size={14} color="#000" />
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const TimelineBlock = React.memo(({ entry, isSelected, sceneName, theme, minX, maxX, onSelect, onCommitMove, onCommitResize, onDelete }: any) => {
  const localX = useSharedValue((entry.timestampMillis / 1000) * PX_PER_SEC);
  const localWidth = useSharedValue((entry.durationMillis / 1000) * PX_PER_SEC);
  const startX = useSharedValue(0);
  const startW = useSharedValue(0);

  useEffect(() => {
    localX.value = (entry.timestampMillis / 1000) * PX_PER_SEC;
    localWidth.value = (entry.durationMillis / 1000) * PX_PER_SEC;
  }, [entry.timestampMillis, entry.durationMillis]);

  const animatedStyle = useAnimatedStyle(() => ({
    left: localX.value,
    width: localWidth.value,
    backgroundColor: isSelected ? theme.primary : '#AAA',
    zIndex: isSelected ? 100 : 50
  }));

  const pan = Gesture.Pan()
    .enabled(isSelected) // 선택된 경우에만 이동 가능
    .onStart(() => {
      'worklet';
      startX.value = localX.value;
    })
    .onUpdate((g) => {
      'worklet';
      const newX = startX.value + g.translationX;
      // 인접 블록과 겹치지 않게 제한
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
      <Animated.View style={[styles.block, animatedStyle]}>
        <Text style={[styles.blockText, { color: isSelected ? '#000' : '#FFF' }]} numberOfLines={1}>{sceneName}</Text>
        {isSelected && (
          <>
            <ResizeHandle 
              direction="left" 
              localX={localX} localWidth={localWidth} startX={startX} startW={startW}
              minX={minX} maxX={maxX}
              onCommit={(dx: number) => onCommitResize(entry.id, dx, 'left')}
            />
            <ResizeHandle 
              direction="right" 
              localX={localX} localWidth={localWidth} startX={startX} startW={startW}
              minX={minX} maxX={maxX}
              onCommit={(dx: number) => onCommitResize(entry.id, dx, 'right')}
            />
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
});

const DancerNode = React.memo(({ dancer, dancerPos, isSelected, onPress, scale, index, settings, stageWidth, stageHeight, cellSize, mode, onDragEnd }: any) => {
  const isDragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pos = useDerivedValue(() => isDragging.value ? { x: dragX.value, y: dragY.value } : dancerPos.value);

  const panGesture = Gesture.Pan().enabled(mode === 'create')
    .onStart(() => { 
      'worklet';
      isDragging.value = true; 
      startX.value = dancerPos.value.x; 
      startY.value = dancerPos.value.y; 
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
    <GestureDetector gesture={Gesture.Exclusive(panGesture, Gesture.Tap().runOnJS(true).onEnd(() => onPress()))}>
      <Animated.View style={[styles.dancerNode, style]} pointerEvents="box-none">
        <View style={[styles.dancerCircle, { backgroundColor: dancer.color, borderColor: isSelected ? '#FFF' : 'rgba(0,0,0,0.2)', width: cellSize * 0.7, height: cellSize * 0.7, borderRadius: (cellSize * 0.7) / 2, borderWidth: 1.5 }]}><Text style={[styles.dancerInitial, { fontSize: cellSize * 0.3 }]}>{index + 1}</Text></View>
        <Text style={[styles.dancerNameText, { color: isSelected ? '#FFF' : '#AAA', fontSize: (settings.dancerNameSize || 8) }]} numberOfLines={1}>{dancer.name}</Text>
      </Animated.View>
    </GestureDetector>
  );
});

const GridLayer = React.memo(({ settings }: { settings: FormationSettings }) => {
  return (
    <View style={styles.gridLayer}>
      {Array.from({ length: settings.gridRows + 1 }).map((_, i) => (
        <View key={`h-${i}`} style={[styles.gridH, { top: `${(i / settings.gridRows) * 100}%` }]} />
      ))}
      {Array.from({ length: settings.gridCols + 5 }).map((_, i) => (
        <View key={`v-${i}`} style={[styles.gridV, { left: `${(i / (settings.gridCols + 4)) * 100}%` }]} />
      ))}
    </View>
  );
});

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
      if (Math.abs(newScale - 1) < 0.07) newScale = 1; 
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
  const isPlayerPlayingSV = useSharedValue(false);
  const isUserScrollingSV = useSharedValue(false);
  const timelineScrollViewRef = useAnimatedRef<Animated.ScrollView>();

  useEffect(() => {
    isPlayerPlayingSV.value = status.playing;
    if (status.playing && status.duration > 0) {
      const remaining = (status.duration - status.currentTime) * 1000;
      currentTimeMs.value = status.currentTime * 1000;
      currentTimeMs.value = withTiming(status.duration * 1000, { duration: Math.max(0, remaining), easing: Easing.linear });
    } else {
      cancelAnimation(currentTimeMs);
      if (status.currentTime !== undefined) {
        currentTimeMs.value = status.currentTime * 1000;
      }
    }
  }, [status.playing]);

  useAnimatedReaction(() => ({ time: currentTimeMs.value, isPlaying: isPlayerPlayingSV.value, isScrolling: isUserScrollingSV.value }), (data) => {
    if (data.isPlaying && !data.isScrolling) {
      scrollTo(timelineScrollViewRef, (data.time / 1000) * PX_PER_SEC, 0, false);
    }
  });

  const handleTimelineScroll = (e: any) => {
    if (isUserScrollingSV.value) {
      const offset = e.nativeEvent.contentOffset.x;
      const newTimeMs = (offset / PX_PER_SEC) * 1000;
      cancelAnimation(currentTimeMs);
      currentTimeMs.value = newTimeMs;
      runOnJS((t: number) => {
        player.seekTo(t / 1000);
      })(newTimeMs);
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
    if (scenes.length === 0) { Alert.alert('알림', '먼저 대형 생성 탭에서 대형을 추가해주세요.'); return; }
    setTouchTimeMs(currentTimeMs.value);
    setShowTimelineMenu(true);
  };

  const handleAddTimelineEntry = (sceneId: string) => {
    const newEntry: TimelineEntry = { id: Math.random().toString(36).substr(2, 9), sceneId, timestampMillis: touchTimeMs, durationMillis: 3000 };
    setTimeline([...timeline, newEntry]);
    setShowTimelineMenu(false);
  };

  const handleCommitMove = useCallback((entryId: string, totalDx: number) => {
    const deltaMs = (totalDx / PX_PER_SEC) * 1000;
    setTimeline(prev => {
      const idx = prev.findIndex(x => x.id === entryId);
      if (idx === -1) return prev;
      const target = prev[idx];
      const sorted = [...prev].sort((a,b) => a.timestampMillis - b.timestampMillis);
      const sIdx = sorted.findIndex(x => x.id === entryId);
      
      const prevBlock = sorted[sIdx-1];
      const nextBlock = sorted[sIdx+1];
      
      let newTs = Math.max(0, target.timestampMillis + deltaMs);
      const minTs = prevBlock ? prevBlock.timestampMillis + prevBlock.durationMillis : 0;
      const maxTs = nextBlock ? nextBlock.timestampMillis - target.durationMillis : Infinity;
      
      newTs = Math.max(minTs, Math.min(newTs, maxTs));
      return prev.map(e => e.id === entryId ? { ...e, timestampMillis: newTs } : e);
    });
  }, []);

  const handleCommitResize = useCallback((entryId: string, totalDx: number, dir: 'left' | 'right') => {
    const deltaMs = (totalDx / PX_PER_SEC) * 1000;
    setTimeline(prev => {
      const sorted = [...prev].sort((a,b) => a.timestampMillis - b.timestampMillis);
      const sIdx = sorted.findIndex(x => x.id === entryId);
      const target = sorted[sIdx];
      const prevBlock = sorted[sIdx-1];
      const nextBlock = sorted[sIdx+1];

      if (dir === 'left') {
        const minTs = prevBlock ? prevBlock.timestampMillis + prevBlock.durationMillis : 0;
        const newStart = Math.max(minTs, Math.min(target.timestampMillis + deltaMs, target.timestampMillis + target.durationMillis - 500));
        const diff = target.timestampMillis - newStart;
        return prev.map(e => e.id === entryId ? { ...e, timestampMillis: newStart, durationMillis: target.durationMillis + diff } : e);
      } else {
        const maxTs = nextBlock ? nextBlock.timestampMillis : Infinity;
        const newDur = Math.max(500, Math.min(target.durationMillis + deltaMs, maxTs - target.timestampMillis));
        return prev.map(e => e.id === entryId ? { ...e, durationMillis: newDur } : e);
      }
    });
  }, []);

  const handleDeleteEntry = useCallback((entryId: string) => {
    setTimeline(prev => prev.filter(x => x.id !== entryId));
  }, []);

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

  const handleSave = async () => { try { await updateFormation(formationId!, { settings, data: { dancers, scenes, timeline } }); Alert.alert('성공', '로컬에 저장되었습니다.'); } catch (e: any) { Alert.alert('오류', e.message); } };

  const resetStage = () => { scale.value = withSpring(1); translateX.value = withSpring(0); translateY.value = withSpring(0); savedScale.value = 1; savedTranslateX.value = 0; savedTranslateY.value = 0; setZoomUI(100); };

  const handlePickAudio = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      const asset = res.assets[0];
      setIsExporting(true);
      try {
        const publicUrl = await storageService.uploadToR2(`formations/${id}`, asset.uri, `audio_${Date.now()}.${asset.name.split('.').pop()}`);
        await updateFormation(formationId!, { audioUrl: publicUrl });
        Alert.alert('성공', '노래가 변경되었습니다. 화면을 나갔다 들어오면 적용됩니다.');
      } catch (e: any) {
        Alert.alert('오류', e.message);
      } finally {
        setIsExporting(false);
      }
    }
  };

  const exportAsFile = async () => {
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

  const exportAsVideo = async () => {
    setIsExporting(true);
    try { 
      await updateFormation(formationId!, { settings, data: { dancers, scenes, timeline } }); 
      await publishFormationAsFeedback(id!, formationId!, formation!.title, { settings, data: { dancers, scenes, timeline }, audioUrl: formation!.audioUrl }); 
      Alert.alert('성공', '피드백 영상 업로드 완료'); 
    } catch (e: any) { Alert.alert('오류', e.message); } finally { setIsExporting(false); }
  };

  const showExportOptions = () => { Alert.alert('내보내기', '방식을 선택하세요.', [{ text: 'JSON 파일 추출', onPress: exportAsFile }, { text: '피드백 영상 업로드', onPress: exportAsVideo }, { text: '취소', style: 'cancel' }]); };

  const GUIDE_STEPS = [
    { title: '댄서 추가', description: '댄서 추가 버튼을 눌러 무대에 댄서를 배치하세요. 댄서를 탭하여 이름과 색상을 변경할 수 있습니다.' },
    { title: '대형 생성', description: '하단의 대형 추가 버튼으로 현재 댄서들의 위치를 대형으로 저장하세요. 여러 개의 대형을 만들어 전환을 구성할 수 있습니다.' },
    { title: '타임라인 배치', description: '대형 배치 탭에서 음악의 특정 시점에 저장한 대형을 배치하세요. 대형 사이의 이동은 자동으로 계산됩니다.' }
  ];

  if (!formation) return null;
  const STAGE_CELL_SIZE = (width - 40) / (settings.gridCols + 4);
  const STAGE_WIDTH = (settings.gridCols + 4) * STAGE_CELL_SIZE;
  const STAGE_HEIGHT = settings.gridRows * STAGE_CELL_SIZE;

  // 정렬된 타임라인 및 씬 이름 캐싱
  const sortedTimeline = useMemo(() => [...timeline].sort((a, b) => a.timestampMillis - b.timestampMillis), [timeline]);
  const sceneNamesMap = useMemo(() => {
    const map: any = {};
    scenes.forEach(s => { map[s.id] = s.name; });
    return map;
  }, [scenes]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#FFF" /></TouchableOpacity>
        <View style={styles.modeToggle}><TouchableOpacity onPress={() => setMode('create')} style={[styles.modeTab, mode === 'create' && styles.activeTab]}><Text style={styles.tabText}>대형 생성</Text></TouchableOpacity><TouchableOpacity onPress={() => setMode('place')} style={[styles.modeTab, mode === 'place' && styles.activeTab]}><Text style={styles.tabText}>대형 배치</Text></TouchableOpacity></View>
        <View style={{ flexDirection: 'row', gap: 15 }}><TouchableOpacity onPress={showExportOptions} disabled={isExporting}>{isExporting ? <ActivityIndicator size="small" /> : <Ionicons name="share-outline" size={24} color={theme.primary} />}</TouchableOpacity><TouchableOpacity onPress={handleSave}><Ionicons name="save-outline" size={24} color={theme.primary} /></TouchableOpacity></View>
      </View>

      <View style={styles.stageSection}>
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomBtn} onPress={resetStage}>
            <Text style={styles.zoomText}>{zoomUI}%</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.zoomBtn} 
            onPress={() => { 
              const nextScale = Math.min(5, (Math.floor(scale.value * 4) + 1) / 4);
              if (nextScale === 1) resetStage();
              else { scale.value = withTiming(nextScale); savedScale.value = nextScale; runOnJS(setZoomUI)(Math.round(nextScale * 100)); }
            }}
          >
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.zoomBtn} 
            onPress={() => { 
              const nextScale = Math.max(0.5, (Math.ceil(scale.value * 4) - 1) / 4);
              if (nextScale === 1) resetStage();
              else { scale.value = withTiming(nextScale); savedScale.value = nextScale; runOnJS(setZoomUI)(Math.round(nextScale * 100)); }
            }}
          >
            <Ionicons name="remove" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
        <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
          <View style={styles.stageWrapper}>
            <View style={[styles.directionLabelBox, { top: -45, backgroundColor: settings.stageDirection === 'top' ? 'rgba(255, 51, 102, 0.15)' : 'rgba(255, 255, 255, 0.05)' }]}>
              <Text style={[styles.directionLabelText, { color: settings.stageDirection === 'top' ? '#FF3366' : '#888', fontSize: 11 }]}>
                {settings.stageDirection === 'top' ? '▼ AUDIENCE (FRONT)' : '▲ BACKSTAGE'}
              </Text>
            </View>

            <Animated.View style={[styles.stage, { width: STAGE_WIDTH, height: STAGE_HEIGHT }, stageAnimatedStyle]}>
              <View style={[styles.offStageArea, { left: 0, width: STAGE_CELL_SIZE * 2 }]} /><View style={[styles.offStageArea, { right: 0, width: STAGE_CELL_SIZE * 2 }]} />
              <GridLayer settings={settings} />
              {dancers.map((d, i) => (
                <DancerNode 
                  key={d.id} 
                  index={i} 
                  dancer={d} 
                  dancerPos={dancerPositions[d.id]} 
                  isSelected={selectedDancerId === d.id} 
                  onPress={() => { setSelectedDancerId(d.id); setShowDancerSheet(true); }} 
                  mode={mode} 
                  settings={settings} 
                  stageWidth={STAGE_WIDTH} 
                  stageHeight={STAGE_HEIGHT} 
                  cellSize={STAGE_CELL_SIZE} 
                  scale={scale} 
                  onDragEnd={(id:string, p:Position) => { if(activeSceneId) setScenes(prev => prev.map(s => s.id === activeSceneId ? {...s, positions: {...s.positions, [id]: p}} : s)); }} 
                />
              ))}
            </Animated.View>

            <View style={[styles.directionLabelBox, { bottom: -45, backgroundColor: settings.stageDirection === 'bottom' ? 'rgba(255, 51, 102, 0.15)' : 'rgba(255, 255, 255, 0.05)' }]}>
              <Text style={[styles.directionLabelText, { color: settings.stageDirection === 'bottom' ? '#FF3366' : '#888', fontSize: 11 }]}>
                {settings.stageDirection === 'top' ? '▲ BACKSTAGE' : '▼ AUDIENCE (FRONT)'}
              </Text>
            </View>
          </View>
        </GestureDetector>
      </View>

      <View style={[styles.bottomDock, { paddingBottom: insets.bottom + 10 }]}>
        {mode === 'place' ? (
          <View style={styles.placeDock}>
            <View style={styles.timelineWrapper}>
              <Animated.ScrollView 
                ref={timelineScrollViewRef} 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                scrollEventThrottle={16} 
                onScroll={handleTimelineScroll} 
                onScrollBeginDrag={() => { 
                  isUserScrollingSV.value = true; 
                  cancelAnimation(currentTimeMs); 
                  runOnJS(setSelectedEntryId)(null); 
                }} 
                onMomentumScrollBegin={() => { isUserScrollingSV.value = true; }}
                onScrollEndDrag={(e) => { if (!e.nativeEvent.velocity || e.nativeEvent.velocity.x === 0) onScrollEnd(e); }}
                onMomentumScrollEnd={onScrollEnd}
                contentContainerStyle={{ paddingHorizontal: CENTER_OFFSET }}
              >
                <GestureDetector gesture={Gesture.Tap().runOnJS(true).onEnd((e) => openTimelineMenuAt(e.x))}>
                  <View style={{ width: (status.duration || 60) * PX_PER_SEC, height: 80 }}>
                    <WaveformBackground duration={status.duration || 60} seed={formation?.audioUrl || 'default'} />
                    <TimeMarkers duration={status.duration || 60} />
                    <View style={styles.timelineTrack}>
                      {sortedTimeline.map((e, idx, arr) => {
                        const prev = arr[idx-1];
                        const next = arr[idx+1];
                        const minX = prev ? (prev.timestampMillis + prev.durationMillis) / 1000 * PX_PER_SEC : 0;
                        const maxX = next ? next.timestampMillis / 1000 * PX_PER_SEC : (status.duration || 60) * PX_PER_SEC;
                        
                        return (
                          <React.Fragment key={e.id}>
                            <TimelineBlock 
                              entry={e}
                              isSelected={selectedEntryId === e.id}
                              sceneName={sceneNamesMap[e.sceneId]}
                              theme={theme}
                              minX={minX}
                              maxX={maxX}
                              onSelect={setSelectedEntryId}
                              onCommitMove={handleCommitMove}
                              onCommitResize={handleCommitResize}
                              onDelete={handleDeleteEntry}
                            />
                            {idx < arr.length - 1 && <TransitionX left={((e.timestampMillis+e.durationMillis)/1000)*PX_PER_SEC} width={(arr[idx+1].timestampMillis - (e.timestampMillis+e.durationMillis))/1000*PX_PER_SEC} />}
                          </React.Fragment>
                        );
                      })}
                    </View>
                  </View>
                </GestureDetector>
              </Animated.ScrollView>
              <View style={[styles.needle, { left: CENTER_OFFSET }]} pointerEvents="none" />
            </View>
            <View style={styles.controls}>
              <TouchableOpacity onPress={handlePickAudio} style={styles.toolBtnSmall}><Ionicons name="musical-notes" size={24} color="#AAA" /><Text style={styles.toolBtnText}>노래 변경</Text></TouchableOpacity>
              <PlayButton player={player} theme={theme} currentTimeMs={currentTimeMs} />
              <PlaybackTimeDisplay player={player} />
            </View>
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
      <Modal visible={showStageSettings} transparent animationType="fade">
        <View style={styles.modalBg}><View style={styles.menu}><Text style={styles.menuTitle}>무대 설정</Text><View style={styles.settingRow}><Text style={{color:'#FFF'}}>격자 행 (세로)</Text><TextInput style={[styles.smallInput, { color: theme.primary }]} keyboardType="number-pad" value={String(settings.gridRows)} onChangeText={v => setSettings({...settings, gridRows: parseInt(v) || 10})} /></View>
            <View style={styles.settingRow}><Text style={{color:'#FFF'}}>격자 열 (가로)</Text><TextInput style={[styles.smallInput, { color: theme.primary }]} keyboardType="number-pad" value={String(settings.gridCols)} onChangeText={v => setSettings({...settings, gridCols: parseInt(v) || 10})} /></View>
            <View style={styles.settingRow}><Text style={{color:'#FFF'}}>Audience 위치</Text><TouchableOpacity style={styles.toggleBtn} onPress={() => setSettings({...settings, stageDirection: settings.stageDirection === 'top' ? 'bottom' : 'top'})}><Text style={{color: theme.primary, fontWeight: 'bold'}}>{settings.stageDirection === 'top' ? '상단 (Top)' : '하단 (Bottom)'}</Text></TouchableOpacity></View>
            <View style={styles.settingRow}><Text style={{color:'#FFF'}}>격자 스냅</Text><TouchableOpacity onPress={() => setSettings({...settings, snapToGrid: !settings.snapToGrid})}><Ionicons name={settings.snapToGrid ? "checkbox" : "square-outline"} size={24} color={theme.primary} /></TouchableOpacity></View>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: theme.primary }]} onPress={() => setShowStageSettings(false)}><Text style={{fontWeight:'bold', color: '#000'}}>확인</Text></TouchableOpacity>
          </View></View></Modal>
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
  needle: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#FFD700', zIndex: 100, marginLeft: -1 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toolBtnSmall: { alignItems: 'center', width: 60 },
  playBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  timeText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', width: 60, textAlign: 'right' },
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
  transitionXContainer: { position: 'absolute', zIndex: 15, alignItems: 'center', justifyContent: 'center' },
  xLine: { position: 'absolute', height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  resizeHandleLeft: { position: 'absolute', left: -15, top: 0, bottom: 0, width: 30, justifyContent: 'center', alignItems: 'center', zIndex: 60 },
  resizeHandleRight: { position: 'absolute', right: -15, top: 0, bottom: 0, width: 30, justifyContent: 'center', alignItems: 'center', zIndex: 60 },
  handleCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 },
  sheet: { backgroundColor: '#111', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, width: '100%', position: 'absolute', bottom: 0 },
  sheetInput: { backgroundColor: '#000', color: '#FFF', padding: 15, borderRadius: 12, marginBottom: 15 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorChip: { width: 30, height: 30, borderRadius: 15 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  smallInput: { backgroundColor: '#000', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, width: 60, textAlign: 'center', fontWeight: 'bold' },
  toggleBtn: { backgroundColor: '#222', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  directionLabelBox: { position: 'absolute', paddingHorizontal: 15, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  directionLabelText: { color: '#666', fontSize: 9, fontWeight: 'bold', letterSpacing: 2 },
  doneBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  zoomControls: { position: 'absolute', top: 15, right: 15, zIndex: 100, flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 20, padding: 4, borderWidth: 1, borderColor: '#333' },
  zoomBtn: { paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' }
});
