import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useDerivedValue, SharedValue } from 'react-native-reanimated';
import { Formation } from '../../types';
import { useAudioPlayer } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAppContext } from '../../context/AppContext';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

interface FormationPlayerProps {
  formation: Formation;
  currentTimeMs: number;
  externalTimeSV?: SharedValue<number>;
  seekToMs?: number | null;
  onTimeUpdate?: (timeMs: number) => void;
  onDurationDetected?: (durationSec: number) => void;
  isPlaying?: boolean;
  playbackRate?: number;
  noAudio?: boolean;
  hidePip?: boolean;
  hideLabels?: boolean;
  forceDarkMode?: boolean;
  containerWidth?: number;
  containerHeight?: number;
  externalVideoPlayer?: any;
}

interface DancerNodeProps {
  dancer: any;
  index: number;
  sortedTimeline: any[];
  scenePositionMap: Record<string, Record<string, { x: number; y: number }>>;
  currentTimeMsSV: SharedValue<number>;
  stageWidth: number;
  stageHeight: number;
  cellSize: number;
}

const DancerNode = React.memo(({
  dancer, index, sortedTimeline, scenePositionMap, currentTimeMsSV, stageWidth, stageHeight, cellSize,
}: DancerNodeProps) => {
  const dancerId = dancer.id;

  const pos = useDerivedValue(() => {
    'worklet';
    const t = currentTimeMsSV.value;
    let prevE: any = null;
    let nextE: any = null;
    for (let i = 0; i < sortedTimeline.length; i++) {
      const e = sortedTimeline[i];
      if (e.timestampMillis <= t) prevE = e;
      else { nextE = e; break; }
    }

    const getScenePos = (sceneId: string): { x: number; y: number } => {
      const sp = scenePositionMap[sceneId];
      if (sp && sp[dancerId]) return sp[dancerId];
      return { x: 0.5, y: 0.5 };
    };

    if (!prevE) {
      return sortedTimeline.length > 0 ? getScenePos(sortedTimeline[0].sceneId) : { x: 0.5, y: 0.5 };
    }

    const prevPos = getScenePos(prevE.sceneId);
    if (t <= prevE.timestampMillis + prevE.durationMillis) return prevPos;

    if (nextE) {
      const nextPos = getScenePos(nextE.sceneId);
      const gapStart = prevE.timestampMillis + prevE.durationMillis;
      const gapEnd = nextE.timestampMillis;
      const raw = gapEnd > gapStart ? (t - gapStart) / (gapEnd - gapStart) : 1;
      const progress = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      const ease = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      return {
        x: prevPos.x + (nextPos.x - prevPos.x) * ease,
        y: prevPos.y + (nextPos.y - prevPos.y) * ease,
      };
    }

    return prevPos;
  });

  const animStyle = useAnimatedStyle(() => ({
    width: cellSize * 2.5,
    transform: [
      { translateX: pos.value.x * stageWidth - cellSize * 1.25 },
      { translateY: pos.value.y * stageHeight - cellSize * 0.35 },
    ],
  }));

  return (
    <Animated.View style={[styles.dancerNode, animStyle]} pointerEvents="none">
      <View style={[styles.dancerCircle, { backgroundColor: dancer.color, width: cellSize * 0.7, height: cellSize * 0.7, borderRadius: (cellSize * 0.7) / 2, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.2)' }]}>
        <Text style={[styles.dancerInitial, { fontSize: Math.max(6, cellSize * 0.3) }]}>{index + 1}</Text>
      </View>
      {cellSize > 8 && (
        <Text style={styles.dancerNameText} numberOfLines={1}>{dancer.name}</Text>
      )}
    </Animated.View>
  );
});

export default function FormationPlayer({
  formation, currentTimeMs, externalTimeSV, seekToMs, onTimeUpdate, onDurationDetected,
  isPlaying = false, playbackRate = 1, noAudio = false, hidePip = false,
  hideLabels = false, forceDarkMode = false,
  containerWidth, containerHeight, externalVideoPlayer
}: FormationPlayerProps) {
  const { theme: appTheme, t } = useAppContext();

  const isDark = forceDarkMode || appTheme.isDark;
  const theme = {
    background: isDark ? '#0A0A0A' : '#F5F5F5',
    card: isDark ? '#1A1A1A' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#AAAAAA' : '#666666',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    primary: appTheme.primary,
  };

  const dancers = formation?.data?.dancers || [];
  const scenes = formation?.data?.scenes || [];
  const timeline = formation?.data?.timeline || [];
  const gridRows = formation?.settings?.gridRows || 10;
  const gridCols = formation?.settings?.gridCols || 20;
  const stageDirection = formation?.settings?.stageDirection || 'top';
  const sideWingWidth = formation?.settings?.sideWingWidth ?? 0;
  const videoSettings = formation?.videoSettings;

  const isCompact = containerWidth != null;
  const showDirectionLabels = !hideLabels;
  const labelExtraHeight = showDirectionLabels ? 28 : 0;

  const effectiveWidth = containerWidth ?? WINDOW_WIDTH;
  const padding = isCompact ? 0 : 40;
  const cellByWidth = (effectiveWidth - padding) / gridCols;
  const cellByHeight = containerHeight != null ? (containerHeight - labelExtraHeight * 2) / gridRows : Infinity;
  const STAGE_CELL_SIZE = Math.min(cellByWidth, cellByHeight);
  const STAGE_WIDTH = gridCols * STAGE_CELL_SIZE;
  const STAGE_HEIGHT = gridRows * STAGE_CELL_SIZE;
  const wingPct = (sideWingWidth > 0 ? `${(sideWingWidth / gridCols) * 100}%` : '0%') as `${number}%`;

  const durationReportedRef = useRef(false);

  // Internal SharedValue driven by audio player; externalTimeSV takes priority for DancerNodes
  const internalTimeSV = useSharedValue(currentTimeMs);
  const activeTimeSV = externalTimeSV ?? internalTimeSV;

  // Pre-compute stable sorted data for worklet capture
  const sortedTimeline = useMemo(() =>
    [...timeline].sort((a: any, b: any) => a.timestampMillis - b.timestampMillis),
    [timeline]
  );

  const scenePositionMap = useMemo(() => {
    const map: Record<string, Record<string, { x: number; y: number }>> = {};
    for (const scene of scenes) {
      map[scene.id] = (scene as any).positions || {};
    }
    return map;
  }, [scenes]);

  const player = useAudioPlayer(noAudio ? '' : (formation?.audioUrl || ''));
  const internalVideoPlayer = useVideoPlayer(videoSettings?.videoUrl || null, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const videoPlayer = externalVideoPlayer || internalVideoPlayer;

  // Fallback: when noAudio and no externalTimeSV, sync internalTimeSV from prop (JS thread)
  useEffect(() => {
    if (noAudio && !externalTimeSV) {
      internalTimeSV.value = currentTimeMs;
    }
  }, [currentTimeMs, noAudio, externalTimeSV]);

  useEffect(() => {
    if (!onDurationDetected) return;
    durationReportedRef.current = false;

    if (noAudio || !formation?.audioUrl) {
      if (timeline.length > 0) {
        const maxMs = Math.max(...timeline.map((e: any) => e.timestampMillis + (e.durationMillis || 0)));
        if (maxMs > 0) onDurationDetected(maxMs / 1000);
      }
      return;
    }

    let attempts = 0;
    const poll = setInterval(() => {
      if (player?.duration > 0) {
        onDurationDetected(player.duration);
        durationReportedRef.current = true;
        clearInterval(poll);
      }
      if (++attempts > 100) {
        if (timeline.length > 0) {
          const maxMs = Math.max(...timeline.map((e: any) => e.timestampMillis + (e.durationMillis || 0)));
          if (maxMs > 0) onDurationDetected(maxMs / 1000);
        }
        clearInterval(poll);
      }
    }, 200);
    return () => clearInterval(poll);
  }, [formation?.audioUrl, noAudio, timeline]);

  useEffect(() => {
    if (!player || noAudio) return;
    player.loop = true;

    if (isPlaying) {
      try { player.playbackRate = playbackRate; } catch (_) {}
      if (videoPlayer?.src) { try { videoPlayer.playbackRate = playbackRate; } catch (_) {} }
      player.play();
      if (videoPlayer?.src) videoPlayer.play();

      const interval = setInterval(() => {
        const ms = player.currentTime * 1000;
        internalTimeSV.value = ms;
        onTimeUpdate?.(ms);
        if (!durationReportedRef.current && player.duration > 0 && onDurationDetected) {
          onDurationDetected(player.duration);
          durationReportedRef.current = true;
        }
      }, 50);
      return () => clearInterval(interval);
    } else {
      player.pause();
      if (videoPlayer?.src) videoPlayer.pause();
    }
  }, [isPlaying, player, videoPlayer, noAudio]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!player) return;
    try { player.playbackRate = playbackRate; } catch (_) {}
    if (videoPlayer?.src) { try { videoPlayer.playbackRate = playbackRate; } catch (_) {} }
  }, [playbackRate]);

  useEffect(() => {
    if (seekToMs == null) return;
    internalTimeSV.value = seekToMs;
    if (player && !noAudio) player.seekTo(seekToMs / 1000);
    if (videoPlayer?.src) videoPlayer.currentTime = seekToMs / 1000;
  }, [seekToMs]);

  if (!formation) return null;

  const gridOpacity = isCompact ? 0.3 : 0.4;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {videoSettings?.videoUrl && !hidePip && (
        <View style={[styles.pipContainer, { left: videoSettings.pipPosition.x, top: videoSettings.pipPosition.y }]}>
          <VideoView
            player={videoPlayer}
            style={styles.pipVideo}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
            nativeControls={false}
            contentFit="contain"
          />
        </View>
      )}
      <View style={styles.stageWrapper}>
        {showDirectionLabels && (
          <View style={styles.directionLabelTop} pointerEvents="none">
            <View style={styles.directionLabelPill}>
              <Text style={[styles.directionLabelText, { color: '#FFFFFF', letterSpacing: 1.5 }]}>
                {stageDirection === 'top' ? t('front') : t('backDir')}
              </Text>
            </View>
          </View>
        )}
        <View style={[styles.stage, { width: STAGE_WIDTH, height: STAGE_HEIGHT, backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={StyleSheet.absoluteFill}>
            {Array.from({ length: gridRows + 1 }).map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridH, { top: `${(i / gridRows) * 100}%`, backgroundColor: theme.border, opacity: gridOpacity }]} />
            ))}
            {Array.from({ length: gridCols + 1 }).map((_, i) => (
              <View key={`v-${i}`} style={[styles.gridV, { left: `${(i / gridCols) * 100}%`, backgroundColor: theme.border, opacity: gridOpacity }]} />
            ))}
          </View>

          {(() => {
            const arm = Math.round(Math.min(24, Math.max(10, STAGE_CELL_SIZE * 1.4)));
            const thick = Math.max(1, Math.round(STAGE_CELL_SIZE * 0.1));
            return (
              <>
                <View style={{ position: 'absolute', top: '50%', left: '50%', width: arm, height: thick, backgroundColor: theme.primary, marginLeft: -(arm / 2), marginTop: -(thick / 2), opacity: 0.9, borderRadius: 1 }} />
                <View style={{ position: 'absolute', top: '50%', left: '50%', width: thick, height: arm, backgroundColor: theme.primary, marginLeft: -(thick / 2), marginTop: -(arm / 2), opacity: 0.9, borderRadius: 1 }} />
              </>
            );
          })()}

          {sideWingWidth > 0 && (
            <>
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: wingPct, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', zIndex: 1 }} />
              <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: wingPct, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', zIndex: 1 }} />
            </>
          )}

          {dancers.map((d: any, i: number) => (
            <DancerNode
              key={d.id}
              index={i}
              dancer={d}
              sortedTimeline={sortedTimeline}
              scenePositionMap={scenePositionMap}
              currentTimeMsSV={activeTimeSV}
              stageWidth={STAGE_WIDTH}
              stageHeight={STAGE_HEIGHT}
              cellSize={STAGE_CELL_SIZE}
            />
          ))}
        </View>
        {showDirectionLabels && (
          <View style={styles.directionLabelBottom} pointerEvents="none">
            <View style={styles.directionLabelPill}>
              <Text style={[styles.directionLabelText, { color: '#FFFFFF', letterSpacing: 1.5 }]}>
                {stageDirection === 'bottom' ? t('front') : t('backDir')}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageWrapper: { alignItems: 'center' },
  stage: { borderWidth: 1, overflow: 'hidden' },
  directionLabelTop: { alignItems: 'center', paddingBottom: 4 },
  directionLabelBottom: { alignItems: 'center', paddingTop: 4 },
  directionLabelPill: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 6 },
  directionLabelBox: { position: 'absolute', paddingHorizontal: 15, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  directionLabelText: { fontSize: 9, fontWeight: 'bold', letterSpacing: 2 },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1 },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  centerLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, zIndex: 1 },
  dancerNode: { position: 'absolute', alignItems: 'center' },
  dancerCircle: { justifyContent: 'center', alignItems: 'center' },
  dancerInitial: { color: '#FFF', fontWeight: 'bold' },
  dancerNameText: { color: '#AAA', marginTop: 2, fontSize: 7 },
  pipContainer: {
    position: 'absolute',
    width: 160,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#000',
    zIndex: 1000
  },
  pipVideo: { flex: 1 },
});
