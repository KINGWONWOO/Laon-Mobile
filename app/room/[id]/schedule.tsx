import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, ScrollView, RefreshControl, Image, Dimensions, Switch, ActivityIndicator, Platform } from 'react-native';
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
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [showVoterModal, setShowVoterModal] = useState(false);
  const [voterModalTitle, setVoterModalTitle] = useState('');
  const [votersToDisplay, setVotersToDisplay] = useState<string[]>([]);
  
  const [title, setTitle] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [startTime, setStartTime] = useState(14);
  const [endTime, setEndTime] = useState(18);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);

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
    if (exists) setSelectedDates(selectedDates.filter(d => d.toDateString() !== date.toDateString()));
    else setSelectedDates([...selectedDates, date].sort((a, b) => a.getTime() - b.getTime()));
  };

  const handleAddSchedule = async () => {
    if (!title.trim() || selectedDates.length === 0) return Alert.alert('오류', '제목과 날짜를 선택해주세요.');
    setIsUpdating(true);
    const opts: string[] = [];
    selectedDates.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      for (let h = startTime; h < endTime; h++) opts.push(`${dateStr} ${h.toString().padStart(2, '0')}:00`);
    });
    try {
      await addSchedule(id || '', title, opts, true, hasDeadline ? deadline.getTime() : undefined);
      setShowAddModal(false);
      resetForm();
    } catch (e: any) { Alert.alert('오류', e.message); }
    finally { setIsUpdating(false); }
  };

  const resetForm = () => {
    setTitle(''); setSelectedDates([]); setHasDeadline(false); setStartTime(14); setEndTime(18); setDeadline(new Date(Date.now() + 24 * 60 * 60 * 1000));
  };

  const openEditModal = () => {
    if (!selectedSchedule) return;
    setTitle(selectedSchedule.title);
    setHasDeadline(!!selectedSchedule.deadline);
    if (selectedSchedule.deadline) setDeadline(new Date(selectedSchedule.deadline));
    const existingDates = Array.from(new Set(selectedSchedule.options.map((o:any) => o.dateTime.split(' ')[0]))).map(ds => new Date(ds));
    setSelectedDates(existingDates);
    setShowEditModal(true);
  };

  const handleUpdateSchedule = async () => {
    if (!title.trim() || !selectedScheduleId) return;
    setIsUpdating(true);
    try {
      await updateSchedule(selectedScheduleId, { title: title.trim(), deadline: hasDeadline ? deadline.getTime() : undefined });
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
        style={[
          styles.listCard, 
          { backgroundColor: theme.card, shadowColor: theme.text },
          !isClosed && { borderColor: theme.primary + '33', borderWidth: 1 }
        ]} 
        onPress={() => setSelectedScheduleId(schedule.id)}
      >
        <View style={styles.listInfo}>
          <View style={{flexDirection:'row', alignItems:'center', marginBottom: 8}}>
            <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>{schedule.title}</Text>
            {isClosed && <View style={[styles.closedBadge, {backgroundColor: theme.textSecondary + '22'}]}><Text style={{fontSize: 10, color: theme.textSecondary, fontWeight: 'bold'}}>종료</Text></View>}
          </View>
          <Text style={[styles.listMeta, { color: theme.textSecondary }]}>참여 {participants}명 • {formatDateFull(schedule.createdAt)}</Text>
        </View>
        <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
          <Ionicons name="chevron-forward" size={18} color={theme.primary} />
        </View>
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

    const ranked = schedule.options.map((opt: any) => ({
      ...opt,
      votes: Object.values(schedule.responses).filter((ids: any) => ids.includes(opt.id)).length,
      voters: Object.entries(schedule.responses).filter(([_, ids]: any) => ids.includes(opt.id)).map(([uId]) => uId)
    })).sort((a: any, b: any) => b.votes - a.votes);

    const getHeatmapColor = (votes: number) => {
      if (votes === 0) return 'transparent';
      const maxVotes = Math.max(...ranked.map(r => r.votes), 1);
      const intensity = 0.15 + (votes / maxVotes) * 0.85;
      return theme.primary + Math.floor(intensity * 255).toString(16).padStart(2, '0');
    };

    return (
      <Modal visible={!!selectedScheduleId} animationType="slide">
        <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedScheduleId(null)} style={styles.closeBtn}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            <Text style={[styles.detailHeaderTitle, { color: theme.text }]}>일정 상세</Text>
            {isOwner && !isClosed ? (
              <TouchableOpacity onPress={openEditModal} style={styles.detailDeleteBtn}><Ionicons name="create-outline" size={24} color={theme.text} /></TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
            <View style={{flexDirection:'row', alignItems:'center', marginBottom: 12}}>
              {isClosed ? <View style={[styles.statusBadge, {backgroundColor: theme.error + '15'}]}><Text style={{color: theme.error, fontWeight:'800', fontSize: 12}}>마감됨</Text></View> : <View style={[styles.statusBadge, {backgroundColor: theme.primary + '15'}]}><Text style={{color: theme.primary, fontWeight:'800', fontSize: 12}}>진행 중</Text></View>}
              {schedule.deadline && !isClosed && <Text style={{color: theme.error, fontSize: 12, marginLeft: 10, fontWeight: '600'}}>마감: {formatDateFull(schedule.deadline)}</Text>}
            </View>
            <Text style={[styles.detailTitle, { color: theme.text }]}>{schedule.title}</Text>
            
            <View style={[styles.matrixCard, { backgroundColor: theme.card, shadowColor: theme.text }]}>
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
                        const votersForThisOpt = Object.entries(schedule.responses).filter(([_, ids]: any) => ids.includes(opt.id)).map(([uId]) => uId);
                        const isSelected = (schedule.responses[currentUser?.id || ''] || []).includes(opt.id);
                        return (
                          <TouchableOpacity 
                            key={date as string} 
                            disabled={isClosed} 
                            activeOpacity={0.7} 
                            style={[
                              styles.gridCell, 
                              { backgroundColor: getHeatmapColor(votersForThisOpt.length), borderColor: isSelected ? theme.primary : theme.border + '33' },
                              isSelected && { borderWidth: 2 }
                            ]} 
                            onPress={() => {
                              const currentRes = schedule.responses[currentUser?.id || ''] || [];
                              respondToSchedule(schedule.id, isSelected ? currentRes.filter((r:string) => r !== opt.id) : [...currentRes, opt.id]);
                            }} 
                            onLongPress={() => {
                              setVotersToDisplay(votersForThisOpt);
                              setVoterModalTitle(`${dateTimeStr.slice(5)} 가능 인원`);
                              setShowVoterModal(true);
                            }}
                          >
                            {isSelected && <Ionicons name="checkmark" size={14} color={theme.background} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
              <Text style={{ textAlign: 'center', fontSize: 11, color: theme.textSecondary, marginTop: 15, fontWeight: '500' }}>💡 칸을 길게 누르면 참여자 명단을 볼 수 있어요</Text>
            </View>

            <View style={[styles.voterSummaryCard, { backgroundColor: theme.card, shadowColor: theme.text }]}>
              <View style={styles.voterRow}>
                <View style={[styles.voterLabelContainer, { backgroundColor: theme.success + '15' }]}>
                  <Text style={[styles.voterLabel, { color: theme.success }]}>참여 {participants.length}</Text>
                </View>
                <View style={styles.voterNamesRow}>
                  {participants.map(vId => <Text key={vId} style={[styles.voterName, { color: theme.textSecondary }]}>{getUserById(vId)?.name} </Text>)}
                  {participants.length === 0 && <Text style={{ color: theme.textSecondary, fontSize: 13 }}>아직 참여자가 없습니다.</Text>}
                </View>
              </View>
              <View style={[styles.voterRow, { marginTop: 15 }]}>
                <View style={[styles.voterLabelContainer, { backgroundColor: theme.error + '15' }]}>
                  <Text style={[styles.voterLabel, { color: theme.error }]}>미참여 {nonParticipants.length}</Text>
                </View>
                <View style={styles.voterNamesRow}>
                  {nonParticipants.map(vId => <Text key={vId} style={[styles.voterName, { color: theme.textSecondary }]}>{getUserById(vId)?.name} </Text>)}
                  {nonParticipants.length === 0 && <Text style={{ color: theme.textSecondary, fontSize: 13 }}>모두 참여했습니다!</Text>}
                </View>
              </View>
            </View>

            <View style={[styles.rankingBox, { backgroundColor: theme.card, shadowColor: theme.text }]}>
              <View style={{flexDirection:'row', alignItems:'center', marginBottom: 20}}>
                <View style={[styles.iconCircleSmall, { backgroundColor: theme.accent + '15', marginRight: 10 }]}>
                  <Ionicons name="time" size={16} color={theme.accent} />
                </View>
                <Text style={[styles.rankingHeader, { color: theme.text }]}>가장 많이 모이는 시간</Text>
              </View>
              
              {ranked.filter(r => r.votes > 0).slice(0, 3).map((r, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={[styles.rankingItem, idx < 2 && { borderBottomWidth: 1, borderBottomColor: theme.border }]} 
                  onPress={() => { setVotersToDisplay(r.voters); setVoterModalTitle(`${r.dateTime.slice(5)} 투표자`); setShowVoterModal(true); }}
                >
                  <View style={[styles.rankingBadge, { backgroundColor: idx === 0 ? theme.primary : idx === 1 ? theme.accent : theme.success }]}>
                    <Text style={styles.rankingBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.rankingText, { color: theme.text }]}>{r.dateTime.slice(5)}시</Text>
                  <View style={styles.rankingCountRow}>
                    <Text style={[styles.rankingCount, { color: theme.primary }]}>{r.votes}명</Text>
                    <Ionicons name="people" size={16} color={theme.primary} />
                  </View>
                </TouchableOpacity>
              ))}
              {ranked.filter(r => r.votes > 0).length === 0 && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: theme.textSecondary }}>아직 투표 데이터가 없습니다.</Text>
                </View>
              )}
            </View>

            {isClosed && ranked[0].votes > 0 && (
              <View style={[styles.resultBanner, {backgroundColor: theme.primary, shadowColor: theme.primary}]}>
                <Ionicons name="calendar-check" size={20} color={theme.background} style={{ marginRight: 8 }} />
                <Text style={{color: theme.background, fontWeight:'800', fontSize: 15}}>추천 시간: {ranked[0].dateTime.slice(5)}시</Text>
              </View>
            )}

            {isOwner && !isClosed && (
              <TouchableOpacity style={[styles.manualCloseBtn, {borderColor: theme.error}]} onPress={() => handleCloseScheduleManual(schedule.id)}>
                <Ionicons name="stop-circle-outline" size={20} color={theme.error} />
                <Text style={{color: theme.error, fontWeight: '800', marginLeft: 8}}>일정 투표 마감하기</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: 40 }} />
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
      <View style={[styles.compactPicker, {borderColor: theme.border, backgroundColor: theme.background}]}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity style={[styles.pickerTab, show === 'date' && {borderBottomColor: theme.primary, borderBottomWidth: 3}]} onPress={() => setShow('date')}><Text style={{color: theme.text, fontWeight: '700'}}>{date.toLocaleDateString()}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.pickerTab, show === 'time' && {borderBottomColor: theme.primary, borderBottomWidth: 3}]} onPress={() => setShow('time')}><Text style={{color: theme.text, fontWeight: '700'}}>{date.getHours()}:{date.getMinutes().toString().padStart(2,'0')}</Text></TouchableOpacity>
        </View>
        {show === 'date' && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{padding: 15}}>{days.map((d, i) => <TouchableOpacity key={i} style={[styles.smallDateBtn, date.toDateString() === d.toDateString() && {backgroundColor: theme.primary}]} onPress={() => { const newD = new Date(date); newD.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); onDateChange(newD); }}><Text style={{fontSize: 10, color: date.toDateString() === d.toDateString() ? theme.background : theme.textSecondary, fontWeight: '600'}}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text><Text style={{fontWeight: '800', fontSize: 16, color: date.toDateString() === d.toDateString() ? theme.background : theme.text}}>{d.getDate()}</Text></TouchableOpacity>)}</ScrollView>}
        {show === 'time' && <View style={{flexDirection:'row', height: 120}}><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>{hours.map(h => <TouchableOpacity key={h} style={[styles.smallTimeBtn, date.getHours() === h && {backgroundColor: theme.primary + '15'}]} onPress={() => { const newD = new Date(date); newD.setHours(h); onDateChange(newD); }}><Text style={{color: date.getHours() === h ? theme.primary : theme.text, fontWeight: date.getHours() === h ? '800' : '500'}}>{h}시</Text></TouchableOpacity>)}</ScrollView><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>{minutes.map(m => <TouchableOpacity key={m} style={[styles.smallTimeBtn, date.getMinutes() === m && {backgroundColor: theme.primary + '15'}]} onPress={() => { const newD = new Date(date); newD.setMinutes(m); onDateChange(newD); }}><Text style={{color: date.getMinutes() === m ? theme.primary : theme.text, fontWeight: date.getMinutes() === m ? '800' : '500'}}>{m}분</Text></TouchableOpacity>)}</ScrollView></View>}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 50 }]}>
      <View style={styles.header}>
        <View><Text style={[styles.headerTitle, { color: theme.text }]}>일정 투표</Text><Text style={[styles.headerSub, { color: theme.textSecondary }]}>가장 많이 모이는 시간을 찾아드려요!</Text></View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]} onPress={() => { resetForm(); setShowAddModal(true); }}><Ionicons name="add" size={28} color={theme.background} /></TouchableOpacity>
      </View>

      <FlatList 
        data={roomSchedules} 
        keyExtractor={item => item.id} 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} 
        renderItem={renderScheduleListItem} 
        ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="calendar-outline" size={60} color={theme.border} /><Text style={[styles.emptyText, { color: theme.textSecondary }]}>진행 중인 일정이 없습니다.</Text></View>} 
      />

      {renderDetail()}

      <Modal visible={showVoterModal} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlayCenter} onPress={() => setShowVoterModal(false)}>
          <View style={[styles.voterModalContent, { backgroundColor: theme.card, shadowColor: theme.text }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text, fontSize: 18 }]}>{voterModalTitle}</Text>
              <TouchableOpacity onPress={() => setShowVoterModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.voterList} showsVerticalScrollIndicator={false}>
              {votersToDisplay.map(vId => (
                <View key={vId} style={styles.voterListItem}>
                  <View style={[styles.iconCircleSmall, { backgroundColor: theme.primary + '15', marginRight: 12 }]}>
                    <Ionicons name="person" size={14} color={theme.primary} />
                  </View>
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{getUserById(vId)?.name || '알 수 없음'}</Text>
                </View>
              ))}
              {votersToDisplay.length === 0 && <Text style={{ color: theme.textSecondary, textAlign: 'center', marginVertical: 20 }}>참여자가 없습니다.</Text>}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal || showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{showEditModal ? '일정 수정' : '새 일정 투표 만들기'}</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); }}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>제목</Text>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} placeholder="예: 정기 연습" placeholderTextColor="#888" value={title} onChangeText={setTitle} />
              
              <Text style={[styles.label, { color: theme.textSecondary, marginTop: 15 }]}>날짜 선택 (복수 가능)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20, paddingVertical: 5}}>{Array.from({length: 31}).map((_, day) => { const d = new Date(); d.setDate(d.getDate() + day); const isSelected = !!selectedDates.find(sd => sd.toDateString() === d.toDateString()); return (<TouchableOpacity key={day} style={[styles.dateItem, { backgroundColor: isSelected ? theme.primary : theme.background, borderColor: isSelected ? theme.primary : theme.border }]} onPress={() => toggleDate(d)}><Text style={[styles.dateWeek, { color: isSelected ? theme.background : theme.textSecondary }]}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text><Text style={[styles.dateDay, { color: isSelected ? theme.background : theme.text }]}>{d.getDate()}</Text></TouchableOpacity>); })}</ScrollView>
              
              <Text style={[styles.label, { color: theme.textSecondary }]}>시간 범위 ({startTime}:00 ~ {endTime}:00)</Text>
              <View style={styles.timeSelectCard}>
                <View style={styles.timeSelectRow}>
                  <View style={styles.timeCol}><Text style={styles.timeLabel}>시작</Text><ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>{Array.from({length: 24}).map((_, i) => (<TouchableOpacity key={i} onPress={() => setStartTime(i)} style={[styles.timeItem, startTime === i && { backgroundColor: theme.primary + '15' }]}><Text style={{ color: startTime === i ? theme.primary : theme.text, fontWeight: startTime === i ? '800' : '500' }}>{i}시</Text></TouchableOpacity>))}</ScrollView></View>
                  <View style={styles.timeCol}><Text style={styles.timeLabel}>종료</Text><ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>{Array.from({length: 25}).map((_, i) => (<TouchableOpacity key={i} onPress={() => setEndTime(i)} style={[styles.timeItem, endTime === i && { backgroundColor: theme.primary + '15' }]}><Text style={{ color: endTime === i ? theme.primary : theme.text, fontWeight: endTime === i ? '800' : '500' }}>{i}시</Text></TouchableOpacity>))}</ScrollView></View>
                </View>
              </View>

              <View style={[styles.settingCard, { backgroundColor: theme.background, marginTop: 20 }]}>
                <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>마감 기한 설정</Text><Switch value={hasDeadline} onValueChange={setHasDeadline} trackColor={{ true: theme.primary, false: '#ddd' }} thumbColor={Platform.OS === 'android' ? (hasDeadline ? theme.primary : '#f4f3f4') : ''} /></View>
                {hasDeadline && (
                  <View style={{marginTop: 15}}>
                    <TouchableOpacity style={[styles.compactRow, {borderColor: theme.border, backgroundColor: theme.card}]} onPress={() => setShowPicker(showPicker === 'date' ? null : 'date')}>
                      <Ionicons name="calendar" size={20} color={theme.primary} />
                      <Text style={{color: theme.text, marginLeft: 10, fontWeight: '600'}}>{formatDateFull(deadline.getTime())}</Text>
                    </TouchableOpacity>
                    {showPicker && <CompactPicker date={deadline} onDateChange={setDeadline} show={showPicker} setShow={setShowPicker} />}
                  </View>
                )}
              </View>

              <TouchableOpacity onPress={showEditModal ? handleUpdateSchedule : handleAddSchedule} style={[styles.saveBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]} disabled={isUpdating}>{isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: theme.background }]}>{showEditModal ? '수정 완료' : '등록하기'}</Text>}</TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  headerTitle: { fontSize: 30, fontWeight: '800' },
  headerSub: { fontSize: 14, marginTop: 4, opacity: 0.8 },
  addButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  listCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 24, 
    borderRadius: 28, 
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.06, 
    shadowRadius: 12, 
    elevation: 3 
  },
  listInfo: { flex: 1 },
  listTitle: { fontSize: 18, fontWeight: '800' },
  listMeta: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  closedBadge: { marginLeft: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconCircleSmall: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee2' },
  detailHeaderTitle: { fontSize: 20, fontWeight: '800' },
  closeBtn: { padding: 5 },
  detailDeleteBtn: { padding: 5 },
  detailScroll: { padding: 24 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start' },
  detailTitle: { fontSize: 26, fontWeight: '800', marginBottom: 25, lineHeight: 34 },
  matrixCard: { 
    padding: 20, 
    borderRadius: 32, 
    marginBottom: 25,
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.07, 
    shadowRadius: 15, 
    elevation: 4 
  },
  matrixContainer: { marginTop: 5 },
  matrixRow: { flexDirection: 'row', alignItems: 'center' },
  timeLabelCell: { width: 55, alignItems: 'center', justifyContent: 'center', height: 45 },
  timeLabelText: { fontSize: 12, fontWeight: '700' },
  dateHeaderCell: { width: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  dateHeaderText: { fontSize: 12, fontWeight: '700' },
  dateHeaderDay: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  gridCell: { width: 50, height: 45, borderWidth: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, margin: 1 },
  gridCellEmpty: { width: 50, height: 45, margin: 1 },
  voterSummaryCard: { 
    padding: 24, 
    borderRadius: 28, 
    marginBottom: 25,
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 2 
  },
  voterRow: { flexDirection: 'row', alignItems: 'flex-start' },
  voterLabelContainer: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, width: 85, alignItems: 'center', marginRight: 12 },
  voterLabel: { fontSize: 12, fontWeight: '800' },
  voterNamesRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  voterName: { fontSize: 14, fontWeight: '500', marginRight: 6, marginBottom: 4 },
  rankingBox: { 
    padding: 24, 
    borderRadius: 32, 
    marginBottom: 25,
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.07, 
    shadowRadius: 15, 
    elevation: 4 
  },
  rankingHeader: { fontSize: 17, fontWeight: '800' },
  rankingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  rankingBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  rankingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  rankingText: { flex: 1, fontSize: 16, fontWeight: '700' },
  rankingCountRow: { flexDirection: 'row', alignItems: 'center' },
  rankingCount: { fontSize: 16, fontWeight: '800', marginRight: 4 },
  resultBanner: { 
    flexDirection: 'row',
    padding: 20, 
    borderRadius: 24, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 10, 
    elevation: 5
  },
  manualCloseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 24, borderWidth: 2, marginTop: 10, borderStyle: 'dashed' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { padding: 25, borderTopLeftRadius: 40, borderTopRightRadius: 40, maxHeight: '92%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 10 },
  voterModalContent: { padding: 25, borderRadius: 32, width: '85%', maxHeight: '70%' },
  voterList: { marginTop: 10 },
  voterListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 24, fontWeight: '800' },
  label: { fontSize: 14, fontWeight: '800', marginTop: 20, marginBottom: 10, marginLeft: 4 },
  input: { borderWidth: 1.5, borderRadius: 20, padding: 18, fontSize: 16, marginBottom: 12 },
  settingCard: { padding: 18, borderRadius: 24, borderWidth: 1, borderColor: '#eee2' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLabel: { fontSize: 16, fontWeight: '700' },
  compactRow: { flexDirection: 'row', alignItems: 'center', padding: 18, borderWidth: 1.5, borderRadius: 20 },
  compactPicker: { borderRadius: 24, marginTop: 12, overflow: 'hidden', borderWidth: 1 },
  pickerHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee2' },
  pickerTab: { flex: 1, padding: 15, alignItems: 'center' },
  smallDateBtn: { width: 50, height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: 16, marginRight: 10 },
  smallTimeBtn: { padding: 18, alignItems: 'center' },
  dateItem: { width: 60, height: 75, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  dateWeek: { fontSize: 12, fontWeight: '700' },
  dateDay: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  timeSelectCard: { padding: 20, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.02)', borderWidth: 1, borderColor: '#eee2' },
  timeSelectRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  timeCol: { width: '42%', alignItems: 'center' },
  timeLabel: { fontSize: 13, marginBottom: 10, fontWeight: '700' },
  timeScroll: { height: 150, width: '100%', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.5)' },
  timeItem: { padding: 12, alignItems: 'center', borderRadius: 12 },
  saveBtn: { padding: 20, borderRadius: 24, alignItems: 'center', marginTop: 25, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  saveBtnText: { fontSize: 18, fontWeight: '800' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { textAlign: 'center', marginTop: 15, fontSize: 16, fontWeight: '500' }
});

