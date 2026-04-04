import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Modal, Alert, ScrollView } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { Dancer, Keyframe, Position, Formation } from '../../../../types';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, useDerivedValue, SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const STAGE_WIDTH = width - 40;
const STAGE_HEIGHT = STAGE_WIDTH * 0.8;

// 댄서 컴포넌트 (Draggable + Interpolated Position)
const DancerNode = ({ 
  dancer, 
  currentTimeMs, 
  keyframes, 
  onDragEnd, 
  isSelected,
  onPress
}: { 
  dancer: Dancer; 
  currentTimeMs: SharedValue<number>; 
  keyframes: Keyframe[]; 
  onDragEnd: (id: string, pos: Position) => void;
  isSelected: boolean;
  onPress: () => void;
}) => {
  const isDragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // 현재 시간(currentTimeMs)에 따른 보간된 X, Y 계산
  const interpolatedX = useDerivedValue(() => {
    if (isDragging.value) return dragX.value;
    if (keyframes.length === 0) return STAGE_WIDTH / 2;
    if (keyframes.length === 1) return keyframes[0].positions[dancer.id]?.x ?? STAGE_WIDTH / 2;

    const time = currentTimeMs.value;
    // Find surrounding keyframes
    let prev = keyframes[0];
    let next = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length; i++) {
      if (keyframes[i].timestampMillis <= time) prev = keyframes[i];
      if (keyframes[i].timestampMillis > time) {
        next = keyframes[i];
        break;
      }
    }

    if (prev.id === next.id || time >= next.timestampMillis) return prev.positions[dancer.id]?.x ?? STAGE_WIDTH/2;
    
    const progress = (time - prev.timestampMillis) / (next.timestampMillis - prev.timestampMillis);
    const startXVal = prev.positions[dancer.id]?.x ?? STAGE_WIDTH/2;
    const endXVal = next.positions[dancer.id]?.x ?? STAGE_WIDTH/2;
    
    return startXVal + (endXVal - startXVal) * progress;
  });

  const interpolatedY = useDerivedValue(() => {
    if (isDragging.value) return dragY.value;
    if (keyframes.length === 0) return STAGE_HEIGHT / 2;
    if (keyframes.length === 1) return keyframes[0].positions[dancer.id]?.y ?? STAGE_HEIGHT / 2;

    const time = currentTimeMs.value;
    let prev = keyframes[0];
    let next = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length; i++) {
      if (keyframes[i].timestampMillis <= time) prev = keyframes[i];
      if (keyframes[i].timestampMillis > time) {
        next = keyframes[i];
        break;
      }
    }

    if (prev.id === next.id || time >= next.timestampMillis) return prev.positions[dancer.id]?.y ?? STAGE_HEIGHT/2;
    
    const progress = (time - prev.timestampMillis) / (next.timestampMillis - prev.timestampMillis);
    const startYVal = prev.positions[dancer.id]?.y ?? STAGE_HEIGHT/2;
    const endYVal = next.positions[dancer.id]?.y ?? STAGE_HEIGHT/2;
    
    return startYVal + (endYVal - startYVal) * progress;
  });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      dragX.value = interpolatedX.value;
      dragY.value = interpolatedY.value;
      startX.value = interpolatedX.value;
      startY.value = interpolatedY.value;
    })
    .onUpdate((e) => {
      let nx = startX.value + e.translationX;
      let ny = startY.value + e.translationY;
      // Clamp to stage
      nx = Math.max(15, Math.min(STAGE_WIDTH - 15, nx));
      ny = Math.max(15, Math.min(STAGE_HEIGHT - 15, ny));
      dragX.value = nx;
      dragY.value = ny;
    })
    .onEnd(() => {
      isDragging.value = false;
      runOnJS(onDragEnd)(dancer.id, { x: dragX.value, y: dragY.value });
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onPress)();
  });

  const composed = Gesture.Exclusive(panGesture, tapGesture);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolatedX.value - 15 },
      { translateY: interpolatedY.value - 15 },
      { scale: isDragging.value ? 1.2 : 1 }
    ],
    zIndex: isSelected || isDragging.value ? 100 : 1
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.dancerNode, { backgroundColor: dancer.color, borderColor: isSelected ? '#FFF' : '#000', borderWidth: isSelected ? 3 : 1 }, style]}>
        <Text style={styles.dancerInitial}>{dancer.name[0]}</Text>
      </Animated.View>
    </GestureDetector>
  );
};

