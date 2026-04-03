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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState(14); // 2 PM
  const [endTime, setEndTime] = useState(18);   // 6 PM

  const roomSchedules = useMemo(() => schedules.filter(s => s.roomId === id), [schedules, id]);
  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  const handleAddSchedule = async () => {
    if (!title.trim()) {
      Alert.alert('오류', '제목을 입력해주세요.');
      return;
    }
    if (startTime >= endTime) {
      Alert.alert('오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    const dateStr = selectedDate.toISOString().split('T')[0];
    const opts = [];
    for (let h = startTime; h < endTime; h++) {
      opts.push(`${dateStr} ${h.toString().padStart(2, '0')}:00`);
    }

    try {
      await addSchedule(id || '', title, opts);
      setShowAddModal(false);
      setTitle('');
      setTimeout(() => refreshAllData(), 500);
    } catch (e: any) { Alert.alert('오류', e.message); }
  };

  const handleDeleteSchedule = (sid: string) => {
    Alert.alert('일정 삭제', '이 일정을 정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteSchedule(sid) }
    ]);
  };

  const getRankedSlots = (schedule: any) => {
    const counts = schedule.options.map((opt: any) => {
      const voters = Object.entries(schedule.responses)
        .filter(([_, ids]: any) => ids.includes(opt.id))
        .map(([uId]) => uId);
      return { ...opt, votes: voters.length, voters };
    });
    return counts.sort((a: any, b: any) => b.votes - a.votes);
  };

  const renderScheduleCard = ({ item: schedule }: { item: any }) => {
    const rankedSlots = getRankedSlots(schedule);
    const participants = Object.keys(schedule.responses);
    const nonParticipants = (currentRoom?.members || []).filter(mId => !participants.includes(mId));
    const isOwner = schedule.userId === currentUser?.id || (currentRoom as any)?.leader_id === currentUser?.id;

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
        
        <View style={styles.contentRow}>
          {/* 왼쪽: 투표 그리드 (1시간 단위) */}
          <View style={styles.gridContainer}>
            {schedule.options.map((opt: any) => {
              const voters = Object.entries(schedule.responses)
                .filter(([_, ids]: any) => ids.includes(opt.id))
                .map(([uId]) => uId);
              
              const isSelected = (schedule.responses[currentUser?.id || ''] || []).includes(opt.id);
              
              // Safe time extraction
              const dateTimeParts = (opt.dateTime || '').split(' ');
              const timeStr = dateTimeParts.length > 1 ? dateTimeParts[1] : '00:00';
              const hour = parseInt(timeStr.split(':')[0]) || 0;

              return (
                <TouchableOpacity 
                  key={opt.id} 
                  style={[styles.gridSlot, { 
                    backgroundColor: isSelected ? theme.primary + '33' : 'transparent',
                    borderColor: isSelected ? theme.primary : theme.border 
                  }]}
                  onPress={() => {
                    const currentRes = schedule.responses[currentUser?.id || ''] || [];
                    const nextRes = isSelected ? currentRes.filter((r:string) => r !== opt.id) : [...currentRes, opt.id];
                    respondToSchedule(schedule.id, nextRes);
                  }}
                >
                  <View style={styles.slotInfo}>
                    <Text style={[styles.slotTime, { color: theme.text }]}>{hour}:00 - {hour+1}:00</Text>
                  </View>
                  
                  <View style={styles.slotVoters}>
                    {voters.map(vId => {
                      const voter = getUserById(vId);
                      return voter?.profileImage ? (
                        <Image key={vId} source={{ uri: voter.profileImage }} style={styles.slotAvatar} />
                      ) : (
                        <View key={vId} style={[styles.slotAvatar, { backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="person" size={10} color={theme.textSecondary} />
                        </View>
                      );
                    })}
                  </View>
                  
                  {isSelected && <Ionicons name="checkmark-circle" size={16} color={theme.primary} style={styles.checkIcon} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 오른쪽: 골든 타임 랭킹 */}
          <View style={[styles.rankingSidebar, { backgroundColor: theme.background + '88' }]}>
            <View style={styles.rankingHeader}>
              <Ionicons name="star" size={14} color={theme.primary} />
              <Text style={[styles.rankingTitle, { color: theme.primary }]}> 추천 시간</Text>
            </View>
            {rankedSlots.slice(0, 3).map((slot: any, idx: number) => (
              <View key={slot.id} style={styles.rankingItem}>
                <Text style={[styles.rankText, { color: theme.textSecondary }]}>{idx + 1}위</Text>
                <Text style={[styles.rankTime, { color: theme.text, fontSize: 12 }]}>{parseInt(slot.dateTime.split(' ')[1]) || 0}시</Text>
                <Text style={[styles.rankVotes, { color: theme.primary }]}>{slot.votes}명</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 하단 참여자 정보 */}
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <View style={styles.participationRow}>
            <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>참여({participants.length})</Text>
            <View style={styles.namesRow}>
              {participants.map(vId => (
                <Text key={vId} style={[styles.participantName, { color: theme.textSecondary }]}>{getUserById(vId)?.name || '...'} </Text>
              ))}
            </View>
          </View>
          <View style={[styles.participationRow, { marginTop: 8 }]}>
            <Text style={[styles.footerLabel, { color: theme.error }]}>미참여({nonParticipants.length})</Text>
            <View style={styles.namesRow}>
              {nonParticipants.map(vId => (
                <Text key={vId} style={[styles.participantName, { color: theme.error }]}>{getUserById(vId)?.name || '...'} </Text>
              ))}
            </View>
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
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>연습 가능한 시간을 알려주세요!</Text>
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
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} placeholder="예: 토요일 보강 연습" placeholderTextColor="#888" value={title} onChangeText={setTitle} />

              <Text style={[styles.label, { color: theme.textSecondary }]}>날짜 선택</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datePicker}>
                {Array.from({length: 31}).map((_, day) => {
                  const d = new Date();
                  d.setDate(d.getDate() + day);
                  const isSelected = d.toDateString() === selectedDate.toDateString();
                  return (
                    <TouchableOpacity 
                      key={day} 
                      style={[styles.dateItem, { backgroundColor: isSelected ? theme.primary : 'transparent', borderColor: theme.border }]}
                      onPress={() => setSelectedDate(d)}
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
  scheduleCard: { borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, overflow: 'hidden' },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  scheduleTitle: { fontSize: 19, fontWeight: 'bold' },
  deleteBtn: { padding: 4, marginLeft: 10 },
  contentRow: { flexDirection: 'row', justifyContent: 'space-between' },
  gridContainer: { flex: 1, marginRight: 15 },
  gridSlot: { 
    height: 60, 
    borderRadius: 15, 
    borderWidth: 1, 
    marginBottom: 8, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12 
  },
  slotInfo: { marginRight: 12 },
  slotTime: { fontSize: 15, fontWeight: '700' },
  slotDate: { fontSize: 10, fontWeight: '600' },
  slotVoters: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  slotAvatar: { width: 22, height: 22, borderRadius: 11, marginRight: -8, borderWidth: 2, borderColor: '#fff' },
  moreVoters: { fontSize: 11, fontWeight: '700', marginLeft: 12 },
  noVoters: { fontSize: 11, fontStyle: 'italic' },
  checkIcon: { marginLeft: 5 },
  rankingSidebar: { width: 90, borderRadius: 18, padding: 12, height: '100%' },
  rankingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rankingTitle: { fontSize: 11, fontWeight: 'bold' },
  rankingItem: { marginBottom: 12 },
  rankText: { fontSize: 10, fontWeight: '600', opacity: 0.7 },
  rankTime: { fontSize: 13, fontWeight: '700' },
  rankVotes: { fontSize: 11, fontWeight: '800' },
  footer: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, alignItems: 'flex-start' },
  participationRow: { flexDirection: 'row', alignItems: 'flex-start' },
  footerLabel: { fontSize: 12, fontWeight: '700', width: 60 },
  namesRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  participantName: { fontSize: 12, marginRight: 8 },
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
