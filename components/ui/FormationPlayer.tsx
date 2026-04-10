import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Formation } from '../../types';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

interface FormationPlayerProps {
  formation: Formation;
  currentTimeMs: number;
  onDurationDetected?: (duration: number) => void;
}

const DancerNode = ({ dancer, timeline, scenes, currentTimeMs, stageWidth, stageHeight, cellSize, index }: any) => {
  const pos = useSharedValue({ x: 0.5, y: 0.5 });

  // 개별 노드에서 위치 계산 및 업데이트
  useEffect(() => {
    if (!timeline || timeline.length === 0) return;

    const sorted = [...timeline].sort((a, b) => a.timestampMillis - b.timestampMillis);
    let prevE = null, nextE = null;
    for (let e of sorted) {
      if (e.timestampMillis <= currentTimeMs) prevE = e;
      else { nextE = e; break; }
    }

    const getScenePos = (sId: string) => scenes.find((s: any) => s.id === sId)?.positions[dancer.id] || { x: 0.5, y: 0.5 };
    
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
        <Text style={[styles.dancerInitial, { fontSize: cellSize * 0.3 }]}>{index + 1}</Text>
      </View>
      <Text style={styles.dancerNameText} numberOfLines={1}>{dancer.name}</Text>
    </Animated.View>
  );
};

export default function FormationPlayer({ formation, currentTimeMs, onDurationDetected }: FormationPlayerProps) {
  const dancers = formation?.data?.dancers || [];
  const scenes = formation?.data?.scenes || [];
  const timeline = formation?.data?.timeline || [];
  const gridRows = formation?.settings?.gridRows || 10;
  const gridCols = formation?.settings?.gridCols || 10;
  const stageDirection = formation?.settings?.stageDirection || 'top';

  const STAGE_CELL_SIZE = (WINDOW_WIDTH - 40) / (gridCols + 4);
  const STAGE_WIDTH = (gridCols + 4) * STAGE_CELL_SIZE;
  const STAGE_HEIGHT = gridRows * STAGE_CELL_SIZE;

  useEffect(() => {
    if (timeline && timeline.length > 0) {
      const sortedTimeline = [...timeline].sort((a, b) => (b.timestampMillis + b.durationMillis) - (a.timestampMillis + a.durationMillis));
      const lastEntry = sortedTimeline[0];
      const duration = (lastEntry.timestampMillis + lastEntry.durationMillis) / 1000;
      if (onDurationDetected) onDurationDetected(duration);
    }
  }, [timeline]);

  if (!formation) return null;

  return (
    <View style={styles.container}>
      <View style={styles.stageWrapper}>
        <View style={[styles.directionLabelBox, { top: -35 }]}>
          <Text style={styles.directionLabelText}>
            {stageDirection === 'top' ? 'AUDIENCE (FRONT)' : 'BACKSTAGE'}
          </Text>
        </View>

        <View style={[styles.stage, { width: STAGE_WIDTH, height: STAGE_HEIGHT }]}>
          <View style={[styles.offStageArea, { left: 0, width: STAGE_CELL_SIZE * 2 }]} />
          <View style={[styles.offStageArea, { right: 0, width: STAGE_CELL_SIZE * 2 }]} />
          <View style={styles.gridLayer}>
            {Array.from({ length: gridRows + 1 }).map((_, i) => <View key={i} style={[styles.gridH, { top: `${(i / gridRows) * 100}%` }]} />)}
            {Array.from({ length: gridCols + 5 }).map((_, i) => <View key={i} style={[styles.gridV, { left: `${(i / (gridCols + 4)) * 100}%` }]} />)}
          </View>
          {dancers.map((d, i) => (
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

        <View style={[styles.directionLabelBox, { bottom: -35 }]}>
          <Text style={styles.directionLabelText}>
            {stageDirection === 'top' ? 'BACKSTAGE' : 'AUDIENCE (FRONT)'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  stageWrapper: { alignItems: 'center', justifyContent: 'center' },
  stage: { backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#333', overflow: 'hidden' },
  directionLabelBox: { position: 'absolute', paddingHorizontal: 15, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  directionLabelText: { color: '#666', fontSize: 9, fontWeight: 'bold', letterSpacing: 2 },
  offStageArea: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.05)', zIndex: 1 },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  dancerNode: { position: 'absolute', alignItems: 'center' },
  dancerCircle: { justifyContent: 'center', alignItems: 'center' },
  dancerInitial: { color: '#FFF', fontWeight: 'bold' },
  dancerNameText: { color: '#AAA', marginTop: 4, fontSize: 8 }
});
