import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Modal, Alert, ActivityIndicator, Pressable, Image, ScrollView, Platform, KeyboardAvoidingView, PixelRatio } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { Dancer, FormationScene, TimelineEntry, Position, Formation, FormationSettings } from '../../../../types';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, useDerivedValue, withSpring, withTiming, makeMutable, Easing, cancelAnimation, useAnimatedReaction, useAnimatedRef, scrollTo, SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { FormationPiPPlayer } from '../../../../components/ui/FormationPiPPlayer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { OptionModal } from '../../../../components/ui/RoomComponents';
import { storageService } from '../../../../services/storageService';
import { ensureStandardMP4 } from '../../../../utils/convertMP4';

const { width } = Dimensions.get('window');
const BASE_PX_PER_SEC = 60;
const TIMELINE_CONTAINER_WIDTH = width - 30;
const CENTER_OFFSET = TIMELINE_CONTAINER_WIDTH / 2;
const COLORS = ['#FF3366', '#FF9F43', '#F7D794', '#4ECDC4', '#45B7D1', '#A06CD5', '#1B9CFC', '#E056FD', '#686DE0', '#30336B'];

const formatTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

const PlaybackTimeDisplay = React.memo(function PlaybackTimeDisplay({ currentTimeMs }: { currentTimeMs: SharedValue<number> }) {
  const { theme } = useAppContext();
  const [timeStr, setTimeStr] = useState('0:00');

  useAnimatedReaction(
    () => Math.floor(currentTimeMs.value / 1000),
    (s, prev) => {
      if (s !== prev) {
        runOnJS(setTimeStr)(`${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`);
      }
    }
  );

  return <Text style={[styles.timeText, { color: theme.text }]}>{timeStr}</Text>;
});

const PlayButton = React.memo(function PlayButton({ player, theme, isPlayingSV }: { player: any, theme: any, isPlayingSV: SharedValue<boolean> }) {
  const [isPlaying, setIsPlaying] = useState(false);

  useAnimatedReaction(
    () => isPlayingSV.value,
    (playing) => { runOnJS(setIsPlaying)(playing); }
  );

  const togglePlay = () => {
    try {
      if (!player) return;
      // player.playing은 stale할 수 있으므로 SharedValue 기준으로 판단
      if (isPlaying) player.pause();
      else player.play();
    } catch (e) {}
  };

  return (
    <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, { backgroundColor: theme.primary }]}>
      <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color={theme.background} />
    </TouchableOpacity>
  );
});

// [Tiling Optimized] 30초 단위의 고해상도 이미지 조각들을 이어 붙여 깨짐 방지 및 성능 극대화
const WaveformBackground = React.memo(function WaveformBackground({ duration, tiles, pxPerSecSV }: { duration: number, tiles: string[], pxPerSecSV: SharedValue<number> }) {
  const { theme } = useAppContext();
  
  const animatedStyle = useAnimatedStyle(() => ({
    width: duration * pxPerSecSV.value,
    flexDirection: 'row',
    alignItems: 'center',
    height: 120
  }));

  if (duration <= 0) return <View style={styles.waveformEmpty}><ActivityIndicator color={theme.primary} /></View>;

  return (
    <Animated.View style={[styles.waveformContainer, animatedStyle]}>
      {tiles.length > 0 ? (
        tiles.map((tile, i) => (
          <WaveformTile 
            key={i} 
            uri={tile} 
            index={i} 
            totalDuration={duration} 
            pxPerSecSV={pxPerSecSV} 
          />
        ))
      ) : (
        <View style={{ height: 1, width: '100%', backgroundColor: theme.text, opacity: 0.1 }} />
      )}
    </Animated.View>
  );
});

const WaveformTile = React.memo(function WaveformTile({ uri, index, totalDuration, pxPerSecSV }: any) {
  const animatedStyle = useAnimatedStyle(() => {
    const tileWidth = Math.min(30, totalDuration - (index * 30)) * pxPerSecSV.value;
    return {
      width: tileWidth,
      height: 120,
    };
  });

  return (
    <AnimatedImage 
      source={{ uri }} 
      style={animatedStyle} 
      resizeMode="stretch"
    />
  );
});

const AnimatedImage = Animated.createAnimatedComponent(Image);

const TimeMarkers = React.memo(function TimeMarkers({ duration, pxPerSecSV }: { duration: number, pxPerSecSV: SharedValue<number> }) {
  const { theme } = useAppContext();
  const markers = useMemo(() => {
    const list = [];
    for (let i = 0; i <= duration; i += 5) {
      list.push(<TimeMarker key={i} time={i} pxPerSecSV={pxPerSecSV} theme={theme} />);
    }
    return list;
  }, [duration, theme, pxPerSecSV]);
  return <View style={styles.timeMarkersLayer}>{markers}</View>;
});