export default function FormationEditorScreen() {
  const { id, formationId } = useGlobalSearchParams<{ id: string, formationId: string }>();
  const { formations, updateFormation, theme } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const formation = formations.find(f => f.id === formationId);

  const [dancers, setDancers] = useState<Dancer[]>(formation?.data?.dancers || []);
  const [keyframes, setKeyframes] = useState<Keyframe[]>(formation?.data?.keyframes || [{ id: 'init', timestampMillis: 0, positions: {} }]);
  
  const currentTimeMs = useSharedValue(0);
  const [currentTimeUI, setCurrentTimeUI] = useState(0); // For display
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(null);

  const [showAddDancer, setShowAddDancer] = useState(false);
  const [newDancerName, setNewDancerName] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  if (!formation) {
    return <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}><Text style={{color: theme.text}}>동선을 찾을 수 없습니다.</Text></View>;
  }

  // Sync reanimated value to local state for UI updates
  useDerivedValue(() => {
    runOnJS(setCurrentTimeUI)(currentTimeMs.value);
  });

  const togglePlay = () => {
    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      timerRef.current = setInterval(() => {
        currentTimeMs.value += 100; // 100ms interval
        if (currentTimeMs.value > 60000) { // Stop at 60s for now
          clearInterval(timerRef.current!);
          setIsPlaying(false);
        }
      }, 100);
    }
  };

  const handleDragEnd = (dancerId: string, pos: Position) => {
    // 현재 시간에 가장 가까운 이전 키프레임을 찾거나, 없으면 새로 만듭니다.
    // 여기서는 단순화를 위해 현재 시간을 가장 가까운 1초 단위로 맞추어 키프레임을 강제로 생성/수정합니다.
    const timeRounded = Math.floor(currentTimeMs.value / 1000) * 1000;
    
    setKeyframes(prev => {
      let newKf = [...prev];
      let existingIndex = newKf.findIndex(k => k.timestampMillis === timeRounded);
      
      if (existingIndex >= 0) {
        newKf[existingIndex] = {
          ...newKf[existingIndex],
          positions: { ...newKf[existingIndex].positions, [dancerId]: pos }
        };
      } else {
        // 복제할 이전 키프레임 찾기
        let prevKf = newKf.filter(k => k.timestampMillis < timeRounded).pop() || newKf[0];
        newKf.push({
          id: Date.now().toString(),
          timestampMillis: timeRounded,
          positions: { ...prevKf.positions, [dancerId]: pos }
        });
        newKf.sort((a, b) => a.timestampMillis - b.timestampMillis);
      }
      return newKf;
    });
  };

  const addDancer = () => {
    if (!newDancerName.trim()) return;
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7D794', '#A06CD5', '#FF9F43'];
    const newDancer: Dancer = {
      id: Date.now().toString(),
      name: newDancerName.trim(),
      color: colors[dancers.length % colors.length]
    };
    
    setDancers([...dancers, newDancer]);
    
    // 첫 키프레임 중앙에 배치
    setKeyframes(prev => {
      const newKf = [...prev];
      if (newKf.length > 0) {
        newKf[0] = {
          ...newKf[0],
          positions: { ...newKf[0].positions, [newDancer.id]: { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 } }
        };
      }
      return newKf;
    });

    setNewDancerName('');
    setShowAddDancer(false);
  };

  const saveFormation = async () => {
    try {
      await updateFormation(formationId, {
        data: { dancers, keyframes }
      });
      Alert.alert('저장 성공', '동선이 방에 공유되었습니다.');
    } catch (e: any) {
      Alert.alert('오류', e.message);
    }
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{formation.title}</Text>
        <TouchableOpacity onPress={saveFormation} style={styles.saveBtn}>
          <Text style={{ color: theme.primary, fontWeight: 'bold' }}>저장</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stageWrapper}>
        <View style={[styles.stage, { borderColor: theme.border }]}>
          {/* 그리드 그리기 */}
          <View style={styles.gridOverlay}>
            {Array.from({length: 10}).map((_, i) => <View key={`v-${i}`} style={[styles.gridV, { left: `${(i+1)*10}%`, borderColor: theme.border + '33' }]} />)}
            {Array.from({length: 8}).map((_, i) => <View key={`h-${i}`} style={[styles.gridH, { top: `${(i+1)*12.5}%`, borderColor: theme.border + '33' }]} />)}
          </View>
          <View style={[styles.frontLabel, { backgroundColor: theme.primary + '22' }]}>
            <Text style={{ color: theme.primary, fontSize: 10, fontWeight: 'bold' }}>FRONT</Text>
          </View>

          {/* 댄서 렌더링 */}
          {dancers.map(d => (
            <DancerNode 
              key={d.id} 
              dancer={d} 
              currentTimeMs={currentTimeMs} 
              keyframes={keyframes} 
              onDragEnd={handleDragEnd}
              isSelected={selectedDancerId === d.id}
              onPress={() => setSelectedDancerId(d.id)}
            />
          ))}
        </View>
      </View>

      {/* 타임라인 & 컨트롤 */}
      <View style={[styles.bottomPanel, { backgroundColor: theme.card, paddingBottom: insets.bottom + 20, borderTopColor: theme.border }]}>
        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, { backgroundColor: theme.primary }]}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={24} color={theme.background} />
          </TouchableOpacity>
          <View style={styles.timeInfo}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: 'bold' }}>{formatTime(currentTimeUI)}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>/ 1:00</Text>
          </View>
        </View>

        {/* 심플 타임라인 */}
        <View style={styles.timelineScrubber}>
          <View style={[styles.timelineTrack, { backgroundColor: theme.border }]} />
          <View style={[styles.timelineFill, { backgroundColor: theme.primary, width: `${(currentTimeUI / 60000) * 100}%` }]} />
          <View style={[styles.timelineThumb, { backgroundColor: theme.primary, left: `${(currentTimeUI / 60000) * 100}%` }]} />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => setShowAddDancer(true)}
          >
            <Ionicons name="person-add" size={18} color={theme.text} />
            <Text style={{ color: theme.text, marginLeft: 8 }}>인원 추가 ({dancers.length}명)</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => {
              if (selectedDancerId) {
                setDancers(dancers.filter(d => d.id !== selectedDancerId));
                setSelectedDancerId(null);
              } else {
                Alert.alert('알림', '무대에서 삭제할 인원을 터치해 선택해주세요.');
              }
            }}
          >
            <Ionicons name="trash" size={18} color={theme.error} />
            <Text style={{ color: theme.error, marginLeft: 8 }}>선택 삭제</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 인원 추가 모달 */}
      <Modal visible={showAddDancer} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>댄서 추가</Text>
            <TextInput 
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="이름 (예: 지성)"
              placeholderTextColor="#888"
              value={newDancerName}
              onChangeText={setNewDancerName}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity onPress={() => setShowAddDancer(false)} style={{ padding: 15 }}>
                <Text style={{ color: theme.textSecondary }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addDancer} style={{ padding: 15 }}>
                <Text style={{ color: theme.primary, fontWeight: 'bold' }}>추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  saveBtn: { padding: 10 },
  
  stageWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, borderWidth: 2, borderRadius: 10, overflow: 'hidden', backgroundColor: '#111' },
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridV: { position: 'absolute', top: 0, bottom: 0, borderLeftWidth: 1 },
  gridH: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1 },
  frontLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 25, justifyContent: 'center', alignItems: 'center' },

  dancerNode: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', position: 'absolute' },
  dancerInitial: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },

  bottomPanel: { padding: 20, borderTopWidth: 1 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  playBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  timeInfo: { flexDirection: 'row', alignItems: 'baseline' },

  timelineScrubber: { height: 30, justifyContent: 'center', marginBottom: 20 },
  timelineTrack: { height: 6, borderRadius: 3, width: '100%' },
  timelineFill: { height: 6, borderRadius: 3, position: 'absolute', left: 0 },
  timelineThumb: { width: 16, height: 16, borderRadius: 8, position: 'absolute', top: 7, marginLeft: -8 },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginHorizontal: 5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 25, borderRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  input: { borderWidth: 1, padding: 15, borderRadius: 10, fontSize: 16 },
});
