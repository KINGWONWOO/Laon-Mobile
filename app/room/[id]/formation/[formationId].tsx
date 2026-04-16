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
import { WebView } from 'react-native-webview';

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

const WaveformBackground = React.memo(function WaveformBackground({ duration, peaks }: { duration: number, peaks: number[] }) {
  const { theme } = useAppContext();
  
  if (duration <= 0) return <View style={styles.waveformEmpty}><ActivityIndicator color={theme.primary} /></View>;

  const displayPeaks = useMemo(() => {
    if (peaks.length > 0) return peaks;
    return Array.from({ length: Math.floor(duration * 10) }).map(() => 0.05);
  }, [peaks, duration]);

  return (
    <View style={[styles.waveformContainer, { width: duration * PX_PER_SEC, alignItems: 'center' }]}>
      {displayPeaks.map((peak, i) => (
        <View 
          key={i} 
          style={[
            styles.waveformBar, 
            { 
              backgroundColor: theme.text,
              width: 1.8,
              height: Math.max(2, peak * 48),
              opacity: peak > 0.3 ? 0.35 : 0.15,
              marginHorizontal: 0.7,
              borderRadius: 1
            }
          ]} 
        />
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
    <View style={{ flex: 1, width: '100%', padding: 4, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: '100%', height: '100%', aspectRatio, position: 'relative' }}>
        {dancers.map(d => {
          const pos = scene.positions[d.id] || { x: 0.5, y: 0.5 };
          return <View key={d.id} style={[styles.miniDancer, { backgroundColor: d.color, left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }]} />;
        })}
      </View>
    </View>
  );
});

const TimelineBlock = React.memo(function TimelineBlock({ entry, isSelected, sceneName, theme, onSelect, onDelete, dancers, scenes, settings }: any) {
  const localX = (entry.timestampMillis / 1000) * PX_PER_SEC;
  const localWidth = (entry.durationMillis / 1000) * PX_PER_SEC;
  const scene = scenes.find((s: any) => s.id === entry.sceneId);

  return (
    <TouchableOpacity 
      onPress={() => onSelect(entry.id)}
      onLongPress={() => {
        Alert.alert('삭제', '이 블록을 삭제할까요?', [
          { text: '취소' },
          { text: '삭제', style: 'destructive', onPress: () => onDelete(entry.id) }
        ]);
      }}
      style={[
        styles.block, 
        { 
          left: localX, 
          width: localWidth, 
          backgroundColor: isSelected ? theme.primary + 'AA' : theme.card + 'CC',
          borderColor: isSelected ? theme.primary : theme.border,
          borderWidth: 1
        }
      ]}
    >
      {scene && <MiniFormationPreview scene={scene} dancers={dancers} settings={settings} />}
      <Text style={[styles.blockText, { color: isSelected ? theme.background : theme.text }]} numberOfLines={1}>{sceneName}</Text>
    </TouchableOpacity>
  );
});

const DancerNode = React.memo(function DancerNode({ dancer, dancerPos, isSelected, onPress, scale, index, settings, stageWidth, stageHeight, cellSize, mode, onDragEnd }: any) {
  const isDragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  
  const pos = useDerivedValue(() => {
    if (isDragging.value) return { x: dragX.value, y: dragY.value };
    return dancerPos?.value || { x: 0.5, y: 0.5 };
  });

  const panGesture = Gesture.Pan()
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

  const { theme } = useAppContext();

  return (
    <GestureDetector gesture={Gesture.Exclusive(panGesture, Gesture.Tap().runOnJS(true).onEnd(() => runOnJS(onPress)()))}>
      <Animated.View style={[styles.dancerNode, style]} pointerEvents="box-none">
        <View style={[styles.dancerCircle, { backgroundColor: dancer.color, borderColor: isSelected ? theme.text : 'rgba(0,0,0,0.2)', width: cellSize * 0.7, height: cellSize * 0.7, borderRadius: (cellSize * 0.7) / 2, borderWidth: 1.5 }]}><Text style={[styles.dancerInitial, { fontSize: cellSize * 0.3 }]}>{index + 1}</Text></View>
        <Text style={[styles.dancerNameText, { color: isSelected ? theme.text : theme.textSecondary, fontSize: (settings.dancerNameSize || 8) }]} numberOfLines={1}>{dancer.name}</Text>
      </Animated.View>
    </GestureDetector>
  );
});

const GridLayer = React.memo(function GridLayer({ settings }: { settings: FormationSettings }) {
  const { theme } = useAppContext();
  const gridColor = theme.border; 
  const centerColor = theme.primary;

  return (
    <View style={styles.gridLayer}>
      {Array.from({ length: settings.gridRows + 1 }).map((_, i) => (
        <View key={`h-${i}`} style={[styles.gridH, { top: `${(i / settings.gridRows) * 100}%`, backgroundColor: gridColor, opacity: 0.4, height: 1 }]} />
      ))}
      {Array.from({ length: settings.gridCols + 1 }).map((_, i) => (
        <View key={`v-${i}`} style={[styles.gridV, { left: `${(i / settings.gridCols) * 100}%`, backgroundColor: gridColor, opacity: 0.4, width: 1 }]} />
      ))}
      <View style={{ position: 'absolute', top: '50%', left: '50%', width: 24, height: 2, backgroundColor: centerColor, marginLeft: -12, marginTop: -1, opacity: 0.9 }} />
      <View style={{ position: 'absolute', top: '50%', left: '50%', width: 2, height: 24, backgroundColor: centerColor, marginLeft: -1, marginTop: -12, opacity: 0.9 }} />
    </View>
  );
});

interface HistoryState {
  dancers: Dancer[];
  scenes: FormationScene[];
  timeline: TimelineEntry[];
  audioUrl: string;
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
  const [audioUrl, setAudioUrl] = useState<string>(formation?.audioUrl || '');
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [settings, setSettings] = useState<FormationSettings>(formation?.settings || { gridRows: 10, gridCols: 20, stageDirection: 'top', snapToGrid: true, dancerNameSize: 8 });
  const [activeSceneId, setActiveSceneId] = useState<string | null>(formation?.data?.scenes?.[0]?.id || null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showDancerSheet, setShowDancerSheet] = useState(false);
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isChangingSong, setIsChangingSong] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sceneModalMode, setSceneModalMode] = useState<'add' | 'rename'>('add');
  const [targetSceneId, setTargetSceneId] = useState<string | null>(null);
  const [inputName, setInputName] = useState('');
  const [touchTimeMs, setTouchTimeMs] = useState(0);
  const [zoomUI, setZoomUI] = useState(100);

  const [tempRows, setTempRows] = useState('');
  const [tempCols, setTempCols] = useState('');

  const webViewRef = useRef<WebView>(null);

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

  const stageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }]
  }));

  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);

  const dancerPositionsRef = useRef<Record<string, any>>({});
  dancers.forEach(d => {
    if (!dancerPositionsRef.current[d.id]) {
      const activeScene = scenes.find(s => s.id === activeSceneId);
      dancerPositionsRef.current[d.id] = makeMutable(activeScene?.positions[d.id] || { x: 0.5, y: 0.5 });
    }
  });
  const dancerPositions = dancerPositionsRef.current;

  const [createPast, setCreatePast] = useState<HistoryState[]>([]);
  const [createFuture, setCreateFuture] = useState<HistoryState[]>([]);
  const [placePast, setPlacePast] = useState<HistoryState[]>([]);
  const [placeFuture, setPlaceFuture] = useState<HistoryState[]>([]);

  const analyzeAudio = async (uri: string) => {
    if (!uri) return;
    setIsAnalyzing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const analysisScript = `
        (async () => {
          try {
            const base64Data = "${base64}";
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
            
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
            const rawData = audioBuffer.getChannelData(0); 
            const samplesPerSec = 10;
            const totalSamples = Math.floor(audioBuffer.duration * samplesPerSec);
            const blockSize = Math.floor(rawData.length / totalSamples);
            const peaks = [];
            
            for (let i = 0; i < totalSamples; i++) {
              let start = blockSize * i;
              let max = 0;
              for (let j = 0; j < blockSize; j++) {
                const abs = Math.abs(rawData[start + j]);
                if (abs > max) max = abs;
              }
              peaks.push(max);
            }
            const maxPeak = Math.max(...peaks);
            const normalized = peaks.map(p => Math.pow(p / maxPeak, 0.8));
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ANALYSIS_COMPLETE', data: normalized }));
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: e.message }));
          }
        })();
      `;
      webViewRef.current?.injectJavaScript(analysisScript);
    } catch (e) {
      console.error('Audio Analysis Error:', e);
      setIsAnalyzing(false);
    }
  };

  useEffect(() => { if (audioUrl) analyzeAudio(audioUrl); }, [audioUrl]);

  const onWebViewMessage = (e: any) => {
    try {
      const event = JSON.parse(e.nativeEvent.data);
      if (event.type === 'ANALYSIS_COMPLETE') setWaveformPeaks(event.data);
      setIsAnalyzing(false);
    } catch (err) {}
  };

  const pushHistory = useCallback(() => {
    const current: HistoryState = { dancers: JSON.parse(JSON.stringify(dancers)), scenes: JSON.parse(JSON.stringify(scenes)), timeline: JSON.parse(JSON.stringify(timeline)), audioUrl };
    if (mode === 'create') { setCreatePast(prev => [...prev, current].slice(-30)); setCreateFuture([]); }
    else { setPlacePast(prev => [...prev, current].slice(-30)); setPlaceFuture([]); }
  }, [dancers, scenes, timeline, mode, audioUrl]);

  const onDragEnd = useCallback((dancerId: string, pos: Position) => {
    const targetId = mode === 'create' ? activeSceneId : (timeline.find(e => currentTimeMs.value >= e.timestampMillis && currentTimeMs.value < e.timestampMillis + e.durationMillis)?.sceneId || null);
    if (!targetId) return;
    setScenes(prev => prev.map(s => s.id === targetId ? { ...s, positions: { ...s.positions, [dancerId]: pos } } : s));
    pushHistory();
  }, [mode, activeSceneId, timeline, pushHistory]);

  const undo = () => {
    const past = mode === 'create' ? createPast : placePast;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const current = { dancers, scenes, timeline, audioUrl };
    if (mode === 'create') { setCreateFuture(f => [current, ...f]); setCreatePast(p => p.slice(0, -1)); }
    else { setPlaceFuture(f => [current, ...f]); setPlacePast(p => p.slice(0, -1)); }
    setDancers(previous.dancers); setScenes(previous.scenes); setTimeline(previous.timeline); setAudioUrl(previous.audioUrl);
  };

  const redo = () => {
    const future = mode === 'create' ? createFuture : placeFuture;
    if (future.length === 0) return;
    const next = future[0];
    const current = { dancers, scenes, timeline, audioUrl };
    if (mode === 'create') { setCreatePast(p => [...p, current]); setCreateFuture(f => f.slice(1)); }
    else { setPlacePast(p => [...p, current]); setPlaceFuture(f => f.slice(1)); }
    setDancers(next.dancers); setScenes(next.scenes); setTimeline(next.timeline); setAudioUrl(next.audioUrl);
  };

  const handleTimelineScroll = (e: any) => {
    if (isUserScrollingSV.value) {
      const newTimeMs = (e.nativeEvent.contentOffset.x / PX_PER_SEC) * 1000;
      cancelAnimation(currentTimeMs);
      currentTimeMs.value = newTimeMs;
      runOnJS((t: number) => player.seekTo(t / 1000))(newTimeMs);
    }
  };

  const openTimelineMenuAt = (x: number) => { if (scenes.length === 0) { Alert.alert('알림', '대형을 먼저 추가해주세요.'); return; } setTouchTimeMs(currentTimeMs.value); setShowTimelineMenu(true); };
  const handleAddTimelineEntry = (sceneId: string) => { pushHistory(); setTimeline([...timeline, { id: Math.random().toString(36).substr(2, 9), sceneId, timestampMillis: touchTimeMs, durationMillis: 3000 }]); setShowTimelineMenu(false); };
  
  const handleChangeSong = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      setIsChangingSong(true);
      const destUri = `${FileSystem.documentDirectory}audio_${Date.now()}_${res.assets[0].name.replace(/\s+/g, '_')}`;
      await FileSystem.copyAsync({ from: res.assets[0].uri, to: destUri });
      pushHistory(); setAudioUrl(destUri); setWaveformPeaks([]);
    } catch (e: any) { Alert.alert('실패', e.message); } finally { setIsChangingSong(false); }
  };

  const handleSave = async () => { try { await updateFormation(formationId!, { audioUrl, settings, data: { dancers, scenes, timeline } }); setShowSaveToast(true); setTimeout(() => setShowSaveToast(false), 2000); } catch (e: any) { Alert.alert('오류', e.message); } };
  const handleSceneAction = () => { pushHistory(); if (sceneModalMode === 'add') { const nid = Math.random().toString(36).substr(2,9), last = scenes[scenes.length-1]; setScenes([...scenes, { id: nid, name: inputName.trim() || `대형 ${scenes.length+1}`, positions: last ? JSON.parse(JSON.stringify(last.positions)) : {} }]); setActiveSceneId(nid); } else setScenes(prev => prev.map(s => s.id === targetSceneId ? {...s, name: inputName.trim() || s.name} : s)); setShowSceneModal(false); setInputName(''); };

  if (!formation) return null;
  const STAGE_CELL_SIZE = (width - 40) / settings.gridCols;
  const STAGE_WIDTH = settings.gridCols * STAGE_CELL_SIZE;
  const STAGE_HEIGHT = settings.gridRows * STAGE_CELL_SIZE;
  const controlTop = 100;
  const sortedTimeline = [...timeline].sort((a,b) => a.timestampMillis - b.timestampMillis);
  const sceneNamesMap = scenes.reduce((acc: any, s) => ({ ...acc, [s.id]: s.name }), {});

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={theme.text} /></TouchableOpacity>
        <View style={[styles.modeToggle, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={() => setMode('create')} style={[styles.modeTab, mode === 'create' && { backgroundColor: theme.primary }]}><Text style={[styles.tabText, { color: mode === 'create' ? theme.background : theme.textSecondary }]}>대형 생성</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('place')} style={[styles.modeTab, mode === 'place' && { backgroundColor: theme.primary }]}><Text style={[styles.tabText, { color: mode === 'place' ? theme.background : theme.textSecondary }]}>대형 배치</Text></TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 15 }}><TouchableOpacity onPress={handleSave}><Ionicons name="save-outline" size={24} color={theme.primary} /></TouchableOpacity><TouchableOpacity onPress={() => setShowExportModal(true)}><Ionicons name="share-outline" size={24} color={theme.primary} /></TouchableOpacity></View>
      </View>

      <View style={{ height: 0, width: 0, opacity: 0, position: 'absolute' }}><WebView ref={webViewRef} onMessage={onWebViewMessage} source={{ html: '<html><body></body></html>' }} /></View>

      {showSaveToast && <View style={[styles.toast, { backgroundColor: theme.primary }]}><Ionicons name="checkmark-circle" size={20} color={theme.background} /><Text style={[styles.toastText, { color: theme.background }]}>저장되었습니다.</Text></View>}
      {isAnalyzing && <View style={[styles.analysisLoader, { backgroundColor: theme.card + 'CC' }]}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.text, marginTop: 10, fontSize: 12, fontWeight: 'bold' }}>음악 데이터 정밀 분석 중...</Text></View>}

      <View style={[styles.historyControls, { top: controlTop + insets.top, backgroundColor: theme.card, borderColor: theme.border }]}><TouchableOpacity style={[styles.zoomBtn, { borderRightWidth: 1, borderColor: theme.border }]} onPress={undo} disabled={(mode === 'create' ? createPast : placePast).length === 0}><Ionicons name="arrow-undo" size={20} color={theme.text} /></TouchableOpacity><TouchableOpacity style={styles.zoomBtn} onPress={redo} disabled={(mode === 'create' ? createFuture : placeFuture).length === 0}><Ionicons name="arrow-redo" size={20} color={theme.text} /></TouchableOpacity></View>
      <View style={[styles.zoomControls, { top: controlTop + insets.top, backgroundColor: theme.card, borderColor: theme.border }]}><TouchableOpacity style={styles.zoomBtn} onPress={() => { scale.value = withSpring(1); translateX.value = withSpring(0); translateY.value = withSpring(0); setZoomUI(100); }}><Text style={[styles.zoomText, { color: theme.text }]}>{zoomUI}%</Text></TouchableOpacity><TouchableOpacity style={styles.zoomBtn} onPress={() => { scale.value = withTiming(Math.min(5, scale.value + 0.25)); runOnJS(setZoomUI)(Math.round(scale.value * 100)); }}><Ionicons name="add" size={20} color={theme.text} /></TouchableOpacity><TouchableOpacity style={styles.zoomBtn} onPress={() => { scale.value = withTiming(Math.max(0.5, scale.value - 0.25)); runOnJS(setZoomUI)(Math.round(scale.value * 100)); }}><Ionicons name="remove" size={20} color={theme.text} /></TouchableOpacity></View>

      <View style={styles.stageSection}>
        <GestureDetector gesture={Gesture.Simultaneous(Gesture.Pinch().onUpdate(e => { scale.value = Math.max(0.5, Math.min(5, savedScale.value * e.scale)); runOnJS(setZoomUI)(Math.round(scale.value * 100)); }).onEnd(() => savedScale.value = scale.value), Gesture.Pan().onUpdate(e => { translateX.value = savedTranslateX.value + e.translationX; translateY.value = savedTranslateY.value + e.translationY; }).onEnd(() => { savedTranslateX.value = translateX.value; savedTranslateY.value = translateY.value; }))}>
          <View style={[styles.stageWrapper, { paddingTop: 40 }]}>
            <Animated.View style={[styles.stage, { width: STAGE_WIDTH, height: STAGE_HEIGHT, backgroundColor: theme.card, borderColor: theme.border }, stageAnimatedStyle]}>
              <GridLayer settings={settings} />
              {dancers.map((d, i) => (
                <DancerNode key={d.id} index={i} dancer={d} dancerPos={dancerPositions[d.id]} isSelected={selectedDancerId === d.id} onPress={() => { setSelectedDancerId(d.id); setShowDancerSheet(true); }} mode={mode} settings={settings} stageWidth={STAGE_WIDTH} stageHeight={STAGE_HEIGHT} cellSize={STAGE_CELL_SIZE} scale={scale} onDragEnd={onDragEnd} />
              ))}
            </Animated.View>
          </View>
        </GestureDetector>
      </View>

      <View style={[styles.bottomDock, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        {mode === 'place' ? (
          <View style={styles.placeDock}>
            <View style={[styles.timelineWrapper, { backgroundColor: theme.card }]}>
              <Animated.ScrollView ref={timelineScrollViewRef} horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={handleTimelineScroll} onScrollBeginDrag={() => { isUserScrollingSV.value = true; cancelAnimation(currentTimeMs); }} onMomentumScrollEnd={() => isUserScrollingSV.value = false} contentContainerStyle={{ paddingHorizontal: CENTER_OFFSET }}>
                <GestureDetector gesture={Gesture.Tap().runOnJS(true).onEnd((e) => openTimelineMenuAt(e.x))}>
                  <View style={{ width: (status.duration || 60) * PX_PER_SEC, height: 120, justifyContent: 'center' }}>
                    <WaveformBackground duration={status.duration || 60} peaks={waveformPeaks} />
                    <TimeMarkers duration={status.duration || 60} />
                    <View style={styles.timelineTrack}>
                      {sortedTimeline.map((e, idx, arr) => (
                        <TimelineBlock key={e.id} entry={e} isSelected={selectedEntryId === e.id} sceneName={sceneNamesMap[e.sceneId]} theme={theme} onSelect={setSelectedEntryId} onDelete={(eid: string) => setTimeline(timeline.filter(x=>x.id!==eid))} dancers={dancers} scenes={scenes} settings={settings} />
                      ))}
                    </View>
                  </View>
                </GestureDetector>
              </Animated.ScrollView>
              <View style={[styles.needle, { left: CENTER_OFFSET }]} pointerEvents="none" />
            </View>
            <View style={styles.controls}><TouchableOpacity onPress={handleChangeSong} style={styles.toolBtnSmall} disabled={isChangingSong}><Ionicons name="musical-notes" size={24} color={theme.textSecondary} /><Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>노래 변경</Text></TouchableOpacity><PlayButton player={player} theme={theme} currentTimeMs={currentTimeMs} /><PlaybackTimeDisplay player={player} /></View>
          </View>
        ) : (
          <View style={styles.createDock}>
            <View style={styles.createToolbar}><TouchableOpacity style={styles.toolBtn} onPress={() => setDancers([...dancers, { id: Math.random().toString(36).substr(2,9), name: `댄서 ${dancers.length+1}`, color: COLORS[dancers.length%COLORS.length] }])}><Ionicons name="person-add" size={24} color={theme.primary} /><Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>댄서 추가</Text></TouchableOpacity><TouchableOpacity style={styles.toolBtn} onPress={() => setShowStageSettings(true)}><Ionicons name="settings-outline" size={24} color={theme.textSecondary} /><Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>무대 설정</Text></TouchableOpacity></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10 }}>
              <TouchableOpacity style={[styles.addSceneBtn, { backgroundColor: theme.primary }]} onPress={() => { setSceneModalMode('add'); setInputName(''); setShowSceneModal(true); }}><Ionicons name="add" size={24} color={theme.background} /></TouchableOpacity>
              {scenes.map(s => <TouchableOpacity key={s.id} onPress={() => setActiveSceneId(s.id)} style={[styles.sceneCard, { borderColor: activeSceneId === s.id ? theme.primary : theme.border, backgroundColor: theme.card }]}><MiniFormationPreview scene={s} dancers={dancers} settings={settings} /><Text style={[styles.sceneCardText, { color: theme.text }]} numberOfLines={1}>{s.name}</Text></TouchableOpacity>)}
            </ScrollView>
          </View>
        )}
      </View>
      
      <Modal visible={showSceneModal} transparent animationType="fade"><View style={styles.modalBg}><View style={[styles.menu, { backgroundColor: theme.card }]}><Text style={[styles.menuTitle, { color: theme.text }]}>{sceneModalMode === 'add' ? '대형 추가' : '이름 변경'}</Text><TextInput style={[styles.sheetInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={inputName} onChangeText={setInputName} placeholder="대형 이름" autoFocus /><View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20 }}><TouchableOpacity onPress={() => setShowSceneModal(false)}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity><TouchableOpacity onPress={handleSceneAction}><Text style={{ color: theme.primary, fontWeight: 'bold' }}>{sceneModalMode === 'add' ? '추가' : '저장'}</Text></TouchableOpacity></View></View></View></Modal>
      <Modal visible={showExportModal} transparent animationType="fade"><View style={styles.modalBg}><View style={[styles.menu, { backgroundColor: theme.card }]}><Text style={[styles.menuTitle, { color: theme.text }]}>내보내기</Text><TouchableOpacity style={styles.exportOption} onPress={() => {}}><Ionicons name="document-text" size={24} color={theme.primary} /><Text style={{ color: theme.text, marginLeft: 15 }}>JSON 파일 추출</Text></TouchableOpacity><TouchableOpacity style={styles.exportOption} onPress={() => {}}><Ionicons name="cloud-upload" size={24} color={theme.primary} /><Text style={{ color: theme.text, marginLeft: 15 }}>피드백 발행</Text></TouchableOpacity><TouchableOpacity style={[styles.exportOption, { marginTop: 10 }]} onPress={() => setShowExportModal(false)}><Text style={{ color: theme.error }}>닫기</Text></TouchableOpacity></View></View></Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  modeToggle: { flexDirection: 'row', borderRadius: 20, padding: 4 },
  modeTab: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 18 },
  tabText: { fontWeight: 'bold', fontSize: 13 },
  stageSection: { flex: 1, overflow: 'hidden' },
  stageWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { borderWidth: 1 },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridH: { position: 'absolute', left: 0, right: 0 },
  gridV: { position: 'absolute', top: 0, bottom: 0 },
  dancerNode: { position: 'absolute', alignItems: 'center' },
  dancerCircle: { justifyContent: 'center', alignItems: 'center' },
  dancerInitial: { color: '#FFF', fontWeight: 'bold' },
  dancerNameText: { marginTop: 4 },
  bottomDock: { borderTopWidth: 1 },
  placeDock: { padding: 15, height: 220 },
  timelineWrapper: { height: 120, position: 'relative', marginBottom: 15, borderRadius: 10, overflow: 'hidden' },
  waveformContainer: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  waveformBar: { },
  waveformEmpty: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  timeMarkersLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 20 },
  timeMarker: { position: 'absolute', bottom: 0, alignItems: 'center' },
  timeMarkerLine: { width: 1, height: 5 },
  timeMarkerText: { fontSize: 9, marginTop: 2, fontWeight: 'bold' },
  timelineTrack: { flex: 1, position: 'relative' },
  block: { position: 'absolute', top: 10, bottom: 25, borderRadius: 4, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, zIndex: 50 },
  blockText: { fontSize: 9, fontWeight: 'bold' },
  needle: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#FFD700', zIndex: 100, marginLeft: -1 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolBtnSmall: { alignItems: 'center', width: 60 },
  playBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  timeText: { fontSize: 16, fontWeight: 'bold', width: 60, textAlign: 'right' },
  createDock: { padding: 15, height: 220 },
  createToolbar: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  toolBtn: { alignItems: 'center' },
  toolBtnText: { fontSize: 11, marginTop: 4 },
  addSceneBtn: { width: 60, height: 80, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  sceneCard: { width: 100, height: 110, borderRadius: 12, borderWidth: 2, marginRight: 12, overflow: 'hidden', alignItems: 'center' },
  sceneCardText: { fontSize: 10, fontWeight: 'bold', marginVertical: 5 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  menu: { padding: 25, borderRadius: 20, width: '85%' },
  menuTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  sheetInput: { padding: 15, borderRadius: 12, marginBottom: 20 },
  exportOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  toast: { position: 'absolute', top: 120, left: '10%', right: '10%', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 999, elevation: 5 },
  toastText: { marginLeft: 10, fontWeight: 'bold' },
  analysisLoader: { position: 'absolute', top: 120, alignSelf: 'center', padding: 15, borderRadius: 12, alignItems: 'center', zIndex: 1000 },
  zoomControls: { position: 'absolute', right: 15, zIndex: 100, flexDirection: 'row', borderRadius: 20, padding: 4, borderWidth: 1 },
  historyControls: { position: 'absolute', left: 15, zIndex: 100, flexDirection: 'row', borderRadius: 20, padding: 4, borderWidth: 1 },
  zoomBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  zoomText: { fontSize: 11, fontWeight: 'bold' },
  miniDancer: { position: 'absolute', width: 6, height: 6, borderRadius: 3, marginLeft: -3, marginTop: -3 },
  resizeHandleLeft: { position: 'absolute', left: -15, top: 0, bottom: 0, width: 30, justifyContent: 'center', alignItems: 'center', zIndex: 60 },
  resizeHandleRight: { position: 'absolute', right: -15, top: 0, bottom: 0, width: 30, justifyContent: 'center', alignItems: 'center', zIndex: 60 },
  handleCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 3 }
});
