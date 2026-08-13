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

const DRIFT_PLAY_S  = 0.5;
const DRIFT_SCRUB_S = 0.15;
const SEEK_COOLDOWN = 300;
const SETTLE_MS     = 2000;

interface Props {
  videoUrl: string;
  currentTimeMs: SharedValue<number>;
  isPlaying: boolean;
  syncOffset?: number;
  skipConversion?: boolean;
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
  skipConversion = false,
  onClose,
  initialX = WINDOW_WIDTH - 220,
  initialY = 100,
  initialScale = 1,
  onPositionChange,
}: Props) => {

  const [displayUrl, setDisplayUrl] = useState(videoUrl);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);

  const isPlayingRef   = useRef(isPlaying);
  const currentTimeRef = useRef(currentTimeMs);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentTimeRef.current = currentTimeMs; }, [currentTimeMs]);

  const videoLoaded  = useRef(false);
  const prevPlaying  = useRef(false);
  const lastSeekedTo = useRef(0);
  const lastSeekAt   = useRef(0);
  const settleUntil  = useRef(0);
  const scrubTickRef = useRef(0);

  const player = useVideoPlayer('', p => {
    p.muted = true;
    p.loop  = true;
    p.timeUpdateEventInterval = 0.5;
  });

  useEffect(() => {
    let isMounted = true;
    const checkAndConvert = async () => {
      if (!videoUrl) return;

      const isLocal = videoUrl.startsWith('file://') || videoUrl.startsWith('/');
      if (isLocal && !skipConversion) {
        console.log('[PiP] Checking local video for fMP4:', videoUrl);
        setIsConverting(true);
        setConversionProgress(0);
        try {
          const finalUrl = await ensureStandardMP4(videoUrl, (ratio) => {
            if (isMounted) setConversionProgress(Math.floor(ratio * 100));
          });
          if (isMounted) setDisplayUrl(finalUrl);
        } catch (e) {
          console.error('[PiP] Conversion error:', e);
          if (isMounted) setDisplayUrl(videoUrl);
        } finally {
          if (isMounted) setIsConverting(false);
        }
      } else {
        console.log(`[PiP] Skipping conversion (skipConversion=${skipConversion} or remote).`);
        setDisplayUrl(videoUrl);
      }
    };

    checkAndConvert();
    return () => { isMounted = false; };
  }, [videoUrl, skipConversion]);

  useEffect(() => {
    if (!displayUrl) return;
    videoLoaded.current  = false;
    lastSeekedTo.current = 0;
    settleUntil.current  = 0;
    player.replace({ uri: displayUrl });
  }, [displayUrl, player]);

  const seekTo = useCallback((sec: number) => {
    const now = Date.now();
    if (now - lastSeekAt.current < SEEK_COOLDOWN) return;
    lastSeekAt.current   = now;
    lastSeekedTo.current = sec;
    settleUntil.current  = now + SETTLE_MS;
    player.currentTime   = sec;
  }, [player]);

  // 로드 완료 → 초기 시크
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && !videoLoaded.current) {
        videoLoaded.current = true;
        const targetSec = Math.max(0, currentTimeRef.current.value / 1000 + syncOffset);
        lastSeekAt.current = 0;
        seekTo(targetSec);
        if (isPlayingRef.current) player.play();
      }
    });
    return () => sub.remove();
  }, [player, syncOffset, seekTo]);

  // 드리프트 보정 (재생 중에만)
  useEffect(() => {
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      if (!videoLoaded.current || !isPlayingRef.current) return;
      const settling = Date.now() < settleUntil.current;
      if (settling) {
        if (currentTime > 0.1 && Math.abs(currentTime - lastSeekedTo.current) < 0.5) {
          settleUntil.current = 0;
        }
        return;
      }

      const effectiveSec = currentTimeRef.current.value / 1000 + syncOffset;
      if (effectiveSec < 0) {
        if (player.playing) player.pause();
        if (lastSeekedTo.current !== 0) { lastSeekAt.current = 0; seekTo(0); }
        return;
      }

      if (currentTime < 0.5 && lastSeekedTo.current > 2) return;

      const drift = Math.abs(currentTime - effectiveSec);
      if (drift > DRIFT_PLAY_S) seekTo(effectiveSec);
    });
    return () => sub.remove();
  }, [player, syncOffset, seekTo]);

  // 싱크 오프셋 변경 시 즉시 반영
  useEffect(() => {
    if (!videoLoaded.current || isPlayingRef.current) return;
    const targetSec = Math.max(0, currentTimeRef.current.value / 1000 + syncOffset);
    seekTo(targetSec);
  }, [syncOffset, seekTo]);

  // 재생/정지 전환 + 스크럽 프리뷰 (편집 중 JS 부하 최소화)
  useEffect(() => {
    const interval = setInterval(() => {
      // Fallback: catch readyToPlay if statusChange missed it
      if (!videoLoaded.current) {
        try {
          if ((player as any).duration > 0) {
            videoLoaded.current = true;
            const targetSec = Math.max(0, currentTimeRef.current.value / 1000 + syncOffset);
            lastSeekAt.current = 0;
            seekTo(targetSec);
            if (isPlayingRef.current) player.play();
          }
        } catch (_) {}
        return;
      }

      const playing      = isPlayingRef.current;
      const effectiveSec = currentTimeRef.current.value / 1000 + syncOffset;
      const stateChg     = playing !== prevPlaying.current;

      if (stateChg) {
        prevPlaying.current = playing;
        scrubTickRef.current = 0;
        if (!playing) {
          player.pause();
        } else if (effectiveSec < 0) {
          player.pause();
          if (lastSeekedTo.current !== 0) { lastSeekAt.current = 0; seekTo(0); }
        } else {
          lastSeekAt.current = 0;
          seekTo(effectiveSec);
          player.play();
        }
      }

      if (playing && effectiveSec >= 0 && !player.playing) {
        lastSeekAt.current = 0;
        seekTo(effectiveSec);
        player.play();
      }

      if (playing && effectiveSec < 0) {
        if (player.playing) player.pause();
      }

      // 정지 중 스크럽 프리뷰: 3틱(~300ms)마다 한 번만 seek하여 편집 중 JS 부하 감소
      if (!playing) {
        scrubTickRef.current = (scrubTickRef.current + 1) % 3;
        if (scrubTickRef.current === 0) {
          const targetSec = Math.max(0, effectiveSec);
          if (Math.abs(targetSec - lastSeekedTo.current) > DRIFT_SCRUB_S) {
            seekTo(targetSec);
          }
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [player, syncOffset, seekTo]);

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
        {isConverting && (
          <View style={[styles.overlay, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="small" color="white" />
            <Text style={{ color: 'white', fontSize: 10, marginTop: 4, fontWeight: 'bold' }}>
              {conversionProgress}%
            </Text>
          </View>
        )}
        {showControls && !isConverting && (
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
