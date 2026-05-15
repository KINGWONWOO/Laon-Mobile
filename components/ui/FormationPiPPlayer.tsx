import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

const L = (...a: any[]) => console.log('[PiP]', ...a);

const DRIFT_PLAY_S  = 0.5;
const DRIFT_SCRUB_S = 0.8;
const SEEK_COOLDOWN = 300;
const SETTLE_MS     = 400;

interface Props {
  videoUrl: string;
  currentTimeMs: SharedValue<number>;
  isPlaying: boolean;           // plain boolean from useAudioPlayerStatus
  syncOffset?: number;
  onClose: () => void;
  initialX?: number;
  initialY?: number;
  initialScale?: number;
  onPositionChange?: (x: number, y: number, scale: number) => void;
}

export const FormationPiPPlayer = React.memo(({
  videoUrl,
  currentTimeMs,
  isPlaying,
  syncOffset = 0,
  onClose,
  initialX = WINDOW_WIDTH - 220,
  initialY = 100,
  initialScale = 1,
  onPositionChange,
}: Props) => {

  const videoRef = useRef<VideoRef>(null);

  // Stable source reference — changing this object resets the video to 0
  const source = useMemo(() => ({ uri: videoUrl }), [videoUrl]);

  // Use refs for values needed inside intervals/callbacks to avoid stale closures
  const isPlayingRef  = useRef(isPlaying);
  const currentTimeRef = useRef(currentTimeMs);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentTimeRef.current = currentTimeMs; }, [currentTimeMs]);

  // Seek state
  const isSeeking     = useRef(false);
  const lastSeekAt    = useRef(0);
  const settleUntil   = useRef(0);
  const lastSeekedTo  = useRef(0);
  const videoLoaded   = useRef(false);

  const seek = useCallback((sec: number, reason: string) => {
    const now = Date.now();
    if (isSeeking.current)              { L(`seek blocked(in-flight) [${reason}]`); return; }
    if (now - lastSeekAt.current < SEEK_COOLDOWN) { L(`seek cooldown [${reason}]`); return; }
    L(`seek → ${sec.toFixed(2)}s [${reason}]`);
    isSeeking.current   = true;
    lastSeekAt.current  = now;
    lastSeekedTo.current = sec;
    videoRef.current?.seek(sec);
  }, []);

  const onSeek = useCallback(() => {
    isSeeking.current   = false;
    settleUntil.current = Date.now() + SETTLE_MS;
    L('onSeek done');
  }, []);

  const onLoad = useCallback(() => {
    videoLoaded.current = true;
    const targetSec = Math.max(0, currentTimeRef.current.value / 1000 + syncOffset);
    L(`onLoad → seek ${targetSec.toFixed(2)}s  isPlaying=${isPlayingRef.current}`);
    seek(targetSec, 'initial');
  }, [syncOffset, seek]);

  const onError = useCallback((e: any) => {
    L('VIDEO ERROR:', JSON.stringify(e));
  }, []);

  // Sync loop: play-transition seek + scrub preview while paused
  const prevPlaying = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!videoLoaded.current) return;
      if (isSeeking.current)    return;
      if (Date.now() < settleUntil.current) return;

      const playing   = isPlayingRef.current;
      const targetSec = Math.max(0, currentTimeRef.current.value / 1000 + syncOffset);
      const stateChg  = playing !== prevPlaying.current;
      if (stateChg) prevPlaying.current = playing;

      if (playing) {
        if (stateChg) seek(targetSec, 'play-transition');
      } else {
        const scrubDrift = Math.abs(targetSec - lastSeekedTo.current);
        if (scrubDrift > DRIFT_SCRUB_S) seek(targetSec, 'scrub-preview');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [syncOffset, seek]);

  // Drift correction while playing (onProgress fires ~every 250ms)
  const onProgress = useCallback(({ currentTime }: { currentTime: number }) => {
    if (!isPlayingRef.current)        return;
    if (isSeeking.current)            return;
    if (Date.now() < settleUntil.current) return;

    const targetSec = Math.max(0, currentTimeRef.current.value / 1000 + syncOffset);
    const drift = Math.abs(currentTime - targetSec);
    if (drift > DRIFT_PLAY_S) {
      L(`drift ${drift.toFixed(2)}s → ${targetSec.toFixed(2)}s`);
      seek(targetSec, 'drift');
    }
  }, [syncOffset, seek]);

  // Controls
  const [minimized, setMinimized]       = useState(false);
  const [showControls, setShowControls] = useState(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleControls = useCallback(() => {
    setShowControls(p => !p);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); }, []);

  // Gestures
  const posX   = useSharedValue(initialX);
  const posY   = useSharedValue(initialY);
  const scaleV = useSharedValue(initialScale);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startS = useSharedValue(1);

  const drag = Gesture.Pan()
    .onStart(() => { 'worklet'; startX.value = posX.value; startY.value = posY.value; })
    .onUpdate(e => { 'worklet'; posX.value = startX.value + e.translationX; posY.value = startY.value + e.translationY; })
    .onEnd(() => { 'worklet'; if (onPositionChange) runOnJS(onPositionChange)(posX.value, posY.value, scaleV.value); });

  const pinch = Gesture.Pinch()
    .onStart(() => { 'worklet'; startS.value = scaleV.value; })
    .onUpdate(e => { 'worklet'; scaleV.value = Math.max(0.4, Math.min(3, startS.value * e.scale)); })
    .onEnd(() => { 'worklet'; if (onPositionChange) runOnJS(onPositionChange)(posX.value, posY.value, scaleV.value); });

  const tap = Gesture.Tap().onEnd(() => runOnJS(toggleControls)());

  const gesture = Gesture.Exclusive(Gesture.Simultaneous(drag, pinch), tap);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: posX.value }, { translateY: posY.value }, { scale: scaleV.value }],
  }));

  if (minimized) {
    return (
      <GestureDetector gesture={drag}>
        <Animated.View style={[styles.mini, aStyle]}>
          <TouchableOpacity onPress={() => setMinimized(false)} style={styles.fill}>
            <Ionicons name="videocam" size={20} color="white" />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, aStyle]}>
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Video
            ref={videoRef}
            source={source}
            style={styles.video}
            paused={!isPlaying}
            muted
            repeat={false}
            resizeMode="contain"
            onLoad={onLoad}
            onSeek={onSeek}
            onProgress={onProgress}
            onError={onError}
            progressUpdateInterval={250}
            ignoreSilentSwitch="ignore"
          />
        </View>
        {showControls && (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.topRow}>
              <TouchableOpacity onPress={onClose} style={styles.btn}>
                <Ionicons name="close" size={18} color="white" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMinimized(true)} style={styles.btn}>
                <Ionicons name="remove" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute', width: 200, height: 112.5,
    backgroundColor: '#000', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    elevation: 10, zIndex: 9999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 4.65,
  },
  video: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: 6, gap: 6 },
  btn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  mini: {
    position: 'absolute', width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#FF3366', justifyContent: 'center', alignItems: 'center',
    elevation: 8, zIndex: 9999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27, shadowRadius: 4.65,
  },
  fill: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
});
