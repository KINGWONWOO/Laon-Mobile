import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, Switch, Alert, RefreshControl, Image, ActivityIndicator, Platform, Dimensions, KeyboardAvoidingView } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull, OptionModal } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';
import { contentService } from '../../../services/contentService';
import { supabase } from '../../../lib/supabase';
import AdBanner from '../../../components/ui/AdBanner';

const { width } = Dimensions.get('window');

export default function VoteScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { votes, addVote, respondToVote, updateVote, deleteVote, closeVote, markVoteViewed, currentUser, theme, refreshAllData, rooms, getRoomDisplayUser, checkProAccess, sendProReminder, sendDirectReminder, blockUser, reportContent, isPro, t, language } = useAppContext();
  const getUser = (userId: string) => getRoomDisplayUser(id as string, userId);
  const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', es: 'es-ES', id: 'id-ID', ja: 'ja-JP', zh: 'zh-CN', th: 'th-TH' };
  const locale = localeMap[language] || 'ko-KR';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  
  const [showVoterModal, setShowVoterModal] = useState(false);
  const [voterModalTitle, setVoterModalTitle] = useState('');
  const [votersToDisplay, setVotersToDisplay] = useState<string[]>([]);

  // Cache for the active vote to prevent flickering during refetches
  const [cachedVote, setCachedVote] = useState<any>(null);

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [useNotification, setUseNotification] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isSendingUnreadReminder, setIsSendingUnreadReminder] = useState(false);

  // Option Modal states
  const [showVoteOptions, setShowVoteOptions] = useState(false);

  const roomVotes = useMemo(() => votes.filter(v => v.roomId === id), [votes, id]);
  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);
  
  const activeVote = useMemo(() => {
    const found = roomVotes.find(v => v.id === selectedVoteId);
    if (found) return found;
    return cachedVote;
  }, [roomVotes, selectedVoteId, cachedVote]);

  useEffect(() => {
    const found = roomVotes.find(v => v.id === selectedVoteId);
    if (found) setCachedVote(found);
  }, [roomVotes, selectedVoteId]);

  useEffect(() => {
    if (selectedVoteId) markVoteViewed(selectedVoteId);
  }, [selectedVoteId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  const handleCreateVote = async () => {
    if (!question.trim() || options.some(opt => !opt.trim())) return Alert.alert(t('errorTitle'), '질문과 모든 선택지 내용을 입력해주세요.');
    setIsUpdating(true);
    try {
      await addVote(id || '', question, options, { isAnonymous, allowMultiple, useNotification, deadline: hasDeadline ? deadline.getTime() : undefined, reminderMinutes });
      setShowAddModal(false); resetForm();
    } catch (e: any) { Alert.alert(t('errorTitle'), e.message); }
    finally { setIsUpdating(false); }
  };

  const resetForm = () => {
    setQuestion(''); setOptions(['', '']); setIsAnonymous(false); setAllowMultiple(false); setHasDeadline(false); setUseNotification(false); setReminderMinutes(30);
  };

  const openEditModal = () => {
    if (!activeVote) return;
    setQuestion(activeVote.question);
    setOptions(activeVote.options.map((o: any) => o.text));
    setIsAnonymous(activeVote.isAnonymous);
    setAllowMultiple(activeVote.allowMultiple);
    setUseNotification(activeVote.useNotification === true);
    setReminderMinutes(activeVote.reminderMinutes || 30);
    setHasDeadline(!!activeVote.deadline);
    if (activeVote.deadline) setDeadline(new Date(activeVote.deadline));
    setShowEditModal(true);
  };

  const handleUpdateVote = async () => {
    if (!question.trim() || !selectedVoteId || !activeVote) return;
    setIsUpdating(true);
    try {
      await updateVote(selectedVoteId, { question: question.trim(), deadline: hasDeadline ? deadline.getTime() : undefined, isAnonymous, allowMultiple, useNotification, reminderMinutes } as any);
      const currentOptionTexts = options.filter(o => o.trim());
      const newOptions = currentOptionTexts.filter(opt => !activeVote.options.some((o: any) => o.text === opt));
      if (newOptions.length > 0) await contentService.addVoteOptions(selectedVoteId, newOptions);
      const removedOptionIds = activeVote.options.filter((o: any) => !currentOptionTexts.includes(o.text)).map((o: any) => o.id);
      if (removedOptionIds.length > 0) {
        await supabase.from('vote_options').delete().in('id', removedOptionIds);
      }
      await refreshAllData();
      setShowEditModal(false);
    } catch (e: any) { Alert.alert(t('errorTitle'), e.message); }
    finally { setIsUpdating(false); }
  };

  const handleDeleteVote = () => {
    Alert.alert('투표 삭제', t('deleteConfirmMsg'), [
      { text: t('cancel') },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        await deleteVote(selectedVoteId!);
        setSelectedVoteId(null);
        setCachedVote(null);
      }}
    ]);
  };

  const handleSendReminder = async () => {
    if (!selectedVoteId) return;
    const access = checkProAccess('reminder');
    if (!access.canAccess) return Alert.alert('Pro 전용 기능', '리마인드 알림은 Pro 멤버십 전용입니다.', [{ text: t('cancel'), style: 'cancel' }, { text: '멤버십 보기', onPress: () => router.push('/subscription') }]);
    setIsSendingReminder(true);
    try {
      await sendProReminder(id!, 'vote', selectedVoteId);
      Alert.alert(t('notificationSentTitle'), '미응답자에게 리마인드 푸시 알림을 보냈습니다.');
    } catch (e: any) { Alert.alert(t('errorTitle'), e.message); }
    finally { setIsSendingReminder(false); }
  };

  const isVoteAuthor = activeVote?.userId === currentUser?.id;
  const isVoteLeader = (currentRoom as any)?.leaderId === currentUser?.id;
  const voteOptionsList = isVoteAuthor || isVoteLeader ? [
    ...(isVoteAuthor ? [{ label: t('editTitleDeadline'), icon: 'create-outline', onPress: openEditModal }] : []),
    { label: activeVote?.deadline && new Date(activeVote.deadline) < new Date() ? t('statusClosed') : t('endImmediately'), icon: 'stop-circle-outline', destructive: true, onPress: () => { Alert.alert(t('endVoteTitle'), t('endVoteConfirm'), [{ text: t('cancel'), style: 'cancel' }, { text: t('endAction'), style: 'destructive', onPress: async () => { await closeVote(selectedVoteId!); } }]); } },
    { label: t('delete'), icon: 'trash-outline', destructive: true, onPress: handleDeleteVote }
  ] : [
    { label: t('reportLabel'), icon: 'warning-outline', destructive: true, onPress: () => { if(activeVote) reportContent(activeVote.id, 'vote'); } },
    { label: t('blockAuthorLabel'), icon: 'ban-outline', destructive: true, onPress: () => { if(activeVote) blockUser(activeVote.userId); } }
  ];

  const renderVoteListItem = ({ item: vote }: { item: any }) => {
    const participants = Object.keys(vote.responses).length;
    const isClosed = vote.deadline && new Date(vote.deadline) < new Date();
    return (
      <TouchableOpacity 
        activeOpacity={0.8} 
        style={[
          styles.listCard, 
          { backgroundColor: isClosed ? (theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)') : theme.card }, 
          isClosed ? { elevation: 0, shadowOpacity: 0 } : Shadows.soft
        ]} 
        onPress={() => setSelectedVoteId(vote.id)}
      >
        <View style={[styles.listInfo, isClosed && { opacity: 0.5 }]}>
          <View style={{flexDirection:'row', alignItems:'center', marginBottom: 6}}>
            <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>{vote.question}</Text>
            {isClosed && <View style={[styles.closedBadge, {backgroundColor: theme.textSecondary + '20'}]}><Text style={{fontSize: 10, color: theme.textSecondary, fontWeight: '800'}}>{t('closedVote')}</Text></View>}
          </View>
          <Text style={[styles.listMeta, { color: theme.textSecondary }]}>{t('participants')} {participants}{t('peopleCount')} • {formatDateFull(vote.createdAt, language)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} style={{opacity: isClosed ? 0.2 : 0.5}} />
      </TouchableOpacity>
    );
  };

  const renderDetail = () => {
    if (!activeVote) return null;
    const vote = activeVote;
    const isClosed = vote.deadline && new Date(vote.deadline) < new Date();
    const respondersCount = Object.keys(vote.responses).length;
    const isOwner = vote.userId === currentUser?.id || (currentRoom as any)?.leaderId === currentUser?.id;
    const myResponses = vote.responses[currentUser?.id || ''] || [];

    const allMembers = currentRoom?.members || [];
    const responders = Object.keys(vote.responses);
    const viewedMembers = vote.viewedBy || [];
    const readAndParticipated = responders;
    const readNotParticipated = allMembers.filter(id => viewedMembers.includes(id) && !responders.includes(id));
    const unreadMembers = allMembers.filter(id => !viewedMembers.includes(id) && !responders.includes(id));

    const handleSendUnreadReminder = async () => {
      if (!isPro) return Alert.alert(t('proFeatureTitle'), t('unreadReminderProOnly'), [{ text: t('cancel'), style: 'cancel' }, { text: t('viewMembership'), onPress: () => router.push('/subscription') }]);
      setIsSendingUnreadReminder(true);
      try {
        await sendDirectReminder(unreadMembers, 'unread_reminder_vote', { roomName: currentRoom?.name || '', contentTitle: vote.question });
        Alert.alert(t('sendUnreadReminder').replace(' (PRO)', ''), t('notificationSent'));
      } catch (e: any) { Alert.alert(t('errorTitle'), e.message); }
      finally { setIsSendingUnreadReminder(false); }
    };

    return (
      <Modal visible={!!selectedVoteId} animationType="slide" transparent={false} onRequestClose={() => setSelectedVoteId(null)}>
        <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedVoteId(null)} style={styles.closeBtn}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            <Text style={[styles.detailHeaderTitle, { color: theme.text }]}>{t('voteDetail')}</Text>
            <TouchableOpacity onPress={() => setShowVoteOptions(true)} style={styles.detailDeleteBtn}><Ionicons name="ellipsis-vertical" size={24} color={theme.text} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.statusRow}>
              {isClosed ? (
                <View style={[styles.statusBadge, {backgroundColor: theme.error + '15'}]}><Text style={{color: theme.error, fontWeight:'800', fontSize: 12}}>{t('statusDeadline')}</Text></View>
              ) : (
                <View style={[styles.statusBadge, {backgroundColor: theme.primary + '15'}]}><Text style={{color: theme.primary, fontWeight:'800', fontSize: 12}}>{t('statusActive')}</Text></View>
              )}
              {vote.deadline && !isClosed && (
                <View style={styles.deadlineInfo}>
                  <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                  <Text style={{color: theme.textSecondary, fontSize: 12, marginLeft: 4, fontWeight: '600'}}>{formatDateFull(vote.deadline, language)} {t('deadline')}</Text>
                </View>
              )}
            </View>

            <Text style={[styles.detailTitle, { color: theme.text }]}>{vote.question}</Text>
            <View style={styles.voteMetaRow}>
              {vote.isAnonymous && (
                <View style={[styles.metaPill, {backgroundColor: theme.border + '30'}]}><Text style={{fontSize: 11, color: theme.textSecondary, fontWeight:'700'}}>{t('anonymous')}</Text></View>
              )}
              <View style={[styles.metaPill, {backgroundColor: theme.border + '30', marginLeft: vote.isAnonymous ? 8 : 0}]}><Text style={{fontSize: 11, color: theme.textSecondary, fontWeight:'700'}}>{vote.allowMultiple ? t('multipleChoice') : t('singleChoice')}</Text></View>
            </View>

            <View style={{marginTop: 30, gap: 12}}>
              {vote.options.map((opt: any) => {
                const isSelected = myResponses.includes(opt.id);
                const voters = Object.entries(vote.responses).filter(([_, ids]: any) => ids.includes(opt.id)).map(([uid]) => uid);
                const percentage = respondersCount > 0 ? (voters.length / respondersCount) * 100 : 0;

                return (
                  <TouchableOpacity
                    key={opt.id}
                    disabled={isClosed}
                    activeOpacity={0.7}
                    style={[styles.optionCard, { backgroundColor: theme.card }, Shadows.soft, isSelected && { borderColor: theme.primary, borderWidth: 2 }]}
                    onPress={() => {
                      let next;
                      if (vote.allowMultiple) {
                        next = isSelected ? myResponses.filter((id: string) => id !== opt.id) : [...myResponses, opt.id];
                      } else {
                        next = isSelected ? [] : [opt.id];
                      }
                      respondToVote(vote.id, next);
                    }}
                  >
                    <View style={styles.optionInfo}>
                      <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
                        <Text style={[styles.optionText, { color: theme.text }]}>{opt.text}</Text>
                        <Text style={[styles.optionCount, { color: theme.primary }]}>{voters.length}{t('peopleCount')}</Text>
                      </View>
                      <View style={[styles.progressBarBg, {backgroundColor: theme.border + '40'}]}>
                        <View style={[styles.progressBarFill, {backgroundColor: theme.primary, width: `${percentage}%`}]} />
                      </View>
                      {!vote.isAnonymous && (
                        <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10}}>
                          <TouchableOpacity
                            style={[styles.viewVotersBtn, {backgroundColor: theme.primary + '12'}]}
                            onPress={() => {
                              setVotersToDisplay(voters);
                              setVoterModalTitle(`${opt.text} ${t('voters')}`);
                              setShowVoterModal(true);
                            }}
                          >
                            <Ionicons name="people-outline" size={13} color={theme.primary} />
                            <Text style={{fontSize: 11, color: theme.primary, fontWeight: '700', marginLeft: 4}}>{t('memberView')} {voters.length > 0 ? `(${voters.length})` : ''}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {(!vote.isAnonymous || (isOwner && !isClosed && (readNotParticipated.length > 0 || unreadMembers.length > 0))) && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24, marginBottom: 12 }]}>{t('participationStatus')}</Text>
                <View style={[styles.voterSummaryCard, { backgroundColor: theme.card }, Shadows.soft]}>
                  {!vote.isAnonymous && ([
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
                    <TouchableOpacity style={[styles.manualReminderBtn, { backgroundColor: theme.primary + '15', marginTop: vote.isAnonymous ? 0 : 16 }]} onPress={handleSendReminder} disabled={isSendingReminder}>
                      {isSendingReminder ? <ActivityIndicator size="small" color={theme.primary} /> : (
                        <><Ionicons name="notifications" size={15} color={theme.primary} /><Text style={{ color: theme.primary, fontWeight: '800', marginLeft: 8, fontSize: 12, flexShrink: 1 }} numberOfLines={2}>{t('notParticipants')}</Text></>
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
              </>
            )}

            {isClosed && (
              <View style={[styles.resultBanner, {backgroundColor: theme.primary + '15', borderColor: theme.primary}]}>
                <Ionicons name="trophy" size={24} color={theme.primary} />
                <Text style={{color: theme.primary, fontWeight:'900', marginTop: 8, fontSize: 16}}>{t('voteClosed')}</Text>
              </View>
            )}
          </ScrollView>
          <OptionModal visible={showVoteOptions} onClose={() => setShowVoteOptions(false)} options={voteOptionsList} title={t('voteSettings')} theme={theme} cancelLabel={t('cancel')} />
        </View>
      </Modal>
    );
  };

  const CompactPicker = ({ date, onDateChange, show, setShow }: any) => {
    const days = Array.from({length: 30}).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
    const hours = Array.from({length: 24}).map((_, i) => i);
    const minutes = [0, 10, 20, 30, 40, 50, 59];
    return (
      <View style={[styles.compactPicker, {backgroundColor: theme.background}]}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity style={[styles.pickerTab, show === 'date' && {borderBottomColor: theme.primary, borderBottomWidth: 3}]} onPress={() => setShow('date')}><Text style={{color: theme.text, fontWeight: '700'}}>{t('dateLabel')}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.pickerTab, show === 'time' && {borderBottomColor: theme.primary, borderBottomWidth: 3}]} onPress={() => setShow('time')}><Text style={{color: theme.text, fontWeight: '700'}}>{t('timeLabel')}</Text></TouchableOpacity>
        </View>
        {show === 'date' && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{padding: 15}}>{days.map((d, i) => {
          const isSelected = date.toDateString() === d.toDateString();
          return (
            <TouchableOpacity key={i} style={[styles.smallDateBtn, { backgroundColor: isSelected ? theme.primary : (theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') }]} onPress={() => { const newD = new Date(date); newD.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); onDateChange(newD); }}>
              <Text style={{fontSize: 10, color: isSelected ? '#fff' : theme.textSecondary, fontWeight: '800'}}>{d.toLocaleDateString(locale, { weekday: 'short' })}</Text>
              <Text style={{fontSize: 16, fontWeight: '900', color: isSelected ? '#fff' : theme.text}}>{d.getDate()}</Text>
            </TouchableOpacity>
          );
        })}</ScrollView>}
        {show === 'time' && <View style={{flexDirection:'row', height: 180}}><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>{hours.map(h => <TouchableOpacity key={h} style={[styles.smallTimeBtn, date.getHours() === h && {backgroundColor: theme.primary + '20'}]} onPress={() => { const newD = new Date(date); newD.setHours(h); newD.setSeconds(0); onDateChange(newD); }}><Text style={{color: date.getHours() === h ? theme.primary : theme.text, fontWeight: '700', fontSize: 16}}>{h}{t('hourSuffix')}</Text></TouchableOpacity>)}</ScrollView><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>{minutes.map(m => <TouchableOpacity key={m} style={[styles.smallTimeBtn, date.getMinutes() === m && {backgroundColor: theme.primary + '20'}]} onPress={() => { const newD = new Date(date); newD.setMinutes(m); newD.setSeconds(0); onDateChange(newD); }}><Text style={{color: date.getMinutes() === m ? theme.primary : theme.text, fontWeight: '700', fontSize: 16}}>{m}{t('minuteSuffix')}</Text></TouchableOpacity>)}</ScrollView></View>}
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
        <View><Text style={[styles.headerTitle, { color: theme.text }]}>{t('voteTitle')}</Text><Text style={[styles.headerSub, { color: theme.textSecondary }]}>{t('voteHeaderSub')}</Text></View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }, Shadows.glow]} onPress={() => { resetForm(); setShowAddModal(true); }}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>
      </View>

      <FlatList data={roomVotes} keyExtractor={item => item.id} contentContainerStyle={{paddingBottom: 100}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} renderItem={renderVoteListItem} ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="checkbox-outline" size={48} color={theme.textSecondary + '30'} /><Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('noVote')}</Text></View>} />

      {renderDetail()}

      <Modal visible={showAddModal || showEditModal} animationType="slide" transparent onRequestClose={() => { setShowAddModal(false); setShowEditModal(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: theme.card, flex: 1, marginTop: 60 }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>{showEditModal ? t('editVoteTitle') : t('newVoteTitle')}</Text><TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); }}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false} style={{flex: 1}}>
              <Text style={[styles.label, { color: theme.text }]}>{t('questionContentLabel')}</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} placeholder={t('whatToDecide')} placeholderTextColor={theme.textSecondary} value={question} onChangeText={setQuestion} />
              <Text style={[styles.label, { color: theme.text, marginTop: 10 }]}>{t('optionsLabel')}</Text>
              {options.map((opt, i) => (
                <View key={i} style={{flexDirection:'row', alignItems:'center', marginBottom: 10}}>
                  <TextInput style={[styles.input, { flex: 1, marginBottom: 0, color: theme.text, backgroundColor: theme.background }]} placeholder={`${t('option')} ${i+1}`} placeholderTextColor={theme.textSecondary} value={opt} onChangeText={text => { const next = [...options]; next[i] = text; setOptions(next); }} />
                  {options.length > 2 && <TouchableOpacity style={{marginLeft: 10}} onPress={() => setOptions(options.filter((_, idx) => idx !== i))}><Ionicons name="remove-circle-outline" size={24} color={theme.error} /></TouchableOpacity>}
                </View>
              ))}
              <TouchableOpacity style={[styles.addOptBtn, { borderColor: theme.primary }]} onPress={() => setOptions([...options, ''])}><Text style={{color: theme.primary, fontWeight: '700'}}>{t('addOptionLabel')}</Text></TouchableOpacity>
              
              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>{t('anonymousVoteLabel')}</Text><Switch value={isAnonymous} onValueChange={setIsAnonymous} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>{t('allowMultipleVote')}</Text><Switch value={allowMultiple} onValueChange={setAllowMultiple} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>{t('sendPushNotification')}</Text><Switch value={useNotification} onValueChange={setUseNotification} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>{t('setDeadlineLabel')}</Text><Switch value={hasDeadline} onValueChange={v => { setHasDeadline(v); if (v) setShowPicker('date'); }} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>

              {hasDeadline && (
                <View style={{marginTop: 10, marginBottom: 20}}>
                  <TouchableOpacity style={[styles.compactRow, {backgroundColor: theme.background}]} onPress={() => setShowPicker(showPicker === 'date' ? null : 'date')}>
                    <Ionicons name="calendar" size={18} color={theme.primary} />
                    <Text style={{color: theme.text, marginLeft: 10, fontWeight: '700'}}>{deadline.toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
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

              <TouchableOpacity onPress={showEditModal ? handleUpdateVote : handleCreateVote} style={[styles.saveBtn, { backgroundColor: theme.primary }, Shadows.glow]} disabled={isUpdating}>{isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: '#fff' }]}>{showEditModal ? t('saveChangesBtn') : t('startVoteBtn')}</Text>}</TouchableOpacity>
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
  detailTitle: { fontSize: 26, fontWeight: '900', marginBottom: 10, letterSpacing: -1, lineHeight: 34 },
  voteMetaRow: { flexDirection: 'row', marginBottom: 25 },
  metaPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  optionCard: { padding: 20, borderRadius: 24, marginBottom: 12, borderWidth: 2, borderColor: 'transparent' },
  optionInfo: { flex: 1 },
  optionText: { fontSize: 16, fontWeight: '700', flex: 1 },
  optionCount: { fontSize: 16, fontWeight: '900' },
  progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  smallNamePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  viewVotersBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  resultBanner: { padding: 24, borderRadius: 32, borderWidth: 2, alignItems: 'center', marginTop: 20, borderStyle: 'dashed' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { padding: 28, borderTopLeftRadius: 40, borderTopRightRadius: 40, maxHeight: '95%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  label: { fontSize: 15, fontWeight: '800', marginBottom: 12, opacity: 0.8 },
  input: { borderRadius: 20, padding: 18, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  addOptBtn: { padding: 16, borderRadius: 20, borderStyle: 'dashed', borderWidth: 1.5, alignItems: 'center', marginBottom: 24 },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 12 },
  settingLabel: { fontSize: 16, fontWeight: '700' },
  saveBtn: { padding: 20, borderRadius: 24, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 18, fontWeight: '900' },
  emptyContainer: { alignItems: 'center', marginTop: 120 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  voterModalContent: { padding: 24, borderRadius: 32, width: '100%' },
  voterList: { marginTop: 16 },
  voterListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  voterAvatar: { width: 40, height: 40, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  voterSummaryCard: { padding: 20, borderRadius: 32, marginBottom: 24 },
  voterRow: { flexDirection: 'row', alignItems: 'center' },
  voterLabelPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginRight: 12 },
  avatarScroll: { flex: 1 },
  namePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 6 },
  manualReminderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, marginTop: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  compactRow: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20 },
  compactPicker: { borderRadius: 24, marginTop: 12, overflow: 'hidden', paddingBottom: 10 },
  pickerHeader: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.02)' },
  pickerTab: { flex: 1, padding: 15, alignItems: 'center' },
  smallDateBtn: { width: 50, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, marginRight: 10 },
  smallTimeBtn: { padding: 18, alignItems: 'center' },
  reminderOpt: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, marginRight: 8, borderWidth: 1 },
});
