import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Formation } from '../../types';
import { useAudioPlayer } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAppContext } from '../../context/AppContext';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

interface FormationPlayerProps {
  formation: Formation;
  currentTimeMs: number;
  seekToMs?: number | null;
  onTimeUpdate?: (timeMs: number) => void;
  onDurationDetected?: (durationSec: number) => void;
  isPlaying?: boolean;
  playbackRate?: number;
  noAudio?: boolean;
  hidePip?: boolean;
  containerWidth?: number;
  externalVideoPlayer?: any;
}

const DancerNode = ({ dancer, timeline, scenes, currentTimeMs, stageWidth, stageHeight, cellSize, index }: any) => {
  const pos = useSharedValue({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (!timeline || timeline.length === 0) return;

    const sorted = [...timeline].sort((a: any, b: any) => a.timestampMillis - b.timestampMillis);
    let prevE: any = null, nextE: any = null;
    for (const e of sorted) {
      if (e.timestampMillis <= currentTimeMs) prevE = e;
      else { nextE = e; break; }
    }

    const getScenePos = (sId: string) => scenes.find((s: any) => s.id === sId)?.positions?.[dancer.id] || { x: 0.5, y: 0.5 };

    let p = { x: 0.5, y: 0.5 };
    if (!prevE) {
      p = sorted.length > 0 ? getScenePos(sorted[0]?.sceneId) : { x: 0.5, y: 0.5 };
    } else {
      const prevPos = getScenePos(prevE.sceneId);
      if (currentTimeMs <= prevE.timestampMillis + prevE.durationMillis) {
        p = prevPos;
      } else if (nextE) {
        const nextPos = getScenePos(nextE.sceneId);
        const gapStart = prevE.timestampMillis + prevE.durationMillis, gapEnd = nextE.timestampMillis;
        const progress = Math.max(0, Math.min(1, (currentTimeMs - gapStart) / (gapEnd - gapStart)));
        const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        p = { x: prevPos.x + (nextPos.x - prevPos.x) * ease, y: prevPos.y + (nextPos.y - prevPos.y) * ease };
      } else {
        p = prevPos;
      }
    }
    pos.value = p;
  }, [currentTimeMs, timeline, scenes, dancer.id]);

  const style = useAnimatedStyle(() => ({
    width: cellSize * 2.5,
    transform: [
      { translateX: (pos.value.x * stageWidth) - (cellSize * 1.25) },
      { translateY: (pos.value.y * stageHeight) - (cellSize * 0.35) },
    ],
  }));

  return (
    <Animated.View style={[styles.dancerNode, style]} pointerEvents="none">
      <View style={[styles.dancerCircle, { backgroundColor: dancer.color, width: cellSize * 0.7, height: cellSize * 0.7, borderRadius: (cellSize * 0.7) / 2, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.2)' }]}>
        <Text style={[styles.dancerInitial, { fontSize: Math.max(6, cellSize * 0.3) }]}>{index + 1}</Text>
      </View>
      {cellSize > 8 && (
        <Text style={styles.dancerNameText} numberOfLines={1}>{dancer.name}</Text>
      )}
    </Animated.View>
  );
};

export default function FormationPlayer({
  formation, currentTimeMs, seekToMs, onTimeUpdate, onDurationDetected,
  isPlaying = false, playbackRate = 1, noAudio = false, hidePip = false,
  containerWidth, externalVideoPlayer
}: FormationPlayerProps) {
  const { theme } = useAppContext();

  const dancers = formation?.data?.dancers || [];
  const scenes = formation?.data?.scenes || [];
  const timeline = formation?.data?.timeline || [];
  const gridRows = formation?.settings?.gridRows || 10;
  const gridCols = formation?.settings?.gridCols || 20;
  const stageDirection = formation?.settings?.stageDirection || 'top';
  const sideWingWidth = formation?.settings?.sideWingWidth ?? 0;
  const videoSettings = formation?.videoSettings;

  // Use containerWidth if provided (thumbnail mode), otherwise full screen
  const effectiveWidth = containerWidth ?? WINDOW_WIDTH;
  const padding = containerWidth != null ? 0 : 40;
  const STAGE_CELL_SIZE = (effectiveWidth - padding) / gridCols;
  const STAGE_WIDTH = gridCols * STAGE_CELL_SIZE;
  const STAGE_HEIGHT = gridRows * STAGE_CELL_SIZE;
  const wingPct = (sideWingWidth > 0 ? `${(sideWingWidth / gridCols) * 100}%` : '0%') as `${number}%`;

  const durationReportedRef = useRef(false);

  const player = useAudioPlayer(noAudio ? '' : (formation?.audioUrl || ''));
  const internalVideoPlayer = useVideoPlayer(videoSettings?.videoUrl || null, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const videoPlayer = externalVideoPlayer || internalVideoPlayer;

  // Report audio duration once when available
  useEffect(() => {
    if (noAudio || !onDurationDetected) return;
    durationReportedRef.current = false;
    let attempts = 0;
    const poll = setInterval(() => {
      if (player?.duration > 0) {
        onDurationDetected(player.duration);
        durationReportedRef.current = true;
        clearInterval(poll);
      }
      if (++attempts > 100) clearInterval(poll);
    }, 200);
    return () => clearInterval(poll);
  }, [formation?.audioUrl, noAudio]);

  // Play/pause + time reporting
  useEffect(() => {
    if (!player || noAudio) return;
    player.loop = true;

    if (isPlaying) {
      try { (player as any).rate = playbackRate; } catch (_) {}
      player.play();
      if (videoPlayer?.src) videoPlayer.play();

      const interval = setInterval(() => {
        const ms = player.currentTime * 1000;
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
  }, [isPlaying, player, videoPlayer, noAudio, playbackRate]);

  // Explicit seek
  useEffect(() => {
    if (seekToMs == null) return;
    if (player && !noAudio) player.seekTo(seekToMs / 1000);
    if (videoPlayer?.src) videoPlayer.currentTime = seekToMs / 1000;
  }, [seekToMs]);

  if (!formation) return null;

  const isCompact = containerWidth != null;
  const gridOpacity = isCompact ? 0.3 : 0.4;

  return (
    <View style={[styles.container, { backgroundColor: theme.isDark ? '#0A0A0A' : '#F5F5F5' }]}>
      {videoSettings?.videoUrl && !hidePip && !isCompact && (
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
        {!isCompact && (
          <View style={[styles.directionLabelBox, {
            top: -35,
            backgroundColor: stageDirection === 'top' ? 'rgba(255, 51, 102, 0.2)' : (theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
          }]}>
            <Text style={[styles.directionLabelText, { color: stageDirection === 'top' ? '#FF3366' : theme.textSecondary, fontSize: 10, fontWeight: '900' }]}>
              {stageDirection === 'top' ? '▼ FRONT (AUDIENCE)' : '▲ BACK'}
            </Text>
          </View>
        )}

        <View style={[styles.stage, { width: STAGE_WIDTH, height: STAGE_HEIGHT, borderColor: theme.border }]}>
          {/* Grid lines */}
          <View style={StyleSheet.absoluteFill}>
            {Array.from({ length: gridRows + 1 }).map((_, i) => (
              <View key={`h-${i}`} style={[styles.gridH, { top: `${(i / gridRows) * 100}%`, backgroundColor: theme.border, opacity: gridOpacity }]} />
            ))}
            {Array.from({ length: gridCols + 1 }).map((_, i) => (
              <View key={`v-${i}`} style={[styles.gridV, { left: `${(i / gridCols) * 100}%`, backgroundColor: theme.border, opacity: gridOpacity }]} />
            ))}
          </View>
          {/* Side wing areas */}
          {sideWingWidth > 0 && (
            <>
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: wingPct, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', zIndex: 1 }} />
              <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: wingPct, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', zIndex: 1 }} />
            </>
          )}
          {/* Dancers */}
          {dancers.map((d: any, i: number) => (
            <DancerNode
              key={d.id}
              index={i}
              dancer={d}
              timeline={timeline}
              scenes={scenes}
              currentTimeMs={currentTimeMs}
              stageWidth={STAGE_WIDTH}
              stageHeight={STAGE_HEIGHT}
              cellSize={STAGE_CELL_SIZE}
            />
          ))}
        </View>

        {!isCompact && (
          <View style={[styles.directionLabelBox, {
            bottom: -35,
            backgroundColor: stageDirection === 'bottom' ? 'rgba(255, 51, 102, 0.2)' : (theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
          }]}>
            <Text style={[styles.directionLabelText, { color: stageDirection === 'bottom' ? '#FF3366' : theme.textSecondary, fontSize: 10, fontWeight: '900' }]}>
              {stageDirection === 'bottom' ? '▲ FRONT (AUDIENCE)' : '▼ BACK'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageWrapper: { alignItems: 'center', justifyContent: 'center' },
  stage: { borderWidth: 1, overflow: 'hidden' },
  directionLabelBox: { position: 'absolute', paddingHorizontal: 15, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  directionLabelText: { fontSize: 9, fontWeight: 'bold', letterSpacing: 2 },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1 },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1 },
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
