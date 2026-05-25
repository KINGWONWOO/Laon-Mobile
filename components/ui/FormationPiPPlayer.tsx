import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Text } from 'react-native';
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

const L = (...a: any[]) => console.log('[PiP]', ...a);

const DRIFT_PLAY_S  = 0.5;
const DRIFT_SCRUB_S = 0.8;
const SEEK_COOLDOWN = 600;  // ms — seek 최소 간격
const SETTLE_MS     = 8000; // ms — seek 후 드리프트 보정 대기 시간 (large GOP 대응)

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
  const settleUntil  = useRef(0); // seek 후 이 시각까지 드리프트 보정 무시

  const player = useVideoPlayer({ uri: displayUrl }, p => {
    p.muted = true;
    p.loop  = false;
    p.timeUpdateEventInterval = 0.1;
  });

  useEffect(() => {
    let isMounted = true;
    const checkAndConvert = async () => {
      if (!videoUrl) return;
      
      const isLocal = videoUrl.startsWith('file://') || videoUrl.startsWith('/');
      if (isLocal) {
        L(`Checking local video for fMP4: ${videoUrl}`);
        setIsConverting(true);
        setConversionProgress(0);
        try {
          const finalUrl = await ensureStandardMP4(videoUrl, (ratio) => {
            if (isMounted) setConversionProgress(Math.floor(ratio * 100));
          });
          if (finalUrl !== videoUrl) {
            L(`Video converted to standard MP4: ${finalUrl}`);
          } else {
            L(`Video is already standard MP4 or skipped conversion.`);
          }
          if (isMounted) setDisplayUrl(finalUrl);
        } catch (e) {
          console.error('[PiP] Conversion error:', e);
          if (isMounted) setDisplayUrl(videoUrl);
        } finally {
          if (isMounted) setIsConverting(false);
        }
      } else {
        L(`Remote video detected, skipping conversion check.`);
        setDisplayUrl(videoUrl);
      }
    };

    checkAndConvert();
    return () => { isMounted = false; };
  }, [videoUrl]);

  useEffect(() => {
    if (!displayUrl) return;
    videoLoaded.current  = false;
    lastSeekedTo.current = 0;
    settleUntil.current  = 0;
    player.replace({ uri: displayUrl });
  }, [displayUrl, player]);

  const seekTo = useCallback((sec: number, reason: string) => {
    const now = Date.now();
    if (now - lastSeekAt.current < SEEK_COOLDOWN) { L(`cooldown [${reason}]`); return; }
    L(`seek → ${sec.toFixed(2)}s [${reason}]`);
    lastSeekAt.current   = now;
    lastSeekedTo.current = sec;
    settleUntil.current  = now + SETTLE_MS; // seek 후 1초 동안 드리프트 보정 차단
    player.currentTime   = sec;
  }, [player]);

  // 로드 완료 → 초기 시크
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && !videoLoaded.current) {
        videoLoaded.current = true;
        const targetSec = Math.max(0, currentTimeRef.current.value / 1000 + syncOffset);
        L(`readyToPlay → ${targetSec.toFixed(2)}s`);
        // SEEK_COOLDOWN 우회: 초기 seek는 강제 실행
        lastSeekAt.current   = 0;
        seekTo(targetSec, 'initial');
        if (isPlayingRef.current) player.play();
      }
    });
    return () => sub.remove();
  }, [player, syncOffset, seekTo]);

  // 드리프트 보정
  useEffect(() => {
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      if (!videoLoaded.current || !isPlayingRef.current) return;
      const settling = Date.now() < settleUntil.current;
      if (settling) {
        // seek 완료 조기 감지: currentTime이 목표 근처에 도달하면 settle 해제
        if (currentTime > 0.1 && Math.abs(currentTime - lastSeekedTo.current) < 0.5) {
          settleUntil.current = 0;
        }
        return;
      }
      // fMP4 seek 직후 currentTime=0 spurious 보고 방어
      if (currentTime < 0.5 && lastSeekedTo.current > 2) return;

      const targetSec = Math.max(0, currentTimeRef.current.value / 1000 + syncOffset);
      const drift = Math.abs(currentTime - targetSec);
      if (drift > DRIFT_PLAY_S) {
        L(`drift ${drift.toFixed(2)}s → ${targetSec.toFixed(2)}s`);
        seekTo(targetSec, 'drift');
      }
    });
    return () => sub.remove();
  }, [player, syncOffset, seekTo]);

  // 재생/정지 전환 + 스크럽 프리뷰
  useEffect(() => {
    const interval = setInterval(() => {
      if (!videoLoaded.current) return;

      const playing  = isPlayingRef.current;
      const stateChg = playing !== prevPlaying.current;
      if (stateChg) {
        prevPlaying.current = playing;
        const targetSec = Math.max(0, currentTimeRef.current.value / 1000 + syncOffset);
        if (playing) {
          lastSeekAt.current = 0; // play 전환 시 SEEK_COOLDOWN 우회
          seekTo(targetSec, 'play-transition');
          player.play();
        } else {
          player.pause();
        }
      }

      if (!playing) {
        const targetSec = Math.max(0, currentTimeRef.current.value / 1000 + syncOffset);
        if (Math.abs(targetSec - lastSeekedTo.current) > DRIFT_SCRUB_S) {
          seekTo(targetSec, 'scrub-preview');
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
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls={false}
          />
        </View>
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
