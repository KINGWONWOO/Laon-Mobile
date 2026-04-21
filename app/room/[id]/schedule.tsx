import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, ScrollView, RefreshControl, Image, Dimensions, Switch, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull, OptionModal } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';
import AdBanner from '../../../components/ui/AdBanner';

export default function ScheduleScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { schedules, addSchedule, updateSchedule, respondToSchedule, deleteSchedule, closeSchedule, theme, currentUser, refreshAllData, rooms, getUserById, checkProAccess, sendProReminder, isPro, blockUser, reportContent } = useAppContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  
  const [showVoterModal, setShowVoterModal] = useState(false);
  const [voterModalTitle, setVoterModalTitle] = useState('');
  const [votersToDisplay, setVotersToDisplay] = useState<string[]>([]);
  
  // Form states
  const [title, setTitle] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [startTime, setStartTime] = useState(14);
  const [endTime, setEndTime] = useState(18);
  const [useNotification, setUseNotification] = useState(true);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);

  // Option Modal states
  const [showScheduleOptions, setShowScheduleOptions] = useState(false);

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
    if (startTime >= endTime) return Alert.alert('시간 설정 오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
    
    setIsUpdating(true);
    const opts: string[] = [];
    selectedDates.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      for (let h = startTime; h < endTime; h++) opts.push(`${dateStr} ${h.toString().padStart(2, '0')}:00`);
    });
    try {
      await addSchedule(id || '', title, opts, useNotification, hasDeadline ? deadline.getTime() : undefined, reminderMinutes);
      setShowAddModal(false);
      resetForm();
    } catch (e: any) { Alert.alert('오류', e.message); }
    finally { setIsUpdating(false); }
  };

  const resetForm = () => {
    setTitle(''); setSelectedDates([]); setHasDeadline(false); setStartTime(14); setEndTime(18); setDeadline(new Date(Date.now() + 24 * 60 * 60 * 1000)); setUseNotification(true); setReminderMinutes(30);
  };

  const openEditModal = () => {
    if (!selectedSchedule) return;
    setTitle(selectedSchedule.title);
    setHasDeadline(!!selectedSchedule.deadline);
    setUseNotification(selectedSchedule.useNotification !== false);
    setReminderMinutes(selectedSchedule.reminderMinutes || 30);
    if (selectedSchedule.deadline) setDeadline(new Date(selectedSchedule.deadline));
    
    const existingDates = Array.from(new Set(selectedSchedule.options.map((o:any) => o.dateTime.split(' ')[0]))).map(ds => new Date(ds as string));
    setSelectedDates(existingDates);
    
    const existingHours = selectedSchedule.options.map((o:any) => parseInt(o.dateTime.split(' ')[1].split(':')[0]));
    if (existingHours.length > 0) {
      setStartTime(Math.min(...existingHours));
      setEndTime(Math.max(...existingHours) + 1);
    }
    
    setShowEditModal(true);
  };

  const handleUpdateSchedule = async () => {
    if (!title.trim() || !selectedScheduleId) return;
    setIsUpdating(true);
    try {
      await updateSchedule(selectedScheduleId, { title: title.trim(), deadline: hasDeadline ? deadline.getTime() : undefined, useNotification, reminderMinutes });
      setShowEditModal(false);
    } catch (e: any) { Alert.alert('오류', e.message); }
    finally { setIsUpdating(false); }
  };

  const handleDeleteSchedule = () => {
    Alert.alert('일정 삭제', '정말 삭제하시겠습니까?', [
      { text: '취소' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await deleteSchedule(selectedScheduleId!);
        setSelectedScheduleId(null);
      }}
    ]);
  };

  const handleSendReminder = async () => {
    if (!selectedScheduleId) return;
    const access = checkProAccess('reminder');
    if (!access.canAccess) {
      return Alert.alert(
        'Pro 전용 기능',
        '미응답자에게 리마인드 알림을 보내는 기능은 Pro 멤버십 전용입니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '멤버십 보기', onPress: () => router.push('/subscription') }
        ]
      );
    }

    setIsSendingReminder(true);
    try {
      await sendProReminder(id!, 'schedule', selectedScheduleId);
      Alert.alert('알림 전송', '미응답자에게 리마인드 푸시 알림을 보냈습니다.');
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setIsSendingReminder(false);
    }
  };

  const scheduleOptions = selectedSchedule?.userId === currentUser?.id || (currentRoom as any)?.leaderId === currentUser?.id ? [
    { label: '미응답자에게 알림 보내기', icon: 'notifications-outline', onPress: handleSendReminder },
    { label: '제목/기한 수정', icon: 'create-outline', onPress: openEditModal },
    { label: selectedSchedule?.deadline && new Date(selectedSchedule.deadline) < new Date() ? '종료됨' : '지금 즉시 종료', 
      icon: 'stop-circle-outline', 
      destructive: true, 
      onPress: () => {
        Alert.alert('일정 종료', '지금 즉시 투표를 마감할까요?', [
          { text: '취소', style: 'cancel' },
          { text: '종료하기', style: 'destructive', onPress: async () => {
            await closeSchedule(selectedScheduleId!);
          }}
        ]);
      }
    },
    { label: '삭제', icon: 'trash-outline', destructive: true, onPress: handleDeleteSchedule }
  ] : [
    { label: '신고하기', icon: 'warning-outline', destructive: true, onPress: () => { if(selectedSchedule) reportContent(selectedSchedule.id, 'schedule'); } },
    { label: '작성자 차단', icon: 'ban-outline', destructive: true, onPress: () => { if(selectedSchedule) blockUser(selectedSchedule.userId); } }
  ];

  const renderScheduleListItem = ({ item: schedule }: { item: any }) => {
    const participants = Object.keys(schedule.responses).length;
    const isClosed = schedule.deadline && new Date(schedule.deadline) < new Date();
    return (
      <TouchableOpacity 
        activeOpacity={0.8}
        style={[styles.listCard, { backgroundColor: theme.card }, Shadows.soft]} 
        onPress={() => setSelectedScheduleId(schedule.id)}
      >
        <View style={styles.listInfo}>
          <View style={{flexDirection:'row', alignItems:'center', marginBottom: 6}}>
            <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>{schedule.title}</Text>
            {isClosed && (
              <View style={[styles.closedBadge, {backgroundColor: theme.textSecondary + '20'}]}>
                <Text style={{fontSize: 10, color: theme.textSecondary, fontWeight: '800'}}>종료</Text>
              </View>
            )}
          </View>
          <Text style={[styles.listMeta, { color: theme.textSecondary }]}>참여 {participants}명 • {formatDateFull(schedule.createdAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} style={{opacity: 0.5}} />
      </TouchableOpacity>
    );
  };

  const getHeatmapColor = (votes: number) => {
    if (votes === 0) return 'transparent';
    const participants = Object.keys(selectedSchedule?.responses || {}).length;
    const maxVotes = Math.max(participants, 1);
    const intensity = 0.15 + (votes / maxVotes) * 0.85;
    return theme.primary + Math.floor(intensity * 255).toString(16).padStart(2, '0');
  };

  const renderDetail = () => {
    if (!selectedSchedule) return null;
    const schedule = selectedSchedule;
    const isClosed = schedule.deadline && new Date(schedule.deadline) < new Date();
    const participants = Object.keys(schedule.responses);
    const nonParticipants = (currentRoom?.members || []).filter(mId => !participants.includes(mId));
    const isOwner = schedule.userId === currentUser?.id || (currentRoom as any)?.leaderId === currentUser?.id;

    const uniqueDates = Array.from(new Set(schedule.options.map((o: any) => o.dateTime.split(' ')[0]))).sort();
    const hours = Array.from(new Set(schedule.options.map((o: any) => parseInt((o.dateTime || ' 00').split(' ')[1].split(':')[0])))).sort((a: any, b: any) => a - b);

    const ranked = schedule.options.map((opt: any) => ({
      ...opt,
      votes: Object.values(schedule.responses).filter((ids: any) => ids.includes(opt.id)).length,
      voters: Object.entries(schedule.responses).filter(([_, ids]: any) => ids.includes(opt.id)).map(([uId]) => uId)
    })).sort((a: any, b: any) => b.votes - a.votes);

    return (
      <Modal visible={!!selectedScheduleId} animationType="slide" onRequestClose={() => setSelectedScheduleId(null)}>
        <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedScheduleId(null)} style={styles.closeBtn}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            <Text style={[styles.detailHeaderTitle, { color: theme.text }]}>일정 상세</Text>
            <TouchableOpacity onPress={() => setShowScheduleOptions(true)} style={styles.detailDeleteBtn}><Ionicons name="ellipsis-vertical" size={24} color={theme.text} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.statusRow}>
              {isClosed ? (
                <View style={[styles.statusBadge, {backgroundColor: theme.error + '15'}]}><Text style={{color: theme.error, fontWeight:'800', fontSize: 12}}>마감됨</Text></View>
              ) : (
                <View style={[styles.statusBadge, {backgroundColor: theme.primary + '15'}]}><Text style={{color: theme.primary, fontWeight:'800', fontSize: 12}}>진행 중</Text></View>
              )}
              {schedule.deadline && !isClosed && (
                <View style={styles.deadlineInfo}>
                  <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                  <Text style={{color: theme.textSecondary, fontSize: 12, marginLeft: 4, fontWeight: '600'}}>{formatDateFull(schedule.deadline)} 마감</Text>
                </View>
              )}
            </View>
            
            <Text style={[styles.title, { color: theme.text, fontSize: 26, fontWeight: '900', marginBottom: 32, letterSpacing: -1 }]}>{schedule.title}</Text>
            
            <View style={styles.heatmapArea}>
              <View style={styles.timeLabels}>
                <View style={styles.dateHeaderCorner} />
                {hours.map(h => <View key={h} style={styles.hourLabel}><Text style={{color: theme.textSecondary, fontSize: 10, fontWeight: '800'}}>{h}시</Text></View>)}
              </View>
              {uniqueDates.map(dateStr => (
                <View key={dateStr} style={styles.heatmapRow}>
                  <View style={styles.dateLabel}><Text style={{color: theme.text, fontSize: 11, fontWeight: '800'}}>{dateStr.slice(5).replace('-','/')}</Text></View>
                  {hours.map(h => {
                    const opt = schedule.options.find((o: any) => o.dateTime === `${dateStr} ${h.toString().padStart(2, '0')}:00`);
                    if (!opt) return <View key={h} style={styles.emptyCell} />;
                    const isSelected = (schedule.responses[currentUser?.id || ''] || []).includes(opt.id);
                    const votes = Object.values(schedule.responses).filter((ids: any) => ids.includes(opt.id)).length;
                    return (
                      <TouchableOpacity 
                        key={h} 
                        disabled={isClosed}
                        style={[styles.heatmapCell, { backgroundColor: isSelected ? theme.primary : getHeatmapColor(votes), borderColor: isSelected ? theme.primary : 'rgba(0,0,0,0.05)' }]} 
                        onPress={() => {
                          const currentRes = schedule.responses[currentUser?.id || ''] || [];
                          respondToSchedule(schedule.id, isSelected ? currentRes.filter((id: string) => id !== opt.id) : [...currentRes, opt.id]);
                        }}
                      >
                        {votes > 0 && <Text style={{fontSize: 9, fontWeight: '900', color: isSelected || votes > (participants.length / 2) ? '#fff' : theme.primary}}>{votes}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            <View style={[styles.voterSummaryCard, { backgroundColor: theme.card }, Shadows.soft]}>
              <View style={styles.voterRow}>
                <View style={[styles.voterLabelPill, {backgroundColor: theme.primary + '15'}]}><Text style={{color: theme.primary, fontWeight:'800', fontSize: 11}}>참여 {participants.length}</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarScroll}>
                  {participants.map(vId => (
                    <View key={vId} style={[styles.namePill, {backgroundColor: theme.primary + '10'}]}><Text style={{fontSize: 10, fontWeight: '800', color: theme.primary}}>{getUserById(vId)?.name || '?'}</Text></View>
                  ))}
                </ScrollView>
              </View>
              <View style={[styles.voterRow, { marginTop: 12 }]}>
                <View style={[styles.voterLabelPill, {backgroundColor: theme.textSecondary + '15'}]}><Text style={{color: theme.textSecondary, fontWeight:'800', fontSize: 11}}>미참여 {nonParticipants.length}</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarScroll}>
                  {nonParticipants.map(vId => (
                    <View key={vId} style={[styles.namePill, {backgroundColor: theme.textSecondary + '10'}]}><Text style={{fontSize: 10, fontWeight: '800', color: theme.textSecondary}}>{getUserById(vId)?.name || '?'}</Text></View>
                  ))}
                </ScrollView>
              </View>
              
              {!isClosed && isOwner && nonParticipants.length > 0 && (
                <TouchableOpacity 
                  style={[styles.manualReminderBtn, {backgroundColor: theme.primary + '15'}]}
                  onPress={handleSendReminder}
                  disabled={isSendingReminder}
                >
                  {isSendingReminder ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <>
                      <Ionicons name="notifications" size={16} color={theme.primary} />
                      <Text style={{color: theme.primary, fontWeight: '800', marginLeft: 8, fontSize: 13}}>미응답자에게 재촉 알림 보내기 (PRO)</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.rankingSection, { backgroundColor: theme.card }, Shadows.soft]}>
              <Text style={[styles.rankingHeader, { color: theme.text }]}>가장 많이 모이는 시간</Text>
              {ranked.length > 0 && ranked[0].votes > 0 ? (
                <View style={{marginTop: 15}}>
                  <View style={[styles.bestTimeCard, {backgroundColor: theme.primary + '10'}]}>
                    <Text style={{color: theme.primary, fontWeight: '900', fontSize: 16}}>베스트 1위 ({ranked[0].votes}명)</Text>
                    <Text style={{color: theme.text, fontWeight: '700', marginTop: 4, fontSize: 14}}>{new Date(ranked[0].dateTime).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} {new Date(ranked[0].dateTime).getHours()}시</Text>
                  </View>
                </View>
              ) : (
                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>아직 조율 데이터가 없습니다.</Text>
              )}
            </View>
          </ScrollView>

          <OptionModal visible={showScheduleOptions} onClose={() => setShowScheduleOptions(false)} options={scheduleOptions} title="조율 설정" theme={theme} />
        </View>
      </Modal>
    );
  };

  const CompactPicker = ({ date, onDateChange, show, setShow }: any) => {
    const days = Array.from({length: 14}).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
    const hours = Array.from({length: 24}).map((_, i) => i);
    const minutes = [0, 10, 20, 30, 40, 50, 59];
    return (
      <View style={[styles.compactPicker, {backgroundColor: theme.background}, Shadows.soft]}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity style={[styles.pickerTab, show === 'date' && {borderBottomColor: theme.primary, borderBottomWidth: 3}]} onPress={() => setShow('date')}><Text style={{color: theme.text, fontWeight: '700'}}>날짜</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.pickerTab, show === 'time' && {borderBottomColor: theme.primary, borderBottomWidth: 3}]} onPress={() => setShow('time')}><Text style={{color: theme.text, fontWeight: '700'}}>시간</Text></TouchableOpacity>
        </View>
        {show === 'date' && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{padding: 15}}>{days.map((d, i) => <TouchableOpacity key={i} style={[styles.smallDateBtn, date.toDateString() === d.toDateString() && {backgroundColor: theme.primary}, Shadows.soft]} onPress={() => { const newD = new Date(date); newD.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); onDateChange(newD); }}><Text style={{fontSize: 10, color: date.toDateString() === d.toDateString() ? '#fff' : theme.textSecondary, fontWeight: '800'}}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text><Text style={{fontSize: 16, fontWeight: '900', color: date.toDateString() === d.toDateString() ? '#fff' : theme.text}}>{d.getDate()}</Text></TouchableOpacity>)}</ScrollView>}
        {show === 'time' && <View style={{flexDirection:'row', height: 120}}><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>{hours.map(h => <TouchableOpacity key={h} style={[styles.smallTimeBtn, date.getHours() === h && {backgroundColor: theme.primary + '20'}]} onPress={() => { const newD = new Date(date); newD.setHours(h); onDateChange(newD); }}><Text style={{color: date.getHours() === h ? theme.primary : theme.text, fontWeight: '700', fontSize: 16}}>{h}시</Text></TouchableOpacity>)}</ScrollView><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>{minutes.map(m => <TouchableOpacity key={m} style={[styles.smallTimeBtn, date.getMinutes() === m && {backgroundColor: theme.primary + '20'}]} onPress={() => { const newD = new Date(date); newD.setMinutes(m); onDateChange(newD); }}><Text style={{color: date.getMinutes() === m ? theme.primary : theme.text, fontWeight: '700', fontSize: 16}}>{m}분</Text></TouchableOpacity>)}</ScrollView></View>}
      </View>
    );
  };

  const reminderOptions = [
    { label: '10분 전', value: 10 },
    { label: '30분 전', value: 30 },
    { label: '1시간 전', value: 60 },
    { label: '3시간 전', value: 180 },
    { label: '6시간 전', value: 360 },
    { label: '12시간 전', value: 720 },
    { label: '1일 전', value: 1440 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 50 }]}>
      <View style={styles.header}>
        <View><Text style={[styles.headerTitle, { color: theme.text }]}>연습 일정 조율</Text><Text style={[styles.headerSub, { color: theme.textSecondary }]}>가능한 시간을 함께 찾아보아요!</Text></View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }, Shadows.glow]} onPress={() => { resetForm(); setShowAddModal(true); }}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>
      </View>

      <FlatList 
        data={roomSchedules} 
        keyExtractor={item => item.id} 
        contentContainerStyle={{paddingBottom: 100}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} 
        renderItem={renderScheduleListItem} 
        ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="calendar-outline" size={48} color={theme.textSecondary + '30'} /><Text style={[styles.emptyText, { color: theme.textSecondary }]}>등록된 일정 조율이 없습니다.</Text></View>} 
      />

      {renderDetail()}

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal || showEditModal} animationType="slide" transparent onRequestClose={() => { setShowAddModal(false); setShowEditModal(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: theme.card, flex: 1, marginTop: 60 }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>{showEditModal ? '조율 수정' : '새 일정 조율'}</Text><TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); }}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false} style={{flex: 1}}>
              <Text style={[styles.label, { color: theme.text }]}>조율 제목</Text>
              <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} placeholder="예: 차주 정기 연습 시간" placeholderTextColor={theme.textSecondary} value={title} onChangeText={setTitle} />
              
              <Text style={[styles.label, { color: theme.text, marginTop: 10 }]}>날짜 선택 (다중)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
                {Array.from({length: 14}).map((_, i) => {
                  const d = new Date(); d.setDate(d.getDate() + i);
                  const isSel = !!selectedDates.find(sd => sd.toDateString() === d.toDateString());
                  return (
                    <TouchableOpacity key={i} onPress={() => toggleDate(d)} style={[styles.smallDateBtn, isSel && {backgroundColor: theme.primary}, Shadows.soft]}><Text style={{fontSize: 10, color: isSel ? '#fff' : theme.textSecondary, fontWeight: '800'}}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text><Text style={{fontSize: 16, fontWeight: '900', color: isSel ? '#fff' : theme.text}}>{d.getDate()}</Text></TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.label, { color: theme.text }]}>시간 범위 설정</Text>
              <View style={{flexDirection:'row', alignItems:'center', gap: 10, marginBottom: 30}}>
                <View style={{flex:1, alignItems:'center'}}><Text style={{color: theme.textSecondary, fontSize:12, marginBottom:6}}>시작 시각</Text><ScrollView horizontal style={{width:'100%'}} showsHorizontalScrollIndicator={false}>{Array.from({length: 24}).map((_,h) => <TouchableOpacity key={h} onPress={()=>setStartTime(h)} style={[styles.timeSlotBtn, startTime===h && {backgroundColor:theme.primary}]}><Text style={{color:startTime===h?'#fff':theme.text, fontWeight:'800'}}>{h}시</Text></TouchableOpacity>)}</ScrollView></View>
                <Ionicons name="arrow-forward" size={20} color={theme.textSecondary} />
                <View style={{flex:1, alignItems:'center'}}><Text style={{color: theme.textSecondary, fontSize:12, marginBottom:6}}>종료 시각</Text><ScrollView horizontal style={{width:'100%'}} showsHorizontalScrollIndicator={false}>{Array.from({length: 24}).map((_,h) => <TouchableOpacity key={h} onPress={()=>setEndTime(h)} style={[styles.timeSlotBtn, endTime===h && {backgroundColor:theme.primary}]}><Text style={{color:endTime===h?'#fff':theme.text, fontWeight:'800'}}>{h}시</Text></TouchableOpacity>)}</ScrollView></View>
              </View>
              
              <View style={[styles.settingItem, {marginTop: 10}]}><Text style={[styles.settingLabel, { color: theme.text }]}>마감 기한 설정</Text><Switch value={hasDeadline} onValueChange={setHasDeadline} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
              {hasDeadline && (
                <View style={{marginTop: 10, marginBottom: 20}}>
                  <TouchableOpacity style={[styles.compactRow, {backgroundColor: theme.background}]} onPress={() => setShowPicker(showPicker === 'date' ? null : 'date')}>
                    <Ionicons name="calendar" size={18} color={theme.primary} />
                    <Text style={{color: theme.text, marginLeft: 10, fontWeight: '700'}}>{deadline.toLocaleString()}</Text>
                  </TouchableOpacity>
                  {showPicker && <CompactPicker date={deadline} onDateChange={setDeadline} show={showPicker} setShow={setShowPicker} />}
                </View>
              )}

              {hasDeadline && (
                <>
                  <Text style={[styles.label, { color: theme.text, marginTop: 10 }]}>마감 전 알림 설정</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
                    {reminderOptions.map((opt) => (
                      <TouchableOpacity 
                        key={opt.value} 
                        style={[styles.reminderOpt, {backgroundColor: theme.background, borderColor: reminderMinutes === opt.value ? theme.primary : theme.border}, reminderMinutes === opt.value && {borderWidth: 2}]} 
                        onPress={() => setReminderMinutes(opt.value)}
                      >
                        <Text style={{color: reminderMinutes === opt.value ? theme.primary : theme.textSecondary, fontWeight: '700'}}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>푸시 알림 전송</Text><Switch value={useNotification} onValueChange={setUseNotification} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>

              <TouchableOpacity onPress={showEditModal ? handleUpdateSchedule : handleAddSchedule} style={[styles.saveBtn, { backgroundColor: theme.primary }, Shadows.glow]} disabled={isUpdating}>{isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: '#fff' }]}>{showEditModal ? '변경사항 저장' : '일정 조율 등록'}</Text>}</TouchableOpacity>
            </ScrollView>
          </View></View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showVoterModal} transparent animationType="fade" onRequestClose={() => setShowVoterModal(false)}>
        <View style={styles.modalOverlayCenter}><View style={[styles.voterModalContent, { backgroundColor: theme.card }, Shadows.medium]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text, fontSize: 18, fontWeight: '800' }]}>{voterModalTitle}</Text><TouchableOpacity onPress={() => setShowVoterModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity></View><View style={styles.voterList}>{votersToDisplay.map(vId => <View key={vId} style={styles.voterListItem}><View style={[styles.voterAvatar, {backgroundColor: theme.primary + '20'}]}><Text style={{color: theme.primary, fontWeight: '800'}}>{getUserById(vId)?.name?.[0]}</Text></View><Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>{getUserById(vId)?.name || '알 수 없음'}</Text></View>)}{votersToDisplay.length === 0 && <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>가능 인원이 없습니다.</Text>}</View></View></View>
      </Modal>
      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingHorizontal: 4 },
  headerTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  headerSub: { fontSize: 14, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  addButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  listCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 32, marginBottom: 16 },
  listInfo: { flex: 1 },
  listTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  listMeta: { fontSize: 12, fontWeight: '500', opacity: 0.6, marginTop: 4 },
  closedBadge: { marginLeft: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  detailHeaderTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  detailDeleteBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  detailScroll: { paddingHorizontal: 24, paddingBottom: 50 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  deadlineInfo: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  heatmapArea: { marginBottom: 32 },
  timeLabels: { flexDirection: 'row' },
  dateHeaderCorner: { width: 40 },
  hourLabel: { flex: 1, alignItems: 'center' },
  heatmapRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  dateLabel: { width: 40 },
  heatmapCell: { flex: 1, height: 36, margin: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emptyCell: { flex: 1, height: 36, margin: 1 },
  voterSummaryCard: { padding: 20, borderRadius: 32, marginBottom: 24 },
  voterRow: { flexDirection: 'row', alignItems: 'center' },
  voterLabelPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginRight: 12 },
  avatarScroll: { flex: 1 },
  namePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 6 },
  manualReminderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, marginTop: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  rankingSection: { padding: 24, borderRadius: 32, marginBottom: 24 },
  rankingHeader: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  bestTimeCard: { padding: 16, borderRadius: 20, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { padding: 28, borderTopLeftRadius: 40, borderTopRightRadius: 40, maxHeight: '95%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  label: { fontSize: 15, fontWeight: '800', marginBottom: 12, opacity: 0.8 },
  input: { borderRadius: 20, padding: 18, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  smallDateBtn: { width: 50, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, marginRight: 10 },
  timeSlotBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 12 },
  settingLabel: { fontSize: 16, fontWeight: '700' },
  compactRow: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20 },
  compactPicker: { borderRadius: 24, marginTop: 12, overflow: 'hidden', paddingBottom: 10 },
  pickerHeader: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.02)' },
  pickerTab: { flex: 1, padding: 15, alignItems: 'center' },
  smallTimeBtn: { padding: 18, alignItems: 'center' },
  saveBtn: { padding: 20, borderRadius: 24, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 18, fontWeight: '900' },
  emptyContainer: { alignItems: 'center', marginTop: 120 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  reminderOpt: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, marginRight: 8, borderWidth: 1 },
  voterModalContent: { padding: 24, borderRadius: 32, width: '100%' },
  voterList: { marginTop: 16 },
  voterListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  voterAvatar: { width: 40, height: 40, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 }
});
