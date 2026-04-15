import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, ScrollView, RefreshControl, Image, Dimensions, Switch, ActivityIndicator } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull } from '../../../components/ui/RoomComponents';

const { width } = Dimensions.get('window');

export default function ScheduleScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { schedules, addSchedule, updateSchedule, respondToSchedule, deleteSchedule, closeSchedule, theme, currentUser, refreshAllData, rooms, getUserById } = useAppContext();
  const insets = useSafeAreaInsets();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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
  
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);

  // Edit states
  const [editTitle, setEditTitle] = useState('');
  const [editHasDeadline, setEditHasDeadline] = useState(false);
  const [editDeadline, setEditDeadline] = useState<Date>(new Date());
  const [isUpdating, setIsUpdating] = useState(false);

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
      await addSchedule(id || '', title, opts, true, hasDeadline ? deadline.getTime() : undefined);
      setShowAddModal(false);
      setTitle('');
      setSelectedDates([]);
      setHasDeadline(false);
    } catch (e: any) { Alert.alert('오류', e.message); }
  };

  const handleUpdateSchedule = async () => {
    if (!editTitle.trim() || !selectedScheduleId) return;
    setIsUpdating(true);
    try {
      await updateSchedule(selectedScheduleId, { 
        title: editTitle.trim(), 
        deadline: editHasDeadline ? editDeadline.getTime() : undefined 
      });
      setShowEditModal(false);
    } catch (e: any) { Alert.alert('오류', e.message); }
    finally { setIsUpdating(false); }
  };

  const handleCloseScheduleManual = (sid: string) => {
    Alert.alert('일정 투표 종료', '지금 즉시 투표를 마감할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '종료하기', style: 'destructive', onPress: async () => {
        await closeSchedule(sid);
        Alert.alert('완료', '투표가 종료되었습니다.');
      }}
    ]);
  };

  const renderScheduleListItem = ({ item: schedule }: { item: any }) => {
    const participants = Object.keys(schedule.responses).length;
    const isClosed = schedule.deadline && new Date(schedule.deadline) < new Date();

    return (
      <TouchableOpacity 
        style={[styles.listCard, { backgroundColor: theme.card, borderColor: isClosed ? theme.border : theme.primary, borderWidth: isClosed ? 1 : 1.5 }]}
        onPress={() => setSelectedScheduleId(schedule.id)}
      >
        <View style={styles.listInfo}>
          <View style={{flexDirection:'row', alignItems:'center', marginBottom: 4}}>
            <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>{schedule.title}</Text>
            {isClosed && <View style={[styles.closedBadge, {backgroundColor: theme.textSecondary + '33'}]}><Text style={{fontSize: 10, color: theme.textSecondary}}>종료</Text></View>}
          </View>
          <Text style={[styles.listMeta, { color: theme.textSecondary }]}>참여 {participants}명 • {formatDateFull(schedule.createdAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderDetail = () => {
    if (!selectedSchedule) return null;
    const schedule = selectedSchedule;
    const isClosed = schedule.deadline && new Date(schedule.deadline) < new Date();
    const participants = Object.keys(schedule.responses);
    const nonParticipants = (currentRoom?.members || []).filter(mId => !participants.includes(mId));
    const isOwner = schedule.userId === currentUser?.id || (currentRoom as any)?.leader_id === currentUser?.id;

    const uniqueDates = Array.from(new Set(schedule.options.map((o: any) => o.dateTime.split(' ')[0]))).sort();
    const hours = Array.from(new Set(schedule.options.map((o: any) => parseInt((o.dateTime || ' 00').split(' ')[1].split(':')[0])))).sort((a: any, b: any) => a - b);

    const voteCounts = schedule.options.map((opt: any) => Object.values(schedule.responses).filter((ids: any) => ids.includes(opt.id)).length);
    const maxVotes = Math.max(...voteCounts, 1);

    const getHeatmapColor = (votes: number) => {
      if (votes === 0) return 'transparent';
      const intensity = 0.15 + (votes / maxVotes) * 0.85;
      return theme.primary + Math.floor(intensity * 255).toString(16).padStart(2, '0');
    };

    const ranked = schedule.options.map((opt: any) => ({
      ...opt,
      votes: Object.values(schedule.responses).filter((ids: any) => ids.includes(opt.id)).length,
      voters: Object.entries(schedule.responses).filter(([_, ids]: any) => ids.includes(opt.id)).map(([uId]) => uId)
    })).sort((a: any, b: any) => b.votes - a.votes);

    return (
      <Modal visible={!!selectedScheduleId} animationType="slide">
        <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedScheduleId(null)} style={styles.closeBtn}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            <Text style={[styles.detailHeaderTitle, { color: theme.text }]}>일정 상세</Text>
            {isOwner && !isClosed ? (
              <TouchableOpacity onPress={() => { setEditTitle(schedule.title); setEditHasDeadline(!!schedule.deadline); setEditDeadline(schedule.deadline ? new Date(schedule.deadline) : new Date()); setShowEditModal(true); }} style={styles.detailDeleteBtn}>
                <Ionicons name="create-outline" size={24} color={theme.text} />
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll}>
            <View style={{flexDirection:'row', alignItems:'center', marginBottom: 10}}>
              {isClosed ? <View style={[styles.statusBadge, {backgroundColor: theme.error + '22'}]}><Text style={{color: theme.error, fontWeight:'bold', fontSize: 12}}>마감됨</Text></View> : <View style={[styles.statusBadge, {backgroundColor: theme.primary + '22'}]}><Text style={{color: theme.primary, fontWeight:'bold', fontSize: 12}}>진행 중</Text></View>}
              {schedule.deadline && !isClosed && <Text style={{color: theme.error, fontSize: 12, marginLeft: 10}}>마감: {formatDateFull(schedule.deadline)}</Text>}
            </View>

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
                    <View style={styles.timeLabelCell}><Text style={[styles.timeLabelText, { color: theme.textSecondary }]}>{hour}:00</Text></View>
                    {uniqueDates.map(date => {
                      const dateTimeStr = `${date} ${hour.toString().padStart(2, '0')}:00`;
                      const opt = schedule.options.find((o: any) => o.dateTime === dateTimeStr);
                      if (!opt) return <View key={date as string} style={styles.gridCellEmpty} />;
                      const count = Object.values(schedule.responses).filter((ids: any) => ids.includes(opt.id)).length;
                      const isSelected = (schedule.responses[currentUser?.id || ''] || []).includes(opt.id);
                      return (
                        <TouchableOpacity key={date as string} disabled={isClosed} activeOpacity={0.7} style={[styles.gridCell, { backgroundColor: getHeatmapColor(count), borderColor: isSelected ? theme.primary : theme.border + '33' }]} onPress={() => {
                          const currentRes = schedule.responses[currentUser?.id || ''] || [];
                          const nextRes = isSelected ? currentRes.filter((r:string) => r !== opt.id) : [...currentRes, opt.id];
                          respondToSchedule(schedule.id, nextRes);
                        }}>
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
              {ranked.filter(r => r.votes > 0).slice(0,3).map((r, idx) => (
                <View key={idx} style={styles.rankingItem}>
                  <Text style={[styles.rankingIdx, { color: theme.textSecondary }]}>{idx+1}위</Text>
                  <Text style={[styles.rankingText, { color: theme.text }]}>{r.dateTime.slice(5)}시</Text>
                  <Text style={[styles.rankingCount, { color: theme.primary }]}>{r.votes}명</Text>
                </View>
              ))}
              {ranked.filter(r => r.votes > 0).length === 0 && <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>아직 투표가 없습니다.</Text>}
            </View>

            {isOwner && !isClosed && (
              <TouchableOpacity style={[styles.manualCloseBtn, {borderColor: theme.error}]} onPress={() => handleCloseScheduleManual(schedule.id)}>
                <Ionicons name="stop-circle-outline" size={20} color={theme.error} />
                <Text style={{color: theme.error, fontWeight: 'bold', marginLeft: 8}}>지금 일정 투표 종료하기</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const CompactPicker = ({ date, onDateChange, show, setShow }: any) => {
    const days = Array.from({length: 14}).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
    const hours = Array.from({length: 24}).map((_, i) => i);
    const minutes = [0, 10, 20, 30, 40, 50, 59];
    return (
      <View style={[styles.compactPicker, {borderColor: theme.border}]}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity style={[styles.pickerTab, show === 'date' && {borderBottomColor: theme.primary, borderBottomWidth: 2}]} onPress={() => setShow('date')}><Text style={{color: theme.text}}>{date.toLocaleDateString()}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.pickerTab, show === 'time' && {borderBottomColor: theme.primary, borderBottomWidth: 2}]} onPress={() => setShow('time')}><Text style={{color: theme.text}}>{date.getHours()}:{date.getMinutes().toString().padStart(2,'0')}</Text></TouchableOpacity>
        </View>
        {show === 'date' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{padding: 10}}>
            {days.map((d, i) => (
              <TouchableOpacity key={i} style={[styles.smallDateBtn, date.toDateString() === d.toDateString() && {backgroundColor: theme.primary}]} onPress={() => { const newD = new Date(date); newD.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); onDateChange(newD); }}>
                <Text style={{fontSize: 10, color: date.toDateString() === d.toDateString() ? theme.background : theme.textSecondary}}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text>
                <Text style={{fontWeight: 'bold', color: date.toDateString() === d.toDateString() ? theme.background : theme.text}}>{d.getDate()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {show === 'time' && (
          <View style={{flexDirection:'row', height: 100}}>
            <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>{hours.map(h => <TouchableOpacity key={h} style={[styles.smallTimeBtn, date.getHours() === h && {backgroundColor: theme.primary}]} onPress={() => { const newD = new Date(date); newD.setHours(h); onDateChange(newD); }}><Text style={{color: date.getHours() === h ? theme.background : theme.text}}>{h}시</Text></TouchableOpacity>)}</ScrollView>
            <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>{minutes.map(m => <TouchableOpacity key={m} style={[styles.smallTimeBtn, date.getMinutes() === m && {backgroundColor: theme.primary}]} onPress={() => { const newD = new Date(date); newD.setMinutes(m); onDateChange(newD); }}><Text style={{color: date.getMinutes() === m ? theme.background : theme.text}}>{m}분</Text></TouchableOpacity>)}</ScrollView>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 50 }]}>
      <View style={styles.header}>
        <View><Text style={[styles.headerTitle, { color: theme.text }]}>일정 투표</Text><Text style={[styles.headerSub, { color: theme.textSecondary }]}>목록에서 일정을 선택해주세요!</Text></View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={() => setShowAddModal(true)}><Ionicons name="add" size={24} color={theme.background} /></TouchableOpacity>
      </View>

      <FlatList data={roomSchedules} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} renderItem={renderScheduleListItem} ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>진행 중인 일정이 없습니다.</Text>} />

      {renderDetail()}

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>새 일정 투표 만들기</Text><TouchableOpacity onPress={() => setShowAddModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>제목</Text>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} placeholder="예: 정기 연습" placeholderTextColor="#888" value={title} onChangeText={setTitle} />
              
              <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>마감 기한 설정</Text><Switch value={hasDeadline} onValueChange={setHasDeadline} trackColor={{ true: theme.primary }} /></View>
              {hasDeadline && (
                <View style={{marginBottom: 20}}>
                  <TouchableOpacity style={[styles.compactRow, {borderColor: theme.border}]} onPress={() => setShowPicker(showPicker === 'date' ? null : 'date')}><Ionicons name="calendar-outline" size={18} color={theme.primary} /><Text style={{color: theme.text, marginLeft: 10}}>{formatDateFull(deadline.getTime())}</Text></TouchableOpacity>
                  {showPicker && <CompactPicker date={deadline} onDateChange={setDeadline} show={showPicker} setShow={setShowPicker} />}
                </View>
              )}

              <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>날짜 선택 (복수 가능)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
                {Array.from({length: 31}).map((_, day) => {
                  const d = new Date(); d.setDate(d.getDate() + day);
                  const isSelected = !!selectedDates.find(sd => sd.toDateString() === d.toDateString());
                  return (
                    <TouchableOpacity key={day} style={[styles.dateItem, isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => toggleDate(d)}>
                      <Text style={[styles.dateWeek, { color: isSelected ? theme.background : theme.textSecondary }]}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text>
                      <Text style={[styles.dateDay, { color: isSelected ? theme.background : theme.text }]}>{d.getDate()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity onPress={handleAddSchedule} style={[styles.saveBtn, { backgroundColor: theme.primary }]}><Text style={[styles.saveBtnText, { color: theme.background }]}>등록하기</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>일정 수정</Text><TouchableOpacity onPress={() => setShowEditModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity></View>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} placeholder="제목 수정" placeholderTextColor="#888" value={editTitle} onChangeText={setEditTitle} />
            <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>마감 기한 설정</Text><Switch value={editHasDeadline} onValueChange={setEditHasDeadline} trackColor={{ true: theme.primary }} /></View>
            {editHasDeadline && (
              <View style={{marginBottom: 20}}>
                <TouchableOpacity style={[styles.compactRow, {borderColor: theme.border}]} onPress={() => setShowPicker(showPicker === 'date' ? null : 'date')}><Ionicons name="calendar-outline" size={18} color={theme.primary} /><Text style={{color: theme.text, marginLeft: 10}}>{formatDateFull(editDeadline.getTime())}</Text></TouchableOpacity>
                {showPicker && <CompactPicker date={editDeadline} onDateChange={setEditDeadline} show={showPicker} setShow={setShowPicker} />}
              </View>
            )}
            <TouchableOpacity onPress={handleUpdateSchedule} style={[styles.saveBtn, { backgroundColor: theme.primary }]} disabled={isUpdating}>{isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: theme.background }]}>수정 완료</Text>}</TouchableOpacity>
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
  listTitle: { fontSize: 17, fontWeight: 'bold' },
  listMeta: { fontSize: 12 },
  closedBadge: { marginLeft: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee2' },
  detailHeaderTitle: { fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  detailDeleteBtn: { padding: 5 },
  detailScroll: { padding: 20 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
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
  manualCloseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 15, borderWidth: 1, marginTop: 30, borderStyle: 'dashed' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { padding: 25, borderTopLeftRadius: 35, borderTopRightRadius: 35, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 15, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 15, padding: 15, fontSize: 16, marginBottom: 10 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15 },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  compactRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderWidth: 1, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.03)' },
  compactPicker: { borderWidth: 1, borderRadius: 12, marginTop: 10, overflow: 'hidden' },
  pickerHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee2' },
  pickerTab: { flex: 1, padding: 10, alignItems: 'center' },
  smallDateBtn: { width: 45, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 10, marginRight: 8 },
  smallTimeBtn: { padding: 15, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#eee1' },
  dateItem: { width: 55, height: 70, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 10, borderColor: '#eee2' },
  dateWeek: { fontSize: 11, fontWeight: '600' },
  dateDay: { fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  saveBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  saveBtnText: { fontSize: 17, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 100, fontSize: 16 }
});
