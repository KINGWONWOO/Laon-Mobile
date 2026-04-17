import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, ScrollView, RefreshControl, Image, Dimensions, Switch, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull, OptionModal } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';

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
    
    // Parse existing options to fill form
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

  const scheduleOptions = [
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

    const getHeatmapColor = (votes: number) => {
      if (votes === 0) return 'transparent';
      const maxVotes = Math.max(...ranked.map(r => r.votes), 1);
      const intensity = 0.15 + (votes / maxVotes) * 0.85;
      return theme.primary + Math.floor(intensity * 255).toString(16).padStart(2, '0');
    };

    const formatMergedTimes = (opts: any[]) => {
      if (opts.length === 0) return "";
      const dates = Array.from(new Set(opts.map(o => o.dateTime.split(' ')[0]))).sort();
      return dates.map(d => {
        const hours = opts.filter(o => o.dateTime.startsWith(d)).map(o => parseInt(o.dateTime.split(' ')[1].split(':')[0])).sort((a,b) => a-b);
        const groups = [];
        let currentGroup = [hours[0]];
        for (let i = 1; i < hours.length; i++) {
          if (hours[i] === hours[i-1] + 1) currentGroup.push(hours[i]);
          else { groups.push(currentGroup); currentGroup = [hours[i]]; }
        }
        groups.push(currentGroup);
        const timeStr = groups.map(g => g.length > 1 ? `${g[0]}-${g[g.length-1]+1}시` : `${g[0]}시`).join(', ');
        return `${d.slice(5)}: ${timeStr}`;
      }).join(' / ');
    };

    return (
      <Modal visible={!!selectedScheduleId} animationType="slide" onRequestClose={() => setSelectedScheduleId(null)}>
        <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedScheduleId(null)} style={styles.closeBtn}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            <Text style={[styles.detailHeaderTitle, { color: theme.text }]}>일정 상세</Text>
            {isOwner ? (
              <TouchableOpacity onPress={() => setShowScheduleOptions(true)} style={styles.detailDeleteBtn}><Ionicons name="ellipsis-vertical" size={24} color={theme.text} /></TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
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
            <Text style={[styles.detailTitle, { color: theme.text }]}>{schedule.title}</Text>
            
            <Text style={[styles.sectionTitle, { color: theme.text }]}>내 시간 선택</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matrixContainer}>
              <View>
                <View style={styles.matrixRow}>
                  <View style={styles.timeLabelCell} />
                  {uniqueDates.map(date => {
                    const d = new Date(date as string);
                    return (<View key={date as string} style={styles.dateHeaderCell}><Text style={[styles.dateHeaderText, { color: theme.textSecondary }]}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text><Text style={[styles.dateHeaderDay, { color: theme.text }]}>{d.getDate()}</Text></View>);
                  })}
                </View>
                {hours.map(hour => (
                  <View key={hour as number} style={styles.matrixRow}>
                    <View style={styles.timeLabelCell}><Text style={[styles.timeLabelText, { color: theme.textSecondary }]}>{hour}:00</Text></View>
                    {uniqueDates.map(date => {
                      const dateTimeStr = `${date} ${hour.toString().padStart(2, '0')}:00`;
                      const opt = schedule.options.find((o: any) => o.dateTime === dateTimeStr);
                      if (!opt) return <View key={date as string} style={styles.gridCellEmpty} />;
                      const isSelected = (schedule.responses[currentUser?.id || ''] || []).includes(opt.id);
                      return (
                        <TouchableOpacity key={date as string} disabled={isClosed} activeOpacity={0.7} style={[styles.gridCell, isSelected && { backgroundColor: theme.primary + '20', borderColor: theme.primary }]} onPress={() => {
                          const currentRes = schedule.responses[currentUser?.id || ''] || [];
                          respondToSchedule(schedule.id, isSelected ? currentRes.filter((r:string) => r !== opt.id) : [...currentRes, opt.id]);
                        }}>
                          {isSelected && <Ionicons name="checkmark" size={12} color={theme.primary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>전체 투표 현황</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matrixContainer}>
              <View>
                <View style={styles.matrixRow}>
                  <View style={styles.timeLabelCell} />
                  {uniqueDates.map(date => {
                    const d = new Date(date as string);
                    return (<View key={date as string} style={styles.dateHeaderCell}><Text style={[styles.dateHeaderText, { color: theme.textSecondary }]}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text><Text style={[styles.dateHeaderDay, { color: theme.text }]}>{d.getDate()}</Text></View>);
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
                      return (
                        <TouchableOpacity key={date as string} activeOpacity={0.9} style={[styles.gridCell, { backgroundColor: getHeatmapColor(votersForThisOpt.length), borderColor: 'transparent' }]} onPress={() => {
                          if (votersForThisOpt.length > 0) {
                            setVotersToDisplay(votersForThisOpt);
                            setVoterModalTitle(`${dateTimeStr.slice(5)} 가능 인원`);
                            setShowVoterModal(true);
                          }
                        }}>
                          {votersForThisOpt.length > 0 && <Text style={{fontSize: 9, fontWeight: 'bold', color: theme.background}}>{votersForThisOpt.length}</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>

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
            </View>

            <View style={[styles.rankingSection, { backgroundColor: theme.card }, Shadows.soft]}>
              <Text style={[styles.rankingHeader, { color: theme.text }]}>가장 많이 모이는 시간</Text>
              {(() => {
                if (ranked.length === 0 || ranked[0].votes === 0) return <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>아직 투표가 없습니다.</Text>;

                const groupedByVotes: Record<number, any[]> = {};
                ranked.forEach(r => {
                  if (r.votes === 0) return;
                  if (!groupedByVotes[r.votes]) groupedByVotes[r.votes] = [];
                  groupedByVotes[r.votes].push(r);
                });

                const sortedCounts = Object.keys(groupedByVotes).map(Number).sort((a, b) => b - a);
                
                return (
                  <View style={{ gap: 15 }}>
                    {sortedCounts.slice(0, 3).map((count, idx) => {
                      const opts = groupedByVotes[count];
                      // Group options by date to merge times correctly
                      const dates = Array.from(new Set(opts.map((o:any) => o.dateTime.split(' ')[0]))).sort();
                      const mergedByDate = dates.map(d => {
                        const dayHours = opts.filter((o:any) => o.dateTime.startsWith(d)).map((o:any) => parseInt(o.dateTime.split(' ')[1].split(':')[0])).sort((a:any,b:any) => a-b);
                        const groups = [];
                        let currentGroup = [dayHours[0]];
                        for (let i = 1; i < dayHours.length; i++) {
                          if (dayHours[i] === dayHours[i-1] + 1) currentGroup.push(dayHours[i]);
                          else { groups.push(currentGroup); currentGroup = [dayHours[i]]; }
                        }
                        groups.push(currentGroup);
                        return { date: d, groups };
                      });

                      return (
                        <View key={count} style={[styles.rankingGroup, idx === 0 && { backgroundColor: theme.primary + '10', borderRadius: 20, padding: 18 }]}>
                          <View style={styles.rankingGroupHeader}>
                            <Text style={[styles.rankingIdx, { color: idx === 0 ? theme.primary : theme.textSecondary }]}>{idx + 1}위</Text>
                            <View style={{flexDirection:'row', alignItems:'center'}}>
                              <Text style={[styles.rankingCount, { color: idx === 0 ? theme.primary : theme.textSecondary, marginRight: 5 }]}>{count}명</Text>
                              <Ionicons name="people" size={14} color={idx === 0 ? theme.primary : theme.textSecondary} />
                            </View>
                          </View>
                          <View style={styles.rankingTimesList}>
                            {mergedByDate.map((dateObj, dIdx) => (
                              dateObj.groups.map((group, gIdx) => {
                                const timeStr = group.length > 1 ? `${group[0]}-${group[group.length-1]+1}시` : `${group[0]}시`;
                                return (
                                  <TouchableOpacity key={`${dIdx}-${gIdx}`} style={styles.rankingTimeItem} onPress={() => { 
                                    // Collect all voters for this specific merged range
                                    const voterSet = new Set<string>();
                                    opts.filter((o:any) => o.dateTime.startsWith(dateObj.date) && group.includes(parseInt(o.dateTime.split(' ')[1].split(':')[0]))).forEach((o:any) => o.voters.forEach((v:any) => voterSet.add(v)));
                                    setVotersToDisplay(Array.from(voterSet)); 
                                    setVoterModalTitle(`${dateObj.date.slice(5)} ${timeStr} 투표자`); 
                                    setShowVoterModal(true); 
                                  }}>
                                    <Text style={[styles.rankingText, { color: theme.text }]}>{dateObj.date.slice(5)} {timeStr}</Text>
                                    <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} opacity={0.3} />
                                  </TouchableOpacity>
                                );
                              })
                            ))}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
            </View>

            {isClosed && ranked.length > 0 && ranked[0].votes > 0 && (
              <View style={[styles.resultBanner, {backgroundColor: theme.primary + '15', borderColor: theme.primary}]}>
                <Ionicons name="star" size={20} color={theme.primary} style={{marginBottom: 4}} />
                <Text style={{color: theme.primary, fontWeight:'900', fontSize: 16, textAlign: 'center'}}>최종 추천: {formatMergedTimes(ranked.filter(r => r.votes === ranked[0].votes))}</Text>
                <Text style={{color: theme.primary, fontSize: 12, marginTop: 4}}>{ranked[0].votes}명 참여 가능</Text>
              </View>
            )}
          </ScrollView>

          <OptionModal 
            visible={showScheduleOptions} 
            onClose={() => setShowScheduleOptions(false)} 
            options={scheduleOptions} 
            title="일정 조율 설정" 
            theme={theme} 
          />
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
        {show === 'time' && <View style={{flexDirection:'row', height: 120}}><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>{hours.map(h => <TouchableOpacity key={h} style={[styles.smallTimeBtn, date.getHours() === h && {backgroundColor: theme.primary + '20'}]} onPress={() => { const newD = new Date(date); newD.setHours(h); onDateChange(newD); }}><Text style={{color: date.getHours() === h ? theme.primary : theme.text, fontWeight: '700', fontSize: 16}}>{h}시</Text></TouchableOpacity>)}</ScrollView><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>{minutes.map(m => <TouchableOpacity key={m} style={[styles.smallTimeBtn, date.getMinutes() === m && {backgroundColor: theme.primary + '20'}]} onPress={() => { const newD = new Date(date); newD.setMinutes(m); onDateChange(newD); }}><Text style={{color: date.getMinutes() === m ? theme.primary : theme.text, fontWeight: '700', fontSize: 16}}>{m}분</Text></TouchableOpacity>)}</ScrollView></View>}
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
        <View><Text style={[styles.headerTitle, { color: theme.text }]}>일정 조율</Text><Text style={[styles.headerSub, { color: theme.textSecondary }]}>가장 많이 모이는 시간을 찾아드려요!</Text></View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }, Shadows.glow]} onPress={() => { resetForm(); setShowAddModal(true); }}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>
      </View>

      <FlatList data={roomSchedules} keyExtractor={item => item.id} contentContainerStyle={{paddingBottom: 100}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} renderItem={renderScheduleListItem} ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="calendar-outline" size={48} color={theme.textSecondary + '30'} /><Text style={[styles.emptyText, { color: theme.textSecondary }]}>아직 일정이 없습니다.</Text></View>} />

      {renderDetail()}

      <Modal visible={showVoterModal} transparent animationType="fade" onRequestClose={() => setShowVoterModal(false)}>
        <View style={styles.modalOverlayCenter}><View style={[styles.voterModalContent, { backgroundColor: theme.card }, Shadows.medium]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text, fontSize: 18, fontWeight: '800' }]}>{voterModalTitle}</Text><TouchableOpacity onPress={() => setShowVoterModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity></View><View style={styles.voterList}>{votersToDisplay.map(vId => <View key={vId} style={styles.voterListItem}><View style={[styles.voterAvatar, {backgroundColor: theme.primary + '20'}]}><Text style={{color: theme.primary, fontWeight: '800'}}>{getUserById(vId)?.name?.[0]}</Text></View><Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>{getUserById(vId)?.name || '알 수 없음'}</Text></View>)}{votersToDisplay.length === 0 && <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>참여자가 없습니다.</Text>}</View></View></View>
      </Modal>

      <Modal visible={showAddModal || showEditModal} animationType="slide" transparent onRequestClose={() => { setShowAddModal(false); setShowEditModal(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: theme.card, flex: 1, marginTop: 60 }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>{showEditModal ? '일정 수정' : '새 일정 조율'}</Text><TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); }}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false} style={{flex: 1}} nestedScrollEnabled={true}>
              <Text style={[styles.label, { color: theme.text }]}>제목</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} placeholder="예: 정기 연습" placeholderTextColor={theme.textSecondary} value={title} onChangeText={setTitle} />
              <Text style={[styles.label, { color: theme.text, marginTop: 20 }]}>날짜 선택</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}} nestedScrollEnabled={true}>{Array.from({length: 31}).map((_, day) => { const d = new Date(); d.setDate(d.getDate() + day); const isSelected = !!selectedDates.find(sd => sd.toDateString() === d.toDateString()); return (<TouchableOpacity key={day} style={[styles.dateItem, {backgroundColor: isSelected ? theme.primary : theme.background, borderColor: isSelected ? theme.primary : theme.border}, Shadows.soft]} onPress={() => toggleDate(d)}><Text style={[styles.dateWeek, { color: isSelected ? "#fff" : theme.textSecondary, fontWeight: '800' }]}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text><Text style={[styles.dateDay, { color: isSelected ? "#fff" : theme.text, fontWeight: '900' }]}>{d.getDate()}</Text></TouchableOpacity>); })}</ScrollView>
              <Text style={[styles.label, { color: theme.text }]}>시간 범위 ({startTime}:00 ~ {endTime}:00)</Text>
              <View style={styles.timeSelectRow}>
                <View style={styles.timeCol}><Text style={styles.timeLabel}>시작</Text><ScrollView style={styles.timeScroll} nestedScrollEnabled={true}>{Array.from({length: 24}).map((_, i) => (<TouchableOpacity key={i} onPress={() => setStartTime(i)} style={[styles.smallTimeBtn, startTime === i && { backgroundColor: theme.primary + '20' }]}><Text style={{ color: startTime === i ? theme.primary : theme.text, fontWeight: '700' }}>{i}시</Text></TouchableOpacity>))}</ScrollView></View>
                <View style={styles.timeCol}><Text style={styles.timeLabel}>종료</Text><ScrollView style={styles.timeScroll} nestedScrollEnabled={true}>{Array.from({length: 25}).map((_, i) => (<TouchableOpacity key={i} onPress={() => setEndTime(i)} style={[styles.smallTimeBtn, endTime === i && { backgroundColor: theme.primary + '20' }]}><Text style={{ color: endTime === i ? theme.primary : theme.text, fontWeight: '700' }}>{i}시</Text></TouchableOpacity>))}</ScrollView></View>
              </View>
              <View style={[styles.settingItem, {marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}]}><Text style={[styles.settingLabel, { color: theme.text, fontSize: 16, fontWeight: '700' }]}>푸시 알림 전송</Text><Switch value={useNotification} onValueChange={setUseNotification} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
              <View style={[styles.settingItem, {marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}]}><Text style={[styles.settingLabel, { color: theme.text, fontSize: 16, fontWeight: '700' }]}>마감 기한 설정</Text><Switch value={hasDeadline} onValueChange={setHasDeadline} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
              {hasDeadline && <View style={{marginTop: 10, marginBottom: 20}}><TouchableOpacity style={[styles.compactRow, {backgroundColor: theme.background}]} onPress={() => setShowPicker(showPicker === 'date' ? null : 'date')}><Ionicons name="calendar" size={18} color={theme.primary} /><Text style={{color: theme.text, marginLeft: 10, fontWeight: '700'}}>{formatDateFull(deadline.getTime())}</Text></TouchableOpacity>{showPicker && <CompactPicker date={deadline} onDateChange={setDeadline} show={showPicker} setShow={setShowPicker} />}</View>}
              
              {hasDeadline && (
                <>
                  <Text style={[styles.label, { color: theme.text, marginTop: 10 }]}>마감 전 알림 설정</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}} nestedScrollEnabled={true}>
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

              <TouchableOpacity onPress={showEditModal ? handleUpdateSchedule : handleAddSchedule} style={[styles.saveBtn, { backgroundColor: theme.primary }, Shadows.glow]} disabled={isUpdating}>{isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: '#fff' }]}>{showEditModal ? '변경사항 저장' : '일정 만들기'}</Text>}</TouchableOpacity>
            </ScrollView></View></View>
        </KeyboardAvoidingView>
      </Modal>
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
  detailTitle: { fontSize: 26, fontWeight: '900', marginBottom: 25, letterSpacing: -1, lineHeight: 34 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15, letterSpacing: -0.5 },
  matrixContainer: { marginBottom: 10, marginTop: 5 },
  matrixRow: { flexDirection: 'row', alignItems: 'center' },
  timeLabelCell: { width: 50, alignItems: 'center', justifyContent: 'center', height: 40 },
  timeLabelText: { fontSize: 11, fontWeight: '600' },
  dateHeaderCell: { width: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  dateHeaderText: { fontSize: 11, fontWeight: '600' },
  dateHeaderDay: { fontSize: 16, fontWeight: 'bold' },
  gridCell: { width: 50, height: 40, borderWidth: 1, borderRadius: 10, margin: 1, alignItems: 'center', justifyContent: 'center' },
  gridCellEmpty: { width: 50, height: 40 },
  voterSummaryCard: { padding: 20, borderRadius: 32, marginBottom: 24, marginTop: 10 },
  voterRow: { flexDirection: 'row', alignItems: 'center' },
  voterLabelPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginRight: 12 },
  avatarScroll: { flex: 1 },
  namePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 6 },
  rankingSection: { padding: 24, borderRadius: 32, marginBottom: 24 },
  rankingHeader: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, marginBottom: 16 },
  rankingGroup: { width: '100%' },
  rankingGroupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rankingTimesList: { gap: 8 },
  rankingTimeItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 4 },
  rankingIdx: { fontSize: 14, fontWeight: '900' },
  rankingText: { fontSize: 15, fontWeight: '600' },
  rankingCount: { fontSize: 14, fontWeight: '800' },
  resultBanner: { padding: 20, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', marginBottom: 24 },
  manualCloseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 24, borderWidth: 1.5, marginTop: 10, borderStyle: 'dashed' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { padding: 28, borderTopLeftRadius: 40, borderTopRightRadius: 40, maxHeight: '95%' },
  voterModalContent: { padding: 24, borderRadius: 32, width: '100%' },
  voterList: { marginTop: 16 },
  voterListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  voterAvatar: { width: 40, height: 40, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  label: { fontSize: 15, fontWeight: '800', marginBottom: 12, opacity: 0.8 },
  input: { borderRadius: 20, padding: 18, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  dateItem: { width: 50, height: 58, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dateWeek: { fontSize: 10 },
  dateDay: { fontSize: 16 },
  timeSelectRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  timeCol: { flex: 0.48, alignItems: 'center' },
  timeLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8, opacity: 0.5 },
  timeScroll: { height: 120, width: '100%', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 20 },
  smallTimeBtn: { padding: 15, alignItems: 'center' },
  compactRow: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20 },
  compactPicker: { borderRadius: 24, marginTop: 12, overflow: 'hidden', paddingBottom: 10 },
  pickerHeader: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.02)' },
  pickerTab: { flex: 1, padding: 15, alignItems: 'center' },
  smallDateBtn: { width: 50, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, marginRight: 10 },
  saveBtn: { padding: 20, borderRadius: 24, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 18, fontWeight: '900' },
  emptyContainer: { alignItems: 'center', marginTop: 120 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 12 },
  settingLabel: { fontSize: 16, fontWeight: '700' },
  reminderOpt: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, marginRight: 8, borderWidth: 1 }
});
