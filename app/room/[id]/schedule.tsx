import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, ScrollView, RefreshControl, Dimensions, Switch, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull, OptionModal } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';
import AdBanner from '../../../components/ui/AdBanner';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, withTiming } from 'react-native-reanimated';

export default function ScheduleScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { schedules, addSchedule, updateSchedule, respondToSchedule, deleteSchedule, closeSchedule, markScheduleViewed, theme, currentUser, refreshAllData, rooms, getRoomDisplayUser, checkProAccess, sendProReminder, sendDirectReminder, isPro, blockUser, reportContent, t, language } = useAppContext();
  const getUser = (userId: string) => getRoomDisplayUser(id as string, userId);
  const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', es: 'es-ES', id: 'id-ID', ja: 'ja-JP', zh: 'zh-CN', th: 'th-TH' };
  const locale = localeMap[language] || 'ko-KR';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isSendingUnreadReminder, setIsSendingUnreadReminder] = useState(false);

  // Zoom controls — 100% = fit-all scale
  // fitScaleSV is a shared value so worklets (pinch) can read it reliably
  const fitScaleSV = useSharedValue(1);
  const scale1 = useSharedValue(1);
  const saved1 = useSharedValue(1);
  const scale2 = useSharedValue(1);
  const saved2 = useSharedValue(1);
  const [displayPct1, setDisplayPct1] = useState(100);
  const [displayPct2, setDisplayPct2] = useState(100);

  const adjustScale = (which: 1 | 2, deltaPct: number) => {
    const sRef = which === 1 ? scale1 : scale2;
    const svRef = which === 1 ? saved1 : saved2;
    const setDisplay = which === 1 ? setDisplayPct1 : setDisplayPct2;
    const currentPct = which === 1 ? displayPct1 : displayPct2;
    // Snap to the nearest 10% boundary in the direction of travel
    // e.g. at 174% pressing + → 180%, pressing − → 170%
    const newPct = deltaPct > 0
      ? Math.floor(currentPct / 10) * 10 + 10
      : Math.ceil(currentPct / 10) * 10 - 10;
    const clampedPct = Math.min(Math.max(newPct, 30), 300);
    const newScale = (clampedPct / 100) * fitScaleSV.value;
    sRef.value = withTiming(newScale, { duration: 180 });
    svRef.value = newScale;
    setDisplay(clampedPct);
  };

  const pinch1 = Gesture.Pinch()
    .onUpdate(e => { scale1.value = Math.min(Math.max(saved1.value * e.scale, fitScaleSV.value * 0.3), fitScaleSV.value * 3); })
    .onEnd(() => { saved1.value = scale1.value; runOnJS(setDisplayPct1)(Math.round((scale1.value / fitScaleSV.value) * 100)); });
  const pinch2 = Gesture.Pinch()
    .onUpdate(e => { scale2.value = Math.min(Math.max(saved2.value * e.scale, fitScaleSV.value * 0.3), fitScaleSV.value * 3); })
    .onEnd(() => { saved2.value = scale2.value; runOnJS(setDisplayPct2)(Math.round((scale2.value / fitScaleSV.value) * 100)); });
  // transformOrigin keeps the left edge fixed on scale — no translateX needed (avoids breaking touch targets)
  const animStyle1 = useAnimatedStyle(() => ({ transform: [{ scale: scale1.value }] }));
  const animStyle2 = useAnimatedStyle(() => ({ transform: [{ scale: scale2.value }] }));

  // Auto-fit: 100% = entire grid visible on screen
  useEffect(() => {
    if (!activeSchedule || !selectedScheduleId) return;
    const uniqueDatesCount = Array.from(new Set(activeSchedule.options.map((o: any) => String(o.dateTime).split(' ')[0]))).length;
    // cell width 50 + 2px margin each side, time label column 52
    const contentWidth = 52 + uniqueDatesCount * 52;
    const availableWidth = Dimensions.get('window').width - 48;
    const fitScale = Math.min(1, Math.max(0.2, availableWidth / contentWidth));
    fitScaleSV.value = fitScale;
    scale1.value = fitScale;
    saved1.value = fitScale;
    scale2.value = fitScale;
    saved2.value = fitScale;
    setDisplayPct1(100);
    setDisplayPct2(100);
  }, [selectedScheduleId]);

  useEffect(() => {
    if (selectedScheduleId) markScheduleViewed(selectedScheduleId);
  }, [selectedScheduleId]);

  const [showVoterModal, setShowVoterModal] = useState(false);
  const [voterModalTitle, setVoterModalTitle] = useState('');
  const [votersToDisplay, setVotersToDisplay] = useState<string[]>([]);

  // Cache for the active schedule to prevent flickering during refetches
  const [cachedSchedule, setCachedSchedule] = useState<any>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [startTime, setStartTime] = useState(14);
  const [endTime, setEndTime] = useState(18);
  const [useNotification, setUseNotification] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);

  // Option Modal states
  const [showScheduleOptions, setShowScheduleOptions] = useState(false);

  const roomSchedules = useMemo(() => schedules.filter(s => s.roomId === id), [schedules, id]);
  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);
  
  const activeSchedule = useMemo(() => {
    const found = roomSchedules.find(s => s.id === selectedScheduleId);
    if (found) return found;
    return cachedSchedule;
  }, [roomSchedules, selectedScheduleId, cachedSchedule]);

  useEffect(() => {
    const found = roomSchedules.find(s => s.id === selectedScheduleId);
    if (found) setCachedSchedule(found);
  }, [roomSchedules, selectedScheduleId]);

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
    if (!title.trim() || selectedDates.length === 0) return Alert.alert(t('error'), t('titleAndDateRequired'));
    if (startTime >= endTime) return Alert.alert(t('timeSettingError'), t('endTimeAfterStartTime'));
    
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
    } catch (e: any) { Alert.alert(t('error'), e.message); }
    finally { setIsUpdating(false); }
  };

  const resetForm = () => {
    setTitle(''); setSelectedDates([]); setHasDeadline(false); setStartTime(14); setEndTime(18); setDeadline(new Date(Date.now() + 24 * 60 * 60 * 1000)); setUseNotification(false); setReminderMinutes(30);
  };

  const openEditModal = () => {
    if (!activeSchedule) return;
    setTitle(activeSchedule.title);
    setHasDeadline(!!activeSchedule.deadline);
    setUseNotification(activeSchedule.useNotification === true);
    setReminderMinutes(activeSchedule.reminderMinutes || 30);
    if (activeSchedule.deadline) setDeadline(new Date(activeSchedule.deadline));
    
    const existingDates = Array.from(new Set(activeSchedule.options.map((o:any) => o.dateTime.split(' ')[0]))).map(ds => new Date(ds as string));
    setSelectedDates(existingDates);
    
    const existingHours = activeSchedule.options.map((o:any) => parseInt(o.dateTime.split(' ')[1].split(':')[0]));
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
    } catch (e: any) { Alert.alert(t('error'), e.message); }
    finally { setIsUpdating(false); }
  };

  const handleDeleteSchedule = () => {
    Alert.alert(t('deleteScheduleTitle'), t('deleteConfirm'), [
      { text: t('cancel') },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        await deleteSchedule(selectedScheduleId!);
        setSelectedScheduleId(null);
        setCachedSchedule(null);
      }}
    ]);
  };

  const handleSendReminder = async () => {
    if (!selectedScheduleId) return;
    const access = checkProAccess('reminder');
    if (!access.canAccess) {
      return Alert.alert(
        t('proFeatureTitle'),
        t('reminderProOnly'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('viewMembership'), onPress: () => router.push('/subscription') }
        ]
      );
    }

    setIsSendingReminder(true);
    try {
      await sendProReminder(id!, 'schedule', selectedScheduleId);
      Alert.alert(t('notificationSent'), t('reminderSentDesc'));
    } catch (e: any) {
      Alert.alert(t('error'), e.message);
    } finally {
      setIsSendingReminder(false);
    }
  };

  const isScheduleAuthor = activeSchedule?.userId === currentUser?.id;
  const isScheduleLeader = (currentRoom as any)?.leaderId === currentUser?.id;
  const scheduleOptions = isScheduleAuthor || isScheduleLeader ? [
    { label: t('remindNotParticipants'), icon: 'notifications-outline', onPress: handleSendReminder },
    ...(isScheduleAuthor ? [{ label: t('editTitleDeadline'), icon: 'create-outline', onPress: openEditModal }] : []),
    { label: activeSchedule?.deadline && new Date(activeSchedule.deadline) < new Date() ? t('closedBadge') : t('closeImmediately'),
      icon: 'stop-circle-outline',
      destructive: true,
      onPress: () => {
        Alert.alert(t('closeScheduleTitle'), t('closeScheduleConfirm'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('closeAction'), style: 'destructive', onPress: async () => {
            await closeSchedule(selectedScheduleId!);
          }}
        ]);
      }
    },
    { label: t('delete'), icon: 'trash-outline', destructive: true, onPress: handleDeleteSchedule }
  ] : [
    { label: t('report'), icon: 'warning-outline', destructive: true, onPress: () => { if(activeSchedule) reportContent(activeSchedule.id, 'schedule'); } },
    { label: t('blockUser'), icon: 'ban-outline', destructive: true, onPress: () => { if(activeSchedule) blockUser(activeSchedule.userId); } }
  ];

  const renderScheduleListItem = ({ item: schedule }: { item: any }) => {
    const participantsCount = Object.keys(schedule.responses).length;
    const isClosed = schedule.deadline && new Date(schedule.deadline) < new Date();
    return (
      <TouchableOpacity 
        activeOpacity={0.8}
        style={[
          styles.listCard, 
          { backgroundColor: isClosed ? (theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)') : theme.card }, 
          isClosed ? { elevation: 0, shadowOpacity: 0 } : Shadows.soft
        ]} 
        onPress={() => setSelectedScheduleId(schedule.id)}
      >
        <View style={[styles.listInfo, isClosed && { opacity: 0.5 }]}>
          <View style={{flexDirection:'row', alignItems:'center', marginBottom: 6}}>
            <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>{schedule.title}</Text>
            {isClosed && (
              <View style={[styles.closedBadge, {backgroundColor: theme.textSecondary + '20'}]}>
                <Text style={{fontSize: 10, color: theme.textSecondary, fontWeight: '800'}}>{t('closedBadge')}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.listMeta, { color: theme.textSecondary }]}>{t('participants')} {participantsCount}{t('peopleCount')} • {formatDateFull(schedule.createdAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} style={{opacity: isClosed ? 0.2 : 0.5}} />
      </TouchableOpacity>
    );
  };

  const getHeatmapColor = (votes: number) => {
    if (votes === 0) return 'transparent';
    const participantsTotal = Object.keys(activeSchedule?.responses || {}).length;
    const maxVotes = Math.max(participantsTotal, 1);
    const intensity = 0.15 + (votes / maxVotes) * 0.85;
    return theme.primary + Math.floor(intensity * 255).toString(16).padStart(2, '0');
  };

  const topBlocks = useMemo(() => {
    if (!activeSchedule || !activeSchedule.options || activeSchedule.options.length === 0) return [];
    const schedule = activeSchedule;
    
    const dateGroups: { [date: string]: any[] } = {};
    schedule.options.forEach((opt: any) => {
      const [date, time] = String(opt.dateTime).split(' ');
      const hour = parseInt((time || '00').split(':')[0]);
      if (!dateGroups[date]) dateGroups[date] = [];
      dateGroups[date].push({ ...opt, hour });
    });

    const allBlocks: any[] = [];
    Object.entries(dateGroups).forEach(([date, dayOptions]) => {
      dayOptions.sort((a, b) => a.hour - b.hour);
      const hours = dayOptions.map(o => o.hour);
      
      for (let i = 0; i < hours.length; i++) {
        for (let j = i; j < hours.length; j++) {
          if (hours[j] !== hours[i] + (j - i)) break;

          const blockOptionIds = dayOptions.slice(i, j + 1).map(o => o.id);
          const commonVoters = Object.entries(schedule.responses).filter(([uId, optIds]: any) => {
            return blockOptionIds.every(id => optIds.includes(id));
          }).map(([uId]) => uId);

          if (commonVoters.length > 0) {
            allBlocks.push({
              date,
              startHour: hours[i],
              endHour: hours[j] + 1,
              voters: commonVoters,
              votes: commonVoters.length,
              duration: (hours[j] + 1) - hours[i]
            });
          }
        }
      }
    });

    const meaningfulBlocks = allBlocks.filter(blockA => {
      const isSubBlock = allBlocks.some(blockB => {
        if (blockA === blockB) return false;
        return blockA.date === blockB.date &&
               blockA.startHour >= blockB.startHour &&
               blockA.endHour <= blockB.endHour &&
               blockA.votes <= blockB.votes &&
               !(blockA.startHour === blockB.startHour && blockA.endHour === blockB.endHour);
      });
      const hasBetterVoterSet = allBlocks.some(blockB => {
        return blockA.date === blockB.date &&
               blockA.startHour === blockB.startHour &&
               blockA.endHour === blockB.endHour &&
               blockB.votes > blockA.votes;
      });
      return !isSubBlock && !hasBetterVoterSet;
    });

    meaningfulBlocks.sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      if (b.duration !== a.duration) return b.duration - a.duration;
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startHour - b.startHour;
    });

    const unique = [];
    const seen = new Set();
    for (const b of meaningfulBlocks) {
      const key = `${b.date}-${b.startHour}-${b.endHour}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(b);
      }
    }
    
    const voteValues = Array.from(new Set(unique.map(b => b.votes))).sort((a, b) => b - a);
    const top3VoteValues = voteValues.slice(0, 3);
    const filtered = unique.filter(b => top3VoteValues.includes(b.votes));

    // Group by votes
    const groups: { [votes: number]: any[] } = {};
    filtered.forEach(block => {
      if (!groups[block.votes]) groups[block.votes] = [];
      groups[block.votes].push(block);
    });

    return Object.entries(groups)
      .map(([votes, blocks]) => ({ votes: parseInt(votes), blocks }))
      .sort((a, b) => b.votes - a.votes);
  }, [activeSchedule]);

  const renderDetail = () => {
    if (!activeSchedule) return null;
    const schedule = activeSchedule;
    const isClosed = schedule.deadline && new Date(schedule.deadline) < new Date();
    const participants = Object.keys(schedule.responses);
    const nonParticipants = (currentRoom?.members || []).filter(mId => !participants.includes(mId));
    const isOwner = schedule.userId === currentUser?.id || (currentRoom as any)?.leaderId === currentUser?.id;

    const allMembers = currentRoom?.members || [];
    const viewedMembers = schedule.viewedBy || [];
    const readAndParticipated = participants;
    const readNotParticipated = allMembers.filter(id => viewedMembers.includes(id) && !participants.includes(id));
    const unreadMembers = allMembers.filter(id => !viewedMembers.includes(id) && !participants.includes(id));

    const handleSendUnreadReminder = async () => {
      if (!isPro) return Alert.alert(t('proFeatureTitle'), t('unreadReminderProOnly'), [{ text: t('cancel'), style: 'cancel' }, { text: t('viewMembership'), onPress: () => router.push('/subscription') }]);
      setIsSendingUnreadReminder(true);
      try {
        await sendDirectReminder(unreadMembers, t('sendUnreadReminder').replace(' (PRO)', ''), `"${schedule.title}" 일정 조율을 아직 확인하지 않으셨어요!`);
        Alert.alert(t('sendUnreadReminder').replace(' (PRO)', ''), t('notificationSent'));
      } catch (e: any) { Alert.alert(t('errorTitle'), e.message); }
      finally { setIsSendingUnreadReminder(false); }
    };

    const uniqueDates = Array.from(new Set(schedule.options.map((o: any) => String(o.dateTime).split(' ')[0]))).sort() as string[];
    const hours = Array.from(new Set(schedule.options.map((o: any) => parseInt((String(o.dateTime) || ' 00').split(' ')[1].split(':')[0])))).sort((a: any, b: any) => a - b) as number[];

    const ranked = schedule.options.map((opt: any) => ({
      ...opt,
      votes: Object.values(schedule.responses).filter((ids: any) => ids.includes(opt.id)).length,
      voters: Object.entries(schedule.responses).filter(([_, ids]: any) => ids.includes(opt.id)).map(([uId]) => uId)
    })).sort((a: any, b: any) => b.votes - a.votes);

    return (
      <Modal visible={!!selectedScheduleId} animationType="slide" transparent={false} onRequestClose={() => setSelectedScheduleId(null)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedScheduleId(null)} style={styles.closeBtn}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            <Text style={[styles.detailHeaderTitle, { color: theme.text }]}>{t('scheduleDetail')}</Text>
            <TouchableOpacity onPress={() => setShowScheduleOptions(true)} style={styles.detailDeleteBtn}><Ionicons name="ellipsis-vertical" size={24} color={theme.text} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.statusRow}>
              {isClosed ? (
                <View style={[styles.statusBadge, {backgroundColor: theme.error + '15'}]}><Text style={{color: theme.error, fontWeight:'800', fontSize: 12}}>{t('statusDeadline')}</Text></View>
              ) : (
                <View style={[styles.statusBadge, {backgroundColor: theme.primary + '15'}]}><Text style={{color: theme.primary, fontWeight:'800', fontSize: 12}}>{t('statusActive')}</Text></View>
              )}
              {schedule.deadline && !isClosed && (
                <View style={styles.deadlineInfo}>
                  <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                  <Text style={{color: theme.textSecondary, fontSize: 12, marginLeft: 4, fontWeight: '600'}}>{formatDateFull(schedule.deadline, language)} {t('deadline')}</Text>
                </View>
              )}
            </View>
            
            <Text style={[styles.detailTitle, { color: theme.text }]}>{schedule.title}</Text>
            
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('timePreference')}</Text>
              <View style={[styles.zoomBar, { borderColor: theme.border }]}>
                <TouchableOpacity style={styles.zoomBtnInner} onPress={() => adjustScale(1, -10)}><Text style={[styles.zoomBtnText, { color: theme.text }]}>−</Text></TouchableOpacity>
                <Text style={[styles.zoomPct, { color: theme.primary, borderLeftWidth: 1, borderRightWidth: 1, borderColor: theme.border }]}>{displayPct1}%</Text>
                <TouchableOpacity style={styles.zoomBtnInner} onPress={() => adjustScale(1, 10)}><Text style={[styles.zoomBtnText, { color: theme.text }]}>+</Text></TouchableOpacity>
              </View>
            </View>
            {/* Grid 1: sticky time column + scrollable dates/cells */}
            <View style={styles.gridWrapper}>
              <Animated.View style={[animStyle1, { transformOrigin: [0, '50%', 0] }]}>
                {/* Spacer matching date header row: dateHeaderCell(h:40) + marginBottom(10) = 50 */}
                <View style={{ height: 50 }} />
                {hours.map(hour => (
                  <View key={hour} style={styles.timeLabelCell}>
                    <Text style={[styles.timeLabelText, { color: theme.textSecondary }]}>{hour}:00</Text>
                  </View>
                ))}
              </Animated.View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                <GestureDetector gesture={pinch1}>
                  <Animated.View style={[animStyle1, { transformOrigin: [0, '50%', 0] }]}>
                    <View style={{ flexDirection: 'row' }}>
                      {uniqueDates.map(date => {
                        const d = new Date(date as string);
                        return (<View key={date as string} style={styles.dateHeaderCell}><Text style={[styles.dateHeaderText, { color: theme.textSecondary }]}>{d.toLocaleDateString(locale, { weekday: 'short' })}</Text><Text style={[styles.dateHeaderDay, { color: theme.text }]}>{d.getDate()}</Text></View>);
                      })}
                    </View>
                    {hours.map(hour => (
                      <View key={hour} style={{ flexDirection: 'row' }}>
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
                  </Animated.View>
                </GestureDetector>
              </ScrollView>
            </View>

            <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('participationStatus')}</Text>
              <View style={[styles.zoomBar, { borderColor: theme.border }]}>
                <TouchableOpacity style={styles.zoomBtnInner} onPress={() => adjustScale(2, -10)}><Text style={[styles.zoomBtnText, { color: theme.text }]}>−</Text></TouchableOpacity>
                <Text style={[styles.zoomPct, { color: theme.primary, borderLeftWidth: 1, borderRightWidth: 1, borderColor: theme.border }]}>{displayPct2}%</Text>
                <TouchableOpacity style={styles.zoomBtnInner} onPress={() => adjustScale(2, 10)}><Text style={[styles.zoomBtnText, { color: theme.text }]}>+</Text></TouchableOpacity>
              </View>
            </View>
            {/* Grid 2: sticky time column + scrollable heatmap */}
            <View style={styles.gridWrapper}>
              <Animated.View style={[animStyle2, { transformOrigin: [0, '50%', 0] }]}>
                <View style={{ height: 50 }} />
                {hours.map(hour => (
                  <View key={hour} style={styles.timeLabelCell}>
                    <Text style={[styles.timeLabelText, { color: theme.textSecondary }]}>{hour}:00</Text>
                  </View>
                ))}
              </Animated.View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                <GestureDetector gesture={pinch2}>
                  <Animated.View style={[animStyle2, { transformOrigin: [0, '50%', 0] }]}>
                    <View style={{ flexDirection: 'row' }}>
                      {uniqueDates.map(date => {
                        const d = new Date(date as string);
                        return (<View key={date as string} style={styles.dateHeaderCell}><Text style={[styles.dateHeaderText, { color: theme.textSecondary }]}>{d.toLocaleDateString(locale, { weekday: 'short' })}</Text><Text style={[styles.dateHeaderDay, { color: theme.text }]}>{d.getDate()}</Text></View>);
                      })}
                    </View>
                    {hours.map(hour => (
                      <View key={hour} style={{ flexDirection: 'row' }}>
                        {uniqueDates.map(date => {
                          const dateTimeStr = `${date} ${hour.toString().padStart(2, '0')}:00`;
                          const opt = schedule.options.find((o: any) => o.dateTime === dateTimeStr);
                          if (!opt) return <View key={date as string} style={styles.gridCellEmpty} />;
                          const votersForThisOpt = Object.entries(schedule.responses).filter(([_, ids]: any) => ids.includes(opt.id)).map(([uId]) => uId);
                          return (
                            <TouchableOpacity key={date as string} activeOpacity={0.9} style={[styles.gridCell, { backgroundColor: getHeatmapColor(votersForThisOpt.length), borderColor: theme.border + '50' }]} onPress={() => {
                              if (votersForThisOpt.length > 0) {
                                setVotersToDisplay(votersForThisOpt);
                                setVoterModalTitle(`${dateTimeStr.slice(5)} ${t('availableMembers')}`);
                                setShowVoterModal(true);
                              }
                            }}>
                              {votersForThisOpt.length > 0 && <Text style={{fontSize: 9, fontWeight: 'bold', color: theme.background}}>{votersForThisOpt.length}</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                  </Animated.View>
                </GestureDetector>
              </ScrollView>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>{t('participationStatus')}</Text>
            <View style={[styles.voterSummaryCard, { backgroundColor: theme.card }, Shadows.soft]}>
              {([
                { key: 'readParticipated', members: readAndParticipated, color: theme.primary, bg: theme.primary + '15', nameBg: theme.primary + '10' },
                { key: 'readNotParticipated', members: readNotParticipated, color: '#FFA500', bg: '#FFA50025', nameBg: '#FFA50015' },
                { key: 'unread', members: unreadMembers, color: theme.textSecondary, bg: theme.textSecondary + '15', nameBg: theme.textSecondary + '10' },
              ] as const).map(({ key, members, color, bg, nameBg }, idx) => (
                <View key={key} style={idx > 0 ? { marginTop: 16 } : undefined}>
                  <View style={[styles.voterLabelPill, { backgroundColor: bg, alignSelf: 'flex-start', marginBottom: 8 }]}>
                    <Text style={{ color, fontWeight: '800', fontSize: 11 }} numberOfLines={1}>{t(key)} · {members.length}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {members.length > 0
                      ? members.map(vId => <Text key={vId} style={{ fontSize: 12, color: theme.textSecondary, marginRight: 10, fontWeight: '600' }}>{getUser(vId)?.name || '?'}</Text>)
                      : <Text style={{ fontSize: 11, color: theme.textSecondary, paddingLeft: 4, opacity: 0.5 }}>-</Text>
                    }
                  </ScrollView>
                </View>
              ))}

              {!isClosed && isOwner && readNotParticipated.length > 0 && (
                <TouchableOpacity style={[styles.manualReminderBtn, { backgroundColor: theme.primary + '15', marginTop: 16 }]} onPress={handleSendReminder} disabled={isSendingReminder}>
                  {isSendingReminder ? <ActivityIndicator size="small" color={theme.primary} /> : (
                    <><Ionicons name="notifications" size={15} color={theme.primary} /><Text style={{ color: theme.primary, fontWeight: '800', marginLeft: 8, fontSize: 12, flexShrink: 1 }} numberOfLines={2}>{t('notParticipants')} 알림 (PRO)</Text></>
                  )}
                </TouchableOpacity>
              )}
              {!isClosed && isOwner && unreadMembers.length > 0 && (
                <TouchableOpacity style={[styles.manualReminderBtn, { backgroundColor: theme.textSecondary + '10', marginTop: 8 }]} onPress={handleSendUnreadReminder} disabled={isSendingUnreadReminder}>
                  {isSendingUnreadReminder ? <ActivityIndicator size="small" color={theme.textSecondary} /> : (
                    <><Ionicons name="eye-off-outline" size={15} color={theme.textSecondary} /><Text style={{ color: theme.textSecondary, fontWeight: '800', marginLeft: 8, fontSize: 12, flexShrink: 1 }} numberOfLines={2}>{t('sendUnreadReminder')}</Text></>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.rankingSection, { backgroundColor: theme.card }, Shadows.soft]}>
              <Text style={[styles.rankingHeader, { color: theme.text, marginBottom: 15 }]}>{t('bestTimes')}</Text>
              {topBlocks.length > 0 ? (
                <View style={{ gap: 16 }}>
                  {topBlocks.map((group: any, index: number) => {
                    const rankNum = index + 1;
                    return (
                      <View 
                        key={index} 
                        style={[styles.rankGroupCard, { backgroundColor: rankNum === 1 ? theme.primary + '10' : theme.background, borderColor: rankNum === 1 ? theme.primary + '20' : theme.border + '30', borderWidth: 1 }]}
                      >
                        <View style={styles.rankGroupHeader}>
                          <View style={[styles.rankBadge, { backgroundColor: rankNum === 1 ? theme.primary : theme.textSecondary + '40' }]}>
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{rankNum}{t('rankSuffix')}</Text>
                          </View>
                          <Text style={{ color: rankNum === 1 ? theme.primary : theme.text, fontWeight: '900', fontSize: 16, marginLeft: 10 }}>{group.votes}{t('peopleCount')}</Text>
                        </View>
                        
                        <View style={styles.rankGroupContent}>
                          {group.blocks.map((block: any, bIndex: number) => (
                            <TouchableOpacity 
                              key={bIndex} 
                              activeOpacity={0.6}
                              style={[styles.rankSlotRow, bIndex > 0 && { borderTopWidth: 1, borderTopColor: theme.border + '20' }]}
                              onPress={() => {
                                setVotersToDisplay(block.voters);
                                const d = new Date(block.date);
                                const dateStr = d.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' });
                                setVoterModalTitle(`${dateStr} ${block.startHour}-${block.endHour} ${t('availableMembers')}`);
                                setShowVoterModal(true);
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 15 }}>
                                  {new Date(block.date).toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' })}
                                </Text>
                                <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 13, marginTop: 2 }}>
                                  {block.startHour}{t('hourSuffix')} - {block.endHour}{t('hourSuffix')}
                                </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                  <Text style={{ fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 4, opacity: 0.7 }}>
                    {t('touchToViewMembers')}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>{t('noScheduleData')}</Text>
              )}
            </View>
          </ScrollView>

          <OptionModal visible={showScheduleOptions} onClose={() => setShowScheduleOptions(false)} options={scheduleOptions} title={t('scheduleSettings')} theme={theme} cancelLabel={t('cancel')} />
        </View>
        </GestureHandlerRootView>
      </Modal>
    );
  };

  const CompactPicker = ({ date, onDateChange, show, setShow }: any) => {
    const days = Array.from({length: 30}).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
    const hours = Array.from({length: 24}).map((_, i) => i);
    const minutes = [0, 10, 20, 30, 40, 50, 59];
    return (
      <View style={[styles.compactPicker, {backgroundColor: theme.background}, Shadows.soft]}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity style={[styles.pickerTab, show === 'date' && {borderBottomColor: theme.primary, borderBottomWidth: 3}]} onPress={() => setShow('date')}><Text style={{color: theme.text, fontWeight: '700'}}>{t('dateLabel')}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.pickerTab, show === 'time' && {borderBottomColor: theme.primary, borderBottomWidth: 3}]} onPress={() => setShow('time')}><Text style={{color: theme.text, fontWeight: '700'}}>{t('timeLabel')}</Text></TouchableOpacity>
        </View>
        {show === 'date' && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{padding: 15}}>{days.map((d, i) => {
          const isSelected = date.toDateString() === d.toDateString();
          return (
            <TouchableOpacity 
              key={i} 
              style={[
                styles.smallDateBtn, 
                { backgroundColor: isSelected ? theme.primary : (theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') },
                isSelected && Shadows.glow
              ]} 
              onPress={() => { const newD = new Date(date); newD.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); onDateChange(newD); }}
            >
              <Text style={{fontSize: 10, color: isSelected ? '#fff' : theme.textSecondary, fontWeight: '800'}}>{d.toLocaleDateString(locale, { weekday: 'short' })}</Text>
              <Text style={{fontSize: 16, fontWeight: '900', color: isSelected ? '#fff' : theme.text}}>{d.getDate()}</Text>
            </TouchableOpacity>
          );
        })}</ScrollView>}
        {show === 'time' && <View style={{flexDirection:'row', height: 180}}><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>{hours.map(h => <TouchableOpacity key={h} style={[styles.smallTimeBtn, date.getHours() === h && {backgroundColor: theme.primary + '20'}]} onPress={() => { const newD = new Date(date); newD.setHours(h); onDateChange(newD); }}><Text style={{color: date.getHours() === h ? theme.primary : theme.text, fontWeight: '700', fontSize: 16}}>{h}{t('hourSuffix')}</Text></TouchableOpacity>)}</ScrollView><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>{minutes.map(m => <TouchableOpacity key={m} style={[styles.smallTimeBtn, date.getMinutes() === m && {backgroundColor: theme.primary + '20'}]} onPress={() => { const newD = new Date(date); newD.setMinutes(m); onDateChange(newD); }}><Text style={{color: date.getMinutes() === m ? theme.primary : theme.text, fontWeight: '700', fontSize: 16}}>{m}{t('minuteSuffix')}</Text></TouchableOpacity>)}</ScrollView></View>}
      </View>
    );
  };

  const reminderOptions = [
    { label: t('none'), value: 0 },
    { label: t('30minsBefore'), value: 30 },
    { label: t('1hourBefore'), value: 60 },
    { label: t('3hoursBefore'), value: 180 },
    { label: t('6hoursBefore'), value: 360 },
    { label: t('12hoursBefore'), value: 720 },
    { label: t('1dayBefore'), value: 1440 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 50 }]}>
      <View style={styles.header}>
        <View><Text style={[styles.headerTitle, { color: theme.text }]}>{t('practiceScheduleTitle')}</Text><Text style={[styles.headerSub, { color: theme.textSecondary }]}>{t('practiceScheduleSub')}</Text></View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }, Shadows.glow]} onPress={() => { resetForm(); setShowAddModal(true); }}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>
      </View>

      <FlatList 
        data={roomSchedules} 
        keyExtractor={item => item.id} 
        contentContainerStyle={{paddingBottom: 100}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} 
        renderItem={renderScheduleListItem} 
        ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="calendar-outline" size={48} color={theme.textSecondary + '30'} /><Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('noSchedulesFound')}</Text></View>} 
      />

      {renderDetail()}

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal || showEditModal} animationType="slide" transparent onRequestClose={() => { setShowAddModal(false); setShowEditModal(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: theme.card, flex: 1, marginTop: 60 }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>{showEditModal ? t('editScheduleTitle') : t('newScheduleTitle')}</Text><TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); }}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false} style={{flex: 1}}>
              <Text style={[styles.label, { color: theme.text }]}>{t('scheduleTitleLabel')}</Text>
              <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} placeholder={t('scheduleExample')} placeholderTextColor={theme.textSecondary} value={title} onChangeText={setTitle} />
              
              <Text style={[styles.label, { color: theme.text, marginTop: 10 }]}>{t('selectDatesMultiple')}</Text>
              <View style={[styles.dateSelectionContainer, { backgroundColor: theme.background }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {Array.from({length: 30}).map((_, i) => {
                    const d = new Date(); d.setDate(d.getDate() + i);
                    const isSel = !!selectedDates.find(sd => sd.toDateString() === d.toDateString());
                    return (
                      <TouchableOpacity 
                        key={i} 
                        onPress={() => toggleDate(d)} 
                        style={[
                          styles.smallDateBtn, 
                          { backgroundColor: isSel ? theme.primary : (theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') },
                          isSel && Shadows.glow
                        ]}
                      >
                        <Text style={{fontSize: 10, color: isSel ? '#fff' : theme.textSecondary, fontWeight: '800'}}>{d.toLocaleDateString(locale, { weekday: 'short' })}</Text>
                        <Text style={{fontSize: 16, fontWeight: '900', color: isSel ? '#fff' : theme.text}}>{d.getDate()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {selectedDates.length === 0 && (
                  <View style={styles.dateSelectionPlaceholder}>
                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>{t('selectAvailableDates')}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.label, { color: theme.text, marginTop: 25 }]}>{t('setTimeRange')}</Text>
              <View style={[styles.timeRangeContainer, { backgroundColor: theme.background }]}>
                <View style={{flex:1, alignItems:'center'}}>
                  <Text style={{color: theme.textSecondary, fontSize:11, marginBottom:8, fontWeight:'700'}}>{t('startTimeLabel')}</Text>
                  <ScrollView horizontal style={{width:'100%'}} showsHorizontalScrollIndicator={false}>
                    {Array.from({length: 24}).map((_,h) => (
                      <TouchableOpacity key={h} onPress={()=>setStartTime(h)} style={[styles.timeSlotBtn, startTime===h && {backgroundColor:theme.primary, ...Shadows.soft}]}>
                        <Text style={{color:startTime===h?'#fff':theme.text, fontWeight:'800'}}>{h}{t('hourSuffix')}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{ paddingHorizontal: 10, paddingTop: 20 }}>
                  <Ionicons name="arrow-forward" size={18} color={theme.textSecondary} />
                </View>
                <View style={{flex:1, alignItems:'center'}}>
                  <Text style={{color: theme.textSecondary, fontSize:11, marginBottom:8, fontWeight:'700'}}>{t('endTimeLabel')}</Text>
                  <ScrollView horizontal style={{width:'100%'}} showsHorizontalScrollIndicator={false}>
                    {Array.from({length: 24}).map((_,h) => (
                      <TouchableOpacity key={h} onPress={()=>setEndTime(h)} style={[styles.timeSlotBtn, endTime===h && {backgroundColor:theme.primary, ...Shadows.soft}]}>
                        <Text style={{color:endTime===h?'#fff':theme.text, fontWeight:'800'}}>{h}{t('hourSuffix')}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
              
              <View style={[styles.settingItem, {marginTop: 10}]}><Text style={[styles.settingLabel, { color: theme.text }]}>{t('setDeadlineLabel')}</Text><Switch value={hasDeadline} onValueChange={v => { setHasDeadline(v); if (v) setShowPicker('date'); }} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
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
                  <Text style={[styles.label, { color: theme.text, marginTop: 10 }]}>{t('preDeadlineNotification')}</Text>
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

              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>{t('sendPushNotification')}</Text><Switch value={useNotification} onValueChange={setUseNotification} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>

              <TouchableOpacity onPress={showEditModal ? handleUpdateSchedule : handleAddSchedule} style={[styles.saveBtn, { backgroundColor: theme.primary }, Shadows.glow]} disabled={isUpdating}>{isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: '#fff' }]}>{showEditModal ? t('saveChangesBtn') : t('registerScheduleBtn')}</Text>}</TouchableOpacity>
            </ScrollView>
          </View></View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showVoterModal} transparent animationType="fade" onRequestClose={() => setShowVoterModal(false)}>
        <View style={styles.modalOverlayCenter}><View style={[styles.voterModalContent, { backgroundColor: theme.card }, Shadows.medium]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text, fontSize: 18, fontWeight: '800' }]}>{voterModalTitle}</Text><TouchableOpacity onPress={() => setShowVoterModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity></View><View style={styles.voterList}>{votersToDisplay.map(vId => <View key={vId} style={styles.voterListItem}><View style={[styles.voterAvatar, {backgroundColor: theme.primary + '20'}]}><Text style={{color: theme.primary, fontWeight: '800'}}>{getUser(vId)?.name?.[0]}</Text></View><Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>{getUser(vId)?.name || t('unknownAuthor')}</Text></View>)}{votersToDisplay.length === 0 && <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>{t('noParticipants')}</Text>}</View></View></View>
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
  detailTitle: { fontSize: 26, fontWeight: '900', marginBottom: 25, letterSpacing: -1, lineHeight: 34 },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  matrixContainer: { marginBottom: 10, marginTop: 5 },
  matrixRow: { flexDirection: 'row', alignItems: 'center' },
  gridWrapper: { flexDirection: 'row', marginBottom: 10, marginTop: 5 },
  timeLabelCell: { width: 50, alignItems: 'center', justifyContent: 'center', height: 40 },
  timeLabelText: { fontSize: 11, fontWeight: '600' },
  dateHeaderCell: { width: 50, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  dateHeaderText: { fontSize: 11, fontWeight: '600' },
  dateHeaderDay: { fontSize: 16, fontWeight: 'bold' },
  gridCell: { width: 50, height: 40, borderWidth: 1, borderRadius: 10, margin: 1, alignItems: 'center', justifyContent: 'center' },
  gridCellEmpty: { width: 50, height: 40 },
  voterSummaryCard: { padding: 20, borderRadius: 32, marginBottom: 24, marginTop: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  zoomBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, overflow: 'hidden' },
  zoomBtnInner: { paddingHorizontal: 10, paddingVertical: 5 },
  zoomBtnText: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  zoomPct: { fontSize: 11, fontWeight: '800', minWidth: 38, textAlign: 'center', paddingVertical: 5 },
  voterRow: { flexDirection: 'row', alignItems: 'center' },
  voterLabelPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginRight: 12 },
  avatarScroll: { flex: 1 },
  namePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 6 },
  manualReminderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, marginTop: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  rankingSection: { padding: 24, borderRadius: 32, marginBottom: 24 },
  rankingHeader: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  rankGroupCard: { borderRadius: 24, overflow: 'hidden' },
  rankGroupHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  rankGroupContent: { padding: 4 },
  rankSlotRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16 },
  rankBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minWidth: 36 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { padding: 28, borderTopLeftRadius: 40, borderTopRightRadius: 40, maxHeight: '95%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  label: { fontSize: 15, fontWeight: '800', marginBottom: 12, opacity: 0.8 },
  input: { borderRadius: 20, padding: 18, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  dateSelectionContainer: { padding: 15, borderRadius: 24, marginBottom: 10 },
  dateSelectionPlaceholder: { marginTop: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 10 },
  smallDateBtn: { width: 50, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, marginRight: 10 },
  timeRangeContainer: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, marginBottom: 20 },
  timeSlotBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, marginRight: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
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