const TimeMarker = React.memo(function TimeMarker({ time, pxPerSecSV, theme }: any) {
  const animatedStyle = useAnimatedStyle(() => ({
    left: time * pxPerSecSV.value
  }));
  return (
    <Animated.View style={[styles.timeMarker, animatedStyle]}>
      <View style={[styles.timeMarkerLine, { backgroundColor: theme.border }]} />
      <Text style={[styles.timeMarkerText, { color: theme.textSecondary }]}>{Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}</Text>
    </Animated.View>
  );
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

const TransitionX = React.memo(function TransitionX({ durationMs, startMs, pxPerSecSV }: { durationMs: number, startMs: number, pxPerSecSV: SharedValue<number> }) {
  const { theme } = useAppContext();
  const height = 85; 
  
  const animatedStyle = useAnimatedStyle(() => {
    const width = (durationMs / 1000) * pxPerSecSV.value;
    const left = (startMs / 1000) * pxPerSecSV.value;
    const angle = Math.atan2(height, width) * (180 / Math.PI);
    const length = Math.sqrt(width * width + height * height);
    
    return {
      left,
      width: Math.max(0, width),
      opacity: width <= 5 ? 0 : 1,
      // Pass length and angle to children if they were animated, 
      // but here we can just return the transform.
      // Actually children lines need length and angle.
    };
  });

  // Since angle and length depend on width, and width is animated, 
  // the children also need to be animated.
  return (
    <Animated.View style={[styles.transitionXContainer, animatedStyle, { height, top: 10 }]} pointerEvents="none">
      <TransitionXLines height={height} durationMs={durationMs} pxPerSecSV={pxPerSecSV} theme={theme} />
    </Animated.View>
  );
});

const TransitionXLines = ({ height, durationMs, pxPerSecSV, theme }: any) => {
  const line1Style = useAnimatedStyle(() => {
    const width = (durationMs / 1000) * pxPerSecSV.value;
    const angle = Math.atan2(height, width) * (180 / Math.PI);
    const length = Math.sqrt(width * width + height * height);
    return {
      width: length,
      top: height / 2,
      left: (width - length) / 2,
      transform: [{ rotate: `${angle}deg` }],
      backgroundColor: theme.textSecondary + '33'
    };
  });

  const line2Style = useAnimatedStyle(() => {
    const width = (durationMs / 1000) * pxPerSecSV.value;
    const angle = Math.atan2(height, width) * (180 / Math.PI);
    const length = Math.sqrt(width * width + height * height);
    return {
      width: length,
      top: height / 2,
      left: (width - length) / 2,
      transform: [{ rotate: `-${angle}deg` }],
      backgroundColor: theme.textSecondary + '33'
    };
  });

  return (
    <>
      <Animated.View style={[styles.xLine, line1Style]} />
      <Animated.View style={[styles.xLine, line2Style]} />
    </>
  );
};

const ResizeHandle = React.memo(function ResizeHandle({ direction, localTs, localDur, minTs, maxTs, pxPerSecSV, onCommit, isVisible, movePanRef }: any) {
  const { theme } = useAppContext();
  const startTs = useSharedValue(0);
  const startDur = useSharedValue(0);

  const pan = useMemo(() => {
    const g = Gesture.Pan()
      .onStart(() => {
        'worklet';
        startTs.value = localTs.value;
        startDur.value = localDur.value;
      })
      .onUpdate((e) => {
        'worklet';
        const deltaTs = (e.translationX / pxPerSecSV.value) * 1000;
        if (direction === 'left') {
          const newTs = Math.max(minTs, Math.min(startTs.value + deltaTs, startTs.value + startDur.value - 200));
          localTs.value = newTs;
          localDur.value = startDur.value - (newTs - startTs.value);
        } else {
          localDur.value = Math.max(200, Math.min(startDur.value + deltaTs, maxTs - localTs.value));
        }
      })
      .onEnd(() => {
        'worklet';
        if (direction === 'left') {
          runOnJS(onCommit)(localTs.value);
        } else {
          runOnJS(onCommit)(localDur.value);
        }
      });
    if (movePanRef) g.blocksExternalGesture(movePanRef);
    return g;
  }, [direction, localTs, localDur, startTs, startDur, minTs, maxTs, pxPerSecSV, onCommit, movePanRef]);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[direction === 'left' ? styles.resizeHandleLeft : styles.resizeHandleRight, { opacity: isVisible ? 1 : 0 }]}
        pointerEvents={isVisible ? 'auto' : 'none'}
      >
        <View style={[styles.handleCircle, { backgroundColor: theme.text }]}>
          <Ionicons name={direction === 'left' ? "chevron-back" : "chevron-forward"} size={14} color={theme.background} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

const TimelineContainer = ({ duration, pxPerSecSV, children }: any) => {
  const animatedStyle = useAnimatedStyle(() => ({
    width: duration * pxPerSecSV.value,
    height: 120
  }));
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

const TimelineBlock = React.memo(function TimelineBlock({ entry, isSelected, sceneName, theme, minTs, maxTs, pxPerSecSV, onSelect, onCommitMove, onCommitResize, onActionClick, dancers, scene, settings }: any) {
  const localTs = useSharedValue(entry.timestampMillis);
  const localDur = useSharedValue(entry.durationMillis);
  const moveStartTs = useSharedValue(0);
  const isSelectedSV = useSharedValue(isSelected);
  const movePanRef = useRef<any>(null);

  useEffect(() => {
    localTs.value = entry.timestampMillis;
    localDur.value = entry.durationMillis;
  }, [entry.timestampMillis, entry.durationMillis, localDur, localTs]);

  useEffect(() => {
    isSelectedSV.value = isSelected;
  }, [isSelected, isSelectedSV]);

  const animatedStyle = useAnimatedStyle(() => ({
    left: (localTs.value / 1000) * pxPerSecSV.value,
    width: (localDur.value / 1000) * pxPerSecSV.value,
    backgroundColor: isSelectedSV.value ? (theme.primary + 'AA') : (theme.card + 'CC'),
    borderColor: isSelectedSV.value ? theme.primary : theme.border,
    zIndex: isSelectedSV.value ? 100 : 50
  }));

  const onCommitLeft = useCallback((finalTs: number) => onCommitResize(entry.id, finalTs, 'left'), [entry.id, onCommitResize]);
  const onCommitRight = useCallback((finalDur: number) => onCommitResize(entry.id, finalDur, 'right'), [entry.id, onCommitResize]);

  const pan = useMemo(() => Gesture.Pan()
    .withRef(movePanRef)
    .enabled(isSelected)
    .onStart(() => {
      'worklet';
      moveStartTs.value = localTs.value;
    })
    .onUpdate((g) => {
      'worklet';
      const deltaTs = (g.translationX / pxPerSecSV.value) * 1000;
      localTs.value = Math.max(minTs, Math.min(moveStartTs.value + deltaTs, maxTs - localDur.value));
    })
    .onEnd(() => {
      'worklet';
      runOnJS(onCommitMove)(entry.id, localTs.value);
    }),
  [isSelected, entry.id, minTs, maxTs, localTs, localDur, moveStartTs, pxPerSecSV, onCommitMove]);

  const tap = useMemo(() => Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      if (isSelected) {
        onActionClick(entry.id);
      } else {
        onSelect(entry.id);
      }
    }),
  [isSelected, entry.id, onActionClick, onSelect]);

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View style={[styles.block, animatedStyle, { borderWidth: 1 }]}>
        {scene && (
          <View style={styles.blockPreview}>
            <MiniFormationPreview scene={scene} dancers={dancers} settings={settings} />
          </View>
        )}
        <Text style={[styles.blockText, { color: isSelected ? theme.background : theme.text }]} numberOfLines={1}>{sceneName}</Text>
        <ResizeHandle
          direction="left"
          localTs={localTs} localDur={localDur}
          minTs={minTs} maxTs={maxTs}
          pxPerSecSV={pxPerSecSV}
          onCommit={onCommitLeft}
          isVisible={isSelected}
          movePanRef={movePanRef}
        />
        <ResizeHandle
          direction="right"
          localTs={localTs} localDur={localDur}
          minTs={minTs} maxTs={maxTs}
          pxPerSecSV={pxPerSecSV}
          onCommit={onCommitRight}
          isVisible={isSelected}
          movePanRef={movePanRef}
        />
      </Animated.View>
    </GestureDetector>
  );
});

const DancerNode = React.memo(function DancerNode({ dancer, dancerPos, isSelected, onPress, scale, index, settings, stageWidth, stageHeight, cellSize, mode, onDragEnd, canDragInPlace }: any) {
  const { theme } = useAppContext();
  if (!dancerPos) return null; // [Guard] Prevent crash if pos is missing
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

  const panGesture = useMemo(() => Gesture.Pan()
    .enabled(canDrag)
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
    }),
  // stageWidth/stageHeight/settings change only on stage-settings edits (rare)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [canDrag, stageWidth, stageHeight, scale, settings, dancerPos, dancer.id, onDragEnd]);

  const gesture = useMemo(() => Gesture.Exclusive(
    panGesture,
    Gesture.Tap().runOnJS(true).onEnd(() => {
      if (canDrag) onPress(dancer.id);
    })
  ), [panGesture, canDrag, onPress, dancer.id]);

  const style = useAnimatedStyle(() => ({
    width: cellSize * 2.5,
    height: cellSize * 2.5, // Increased height for better touch target
    justifyContent: 'center', // Center content within the touch target
    transform: [
      { translateX: (pos.value.x * stageWidth) - (cellSize * 1.25) },
      { translateY: (pos.value.y * stageHeight) - (cellSize * 1.25) }, // Adjusted for larger height
      { scale: withSpring(isSelected || isDragging.value ? 1.1 : 1) }
    ],
    opacity: 1,
    zIndex: isSelected || isDragging.value ? 100 : 1
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.dancerNode, style]} pointerEvents="box-none">
        {/* Circle Icon (Centered in the parent which is the snap point) */}
        <View style={[styles.dancerCircle, { backgroundColor: dancer.color, borderColor: isSelected ? theme.text : 'rgba(0,0,0,0.2)', width: cellSize * 0.7, height: cellSize * 0.7, borderRadius: (cellSize * 0.7) / 2, borderWidth: 1.5 }]}>
          <Text style={[styles.dancerInitial, { fontSize: cellSize * 0.3 }]}>{index + 1}</Text>
        </View>
        
        {/* Name Text (Positioned absolutely below the circle so it doesn't push the circle up) */}
        <View style={{ position: 'absolute', top: '50%', marginTop: (cellSize * 0.35) + 4, width: '100%', alignItems: 'center' }}>
          <Text style={[styles.dancerNameText, { color: isSelected ? theme.text : theme.textSecondary, fontSize: (settings.dancerNameSize || 8), marginTop: 0 }]} numberOfLines={1}>
            {dancer.name}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

const SceneCardItem = React.memo(function SceneCardItem({ scene, isActive, dancers, settings, onSelect, onLongPress, theme }: any) {
  return (
    <TouchableOpacity
      onLongPress={() => onLongPress(scene)}
      onPress={() => onSelect(scene.id, isActive)}
      style={[styles.sceneCard, { backgroundColor: theme.card, borderColor: isActive ? theme.primary : theme.border }, isActive && { backgroundColor: theme.primary + '11' }]}
    >
      <MiniFormationPreview scene={scene} dancers={dancers} settings={settings} />
      <View style={[styles.sceneCardLabel, { backgroundColor: theme.border + '11' }]}>
        <Text style={[styles.sceneCardText, { color: isActive ? theme.primary : theme.textSecondary }]}>{scene.name}</Text>
      </View>
    </TouchableOpacity>
  );
});

const GridLayer = React.memo(function GridLayer({ settings }: { settings: FormationSettings }) {
  const { theme } = useAppContext();
  const gridColor = theme.border; 
  const centerColor = theme.primary;
  const wingWidth = settings.sideWingWidth ?? 0;
  const wingPercent = (wingWidth / settings.gridCols) * 100;

  return (
    <View style={styles.gridLayer}>
      {/* Wing Areas (Configurable grid units on each side) */}
      {wingWidth > 0 && (
        <>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${wingPercent}%`, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }} />
          <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${wingPercent}%`, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }} />
        </>
      )}

      {/* Horizontal Grid Lines */}
      {Array.from({ length: settings.gridRows + 1 }).map((_, i) => (
        <View key={`h-${i}`} style={[styles.gridH, { top: `${(i / settings.gridRows) * 100}%`, backgroundColor: gridColor, opacity: 0.4, height: 1 }]} />
      ))}
      {/* Vertical Grid Lines */}
      {Array.from({ length: settings.gridCols + 1 }).map((_, i) => (
        <View key={`v-${i}`} style={[styles.gridV, { left: `${(i / settings.gridCols) * 100}%`, backgroundColor: gridColor, opacity: 0.4, width: 1 }]} />
      ))}
      
      {/* Short Center Crosshair */}
      <View style={{ position: 'absolute', top: '50%', left: '50%', width: 24, height: 2, backgroundColor: centerColor, marginLeft: -12, marginTop: -1, opacity: 0.9, borderRadius: 1 }} />
      <View style={{ position: 'absolute', top: '50%', left: '50%', width: 2, height: 24, backgroundColor: centerColor, marginLeft: -1, marginTop: -12, opacity: 0.9, borderRadius: 1 }} />
    </View>
  );
});

const GUIDE_IMAGES = [
  require('../../../../guideimage/Guide1.png'),
  require('../../../../guideimage/Guide2.png'),
  require('../../../../guideimage/Guide3.png'),
  require('../../../../guideimage/Guide4.png'),
  require('../../../../guideimage/Guide5.png'),
];

interface HistoryState {
  dancers: Dancer[];
  scenes: FormationScene[];
  timeline: TimelineEntry[];
  audioUrl: string;
}

export default function FormationEditorScreen() {
  const { id, formationId } = useGlobalSearchParams<{ id: string, formationId: string }>();
  const { formations, updateFormation, publishFormationAsFeedback, theme, blockUser, reportContent, currentUser, rooms, t } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const formation = formations.find(f => f.id === formationId);
  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);

  // [State: 32b2ca5 기반]
  const [mode, setMode] = useState<'create' | 'place'>('create');
  const [dancers, setDancers] = useState<Dancer[]>(formation?.data?.dancers || []);
  const [scenes, setScenes] = useState<FormationScene[]>(formation?.data?.scenes || []);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(formation?.data?.timeline || []);
  const [audioUrl, setAudioUrl] = useState<string>(formation?.audioUrl || '');
  const [videoUrl, setVideoUrl] = useState<string>(formation?.videoSettings?.videoUrl || '');
  const pipX = useSharedValue(formation?.videoSettings?.pipPosition?.x ?? width - 220);
  const pipY = useSharedValue(formation?.videoSettings?.pipPosition?.y ?? 100);
  const pipScale = useSharedValue(formation?.videoSettings?.pipScale ?? 1);
  // Reanimated: SharedValue.value를 render 중 읽으면 경고 발생.
  // initialX/Y/Scale은 마운트 시 1회만 필요하므로 useState로 캡처.
  const [pipInitial] = useState(() => ({
    x: formation?.videoSettings?.pipPosition?.x ?? width - 220,
    y: formation?.videoSettings?.pipPosition?.y ?? 100,
    scale: formation?.videoSettings?.pipScale ?? 1,
  }));

  const [settings, setSettings] = useState<FormationSettings>(() => {
    const base = formation?.settings || { gridRows: 10, gridCols: 20, stageDirection: 'top', snapToGrid: true, dancerNameSize: 8 };
    return { ...base, sideWingWidth: base.sideWingWidth ?? 2 };
  });
  const [activeSceneId, setActiveSceneId] = useState<string | null>(formation?.data?.scenes?.[0]?.id || null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);
  const [showEntryActionModal, setShowEntryActionModal] = useState(false);
  const [targetEntryId, setTargetEntryId] = useState<string | null>(null);

  const [showTimelineMenu, setShowTimelineMenu] = useState(false);
  const [showDancerSheet, setShowDancerSheet] = useState(false);
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [showMirrorModal, setShowMirrorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFilenameModal, setShowFilenameModal] = useState(false);
  const [showFormationOptions, setShowFormationOptions] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [isChangingSong, setIsChangingSong] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [publishTitle, setPublishTitle] = useState('');
  const [includeChoreography, setIncludeChoreography] = useState(true);
  const [selectedMirrorType, setSelectedMirrorType] = useState<'horizontal' | 'vertical' | 'both'>('horizontal');
  const [sceneModalMode, setSceneModalMode] = useState<'add' | 'rename'>('add');
  const [targetSceneId, setTargetSceneId] = useState<string | null>(null);
  const [inputName, setInputName] = useState('');
  const [guideIndex, setGuideIndex] = useState(0);
  const [touchTimeMs, setTouchTimeMs] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [zoomUI, setZoomUI] = useState(100);
  const [timelineZoomUI, setTimelineZoomUI] = useState(100);

  const [tempRows, setTempRows] = useState('');
  const [tempCols, setTempCols] = useState('');
  const [tempWingWidth, setTempWingWidth] = useState('');

  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [waveformTiles, setWaveformTiles] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const compressionResolverRef = useRef<((uri: string) => void) | null>(null);
  const compressionRejecterRef = useRef<((err: any) => void) | null>(null);
  const lastSeekTimeRef = useRef(0);
  const [syncOffset, setSyncOffset] = useState(formation?.videoSettings?.syncOffset || 0);
  const webViewRef = useRef<WebView>(null);
  const webViewReadyRef = useRef(false);

  // [Horizontal Zoom] 
  const timelineZoom = useSharedValue(1);
  const savedTimelineZoom = useSharedValue(1);
  const pxPerSecSV = useDerivedValue(() => BASE_PX_PER_SEC * timelineZoom.value);

  const timelinePinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      savedTimelineZoom.value = timelineZoom.value;
    })
    .onUpdate((e) => {
      'worklet';
      // 0.5배에서 5배까지 확대 가능
      const newZoom = Math.max(0.5, Math.min(5, savedTimelineZoom.value * e.scale));
      timelineZoom.value = newZoom;
      runOnJS(setTimelineZoomUI)(Math.round(newZoom * 100));
    });

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
  const seekFreezeUntilRef = useRef(0);

  const player = useAudioPlayer(audioUrl, { updateInterval: 100 });
  const playerStatus = useAudioPlayerStatus(player);
  const effectiveDuration = player.duration || 60;

  const seekAll = useCallback((timeSec: number) => {
    const timeMs = timeSec * 1000;
    cancelAnimation(currentTimeMs);
    currentTimeMs.value = timeMs;
    seekFreezeUntilRef.current = Date.now() + 300;
    player.seekTo(timeSec);
  }, [player, currentTimeMs]);

  const activeScene = useMemo(() => scenes.find(s => s.id === activeSceneId), [scenes, activeSceneId]);
  
  // Use useMemo to create stable SharedValues for each dancer
  const dancerPositions = useMemo(() => {
    const map: Record<string, any> = {};
    dancers.forEach(d => {
      const posInScene = activeScene?.positions[d.id] || { x: 0.5, y: 0.5 };
      map[d.id] = makeMutable(posInScene);
    });
    return map;
  }, [dancers]);

  useEffect(() => {
    if (!activeScene) return;
    
    dancers.forEach(d => {
      if (dancerPositions[d.id]) {
        const posInScene = activeScene.positions[d.id] || { x: 0.5, y: 0.5 };
        dancerPositions[d.id].value = posInScene;
      }
    });
  }, [dancers, activeScene, dancerPositions]);

  // 히스토리 관리 (모드별 분리)
  const [createPast, setCreatePast] = useState<HistoryState[]>([]);
  const [createFuture, setCreateFuture] = useState<HistoryState[]>([]);
  const [placePast, setPlacePast] = useState<HistoryState[]>([]);
  const [placeFuture, setPlaceFuture] = useState<HistoryState[]>([]);

  const [nextSceneId, setNextSceneId] = useState<string | null>(null);
  const [activeEntryIdInPlace, setActiveEntryIdInPlace] = useState<string | null>(null);

  const sortedTimeline = useMemo(() => [...timeline].sort((a, b) => a.timestampMillis - b.timestampMillis), [timeline]);
  const [, setChangeCount] = useState(0);

  // Auto-save logic
  const handleAutoSave = useCallback(async () => {
    try {
      const data = { title: formation?.title, audioUrl, settings, data: { dancers, scenes, timeline } };
      const filePath = `${FileSystem.documentDirectory}autosave_${formationId}.json`;
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data), { encoding: 'utf8' });
    } catch (e) {
      console.warn('Auto-save failed:', e);
    }
  }, [formation, audioUrl, settings, dancers, scenes, timeline, formationId]);

  const incrementChange = useCallback(() => {
    setChangeCount(prev => {
      const next = prev + 1;
      if (next >= 10) {
        handleAutoSave();
        return 0;
      }
      return next;
    });
  }, [handleAutoSave]);

  const formationOptions = formation?.userId === currentUser?.id || (currentRoom as any)?.leaderId === currentUser?.id ? [
    { label: t('save'), icon: 'save-outline', onPress: () => handleSave() },
    { label: t('exportShare'), icon: 'share-outline', onPress: () => setShowExportModal(true) }
  ] : [
    { label: t('reportLabel'), icon: 'warning-outline', destructive: true, onPress: () => { if(formation) reportContent(formation.id, 'formation'); } },
    { label: t('blockAuthorLabel'), icon: 'ban-outline', destructive: true, onPress: () => { if(formation) blockUser(formation.userId); } }
  ];

  const compressAudio = async (uri: string): Promise<string> => {
    setIsCompressing(true);
    setCompressionProgress(0);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const compressScript = `
        (async () => {
          try {
            const b64 = "${base64}";
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
            
            // 편집 성능을 극대화하기 위해 64kbps Mono로 압축
            const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 64);
            const mp3Data = [];
            const ch0 = audioBuffer.getChannelData(0);
            
            const sampleBlockSize = 1152;
            for (let i = 0; i < ch0.length; i += sampleBlockSize) {
              const samples = new Int16Array(sampleBlockSize);
              for (let j = 0; j < sampleBlockSize; j++) {
                if (i + j < ch0.length) {
                  samples[j] = Math.max(-1, Math.min(1, ch0[i + j])) * 32767;
                }
              }
              const mp3buf = mp3encoder.encodeBuffer(samples);
              if (mp3buf.length > 0) mp3Data.push(mp3buf);
              
              if (i % (sampleBlockSize * 150) === 0) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'COMPRESSION_PROGRESS', 
                  progress: i / ch0.length 
                }));
              }
            }
            const mp3buf = mp3encoder.flush();
            if (mp3buf.length > 0) mp3Data.push(mp3buf);
            
            const blob = new Blob(mp3Data, { type: 'audio/mp3' });
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'COMPRESSION_COMPLETE', data: reader.result }));
            };
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: e.message }));
          }
        })();
      `;

      const compressedDataUrl: string = await new Promise((resolve, reject) => {
        compressionResolverRef.current = resolve;
        compressionRejecterRef.current = reject;
        const inject = () => {
          if (webViewReadyRef.current && webViewRef.current) {
            webViewRef.current.injectJavaScript(compressScript);
          } else {
            setTimeout(inject, 500);
          }
        };
        inject();
      });

      const base64Data = compressedDataUrl.split(',')[1];
      const fileName = `compressed_${Date.now()}.mp3`;
      const destUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(destUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
      return destUri;
    } catch (e) {
      setIsCompressing(false);
      throw e;
    }
  };

  const analyzeAudio = async (uri: string) => {
    if (!uri) return;
    setIsAnalyzing(true);
    try {
      let localUri = uri;
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        const urlHash = uri.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0).toString(36);
        const cacheUri = `${FileSystem.cacheDirectory}audio_${urlHash}.tmp`;
        const fileInfo = await FileSystem.getInfoAsync(cacheUri);
        if (!fileInfo.exists) {
          const { uri: downloaded } = await FileSystem.downloadAsync(uri, cacheUri);
          localUri = downloaded;
        } else {
          localUri = cacheUri;
        }
      } else if (uri.startsWith('/')) {
        localUri = `file://${uri}`;
      }

      const fInfo = await FileSystem.getInfoAsync(localUri, { size: true } as any) as any;
      // 분석 전 파일이 너무 크면 스킵하여 메모리 보호
      if (fInfo.exists && fInfo.size && fInfo.size > 20 * 1024 * 1024) {
        setIsAnalyzing(false);
        setWaveformPeaks([]);
        return;
      }

      let base64 = "";
      try {
        base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      } catch (readErr) {
        setIsAnalyzing(false);
        setWaveformPeaks([]);
        return;
      }

      const analysisScript = `
        (async () => {
          try {
            const b64 = "${base64}";
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioCtx.decodeAudioData(bytes.buffer, (audioBuffer) => {
              const ch0 = audioBuffer.getChannelData(0);
              const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0;
              const samplesPerSec = 20; // 2배 더 정밀하게 데이터 추출
              const totalSamples = Math.floor(audioBuffer.duration * samplesPerSec);
              const blockSize = Math.floor(ch0.length / totalSamples);
              const peaks = [];
              for (let i = 0; i < totalSamples; i++) {
                const start = blockSize * i;
                let peakVal = 0;
                for (let j = 0; j < blockSize; j++) {
                  const mono = Math.max(Math.abs(ch0[start + j] || 0), Math.abs(ch1[start + j] || 0));
                  if (mono > peakVal) peakVal = mono;
                }
                peaks.push(peakVal);
              }
              const maxPeak = Math.max(...peaks) || 1;
              const normalized = peaks.map(p => p / maxPeak);

              // [Pro Tiling Optimization] 30초 단위로 캔버스를 쪼개서 고해상도 이미지 생성
              try {
                const tiles = [];
                const segmentDuration = 30; // 30초 단위
                const samplesPerSegment = samplesPerSec * segmentDuration; // 20 * 30 = 600개
                const numSegments = Math.ceil(audioBuffer.duration / segmentDuration);
                
                // 테마 색상 파싱
                const themeColor = "${theme.text}";
                let r=255, g=255, b=255;
                const hex = themeColor.replace('#', '');
                if (hex.length === 3) { r = parseInt(hex[0]+hex[0],16); g = parseInt(hex[1]+hex[1],16); b = parseInt(hex[2]+hex[2],16); }
                else { r = parseInt(hex.slice(0,2),16); g = parseInt(hex.slice(2,4),16); b = parseInt(hex.slice(4,6),16); }

                for (let s = 0; s < numSegments; s++) {
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  
                  const startIdx = s * samplesPerSegment;
                  const endIdx = Math.min(startIdx + samplesPerSegment, normalized.length);
                  const segmentPeaks = normalized.slice(startIdx, endIdx);
                  
                  const targetWidth = segmentPeaks.length * (60 / samplesPerSec); // 3px slot
                  const targetHeight = 120;
                  
                  // 타일 방식은 캔버스가 작으므로 2배 해상도 적용해도 매우 안전함
                  const dpr = 2.0; 
                  canvas.width = targetWidth * dpr;
                  canvas.height = targetHeight * dpr;
                  ctx.scale(dpr, dpr);
                  
                  const barWidth = 1.2;
                  const slotWidth = 3; 
                  
                  segmentPeaks.forEach((p, i) => {
                    const h = Math.max(2, p * 48);
                    const opacity = p > 0.3 ? 0.4 : 0.18;
                    const x = i * slotWidth + (slotWidth - barWidth) / 2;
                    const y = (targetHeight - h) / 2;
                    
                    ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + opacity + ")";
                    if (ctx.roundRect) {
                      ctx.beginPath();
                      ctx.roundRect(x, y, barWidth, h, 0.6);
                      ctx.fill();
                    } else {
                      ctx.fillRect(x, y, barWidth, h);
                    }
                  });
                  tiles.push(canvas.toDataURL('image/png'));
                }

                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'ANALYSIS_COMPLETE', 
                  data: normalized,
                  tiles: tiles
                }));
              } catch (err) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ANALYSIS_COMPLETE', data: normalized, tiles: [] }));
              }
            }, (err) => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: 'Decode failed' }));
            });
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: e.message }));
          }
        })();
      `;

      const inject = () => {
        if (webViewReadyRef.current && webViewRef.current) {
          webViewRef.current.injectJavaScript(analysisScript);
        } else {
          setTimeout(inject, 300);
        }
      };
      inject();
    } catch (e) {
      setIsAnalyzing(false);
      setWaveformPeaks([]);
    }
  };

  useEffect(() => {
    const urlToAnalyze = audioUrl;
    if (urlToAnalyze) {
      analyzeAudio(urlToAnalyze);
    }
  }, [audioUrl]);

  const onWebViewMessage = (e: any) => {
    try {
      const event = JSON.parse(e.nativeEvent.data);
      if (event.type === 'ANALYSIS_COMPLETE') {
        setWaveformPeaks(event.data);
        if (event.tiles) setWaveformTiles(event.tiles);
        setIsAnalyzing(false);
      } else if (event.type === 'COMPRESSION_COMPLETE') {
        if (compressionResolverRef.current) {
          compressionResolverRef.current(event.data);
          compressionResolverRef.current = null;
        }
        setIsCompressing(false);
      } else if (event.type === 'COMPRESSION_PROGRESS') {
        setCompressionProgress(event.progress);
      } else if (event.type === 'ERROR') {
        console.warn('WebView Error:', event.message);
        if (isCompressing && compressionRejecterRef.current) {
          compressionRejecterRef.current(new Error(event.message));
          compressionRejecterRef.current = null;
        }
        setIsAnalyzing(false);
        setIsCompressing(false);
      }
    } catch (err) {
      setIsAnalyzing(false);
      setIsCompressing(false);
    }
  };

  useAnimatedReaction(
    () => {
      // Use pre-sorted array — avoid sort on every animation frame
      const next = sortedTimeline.find(e => e.timestampMillis > currentTimeMs.value);
      let currentEntryId = null;
      for (let e of sortedTimeline) {
        if (currentTimeMs.value >= e.timestampMillis && currentTimeMs.value < e.timestampMillis + e.durationMillis) {
          currentEntryId = e.id;
          break;
        }
      }
      return { nextId: next?.sceneId || null, currentEntryId };
    },
    (data) => {
      if (data.nextId !== nextSceneId) runOnJS(setNextSceneId)(data.nextId);
      if (data.currentEntryId !== activeEntryIdInPlace) runOnJS(setActiveEntryIdInPlace)(data.currentEntryId);
    },
    [sortedTimeline]
  );

  const activeSceneIdToEdit = useMemo(() => {
    if (mode === 'create') return activeSceneId;
    if (mode === 'place') {
      // selectedEntryId (user explicitly selected block) takes priority over playhead position
      const editEntryId = selectedEntryId || activeEntryIdInPlace;
      if (editEntryId) return timeline.find(e => e.id === editEntryId)?.sceneId || null;
    }
    return null;
  }, [mode, activeSceneId, activeEntryIdInPlace, selectedEntryId, timeline]);

  const pushHistory = useCallback(() => {
    incrementChange();
    const current: HistoryState = { dancers: JSON.parse(JSON.stringify(dancers)), scenes: JSON.parse(JSON.stringify(scenes)), timeline: JSON.parse(JSON.stringify(timeline)), audioUrl };
    if (mode === 'create') { setCreatePast(prev => [...prev, current].slice(-30)); setCreateFuture([]); }
    else { setPlacePast(prev => [...prev, current].slice(-30)); setPlaceFuture([]); }
  }, [dancers, scenes, timeline, mode, audioUrl, incrementChange]);

  // Refs let onDragEnd stay stable across renders so DancerNodes never re-render due to callback churn
  const activeSceneIdToEditRef = useRef<string | null>(null);
  const pushHistoryRef = useRef(pushHistory);
  useEffect(() => { activeSceneIdToEditRef.current = activeSceneIdToEdit; }, [activeSceneIdToEdit]);
  useEffect(() => { pushHistoryRef.current = pushHistory; }, [pushHistory]);

  const onDragEnd = useCallback((dancerId: string, pos: Position) => {
    const targetId = activeSceneIdToEditRef.current;
    if (!targetId) return;
    setScenes(prev => prev.map(s => s.id === targetId ? {
      ...s,
      positions: { ...s.positions, [dancerId]: pos }
    } : s));
    pushHistoryRef.current();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undo = () => {
    if (mode === 'create') {
      if (createPast.length === 0) return;
      const previous = createPast[createPast.length - 1];
      const current: HistoryState = { dancers, scenes, timeline, audioUrl };
      setCreateFuture(prev => [current, ...prev]); setCreatePast(prev => prev.slice(0, -1));
      setDancers(previous.dancers); setScenes(previous.scenes); setTimeline(previous.timeline); setAudioUrl(previous.audioUrl);
      const active = previous.scenes.find(s => s.id === activeSceneId);
      if (active) Object.keys(active.positions).forEach(dId => { if (dancerPositions[dId]) dancerPositions[dId].value = active.positions[dId]; });
    } else {
      if (placePast.length === 0) return;
      const previous = placePast[placePast.length - 1];
      const current: HistoryState = { dancers, scenes, timeline, audioUrl };
      setPlaceFuture(prev => [current, ...prev]); setPlacePast(prev => prev.slice(0, -1));
      setDancers(previous.dancers); setScenes(previous.scenes); setTimeline(previous.timeline); setAudioUrl(previous.audioUrl);
    }
  };

  const redo = () => {
    if (mode === 'create') {
      if (createFuture.length === 0) return;
      const next = createFuture[0];
      const current: HistoryState = { dancers, scenes, timeline, audioUrl };
      setCreatePast(prev => [...prev, current]); setCreateFuture(prev => prev.slice(1));
      setDancers(next.dancers); setScenes(next.scenes); setTimeline(next.timeline); setAudioUrl(next.audioUrl);
      const active = next.scenes.find(s => s.id === activeSceneId);
      if (active) Object.keys(active.positions).forEach(dId => { if (dancerPositions[dId]) dancerPositions[dId].value = (next as any).positions[dId]; });
    } else {
      if (placeFuture.length === 0) return;
      const next = placeFuture[0];
      const current: HistoryState = { dancers, scenes, timeline, audioUrl };
      setPlacePast(prev => [...prev, current]); setPlaceFuture(prev => prev.slice(1));
      setDancers(next.dancers); setScenes(next.scenes); setTimeline(next.timeline); setAudioUrl(next.audioUrl);
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

  // playbackStatusUpdate 이벤트(100ms)로 playing/currentTime을 캐시하고
  // rAF(60fps)에서 보간해 currentTimeMs를 매끄럽게 업데이트
  useEffect(() => {
    let raf: number;
    let isActive = true;
    let cachedPlaying = false;
    let cachedCurrentTime = 0;
    let lastStatusTs = 0;
    let statusEventCount = 0;
    let lastDiagSecAudio = -1;

    const statusSub = player.addListener('playbackStatusUpdate', (status: any) => {
      cachedPlaying = status.playing;
      cachedCurrentTime = status.currentTime;
      lastStatusTs = Date.now();
      statusEventCount++;
      // 첫 이벤트 및 재생 상태 전환 시 로그
      if (statusEventCount === 1) {
        console.log('[Formation-Audio] First playbackStatusUpdate:', JSON.stringify(status));
      }
    });

    const tick = () => {
      if (!isActive) return;
      isPlayerPlayingSV.value = cachedPlaying;
      if (!isUserScrollingSV.value && Date.now() > seekFreezeUntilRef.current) {
        const elapsed = cachedPlaying ? (Date.now() - lastStatusTs) / 1000 : 0;
        currentTimeMs.value = (cachedCurrentTime + elapsed) * 1000;
      }

      // 1초마다 오디오-SharedValue 동기 진단 로그
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec !== lastDiagSecAudio) {
        lastDiagSecAudio = nowSec;
        console.log(
          `[Formation-Audio] cachedPlaying=${cachedPlaying}  cachedCurrentTime=${cachedCurrentTime.toFixed(2)}s` +
          `  currentTimeMs.value=${currentTimeMs.value.toFixed(0)}  statusEvents=${statusEventCount}` +
          `  isUserScrolling=${isUserScrollingSV.value}  freezeUntil=${seekFreezeUntilRef.current > Date.now() ? 'YES' : 'no'}`
        );
        statusEventCount = 0; // 초당 이벤트 수 카운트 리셋
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      isActive = false;
      cancelAnimationFrame(raf);
      statusSub.remove();
    };
  }, [player]);

  useAnimatedReaction(() => ({ time: currentTimeMs.value, isPlaying: isPlayerPlayingSV.value, isScrolling: isUserScrollingSV.value, pps: pxPerSecSV.value }), (data) => {
    if (data.isPlaying && !data.isScrolling) { scrollTo(timelineScrollViewRef, (data.time / 1000) * data.pps, 0, false); }
  });

  const handleTimelineScroll = useCallback((e: any) => {
    if (isUserScrollingSV.value) {
      const offset = e.nativeEvent.contentOffset.x;
      const newTimeMs = (offset / pxPerSecSV.value) * 1000;
      cancelAnimation(currentTimeMs);
      currentTimeMs.value = newTimeMs;
      const timeSec = newTimeMs / 1000;

      const now = Date.now();
      if (now - lastSeekTimeRef.current > 100) {
        lastSeekTimeRef.current = now;
        seekFreezeUntilRef.current = now + 300;
        try { player.seekTo(timeSec); } catch (_) {}
      }
    }
  }, [player, currentTimeMs, pxPerSecSV]);

  const onScrollEnd = (e: any) => {
    const finalTimeMs = (e.nativeEvent.contentOffset.x / pxPerSecSV.value) * 1000;
    seekFreezeUntilRef.current = Date.now() + 300;
    currentTimeMs.value = finalTimeMs;
    isUserScrollingSV.value = false;
  };

  useAnimatedReaction(() => ({ scenes, mode, activeId: activeSceneId }), (data) => {
    if (data.mode === 'create') {
      const targetScene = data.scenes.find(s => s.id === data.activeId);
      if (targetScene) { dancers.forEach(d => { if (dancerPositions[d.id]) { cancelAnimation(dancerPositions[d.id]); dancerPositions[d.id].value = withTiming(targetScene.positions[d.id] || { x: 0.5, y: 0.5 }, { duration: 200, easing: Easing.out(Easing.quad) }); } }); }
    }
  }, [activeSceneId, mode, dancers, scenes]);

  useAnimatedReaction(() => ({ time: currentTimeMs.value, sortedTimeline, mode, scenes }), (data) => {
    if (data.mode === 'place') {
      let prevE = null, nextE = null;
      for (let e of data.sortedTimeline) { if (e.timestampMillis <= data.time) prevE = e; else { nextE = e; break; } }
      dancers.forEach(d => {
        let p = { x: 0.5, y: 0.5 };
        const getScenePos = (sId: string) => data.scenes.find(s => s.id === sId)?.positions[d.id] || { x: 0.5, y: 0.5 };
        if (!prevE) p = data.sortedTimeline.length > 0 ? getScenePos(data.sortedTimeline[0]?.sceneId) : { x: 0.5, y: 0.5 };
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
  }, [mode, sortedTimeline, scenes, dancers]);

  const openTimelineMenuAt = (x: number) => { 
    const ts = (x / pxPerSecSV.value) * 1000;
    setTouchTimeMs(ts); 
    setShowTimelineMenu(true); 
  };
  
  const handleAddTimelineEntry = (sceneId: string) => { 
    pushHistory(); 
    const newEntry: TimelineEntry = { id: Math.random().toString(36).substr(2, 9), sceneId, timestampMillis: touchTimeMs, durationMillis: 3000 }; 
    setTimeline([...timeline, newEntry]); 
    setShowTimelineMenu(false); 
  };

  const handleAddNewSceneToTimeline = () => {
    pushHistory();
    const newSceneId = Math.random().toString(36).substr(2, 9);
    const newScene: FormationScene = {
      id: newSceneId,
      name: t('sceneDefaultName').replace('{n}', String(scenes.length + 1)),
      positions: {}
    };
    const newEntry: TimelineEntry = { 
      id: Math.random().toString(36).substr(2, 9), 
      sceneId: newSceneId, 
      timestampMillis: touchTimeMs, 
      durationMillis: 3000 
    };
    setScenes([...scenes, newScene]);
    setTimeline([...timeline, newEntry]);
    setShowTimelineMenu(false);
  };

  const handleEntryActionClick = useCallback((entryId: string) => {
    setTargetEntryId(entryId);
    setShowEntryActionModal(true);
  }, []);

  const handleDuplicateTimelineEntry = () => {
    if (!targetEntryId) return;
    pushHistory();
    const targetEntry = timeline.find(e => e.id === targetEntryId);
    if (!targetEntry) return;

    const originalScene = scenes.find(s => s.id === targetEntry.sceneId);
    
    // Create new scene copy
    const newSceneId = Math.random().toString(36).substr(2, 9);
    const newScene: FormationScene = {
      id: newSceneId,
      name: (originalScene ? originalScene.name : t('formationNamePlaceholder')) + ' ' + t('copySuffix'),
      positions: originalScene ? JSON.parse(JSON.stringify(originalScene.positions)) : {}
    };

    const insertTime = targetEntry.timestampMillis + targetEntry.durationMillis;
    const duration = targetEntry.durationMillis;

    // Shift subsequent entries
    const newTimeline = timeline.map(e => {
      if (e.timestampMillis >= insertTime) {
        return { ...e, timestampMillis: e.timestampMillis + duration };
      }
      return e;
    });

    const newEntry: TimelineEntry = {
      id: Math.random().toString(36).substr(2, 9),
      sceneId: newSceneId,
      timestampMillis: insertTime,
      durationMillis: duration
    };

    setScenes([...scenes, newScene]);
    setTimeline([...newTimeline, newEntry]);
    setShowEntryActionModal(false);
    setTargetEntryId(null);
  };

  const handleDeleteTimelineEntryAction = () => {
    if (!targetEntryId) return;
    handleDeleteEntry(targetEntryId);
    setShowEntryActionModal(false);
    setTargetEntryId(null);
  };
  // Stable callbacks: use pushHistoryRef so these never change reference,
  // preventing TimelineBlock re-renders and gesture recreation after each commit.
  const handleCommitMove = useCallback((entryId: string, finalTs: number) => {
    pushHistoryRef.current();
    setTimeline(prev => {
      const sorted = [...prev].sort((a, b) => a.timestampMillis - b.timestampMillis);
      const sIdx = sorted.findIndex(x => x.id === entryId);
      if (sIdx === -1) return prev;
      const target = sorted[sIdx];
      const prevBlock = sorted[sIdx - 1], nextBlock = sorted[sIdx + 1];
      const minTs = prevBlock ? prevBlock.timestampMillis + prevBlock.durationMillis : 0;
      const maxTs = nextBlock ? nextBlock.timestampMillis - target.durationMillis : Infinity;
      const clampedTs = Math.max(0, Math.max(minTs, Math.min(finalTs, maxTs)));
      return prev.map(e => e.id === entryId ? { ...e, timestampMillis: clampedTs } : e);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCommitResize = useCallback((entryId: string, finalValue: number, dir: 'left' | 'right') => {
    pushHistoryRef.current();
    setTimeline(prev => {
      const sorted = [...prev].sort((a, b) => a.timestampMillis - b.timestampMillis);
      const sIdx = sorted.findIndex(x => x.id === entryId);
      if (sIdx === -1) return prev;
      const target = sorted[sIdx];
      const prevBlock = sorted[sIdx - 1], nextBlock = sorted[sIdx + 1];
      if (dir === 'left') {
        const rightEdgeTs = target.timestampMillis + target.durationMillis;
        const minTs = prevBlock ? prevBlock.timestampMillis + prevBlock.durationMillis : 0;
        const clampedStart = Math.max(minTs, Math.min(finalValue, rightEdgeTs - 200));
        return prev.map(e => e.id === entryId ? { ...e, timestampMillis: clampedStart, durationMillis: rightEdgeTs - clampedStart } : e);
      } else {
        const maxTs = nextBlock ? nextBlock.timestampMillis : Infinity;
        const clampedDur = Math.max(200, Math.min(finalValue, maxTs - target.timestampMillis));
        return prev.map(e => e.id === entryId ? { ...e, durationMillis: clampedDur } : e);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleDeleteEntry = useCallback((entryId: string) => {
    pushHistoryRef.current();
    setTimeline(prev => prev.filter(x => x.id !== entryId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleSceneAction = () => { pushHistory(); if (sceneModalMode === 'add') { const nid = Math.random().toString(36).substr(2,9), last = scenes[scenes.length-1], nScenes = [...scenes, { id: nid, name: inputName.trim() || t('sceneDefaultName').replace('{n}', String(scenes.length + 1)), positions: last ? JSON.parse(JSON.stringify(last.positions)) : {} }]; setScenes(nScenes); setActiveSceneId(nid); } else if (sceneModalMode === 'rename' && targetSceneId) setScenes(prev => prev.map(s => s.id === targetSceneId ? {...s, name: inputName.trim() || s.name} : s)); setShowSceneModal(false); setInputName(''); };
  
  const handleChangeSong = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      
      setIsChangingSong(true);
      const asset = res.assets[0];
      const sourceUri = asset.uri;
      
      // [Compression] 2.5MB 이상인 경우 성능을 위해 Mono 64kbps로 압축
      let finalUri = sourceUri;
      const fInfo = await FileSystem.getInfoAsync(sourceUri, { size: true } as any) as any;
      if (fInfo.exists && fInfo.size && fInfo.size > 2.5 * 1024 * 1024) {
        try {
          finalUri = await compressAudio(sourceUri);
        } catch (compErr) {
          console.warn('Compression failed, using original:', compErr);
        }
      }

      const fileName = `audio_${Date.now()}_${asset.name.replace(/\s+/g, '_')}`;
      const destUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.copyAsync({ from: finalUri, to: destUri });

      pushHistory();
      setAudioUrl(destUri);
      setWaveformPeaks([]); 
    } catch (e: any) {
      Alert.alert(t('failure'), e.message);
    } finally {
      setIsChangingSong(false);
      setIsCompressing(false);
    }
  };

  // [Performance] 앱 로드 시 현재 오디오가 너무 크면 자동으로 압축 진행 (이미 로컬 파일인 경우)
  useEffect(() => {
    const checkAndCompress = async () => {
      if (!audioUrl || audioUrl.startsWith('http') || isCompressing) return;
      try {
        const fInfo = await FileSystem.getInfoAsync(audioUrl, { size: true } as any) as any;
        if (fInfo.exists && fInfo.size && fInfo.size > 2.5 * 1024 * 1024) {
          const compressedUri = await compressAudio(audioUrl);
          setAudioUrl(compressedUri);
        }
      } catch (e) {}
    };
    checkAndCompress();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSyncAdjust = useCallback((delta: number) => {
    setSyncOffset(prev => parseFloat((prev + delta).toFixed(1)));
  }, []);

  const handleAddVideo = async () => {
    if (videoUrl) {
      Alert.alert(t('addVideo'), t('videoReplaceOrRemove'), [
        { text: t('removeVideo'), style: 'destructive', onPress: () => setVideoUrl('') },
        { text: t('replaceVideo'), onPress: pickVideo },
        { text: t('cancel'), style: 'cancel' },
      ]);
      return;
    }
    pickVideo();
  };

  const [isConvertingVideo, setIsConvertingVideo] = useState(false);
  const [videoConversionProgress, setVideoConversionProgress] = useState(0);

  const pickVideo = async () => {
    try {
      // 1. pip 영상 선택 및 2. 축소 진행 (720p 제한)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 1,
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const fileUri = asset.uri;

      // 3. 용량이 너무 큰가 체크 (변환 시 메모리 부족 방지)
      if (asset.fileSize && asset.fileSize > 200 * 1024 * 1024) {
        Alert.alert(t('error'), '파일 용량이 너무 큽니다 (200MB 제한).');
        return;
      }

      // 4. 변환이 필요한가? & 5. 변환 진행
      setIsConvertingVideo(true);
      setVideoConversionProgress(0);
      
      // UI 렌더링을 위해 약간의 지연 후 변환 시작
      setTimeout(async () => {
        try {
          const finalUri = await ensureStandardMP4(fileUri, (ratio) => {
            setVideoConversionProgress(Math.floor(ratio * 100));
          });
          setVideoUrl(finalUri);
          pipX.value = width - 220;
          pipY.value = 100;
          pipScale.value = 1;
        } catch (e: any) {
          Alert.alert(t('error'), e.message);
        } finally {
          setIsConvertingVideo(false);
        }
      }, 100);
    } catch (e: any) {
      setIsConvertingVideo(false);
      Alert.alert(t('error'), e.message);
    }
  };

  const handleSave = async () => { 
    try { 
      await updateFormation(formationId!, { 
        audioUrl, 
        videoSettings: videoUrl ? { videoUrl, pipPosition: { x: pipX.value, y: pipY.value }, pipScale: pipScale.value, syncOffset } : undefined,
        settings, 
        data: { dancers, scenes, timeline } 
      }); 
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2000);
    } catch (e: any) { 
      Alert.alert(t('error'), e.message); 
    } 
  };

  const handleExportJSON = async () => {
    try {
      const finalName = (exportFileName || t('formationTitle')).replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ._-]/gi, '_');
      const data = {
        title: formation?.title,
        audioUrl,
        videoSettings: videoUrl ? { videoUrl, pipPosition: { x: pipX.value, y: pipY.value }, pipScale: pipScale.value, syncOffset } : undefined,
        settings,
        data: { dancers, scenes, timeline }
      };
      const filePath = `${FileSystem.documentDirectory}${finalName}.json`;
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data), { encoding: 'utf8' });
      setShowFilenameModal(false);
      setShowExportModal(false);
      Alert.alert(t('success'), `${finalName}.json ${t('fileSaveSuccess')}`);
    } catch (e: any) {
      Alert.alert(t('error'), `${t('fileSaveFailed')}: ${e.message}`);
    }
  };

  const startExportJSON = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
    const defaultName = `${formation?.title || t('formationTitle')}_${dateStr}_${timeStr}`;
    setExportFileName(defaultName);
    setShowFilenameModal(true);
  };

  const handlePublish = async () => {
    if (!publishTitle.trim()) { Alert.alert(t('notification'), t('enterPublishTitle')); return; }

    const choreographyUrl = includeChoreography ? videoUrl : undefined;

    try {
      setIsExporting(true);
      await publishFormationAsFeedback(id!, formationId!, publishTitle, {
        audioUrl,
        videoSettings: videoUrl ? { videoUrl, pipPosition: { x: pipX.value, y: pipY.value }, pipScale: pipScale.value, syncOffset } : undefined,
        settings,
        data: { dancers, scenes, timeline }
      }, choreographyUrl);
      setShowPublishModal(false); setShowExportModal(false);
      Alert.alert(t('success'), t('formationPublished'));
    } catch (e: any) {
      Alert.alert(t('error'), e.message);
    } finally {
      setIsExporting(false);
    }
  };
  const copyActiveScene = () => {
    if (!activeSceneId) return;
    pushHistory();
    const activeIdx = scenes.findIndex(s => s.id === activeSceneId);
    if (activeIdx === -1) return;
    const activeScene = scenes[activeIdx];
    const newId = Math.random().toString(36).substr(2, 9);
    const newScene: FormationScene = { id: newId, name: `${activeScene.name} ${t('copySuffix')}`, positions: JSON.parse(JSON.stringify(activeScene.positions)) };
    const newScenes = [...scenes]; newScenes.splice(activeIdx + 1, 0, newScene);
    setScenes(newScenes); setActiveSceneId(newId);
  };

  const deleteActiveScene = () => { if (!activeSceneId || scenes.length <= 1) { Alert.alert(t('notification'), t('minOneFormation')); return; } pushHistory(); const newScenes = scenes.filter(s => s.id !== activeSceneId), newTimeline = timeline.filter(e => e.sceneId !== activeSceneId); setScenes(newScenes); setTimeline(newTimeline); setActiveSceneId(newScenes[0].id); setShowDeleteModal(false); };
  const addDancer = () => { pushHistory(); const newDancer: Dancer = { id: Math.random().toString(36).substr(2, 9), name: `${t('dancer')} ${dancers.length + 1}`, color: COLORS[dancers.length % COLORS.length] }; setDancers([...dancers, newDancer]); };
  const handleApplySettings = () => { 
    const r = parseInt(tempRows), c = parseInt(tempCols), w = parseInt(tempWingWidth); 
    if (isNaN(r) || isNaN(c) || isNaN(w) || r <= 0 || c <= 0 || w < 0) { 
      Alert.alert(t('error'), t('gridInputError')); 
      return; 
    } 
    setSettings({ ...settings, gridRows: r, gridCols: c, sideWingWidth: w }); 
    setShowStageSettings(false); 
  };
  const applyMirror = (allScenes: boolean) => { pushHistory(); const flipPos = (pos: Position) => ({ x: (selectedMirrorType === 'horizontal' || selectedMirrorType === 'both') ? Math.max(0.01, Math.min(0.99, 1 - pos.x)) : pos.x, y: (selectedMirrorType === 'vertical' || selectedMirrorType === 'both') ? Math.max(0.01, Math.min(0.99, 1 - pos.y)) : pos.y }); if (allScenes) { setScenes(prev => { const next = prev.map(s => { const nPos = { ...s.positions }; Object.keys(nPos).forEach(dId => { nPos[dId] = flipPos(nPos[dId]); }); return { ...s, positions: nPos }; }); const current = next.find(s => s.id === activeSceneId); if (current) Object.keys(current.positions).forEach(dId => { if (dancerPositions[dId]) dancerPositions[dId].value = current.positions[dId]; }); return next; }); } else if (activeSceneId) { setScenes(prev => prev.map(s => { if (s.id !== activeSceneId) return s; const nPos = { ...s.positions }; Object.keys(nPos).forEach(dId => { nPos[dId] = flipPos(nPos[dId]); }); Object.keys(nPos).forEach(dId => { if (dancerPositions[dId]) dancerPositions[dId].value = nPos[dId]; }); return { ...s, positions: nPos }; })); } setShowMirrorModal(false); };

  const resetStage = () => { scale.value = withSpring(1); translateX.value = withSpring(0); translateY.value = withSpring(0); savedScale.value = 1; savedTranslateX.value = 0; savedTranslateY.value = 0; setZoomUI(100); };

  const sceneNamesMap = useMemo(() => { const map: any = {}; scenes.forEach(s => { map[s.id] = s.name; }); return map; }, [scenes]);

  const handleSceneCardSelect = useCallback((sceneId: string, isActive: boolean) => {
    if (isActive) {
      const scene = scenes.find(s => s.id === sceneId);
      if (scene) { setSceneModalMode('rename'); setTargetSceneId(sceneId); setInputName(scene.name); setShowSceneModal(true); }
    } else {
      setActiveSceneId(sceneId);
    }
  }, [scenes]);

  const handleSceneCardLongPress = useCallback((scene: any) => {
    Alert.alert(scene.name, t('confirm'), [
      { text: t('renameFormation'), onPress: () => { setSceneModalMode('rename'); setTargetSceneId(scene.id); setInputName(scene.name); setShowSceneModal(true); } },
      { text: t('delete'), style: 'destructive', onPress: () => { pushHistory(); setScenes((prev: any[]) => prev.filter((x: any) => x.id !== scene.id)); } },
      { text: t('cancel') }
    ]);
  }, [pushHistory, t]);

  const handleDancerPress = useCallback((dancerId: string) => {
    setSelectedDancerId(dancerId);
    setShowDancerSheet(true);
  }, []);

  useEffect(() => {
    if (showExportModal || showPublishModal) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
      setPublishTitle(`${formation?.title || t('formationFilter')}_${dateStr}.${timeStr}`);
    }
  }, [showExportModal, showPublishModal, formation?.title]);

  if (!formation) return null;
  const STAGE_CELL_SIZE = (width - 40) / settings.gridCols;
  const STAGE_WIDTH = settings.gridCols * STAGE_CELL_SIZE;
  const STAGE_HEIGHT = settings.gridRows * STAGE_CELL_SIZE;

  const hasPast = mode === 'create' ? createPast.length > 0 : placePast.length > 0;
  const hasFuture = mode === 'create' ? createFuture.length > 0 : placeFuture.length > 0;

  const controlTop = insets.top + 100;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: theme.background }]}>
      {videoUrl ? (
        <FormationPiPPlayer
          videoUrl={videoUrl}
          currentTimeMs={currentTimeMs}
          isPlaying={playerStatus.playing}
          syncOffset={syncOffset}
          onClose={() => setVideoUrl('')}
          initialX={pipInitial.x}
          initialY={pipInitial.y}
          initialScale={pipInitial.scale}
          onPositionChange={(x, y, s) => {
            pipX.value = x;
            pipY.value = y;
            pipScale.value = s;
          }}
        />
      ) : null}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={theme.text} /></TouchableOpacity>
        <View style={[styles.modeToggle, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={() => setMode('create')} style={[styles.modeTab, mode === 'create' && { backgroundColor: theme.primary }]}><Text style={[styles.tabText, { color: mode === 'create' ? theme.background : theme.textSecondary }]}>{t('createFormation')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('place')} style={[styles.modeTab, mode === 'place' && { backgroundColor: theme.primary }]}><Text style={[styles.tabText, { color: mode === 'place' ? theme.background : theme.textSecondary }]}>{t('placeFormation')}</Text></TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
          {(formation?.userId === currentUser?.id || (currentRoom as any)?.leaderId === currentUser?.id) ? (
            <TouchableOpacity onPress={handleSave}><Ionicons name="save-outline" size={24} color={theme.primary} /></TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => setShowFormationOptions(true)}><Ionicons name="ellipsis-vertical" size={24} color={theme.text} /></TouchableOpacity>
        </View>
      </View>

      <OptionModal
        visible={showFormationOptions}
        onClose={() => setShowFormationOptions(false)}
        options={formationOptions}
        title={t('formationSettings')}
        theme={theme}
        cancelLabel={t('cancel')}
      />

      {/* Hidden WebView for Audio Analysis & Compression */}
      <View style={{ height: 0, width: 0, opacity: 0, position: 'absolute' }}>
        <WebView 
          ref={webViewRef} 
          onMessage={onWebViewMessage} 
          source={{ html: '<html><head><script src="https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js"></script></head><body></body></html>' }} 
          originWhitelist={['*']}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          onLoad={() => { webViewReadyRef.current = true; }}
        />
      </View>

      {/* Save Success Toast */}
      {showSaveToast && (
        <View style={[styles.toast, { backgroundColor: theme.primary }]}>
          <Ionicons name="checkmark-circle" size={20} color={theme.background} />
          <Text style={[styles.toastText, { color: theme.background }]}>{t('saveSuccessToast')}</Text>
        </View>
      )}

      {/* Analysis Loader UI */}
      {isAnalyzing && (
        <View style={[styles.analysisLoader, { backgroundColor: theme.card + 'CC' }]}>
          <ActivityIndicator color={theme.primary} />
          <Text style={{ color: theme.text, marginTop: 10, fontSize: 12, fontWeight: 'bold' }}>{t('analyzingAudio')}</Text>
        </View>
      )}

      {/* Compression Loader UI */}
      {isCompressing && (
        <View style={[styles.analysisLoader, { backgroundColor: theme.card + 'CC' }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.text, marginTop: 10, fontSize: 12, fontWeight: 'bold' }}>{t('compressingAudio')} ({Math.round(compressionProgress * 100)}%)</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 5 }}>{t('compressingNote')}</Text>
        </View>
      )}

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
                <Text style={[styles.directionLabelText, { color: theme.text, textAlign: 'center' }]}>{settings.stageDirection === 'top' ? t('front') : t('backDir')}</Text>
              </View>
              <GridLayer settings={settings} />
              

              {dancers.map((d, i) => (
                <DancerNode key={d.id} index={i} dancer={d} dancerPos={dancerPositions[d.id]} isSelected={selectedDancerId === d.id} onPress={handleDancerPress} mode={mode} settings={settings} stageWidth={STAGE_WIDTH} stageHeight={STAGE_HEIGHT} cellSize={STAGE_CELL_SIZE} scale={scale} onDragEnd={onDragEnd} canDragInPlace={!!(activeEntryIdInPlace || selectedEntryId)} />
              ))}
              <View style={{ position: 'absolute', bottom: -45, left: 0, right: 0, alignSelf: 'center' }}>
                <Text style={[styles.directionLabelText, { color: theme.text, textAlign: 'center' }]}>{settings.stageDirection === 'bottom' ? t('front') : t('backDir')}</Text>
              </View>
            </Animated.View>
          </View>
        </GestureDetector>
      </View>

      <View style={[styles.bottomDock, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        {mode === 'place' ? (
          <View style={styles.placeDock}>
            <View style={[styles.timelineWrapper, { backgroundColor: theme.card }]}>
              <Animated.ScrollView 
                ref={timelineScrollViewRef} 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                scrollEventThrottle={16} 
                onScroll={handleTimelineScroll} 
                onScrollBeginDrag={() => { isUserScrollingSV.value = true; cancelAnimation(currentTimeMs); }} 
                onMomentumScrollBegin={() => { isUserScrollingSV.value = true; }} 
                onScrollEndDrag={(e) => { if (!e.nativeEvent.velocity || e.nativeEvent.velocity.x === 0) onScrollEnd(e); }} 
                onMomentumScrollEnd={onScrollEnd} 
                contentContainerStyle={{ paddingHorizontal: CENTER_OFFSET }}
                removeClippedSubviews={true}
              >
                <GestureDetector gesture={Gesture.Simultaneous(timelinePinchGesture, Gesture.Tap().runOnJS(true).onEnd((e) => openTimelineMenuAt(e.x)))}>
                  <TimelineContainer duration={effectiveDuration || 60} pxPerSecSV={pxPerSecSV}>
                    <WaveformBackground duration={effectiveDuration || 60} tiles={waveformTiles} pxPerSecSV={pxPerSecSV} />
                    <TimeMarkers duration={effectiveDuration || 60} pxPerSecSV={pxPerSecSV} />
                    <View style={styles.timelineTrack}>
                      {sortedTimeline.map((e, idx, arr) => (
                        <React.Fragment key={e.id}>
                          <TimelineBlock 
                            entry={e} 
                            isSelected={selectedEntryId === e.id} 
                            sceneName={sceneNamesMap[e.sceneId]} 
                            theme={theme} 
                            minTs={arr[idx-1] ? (arr[idx-1].timestampMillis + arr[idx-1].durationMillis) : 0} 
                            maxTs={arr[idx+1] ? arr[idx+1].timestampMillis : (effectiveDuration || 60) * 1000} 
                            pxPerSecSV={pxPerSecSV}
                            onSelect={setSelectedEntryId} 
                            onCommitMove={handleCommitMove} 
                            onCommitResize={handleCommitResize} 
                            onActionClick={handleEntryActionClick} 
                            dancers={dancers} 
                            scene={scenes.find(s => s.id === e.sceneId)} 
                            settings={settings} 
                          />
                          {idx < arr.length - 1 && (
                            <TransitionX 
                              startMs={e.timestampMillis + e.durationMillis}
                              durationMs={arr[idx+1].timestampMillis - (e.timestampMillis + e.durationMillis)}
                              pxPerSecSV={pxPerSecSV}
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </View>
                  </TimelineContainer>
                </GestureDetector>
              </Animated.ScrollView>
              
              {/* Timeline Zoom Controls */}
              <View style={[styles.timelineZoomControls, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <TouchableOpacity style={styles.zoomBtn} onPress={() => { timelineZoom.value = withTiming(1); setTimelineZoomUI(100); }}>
                  <Text style={[styles.zoomText, { color: theme.text }]}>{timelineZoomUI}%</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.zoomBtn} onPress={() => { const nz = Math.min(5, (Math.floor(timelineZoom.value * 4) + 1) / 4); timelineZoom.value = withTiming(nz); setTimelineZoomUI(Math.round(nz * 100)); }}>
                  <Ionicons name="add" size={16} color={theme.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.zoomBtn} onPress={() => { const nz = Math.max(0.5, (Math.ceil(timelineZoom.value * 4) - 1) / 4); timelineZoom.value = withTiming(nz); setTimelineZoomUI(Math.round(nz * 100)); }}>
                  <Ionicons name="remove" size={16} color={theme.text} />
                </TouchableOpacity>
              </View>

              <View style={[styles.needle, { left: CENTER_OFFSET }]} pointerEvents="none" />
            </View>
            <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 }}>
              <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <TouchableOpacity onPress={handleAddVideo} style={styles.toolBtnSmall} disabled={isConvertingVideo}>{isConvertingVideo ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="videocam" size={24} color={theme.textSecondary} />}<Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>{isConvertingVideo ? '변환 중...' : t('addVideo')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleChangeSong} style={styles.toolBtnSmall} disabled={isChangingSong}>{isChangingSong ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="musical-notes" size={24} color={theme.textSecondary} />}<Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>{t('changeSong')}</Text></TouchableOpacity>
                {videoUrl && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 6, height: 36, borderWidth: 1, borderColor: theme.border }}>
                    <TouchableOpacity onPress={() => handleSyncAdjust(-0.1)} style={{ padding: 4 }}>
                      <Ionicons name="remove-circle-outline" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <View style={{ width: 55, alignItems: 'center' }}>
                      <Text style={{ color: theme.text, fontSize: 11, fontWeight: 'bold' }}>{t('sync')} {syncOffset >= 0 ? '+' : ''}{syncOffset.toFixed(1)}s</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleSyncAdjust(0.1)} style={{ padding: 4 }}>
                      <Ionicons name="add-circle-outline" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={{ width: 70, alignItems: 'center', justifyContent: 'center' }}>
                <PlayButton
                  player={player}
                  theme={theme}
                  isPlayingSV={isPlayerPlayingSV}
                />
              </View>

              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                <PlaybackTimeDisplay currentTimeMs={currentTimeMs} />
              </View>
            </View>

          </View>
        ) : (
          <View style={styles.createDock}>
            <View style={styles.createToolbar}>
              <TouchableOpacity style={styles.toolBtn} onPress={addDancer}><Ionicons name="person-add" size={24} color={theme.primary} /><Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>{t('addDancer')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={() => { setTempRows(String(settings.gridRows)); setTempCols(String(settings.gridCols)); setTempWingWidth(String(settings.sideWingWidth || 0)); setShowStageSettings(true); }}><Ionicons name="settings-outline" size={24} color={theme.textSecondary} /><Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>{t('stageSettings')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={() => { setGuideIndex(0); setShowGuide(true); }}><Ionicons name="help-circle-outline" size={24} color={theme.textSecondary} /><Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>{t('guide')}</Text></TouchableOpacity>
            </View>
            <View style={styles.sceneSection}>
              <View style={styles.actionColumn}>
                <TouchableOpacity style={[styles.addSceneBtnWide, { backgroundColor: theme.primary }]} onPress={() => { setSceneModalMode('add'); setInputName(''); setShowSceneModal(true); }}><Ionicons name="add-circle" size={16} color={theme.background} /><Text style={[styles.addSceneText, { color: theme.background }]}>{t('addFormation')}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.addSceneBtnWide, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]} onPress={() => setShowMirrorModal(true)}><Ionicons name="swap-horizontal" size={16} color={theme.text} /><Text style={[styles.addSceneText, { color: theme.text }]}>{t('mirrorFormation')}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.addSceneBtnWide, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]} onPress={copyActiveScene}><Ionicons name="copy-outline" size={16} color={theme.text} /><Text style={[styles.addSceneText, { color: theme.text }]}>{t('copyFormation')}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.addSceneBtnWide, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]} onPress={() => setShowDeleteModal(true)}><Ionicons name="trash-outline" size={16} color={theme.error} /><Text style={[styles.addSceneText, { color: theme.error }]}>{t('deleteFormation')}</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center' }}>
                {scenes.map(s => (
                  <SceneCardItem
                    key={s.id}
                    scene={s}
                    isActive={activeSceneId === s.id}
                    dancers={dancers}
                    settings={settings}
                    theme={theme}
                    onSelect={handleSceneCardSelect}
                    onLongPress={handleSceneCardLongPress}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        )}
        <View style={{ height: 15 }} />
      </View>

      <Modal visible={showExportModal} transparent animationType="fade" onRequestClose={() => setShowExportModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.menu, { width: '85%', paddingBottom: 30, backgroundColor: theme.card }]}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}><Text style={[styles.menuTitle, { marginBottom: 0, color: theme.text }]}>{t('exportShare')}</Text><TouchableOpacity onPress={() => setShowExportModal(false)}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity></View><View style={{ gap: 12 }}><TouchableOpacity style={[styles.exportOption, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]} onPress={startExportJSON}><View style={[styles.exportIcon, { backgroundColor: theme.primary + '22' }]}><Ionicons name="code-working" size={24} color={theme.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.exportLabel, { color: theme.text }]}>{t('exportJson')}</Text><Text style={[styles.exportDesc, { color: theme.textSecondary }]}>{t('exportJsonDesc')}</Text></View><Ionicons name="chevron-forward" size={18} color={theme.border} /></TouchableOpacity><TouchableOpacity style={[styles.exportOption, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]} onPress={() => setShowPublishModal(true)}><View style={[styles.exportIcon, { backgroundColor: '#FF2D5522' }]}><Ionicons name="videocam" size={24} color="#FF2D55" /></View><View style={{ flex: 1 }}><Text style={[styles.exportLabel, { color: theme.text }]}>{t('uploadFeedback')}</Text><Text style={[styles.exportDesc, { color: theme.textSecondary }]}>{t('uploadFeedbackDesc')}</Text></View><Ionicons name="chevron-forward" size={18} color={theme.border} /></TouchableOpacity></View></View>
        </View>
      </Modal>

      <Modal visible={showPublishModal} transparent animationType="fade" onRequestClose={() => setShowPublishModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalBg}>
            <View style={[styles.menu, { backgroundColor: theme.card }]}>
              <Text style={[styles.menuTitle, { color: theme.text }]}>{t('publishFeedback')}</Text>
              
              <Text style={{ color: theme.textSecondary, marginBottom: 10, fontSize: 12 }}>{t('publishTitleLabel')}</Text>
              <TextInput 
                style={[styles.sheetInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} 
                value={publishTitle} 
                onChangeText={setPublishTitle} 
                placeholder={t('publishTitlePlaceholder')} 
                placeholderTextColor={theme.textSecondary} 
                autoFocus 
              />

              {videoUrl && (
                <View style={{ marginTop: 20 }}>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: 'bold', marginBottom: 10 }}>{t('includeChoreographyVideo')}</Text>
                  <TouchableOpacity 
                    onPress={() => setIncludeChoreography(!includeChoreography)}
                    style={[
                      styles.toggleBtn, 
                      { 
                        backgroundColor: includeChoreography ? theme.primary : theme.background,
                        borderColor: includeChoreography ? theme.primary : theme.border,
                        borderWidth: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 12,
                        borderRadius: 12
                      }
                    ]}
                  >
                    <Ionicons 
                      name={includeChoreography ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={includeChoreography ? "#FFF" : theme.textSecondary} 
                      style={{ marginRight: 8 }}
                    />
                    <Text style={{ color: includeChoreography ? "#FFF" : theme.textSecondary, fontWeight: 'bold' }}>
                      {includeChoreography ? (t('includingChoreography') || '안무 영상 포함됨') : (t('excludeChoreography') || '대형만 업로드')}
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 6 }}>
                    {t('includeChoreographyDescShort') || '체크 시 대형과 안무 영상을 동시에 볼 수 있는 듀얼 플레이어로 게시됩니다.'}
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 25 }}>
                <TouchableOpacity onPress={() => setShowPublishModal(false)}>
                  <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePublish} disabled={isExporting}>
                  {isExporting ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 16 }}>{t('post')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalBg}><View style={[styles.menu, { width: '80%', paddingBottom: 25, backgroundColor: theme.card }]}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}><Text style={[styles.menuTitle, { marginBottom: 0, color: theme.text }]}>{t('deleteFormation')}</Text><TouchableOpacity onPress={() => setShowDeleteModal(false)}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity></View><View style={{ alignItems: 'center', marginVertical: 15 }}><Ionicons name="trash" size={32} color={theme.error} /><Text style={{ color: theme.text, fontSize: 14, fontWeight: 'bold', marginTop: 10 }}>{t('deleteFormationConfirm')}</Text></View><View style={{ gap: 8 }}><TouchableOpacity style={[styles.mirrorApplyBtn, { backgroundColor: theme.background, padding: 12, borderWidth: 1, borderColor: theme.border }]} onPress={() => setShowDeleteModal(false)}><Text style={[styles.mirrorApplyText, { color: theme.textSecondary }]}>{t('cancel')}</Text></TouchableOpacity><TouchableOpacity style={[styles.mirrorApplyBtn, { backgroundColor: theme.error, padding: 12 }]} onPress={deleteActiveScene}><Text style={[styles.mirrorApplyText, { color: '#FFF' }]}>{t('delete')}</Text></TouchableOpacity></View></View></View></Modal>

      <Modal visible={showFilenameModal} transparent animationType="fade" onRequestClose={() => setShowFilenameModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalBg}>
            <View style={[styles.menu, { backgroundColor: theme.card }]}>
              <Text style={[styles.menuTitle, { color: theme.text }]}>{t('fileNameSettings')}</Text>
              <Text style={{ color: theme.textSecondary, marginBottom: 10, fontSize: 12 }}>{t('fileNameLabel')}</Text>
              <TextInput 
                style={[styles.sheetInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} 
                value={exportFileName} 
                onChangeText={setExportFileName} 
                placeholder={t('fileNamePlaceholder')} 
                placeholderTextColor={theme.textSecondary} 
                autoFocus 
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 10 }}>
                <TouchableOpacity onPress={() => setShowFilenameModal(false)}><Text style={{ color: theme.textSecondary }}>{t('cancel')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleExportJSON}><Text style={{ color: theme.primary, fontWeight: 'bold' }}>{t('save')}</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showTimelineMenu} transparent animationType="fade">
        <Pressable style={styles.modalBg} onPress={() => setShowTimelineMenu(false)}>
          <View style={[styles.menu, { backgroundColor: theme.card }]}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>{t('addFormation')}</Text>

            {scenes.length > 0 ? (
              <>
                <Text style={{ color: theme.textSecondary, marginBottom: 10, fontSize: 12 }}>{t('existingFormation')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {scenes.map(s => (
                    <TouchableOpacity 
                      key={s.id} 
                      onPress={() => handleAddTimelineEntry(s.id)} 
                      style={[styles.menuItem, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}
                    >
                      <Text style={{ color: theme.text }}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <Text style={{ color: theme.textSecondary, textAlign: 'center', marginVertical: 10 }}>
                {t('noFormationCreateHint')}
              </Text>
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showEntryActionModal} transparent animationType="fade" onRequestClose={() => setShowEntryActionModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowEntryActionModal(false)}>
          <View style={[styles.menu, { width: '80%', paddingBottom: 25, backgroundColor: theme.card }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={[styles.menuTitle, { marginBottom: 0, color: theme.text }]}>{t('formationAction')}</Text>
              <TouchableOpacity onPress={() => setShowEntryActionModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={{ gap: 10, marginTop: 10 }}>
              <TouchableOpacity 
                style={[styles.mirrorApplyBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]} 
                onPress={handleDuplicateTimelineEntry}
              >
                <Text style={[styles.mirrorApplyText, { color: theme.text }]}>{t('copyFormation')}</Text>
                <Ionicons name="copy-outline" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.mirrorApplyBtn, { backgroundColor: theme.error + '22', borderColor: theme.error, borderWidth: 1 }]} 
                onPress={handleDeleteTimelineEntryAction}
              >
                <Text style={[styles.mirrorApplyText, { color: theme.error }]}>{t('delete')}</Text>
                <Ionicons name="trash-outline" size={18} color={theme.error} />
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>


      <Modal visible={showSceneModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalBg}><View style={[styles.menu, { backgroundColor: theme.card }]}><Text style={[styles.menuTitle, { color: theme.text }]}>{sceneModalMode === 'add' ? t('addFormation') : t('renameFormation')}</Text><TextInput style={[styles.sheetInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={inputName} onChangeText={setInputName} placeholder={t('formationNamePlaceholder')} placeholderTextColor={theme.textSecondary} autoFocus /><View style={{flexDirection:'row', justifyContent:'flex-end', gap:20}}><TouchableOpacity onPress={() => setShowSceneModal(false)}><Text style={{color:theme.textSecondary}}>{t('cancel')}</Text></TouchableOpacity><TouchableOpacity onPress={handleSceneAction}><Text style={{color:theme.primary, fontWeight:'bold'}}>{sceneModalMode === 'add' ? t('add') : t('save')}</Text></TouchableOpacity></View></View></View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={showDancerSheet} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalBg} onPress={() => setShowDancerSheet(false)}>
            <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: Math.max(insets.bottom, 25) + 10 }]}>
              <TextInput 
                style={[styles.sheetInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} 
                value={dancers.find(d => d.id === selectedDancerId)?.name} 
                onChangeText={val => { 
                  pushHistory(); 
                  setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, name: val } : d)); 
                }} 
                placeholderTextColor={theme.textSecondary} 
              />
              <View style={styles.colorRow}>
                {COLORS.map(c => (
                  <TouchableOpacity 
                    key={c} 
                    style={[styles.colorChip, { backgroundColor: c }, dancers.find(d => d.id === selectedDancerId)?.color === c && { borderWidth: 3, borderColor: theme.text }]} 
                    onPress={() => { 
                      pushHistory(); 
                      setDancers(dancers.map(d => d.id === selectedDancerId ? { ...d, color: c } : d)); 
                    }} 
                  />
                ))}
              </View>
              <TouchableOpacity 
                style={styles.deleteBtn} 
                onPress={() => { 
                  pushHistory(); 
                  setDancers(dancers.filter(d => d.id !== selectedDancerId)); 
                  setSelectedDancerId(null); 
                  setShowDancerSheet(false); 
                }}
              >
                <Ionicons name="trash" size={20} color={theme.error} />
                <Text style={{ color: theme.error, marginLeft: 10 }}>{t('deleteDancer')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={showStageSettings} transparent animationType="fade"><View style={styles.modalBg}><View style={[styles.menu, { backgroundColor: theme.card }]}><Text style={[styles.menuTitle, { color: theme.text }]}>{t('stageSettings')}</Text><View style={styles.settingRow}><Text style={{color:theme.text}}>{t('gridRows')}</Text><TextInput style={[styles.smallInput, { backgroundColor: theme.background, color: theme.primary, borderColor: theme.border, borderWidth: 1 }]} keyboardType="number-pad" value={tempRows} onChangeText={setTempRows} /></View><View style={styles.settingRow}><Text style={{color:theme.text}}>{t('gridCols')}</Text><TextInput style={[styles.smallInput, { backgroundColor: theme.background, color: theme.primary, borderColor: theme.border, borderWidth: 1 }]} keyboardType="number-pad" value={tempCols} onChangeText={setTempCols} /></View><View style={styles.settingRow}><Text style={{color:theme.text}}>{t('wingSpace')}</Text><TextInput style={[styles.smallInput, { backgroundColor: theme.background, color: theme.primary, borderColor: theme.border, borderWidth: 1 }]} keyboardType="number-pad" value={tempWingWidth} onChangeText={setTempWingWidth} /></View><View style={styles.settingRow}><Text style={{color:theme.text}}>{t('audiencePos')}</Text><TouchableOpacity style={[styles.toggleBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]} onPress={() => setSettings({...settings, stageDirection: settings.stageDirection === 'top' ? 'bottom' : 'top'})}><Text style={{color: theme.primary, fontWeight: 'bold'}}>{settings.stageDirection === 'top' ? t('topSide') : t('bottomSide')}</Text></TouchableOpacity></View><View style={styles.settingRow}><Text style={{color:theme.text}}>{t('gridSnap')}</Text><TouchableOpacity onPress={() => setSettings({...settings, snapToGrid: !settings.snapToGrid})}><Ionicons name={settings.snapToGrid ? "checkbox" : "square-outline"} size={24} color={theme.primary} /></TouchableOpacity></View><TouchableOpacity style={[styles.doneBtn, { backgroundColor: theme.primary }]} onPress={handleApplySettings}><Text style={{fontWeight:'bold', color: theme.background}}>{t('ok')}</Text></TouchableOpacity></View></View></Modal>
      <Modal visible={showMirrorModal} transparent animationType="fade" onRequestClose={() => setShowMirrorModal(false)}><View style={styles.modalBg}><View style={[styles.menu, { width: '90%', paddingBottom: 30, backgroundColor: theme.card }]}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}><Text style={[styles.menuTitle, { marginBottom: 0, color: theme.text }]}>{t('mirrorFormation')}</Text><TouchableOpacity onPress={() => setShowMirrorModal(false)}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity></View><Text style={[styles.settingLabel, { color: theme.textSecondary }]}>{t('mirrorType')}</Text><View style={styles.mirrorRow}><TouchableOpacity style={[styles.mirrorBox, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }, selectedMirrorType === 'horizontal' && { borderColor: theme.primary, backgroundColor: theme.primary + '11' }]} onPress={() => setSelectedMirrorType('horizontal')}><Ionicons name="resize" size={24} color={selectedMirrorType === 'horizontal' ? theme.primary : theme.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} /><Text style={[styles.mirrorText, { color: theme.textSecondary }, selectedMirrorType === 'horizontal' && { color: theme.primary }]}>{t('horizontal')}</Text></TouchableOpacity><TouchableOpacity style={[styles.mirrorBox, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }, selectedMirrorType === 'vertical' && { borderColor: theme.primary, backgroundColor: theme.primary + '11' }]} onPress={() => setSelectedMirrorType('vertical')}><Ionicons name="resize" size={24} color={selectedMirrorType === 'vertical' ? theme.primary : theme.textSecondary} /><Text style={[styles.mirrorText, { color: theme.textSecondary }, selectedMirrorType === 'vertical' && { color: theme.primary }]}>{t('vertical')}</Text></TouchableOpacity><TouchableOpacity style={[styles.mirrorBox, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }, selectedMirrorType === 'both' && { borderColor: theme.primary, backgroundColor: theme.primary + '11' }]} onPress={() => setSelectedMirrorType('both')}><Ionicons name="sync" size={24} color={selectedMirrorType === 'both' ? theme.primary : theme.textSecondary} /><Text style={[styles.mirrorText, { color: theme.textSecondary }, selectedMirrorType === 'both' && { color: theme.primary }]}>{t('both')}</Text></TouchableOpacity></View><Text style={[styles.settingLabel, { marginTop: 25, color: theme.textSecondary }]}>{t('applyTarget')}</Text><View style={{ gap: 10 }}><TouchableOpacity style={[styles.mirrorApplyBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]} onPress={() => applyMirror(false)}><Text style={[styles.mirrorApplyText, { color: theme.text }]}>{t('currentOnly')}</Text><Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /></TouchableOpacity><TouchableOpacity style={[styles.mirrorApplyBtn, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]} onPress={() => applyMirror(true)}><Text style={[styles.mirrorApplyText, { color: theme.text }]}>{t('applyAll')}</Text><Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /></TouchableOpacity></View></View></View></Modal>
      <Modal visible={showGuide} transparent animationType="fade" onRequestClose={() => setShowGuide(false)}><Pressable style={styles.modalBg} onPress={() => setShowGuide(false)}><View style={[styles.menu, {width:'95%', backgroundColor: theme.card}]}><Text style={[styles.menuTitle, { color: theme.text }]}>{t(`guideStep${guideIndex + 1}Title`)}</Text>{GUIDE_IMAGES[guideIndex] && <Image source={GUIDE_IMAGES[guideIndex]} style={{ width: '100%', height: 200, borderRadius: 15, marginVertical: 10 }} resizeMode="contain" />}<Text style={{color:theme.textSecondary, marginVertical:15, fontSize: 13, lineHeight: 18}}>
  {t(`guideStep${guideIndex + 1}Desc`).split(/(\*\*.*?\*\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={i} style={{color: theme.primary, fontWeight: 'bold'}}>{part.slice(2, -2)}</Text>;
    }
    return part;
  })}
</Text><View style={{flexDirection:'row', justifyContent:'space-between'}}><TouchableOpacity onPress={() => setGuideIndex(prev => Math.max(0, prev-1))}><Text style={{color:theme.text}}>{t('prev')}</Text></TouchableOpacity><TouchableOpacity onPress={() => { if(guideIndex < GUIDE_IMAGES.length - 1) setGuideIndex(prev=>prev+1); else setShowGuide(false); }}><Text style={{color:theme.primary, fontWeight: 'bold'}}>{guideIndex === GUIDE_IMAGES.length - 1 ? t('close') : t('next')}</Text></TouchableOpacity></View></View></Pressable></Modal>
      {isConvertingVideo && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }]}>
          <View style={[styles.menu, { alignItems: 'center', padding: 30, backgroundColor: theme.card }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={{ color: theme.text, marginTop: 15, fontWeight: 'bold' }}>{t('convertingVideo') || '영상을 변환 중입니다...'}</Text>
            <Text style={{ color: theme.primary, marginTop: 5, fontSize: 18, fontWeight: '900' }}>{videoConversionProgress}%</Text>
            <Text style={{ color: theme.textSecondary, marginTop: 10, fontSize: 12, textAlign: 'center' }}>{t('conversionDesc') || 'fMP4 형식을 표준 MP4로 변환하여\n탐색 성능을 최적화하고 있습니다.'}</Text>
            <Text style={{ color: theme.textSecondary, marginTop: 20, fontSize: 10 }}>대용량 파일의 경우 수 분이 소요될 수 있습니다.</Text>
          </View>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  modeToggle: { flexDirection: 'row', borderRadius: 20, padding: 4 },
  modeTab: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 18 },
  tabText: { fontWeight: 'bold', fontSize: 13 },
  stageSection: { flex: 1, overflow: 'hidden', position: 'relative' },
  stageWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { borderWidth: 1, overflow: 'visible' },
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
  waveformContainer: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 0 },
  waveformBar: { },
  waveformEmpty: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  timeMarkersLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 20 },
  timeMarker: { position: 'absolute', bottom: 0, alignItems: 'center' },
  timeMarkerLine: { width: 1, height: 5 },
  timeMarkerText: { fontSize: 9, marginTop: 2, fontWeight: 'bold' },
  timelineTrack: { flex: 1, position: 'relative' },
  block: { position: 'absolute', top: 10, bottom: 25, borderRadius: 4, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, zIndex: 50 },
  blockPreview: { width: '100%', height: 55, marginBottom: 4, pointerEvents: 'none', alignItems: 'center' },
  blockText: { fontSize: 9, fontWeight: 'bold' },
  needle: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#FFD700', zIndex: 100, marginLeft: -1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  timelineZoomControls: { position: 'absolute', top: 4, right: 8, zIndex: 100, flexDirection: 'row', borderRadius: 15, padding: 2, borderWidth: 1 },
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
  directionLabelText: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  exportOption: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 10 },
  exportIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  exportLabel: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  exportDesc: { fontSize: 12 },
  toast: { position: 'absolute', top: 120, left: '10%', right: '10%', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 999, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  toastText: { marginLeft: 10, fontWeight: 'bold', fontSize: 14 },
  analysisLoader: { position: 'absolute', top: 120, alignSelf: 'center', padding: 15, borderRadius: 12, alignItems: 'center', zIndex: 1000 },
});
