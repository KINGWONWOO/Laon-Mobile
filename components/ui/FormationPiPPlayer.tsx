import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { ensureStandardMP4 } from '../../utils/convertMP4';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

interface Props {
  videoUrl: string;
  currentTimeMs: SharedValue<number>;
  isPlaying: boolean;
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
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const readyRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  const syncOffsetRef = useRef(syncOffset);
  const currentTimeMsRef = useRef(currentTimeMs);
  const seekCooldownRef = useRef(0);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { syncOffsetRef.current = syncOffset; }, [syncOffset]);
  useEffect(() => { currentTimeMsRef.current = currentTimeMs; }, [currentTimeMs]);

  const player = useVideoPlayer('', p => {
    p.muted = true;
    p.loop = true;
  });

  // Load video — convert if local file, then replace player source
  useEffect(() => {
    if (!videoUrl) return;
    let cancelled = false;
    readyRef.current = false;

    async function load() {
      const isLocal = videoUrl.startsWith('file://') || videoUrl.startsWith('/');
      let uri = videoUrl;

      if (isLocal) {
        setConverting(true);
        setConvertProgress(0);
        try {
          uri = await ensureStandardMP4(videoUrl, ratio => {
            if (!cancelled) setConvertProgress(Math.round(ratio * 100));
          });
        } catch {
          // fall back to original on error
        }
        if (!cancelled) setConverting(false);
      }

      if (!cancelled) {
        player.replace({ uri });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [videoUrl, player]);

  // On readyToPlay: seek to current position and start if playing
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status !== 'readyToPlay' || readyRef.current) return;
      readyRef.current = true;

      const targetSec = Math.max(0, currentTimeMsRef.current.value / 1000 + syncOffsetRef.current);
      player.currentTime = targetSec;
      seekCooldownRef.current = Date.now() + 600;

      if (isPlayingRef.current) player.play();
    });
    return () => sub.remove();
  }, [player]);

  // Sync loop: keep PiP frame in sync with main timeline
  useEffect(() => {
    const DRIFT_S = 0.5;
    let prevPlaying = false;
    let scrubTick = 0;

    const interval = setInterval(() => {
      if (!readyRef.current) return;

      const now = Date.now();
      const playing = isPlayingRef.current;
      const targetSec = currentTimeMsRef.current.value / 1000 + syncOffsetRef.current;
      const clamped = Math.max(0, targetSec);

      // Play/pause state changed
      if (playing !== prevPlaying) {
        prevPlaying = playing;
        if (!playing) {
          player.pause();
        } else {
          player.currentTime = clamped;
          seekCooldownRef.current = now + 600;
          player.play();
        }
        return;
      }

      if (!playing) {
        // Scrub preview every 3 ticks to reduce JS load
        scrubTick = (scrubTick + 1) % 3;
        if (scrubTick === 0 && Math.abs(player.currentTime - clamped) > 0.15) {
          player.currentTime = clamped;
        }
        return;
      }

      // Ensure playback is running
      if (!player.playing) {
        player.currentTime = clamped;
        seekCooldownRef.current = now + 600;
        player.play();
        return;
      }

      // Drift correction
      if (now > seekCooldownRef.current && Math.abs(player.currentTime - targetSec) > DRIFT_S) {
        player.currentTime = clamped;
        seekCooldownRef.current = now + 600;
      }
    }, 100);

    return () => clearInterval(interval);
  }, [player]);

  const toggleControls = useCallback(() => {
    setShowControls(p => !p);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); }, []);

  // Drag + pinch gestures
  const posX = useSharedValue(initialX);
  const posY = useSharedValue(initialY);
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
    <GestureDetector gesture={Gesture.Simultaneous(drag, pinch)}>
      <Animated.View style={[styles.container, aStyle]}>
        <GestureDetector gesture={tap}>
          <View style={StyleSheet.absoluteFillObject}>
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls={false}
            />
          </View>
        </GestureDetector>
        {converting && (
          <View style={[styles.overlay, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="small" color="white" />
            <Text style={{ color: 'white', fontSize: 10, marginTop: 4, fontWeight: 'bold' }}>
              {convertProgress}%
            </Text>
          </View>
        )}
        {showControls && !converting && (
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
