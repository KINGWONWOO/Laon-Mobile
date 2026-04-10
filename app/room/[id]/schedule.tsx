import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, ScrollView, RefreshControl, Image, Dimensions } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ScheduleScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { schedules, addSchedule, respondToSchedule, deleteSchedule, theme, currentUser, refreshAllData, rooms, getUserById } = useAppContext();
  const insets = useSafeAreaInsets();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showVoterModal, setShowVoterModal] = useState(false);
  const [voterModalTitle, setVoterModalTitle] = useState('');
  const [votersToDisplay, setVotersToDisplay] = useState<string[]>([]);
  
  // 생성 관련 상태
  const [title, setTitle] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [startTime, setStartTime] = useState(14); // 2 PM
  const [endTime, setEndTime] = useState(18);   // 6 PM

  const roomSchedules = useMemo(() => schedules.filter(s => s.roomId === id), [schedules, id]);
  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);
  const selectedSchedule = useMemo(() => roomSchedules.find(s => s.id === selectedScheduleId), [roomSchedules, selectedScheduleId]);

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
    if (!title.trim()) return Alert.alert('오류', '제목을 입력해주세요.');
    if (selectedDates.length === 0) return Alert.alert('오류', '날짜를 선택해주세요.');
    
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
    } catch (e: any) { Alert.alert('오류', e.message); }
  };

  const handleDeleteSchedule = (sid: string) => {
    Alert.alert('일정 삭제', '이 일정을 정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await deleteSchedule(sid);
        setSelectedScheduleId(null);
      }}
    ]);
  };

  const renderScheduleListItem = ({ item: schedule }: { item: any }) => {
    const participants = Object.keys(schedule.responses).length;
    return (
      <TouchableOpacity 
        style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => setSelectedScheduleId(schedule.id)}
      >
        <View style={styles.listInfo}>
          <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>{schedule.title}</Text>
          <Text style={[styles.listMeta, { color: theme.textSecondary }]}>참여 {participants}명 • {new Date(schedule.createdAt).toLocaleDateString()}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderDetail = () => {
    if (!selectedSchedule) return null;
    const schedule = selectedSchedule;
    const participants = Object.keys(schedule.responses);
    const nonParticipants = (currentRoom?.members || []).filter(mId => !participants.includes(mId));
    const isOwner = schedule.userId === currentUser?.id || (currentRoom as any)?.leader_id === currentUser?.id;

    const uniqueDates = Array.from(new Set(schedule.options.map((o: any) => o.dateTime.split(' ')[0]))).sort();
    const hours = Array.from(new Set(schedule.options.map((o: any) => parseInt((o.dateTime || ' 00').split(' ')[1].split(':')[0])))).sort((a: any, b: any) => a - b);

    const voteCounts = schedule.options.map((opt: any) => 
      Object.values(schedule.responses).filter((ids: any) => ids.includes(opt.id)).length
    );
    const maxVotes = Math.max(...voteCounts, 1);

    const getHeatmapColor = (votes: number) => {
      if (votes === 0) return 'transparent';
      const intensity = 0.15 + (votes / maxVotes) * 0.85;
      return theme.primary + Math.floor(intensity * 255).toString(16).padStart(2, '0');
    };

    const getRanked = () => {
      return schedule.options.map((opt: any) => ({
        ...opt,
        votes: Object.values(schedule.responses).filter((ids: any) => ids.includes(opt.id)).length,
        voters: Object.entries(schedule.responses).filter(([_, ids]: any) => ids.includes(opt.id)).map(([uId]) => uId)
      })).sort((a: any, b: any) => b.votes - a.votes);
    };

    const ranked = getRanked();
    
    // 연속된 시간 그룹화 로직 (Hook 제거)
    const getGroupedRanked = () => {
      if (!ranked || ranked.length === 0) return [];
      const topVotes = ranked[0].votes;
      if (topVotes === 0) return [];
      
      const topOptions = ranked.filter(r => r.votes === topVotes).sort((a, b) => a.dateTime.localeCompare(b.dateTime));
      const groups: any[] = [];
      
      if (topOptions.length > 0) {
        let currentGroup: any[] = [topOptions[0]];
        for (let i = 1; i < topOptions.length; i++) {
          const prev = topOptions[i-1];
          const curr = topOptions[i];
          const prevDate = prev.dateTime.split(' ')[0];
          const currDate = curr.dateTime.split(' ')[0];
          const prevHour = parseInt(prev.dateTime.split(' ')[1]);
          const currHour = parseInt(curr.dateTime.split(' ')[1]);
          
          if (prevDate === currDate && currHour === prevHour + 1) {
            currentGroup.push(curr);
          } else {
            groups.push(currentGroup);
            currentGroup = [curr];
          }
        }
        groups.push(currentGroup);
      }
      return groups;
    };

    const groupedRanked = getGroupedRanked();

    return (
      <Modal visible={!!selectedScheduleId} animationType="slide">
        <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedScheduleId(null)} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.detailHeaderTitle, { color: theme.text }]} numberOfLines={1}>일정 투표 상세</Text>
            {isOwner ? (
              <TouchableOpacity onPress={() => handleDeleteSchedule(schedule.id)} style={styles.detailDeleteBtn}>
                <Ionicons name="trash-outline" size={24} color={theme.error} />
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll}>
            <Text style={[styles.detailTitle, { color: theme.text }]}>{schedule.title}</Text>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matrixContainer}>
              <View>
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

                {hours.map(hour => (
                  <View key={hour as number} style={styles.matrixRow}>
                    <View style={styles.timeLabelCell}>
                      <Text style={[styles.timeLabelText, { color: theme.textSecondary }]}>{hour}:00</Text>
                    </View>
                    {uniqueDates.map(date => {
                      const dateTimeStr = `${date} ${hour.toString().padStart(2, '0')}:00`;
                      const opt = schedule.options.find((o: any) => o.dateTime === dateTimeStr);
                      if (!opt) return <View key={date as string} style={styles.gridCellEmpty} />;

                      const count = Object.values(schedule.responses).filter((ids: any) => ids.includes(opt.id)).length;
                      const isSelected = (schedule.responses[currentUser?.id || ''] || []).includes(opt.id);

                      return (
                        <TouchableOpacity
                          key={date as string}
                          activeOpacity={0.7}
                          style={[styles.gridCell, { 
                            backgroundColor: getHeatmapColor(count),
                            borderColor: isSelected ? theme.primary : theme.border + '33'
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

            <View style={[styles.rankingBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.rankingHeader, { color: theme.primary }]}>가장 많이 모이는 시간</Text>
              {groupedRanked.length > 0 ? groupedRanked.map((group, idx) => {
                const start = group[0];
                const end = group[group.length-1];
                const dateStr = start.dateTime.split(' ')[0].slice(5);
                const startHour = parseInt(start.dateTime.split(' ')[1]);
                const endHour = parseInt(end.dateTime.split(' ')[1]) + 1;
                const displayTime = group.length === 1 ? `${dateStr}일 ${startHour}시` : `${dateStr}일 ${startHour}시-${endHour}시`;
                
                return (
                  <View key={idx} style={styles.rankingItem}>
                    <Text style={[styles.rankingIdx, { color: theme.textSecondary }]}>{idx+1}위</Text>
                    <Text style={[styles.rankingText, { color: theme.text }]}>{displayTime}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.rankingCount, { color: theme.primary, marginRight: 10 }]}>{start.votes}명</Text>
                      <TouchableOpacity 
                        style={[styles.infoBtn, { backgroundColor: theme.primary + '22' }]} 
                        onPress={() => {
                          setVotersToDisplay(start.voters);
                          setVoterModalTitle(displayTime);
                          setShowVoterModal(true);
                        }}
                      >
                        <Ionicons name="people" size={14} color={theme.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }) : <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 10 }}>아직 투표가 없습니다.</Text>}
            </View>

            <View style={styles.voterSummaryDetail}>
              <View style={styles.voterRow}>
                <Text style={[styles.voterLabel, { color: theme.textSecondary }]}>참여({participants.length})</Text>
                <View style={styles.voterNamesRow}>
                  {participants.map(vId => (
                    <Text key={vId} style={[styles.voterName, { color: theme.textSecondary }]}>{getUserById(vId)?.name} </Text>
                  ))}
                </View>
              </View>
              <View style={[styles.voterRow, { marginTop: 10 }]}>
                <Text style={[styles.voterLabel, { color: theme.error }]}>미참여({nonParticipants.length})</Text>
                <View style={styles.voterNamesRow}>
                  {nonParticipants.map(vId => (
                    <Text key={vId} style={[styles.voterName, { color: theme.error }]}>{getUserById(vId)?.name} </Text>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 50 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>일정 투표</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>목록에서 일정을 선택해주세요!</Text>
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
        renderItem={renderScheduleListItem}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>진행 중인 일정이 없습니다.</Text>}
      />

      {renderDetail()}

      <Modal visible={showVoterModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.voterModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text, fontSize: 16 }]}>{voterModalTitle} 가능 인원</Text>
              <TouchableOpacity onPress={() => setShowVoterModal(false)}><Ionicons name="close" size={20} color={theme.text} /></TouchableOpacity>
            </View>
            <View style={styles.voterList}>
              {votersToDisplay.map(vId => (
                <View key={vId} style={styles.voterListItem}>
                  <Ionicons name="person-circle" size={24} color={theme.primary} style={{ marginRight: 10 }} />
                  <Text style={{ color: theme.text }}>{getUserById(vId)?.name || '알 수 없음'}</Text>
                </View>
              ))}
              {votersToDisplay.length === 0 && <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>가능한 인원이 없습니다.</Text>}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>새 일정 투표 만들기</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>제목</Text>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} placeholder="예: 정기 연습" placeholderTextColor="#888" value={title} onChangeText={setTitle} />
              <Text style={[styles.label, { color: theme.textSecondary }]}>날짜 선택 (복수 가능)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datePicker}>
                {Array.from({length: 31}).map((_, day) => {
                  const d = new Date(); d.setDate(d.getDate() + day);
                  const isSelected = !!selectedDates.find(sd => sd.toDateString() === d.toDateString());
                  return (
                    <TouchableOpacity key={day} style={[styles.dateItem, { backgroundColor: isSelected ? theme.primary : 'transparent', borderColor: theme.border }]} onPress={() => toggleDate(d)}>
                      <Text style={[styles.dateWeek, { color: isSelected ? theme.background : theme.textSecondary }]}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text>
                      <Text style={[styles.dateDay, { color: isSelected ? theme.background : theme.text }]}>{d.getDate()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={[styles.label, { color: theme.textSecondary }]}>시간 범위 ({startTime}:00 ~ {endTime}:00)</Text>
              <View style={styles.timeSelectRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeLabel}>시작</Text>
                  <ScrollView style={styles.timeScroll}>{Array.from({length: 24}).map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => setStartTime(i)} style={[styles.timeItem, startTime === i && { backgroundColor: theme.primary + '33' }]}>
                      <Text style={{ color: startTime === i ? theme.primary : theme.text }}>{i}시</Text>
                    </TouchableOpacity>
                  ))}</ScrollView>
                </View>
                <View style={styles.timeCol}>
                  <Text style={styles.timeLabel}>종료</Text>
                  <ScrollView style={styles.timeScroll}>{Array.from({length: 25}).map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => setEndTime(i)} style={[styles.timeItem, endTime === i && { backgroundColor: theme.primary + '33' }]}>
                      <Text style={{ color: endTime === i ? theme.primary : theme.text }}>{i}시</Text>
                    </TouchableOpacity>
                  ))}</ScrollView>
                </View>
              </View>
              <TouchableOpacity onPress={handleAddSchedule} style={[styles.saveBtn, { backgroundColor: theme.primary }]}><Text style={[styles.saveBtnText, { color: theme.background }]}>등록하기</Text></TouchableOpacity>
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
  
  listCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, marginBottom: 12, borderWidth: 1 },
  listInfo: { flex: 1 },
  listTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  listMeta: { fontSize: 12 },

  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee2' },
  detailHeaderTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  closeBtn: { padding: 5 },
  detailDeleteBtn: { padding: 5 },
  detailScroll: { padding: 20 },
  detailTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },

  matrixContainer: { marginBottom: 25 },
  matrixRow: { flexDirection: 'row', alignItems: 'center' },
  timeLabelCell: { width: 50, alignItems: 'center', justifyContent: 'center', height: 40 },
  timeLabelText: { fontSize: 11, fontWeight: '600' },
  dateHeaderCell: { width: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  dateHeaderText: { fontSize: 11, fontWeight: '600' },
  dateHeaderDay: { fontSize: 16, fontWeight: 'bold' },
  gridCell: { width: 50, height: 40, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  gridCellEmpty: { width: 50, height: 40 },

  rankingBox: { padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 25 },
  rankingHeader: { fontSize: 15, fontWeight: 'bold', marginBottom: 15 },
  rankingItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rankingIdx: { width: 30, fontSize: 13, fontWeight: 'bold' },
  rankingText: { flex: 1, fontSize: 14 },
  rankingCount: { fontSize: 14, fontWeight: 'bold' },
  infoBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  voterSummaryDetail: { paddingHorizontal: 5, paddingBottom: 50 },
  voterRow: { flexDirection: 'row' },
  voterLabel: { fontSize: 13, fontWeight: 'bold', width: 70 },
  voterNamesRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  voterName: { fontSize: 13 },

  emptyText: { textAlign: 'center', marginTop: 100, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { padding: 25, borderTopLeftRadius: 35, borderTopRightRadius: 35, maxHeight: '85%' },
  voterModalContent: { padding: 20, borderRadius: 25, width: '80%', alignSelf: 'center', marginBottom: 'auto', marginTop: 'auto' },
  voterList: { marginTop: 10 },
  voterListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
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
