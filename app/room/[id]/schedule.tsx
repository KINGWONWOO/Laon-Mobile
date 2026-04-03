import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, ScrollView, RefreshControl, Image, Dimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { schedules, addSchedule, respondToSchedule, deleteSchedule, theme, currentUser, refreshAllData, rooms, getUserById } = useAppContext();
  const insets = useSafeAreaInsets();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // 생성 관련 상태
  const [title, setTitle] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [startTime, setStartTime] = useState(14); // 2 PM
  const [endTime, setEndTime] = useState(18);   // 6 PM

  const roomSchedules = useMemo(() => schedules.filter(s => s.roomId === id), [schedules, id]);
  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  const toggleDate = (date: Date) => {
    const exists = selectedDates.find(d => d.toDateString() === date.toDateString());
    if (exists) {
      setSelectedDates(selectedDates.filter(d => d.toDateString() !== date.toDateString()));
    } else {
      setSelectedDates([...selectedDates, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const handleAddSchedule = async () => {
    if (!title.trim()) {
      Alert.alert('오류', '제목을 입력해주세요.');
      return;
    }
    if (selectedDates.length === 0) {
      Alert.alert('오류', '최소 하룻 이상의 날짜를 선택해주세요.');
      return;
    }
    if (startTime >= endTime) {
      Alert.alert('오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    const opts: string[] = [];
    selectedDates.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      for (let h = startTime; h < endTime; h++) {
        opts.push(`${dateStr} ${h.toString().padStart(2, '0')}:00`);
      }
    });

    try {
      await addSchedule(id || '', title, opts);
      setShowAddModal(false);
      setTitle('');
      setSelectedDates([]);
      setTimeout(() => refreshAllData(), 500);
    } catch (e: any) { Alert.alert('오류', e.message); }
  };

  const handleDeleteSchedule = (sid: string) => {
    Alert.alert('일정 삭제', '이 일정을 정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteSchedule(sid) }
    ]);
  };

  const renderScheduleCard = ({ item: schedule }: { item: any }) => {
    const participants = Object.keys(schedule.responses);
    const nonParticipants = (currentRoom?.members || []).filter(mId => !participants.includes(mId));
    const isOwner = schedule.userId === currentUser?.id || (currentRoom as any)?.leader_id === currentUser?.id;

    // 데이터 가공: 날짜별/시간별 매트릭스 생성
    const uniqueDates = Array.from(new Set(schedule.options.map((o: any) => o.dateTime.split(' ')[0]))).sort();
    const hours = Array.from(new Set(schedule.options.map((o: any) => parseInt(o.dateTime.split(' ')[1].split(':')[0])))).sort((a: any, b: any) => a - b);

    const getHeatmapColor = (votes: number) => {
      if (votes === 0) return 'transparent';
      const opacity = Math.min(0.2 + (votes / Math.max(participants.length, 1)) * 0.8, 1);
      return theme.primary + Math.floor(opacity * 255).toString(16).padStart(2, '0');
    };

    const getRankedSlots = () => {
      const counts = schedule.options.map((opt: any) => {
        const voters = Object.entries(schedule.responses)
          .filter(([_, ids]: any) => ids.includes(opt.id))
          .map(([uId]) => uId);
        return { ...opt, votes: voters.length };
      });
      return counts.sort((a: any, b: any) => b.votes - a.votes);
    };

    const ranked = getRankedSlots();

    return (
      <View style={[styles.scheduleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.scheduleHeader}>
          <Text style={[styles.scheduleTitle, { color: theme.text, flex: 1 }]}>{schedule.title}</Text>
          {isOwner && (
            <TouchableOpacity onPress={() => handleDeleteSchedule(schedule.id)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={22} color={theme.error} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matrixContainer}>
          <View>
            {/* 헤더: 날짜 */}
            <View style={styles.matrixRow}>
              <View style={styles.timeLabelCell} />
              {uniqueDates.map(date => {
                const d = new Date(date as string);
                return (
                  <View key={date as string} style={styles.dateHeaderCell}>
                    <Text style={[styles.dateHeaderText, { color: theme.textSecondary }]}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text>
                    <Text style={[styles.dateHeaderDay, { color: theme.text }]}>{d.getDate()}</Text>
                  </View>
                );
              })}
            </View>

            {/* 본문: 시간 그리드 */}
            {hours.map(hour => (
              <View key={hour as number} style={styles.matrixRow}>
                <View style={styles.timeLabelCell}>
                  <Text style={[styles.timeLabelText, { color: theme.textSecondary }]}>{hour}:00</Text>
                </View>
                {uniqueDates.map(date => {
                  const dateTimeStr = `${date} ${hour.toString().padStart(2, '0')}:00`;
                  const opt = schedule.options.find((o: any) => o.dateTime === dateTimeStr);
                  if (!opt) return <View key={date as string} style={styles.gridCellEmpty} />;

                  const voters = Object.entries(schedule.responses)
                    .filter(([_, ids]: any) => ids.includes(opt.id))
                    .map(([uId]) => uId);
                  
                  const isSelected = (schedule.responses[currentUser?.id || ''] || []).includes(opt.id);

                  return (
                    <TouchableOpacity
                      key={date as string}
                      style={[styles.gridCell, { 
                        backgroundColor: getHeatmapColor(voters.length),
                        borderColor: isSelected ? theme.primary : theme.border + '44'
                      }]}
                      onPress={() => {
                        const currentRes = schedule.responses[currentUser?.id || ''] || [];
                        const nextRes = isSelected ? currentRes.filter((r:string) => r !== opt.id) : [...currentRes, opt.id];
                        respondToSchedule(schedule.id, nextRes);
                      }}
                    >
                      {isSelected && <Ionicons name="checkmark" size={12} color={theme.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.summaryRow}>
          <View style={[styles.rankingBox, { backgroundColor: theme.background + '88' }]}>
            <Text style={[styles.rankingTitle, { color: theme.primary }]}>Best Times</Text>
            {ranked.slice(0, 3).map((r: any, idx: number) => (
              <Text key={r.id} style={[styles.rankingItemText, { color: theme.text }]}>
                {idx+1}. {r.dateTime.split(' ')[0].slice(5)} {parseInt(r.dateTime.split(' ')[1])}시 ({r.votes}명)
              </Text>
            ))}
          </View>
          
          <View style={styles.voterSummary}>
            <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>참여({participants.length})</Text>
            <Text style={[styles.voterNames, { color: theme.textSecondary }]} numberOfLines={1}>
              {participants.map(vId => getUserById(vId)?.name).join(', ')}
            </Text>
            <Text style={[styles.footerLabel, { color: theme.error, marginTop: 4 }]}>미참여({nonParticipants.length})</Text>
            <Text style={[styles.voterNames, { color: theme.error }]} numberOfLines={1}>
              {nonParticipants.map(vId => getUserById(vId)?.name).join(', ')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 50 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>일정 투표</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>가능한 시간을 드래그/클릭 해주세요!</Text>
        </View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={24} color={theme.background} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={roomSchedules}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        renderItem={renderScheduleCard}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>진행 중인 일정이 없습니다.</Text>}
      />

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>새 일정 투표 만들기</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>제목</Text>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} placeholder="예: 정기 연습 일정" placeholderTextColor="#888" value={title} onChangeText={setTitle} />

              <Text style={[styles.label, { color: theme.textSecondary }]}>날짜 선택 (여러 날짜 선택 가능)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datePicker}>
                {Array.from({length: 31}).map((_, day) => {
                  const d = new Date();
                  d.setDate(d.getDate() + day);
                  const isSelected = !!selectedDates.find(sd => sd.toDateString() === d.toDateString());
                  return (
                    <TouchableOpacity 
                      key={day} 
                      style={[styles.dateItem, { backgroundColor: isSelected ? theme.primary : 'transparent', borderColor: theme.border }]}
                      onPress={() => toggleDate(d)}
                    >
                      <Text style={[styles.dateWeek, { color: isSelected ? theme.background : theme.textSecondary }]}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text>
                      <Text style={[styles.dateDay, { color: isSelected ? theme.background : theme.text }]}>{d.getDate()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.label, { color: theme.textSecondary }]}>시간 범위 설정 ({startTime}:00 ~ {endTime}:00)</Text>
              <View style={styles.timeSelectRow}>
                <View style={styles.timeCol}>
                  <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>시작</Text>
                  <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                    {Array.from({length: 24}).map((_, i) => (
                      <TouchableOpacity key={i} onPress={() => setStartTime(i)} style={[styles.timeItem, startTime === i && { backgroundColor: theme.primary + '33' }]}>
                        <Text style={{ color: startTime === i ? theme.primary : theme.text }}>{i}시</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <Ionicons name="arrow-forward" size={20} color={theme.textSecondary} style={{marginTop: 50}} />
                <View style={styles.timeCol}>
                  <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>종료</Text>
                  <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                    {Array.from({length: 25}).map((_, i) => (
                      <TouchableOpacity key={i} onPress={() => setEndTime(i)} style={[styles.timeItem, endTime === i && { backgroundColor: theme.primary + '33' }]}>
                        <Text style={{ color: endTime === i ? theme.primary : theme.text }}>{i}시</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <TouchableOpacity onPress={handleAddSchedule} style={[styles.saveBtn, { backgroundColor: theme.primary }]}><Text style={[styles.saveBtnText, { color: theme.background }]}>투표 등록하기</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  headerTitle: { fontSize: 26, fontWeight: 'bold' },
  headerSub: { fontSize: 13, marginTop: 4 },
  addButton: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  scheduleCard: { borderRadius: 24, padding: 15, marginBottom: 20, borderWidth: 1 },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  scheduleTitle: { fontSize: 18, fontWeight: 'bold' },
  deleteBtn: { padding: 4, marginLeft: 10 },
  matrixContainer: { marginBottom: 15 },
  matrixRow: { flexDirection: 'row', alignItems: 'center' },
  timeLabelCell: { width: 45, alignItems: 'center', justifyContent: 'center', height: 35 },
  timeLabelText: { fontSize: 10, fontWeight: '600' },
  dateHeaderCell: { width: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  dateHeaderText: { fontSize: 10, fontWeight: '600' },
  dateHeaderDay: { fontSize: 14, fontWeight: 'bold' },
  gridCell: { width: 45, height: 35, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  gridCellEmpty: { width: 45, height: 35 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  rankingBox: { flex: 1, padding: 10, borderRadius: 12, marginRight: 10 },
  rankingTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  rankingItemText: { fontSize: 10, marginBottom: 2 },
  voterSummary: { width: '40%' },
  footerLabel: { fontSize: 10, fontWeight: 'bold' },
  voterNames: { fontSize: 10, opacity: 0.8 },
  emptyText: { textAlign: 'center', marginTop: 100, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { padding: 25, borderTopLeftRadius: 35, borderTopRightRadius: 35, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 15, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 15, padding: 15, fontSize: 16 },
  datePicker: { flexDirection: 'row', marginBottom: 10 },
  dateItem: { width: 55, height: 70, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dateWeek: { fontSize: 11, fontWeight: '600' },
  dateDay: { fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  timeSelectRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20 },
  timeCol: { width: '40%', alignItems: 'center' },
  timeLabel: { fontSize: 12, marginBottom: 8 },
  timeScroll: { height: 120, width: '100%', borderWidth: 1, borderColor: '#eee', borderRadius: 15 },
  timeItem: { padding: 10, alignItems: 'center' },
  saveBtn: { padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 30, elevation: 3 },
  saveBtnText: { fontSize: 18, fontWeight: 'bold' }
});
