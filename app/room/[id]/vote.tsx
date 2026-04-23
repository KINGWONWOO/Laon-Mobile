import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, Switch, Alert, RefreshControl, Image, ActivityIndicator, Platform, Dimensions, KeyboardAvoidingView } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull, OptionModal } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';
import { contentService } from '../../../services/contentService';
import AdBanner from '../../../components/ui/AdBanner';

const { width } = Dimensions.get('window');

export default function VoteScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { votes, addVote, respondToVote, updateVote, deleteVote, closeVote, currentUser, theme, refreshAllData, rooms, getUserById, checkProAccess, sendProReminder, blockUser, reportContent, isPro } = useAppContext();
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
  const [useNotification, setUseNotification] = useState(true);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  const handleCreateVote = async () => {
    if (!question.trim() || options.some(opt => !opt.trim())) return Alert.alert('오류', '질문과 모든 선택지 내용을 입력해주세요.');
    setIsUpdating(true);
    try {
      await addVote(id || '', question, options, { isAnonymous, allowMultiple, useNotification, deadline: hasDeadline ? deadline.getTime() : undefined, reminderMinutes });
      setShowAddModal(false); resetForm();
    } catch (e: any) { Alert.alert('오류', e.message); }
    finally { setIsUpdating(false); }
  };

  const resetForm = () => {
    setQuestion(''); setOptions(['', '']); setIsAnonymous(false); setAllowMultiple(false); setHasDeadline(false); setUseNotification(true); setReminderMinutes(30);
  };

  const openEditModal = () => {
    if (!activeVote) return;
    setQuestion(activeVote.question);
    setOptions(activeVote.options.map((o: any) => o.text));
    setIsAnonymous(activeVote.isAnonymous);
    setAllowMultiple(activeVote.allowMultiple);
    setUseNotification(activeVote.useNotification !== false);
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
      const existingOptionTexts = activeVote.options.map((o: any) => o.text);
      const newOptions = options.filter(opt => opt.trim() && !existingOptionTexts.includes(opt.trim()));
      if (newOptions.length > 0) await contentService.addVoteOptions(selectedVoteId, newOptions);
      await refreshAllData();
      setShowEditModal(false);
    } catch (e: any) { Alert.alert('오류', e.message); }
    finally { setIsUpdating(false); }
  };

  const handleDeleteVote = () => {
    Alert.alert('투표 삭제', '정말 삭제하시겠습니까?', [
      { text: '취소' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await deleteVote(selectedVoteId!);
        setSelectedVoteId(null);
        setCachedVote(null);
      }}
    ]);
  };

  const handleSendReminder = async () => {
    if (!selectedVoteId) return;
    const access = checkProAccess('reminder');
    if (!access.canAccess) return Alert.alert('Pro 전용 기능', '리마인드 알림은 Pro 멤버십 전용입니다.', [{ text: '취소', style: 'cancel' }, { text: '멤버십 보기', onPress: () => router.push('/subscription') }]);
    setIsSendingReminder(true);
    try {
      await sendProReminder(id!, 'vote', selectedVoteId);
      Alert.alert('알림 전송', '미응답자에게 리마인드 푸시 알림을 보냈습니다.');
    } catch (e: any) { Alert.alert('오류', e.message); }
    finally { setIsSendingReminder(false); }
  };

  const voteOptionsList = activeVote?.userId === currentUser?.id || (currentRoom as any)?.leaderId === currentUser?.id ? [
    { label: '미응답자에게 알림 보내기', icon: 'notifications-outline', onPress: handleSendReminder },
    { label: '제목/기한 수정', icon: 'create-outline', onPress: openEditModal },
    { label: activeVote?.deadline && new Date(activeVote.deadline) < new Date() ? '종료됨' : '지금 즉시 종료', icon: 'stop-circle-outline', destructive: true, onPress: () => { Alert.alert('투표 종료', '지금 즉시 투표를 마감할까요?', [{ text: '취소', style: 'cancel' }, { text: '종료하기', style: 'destructive', onPress: async () => { await closeVote(selectedVoteId!); } }]); } },
    { label: '삭제', icon: 'trash-outline', destructive: true, onPress: handleDeleteVote }
  ] : [
    { label: '신고하기', icon: 'warning-outline', destructive: true, onPress: () => { if(activeVote) reportContent(activeVote.id, 'vote'); } },
    { label: '작성자 차단', icon: 'ban-outline', destructive: true, onPress: () => { if(activeVote) blockUser(activeVote.userId); } }
  ];

  const renderVoteListItem = ({ item: vote }: { item: any }) => {
    const participants = Object.keys(vote.responses).length;
    const isClosed = vote.deadline && new Date(vote.deadline) < new Date();
    return (
      <TouchableOpacity activeOpacity={0.8} style={[styles.listCard, { backgroundColor: theme.card }, Shadows.soft]} onPress={() => setSelectedVoteId(vote.id)}>
        <View style={styles.listInfo}>
          <View style={{flexDirection:'row', alignItems:'center', marginBottom: 6}}>
            <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>{vote.question}</Text>
            {isClosed && <View style={[styles.closedBadge, {backgroundColor: theme.textSecondary + '20'}]}><Text style={{fontSize: 10, color: theme.textSecondary, fontWeight: '800'}}>종료</Text></View>}
          </View>
          <Text style={[styles.listMeta, { color: theme.textSecondary }]}>참여 {participants}명 • {formatDateFull(vote.createdAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} style={{opacity: 0.5}} />
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

    return (
      <Modal visible={!!selectedVoteId} animationType="slide" transparent={false} onRequestClose={() => setSelectedVoteId(null)}>
        <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedVoteId(null)} style={styles.closeBtn}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            <Text style={[styles.detailHeaderTitle, { color: theme.text }]}>투표 상세</Text>
            <TouchableOpacity onPress={() => setShowVoteOptions(true)} style={styles.detailDeleteBtn}><Ionicons name="ellipsis-vertical" size={24} color={theme.text} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.statusRow}>
              {isClosed ? (
                <View style={[styles.statusBadge, {backgroundColor: theme.error + '15'}]}><Text style={{color: theme.error, fontWeight:'800', fontSize: 12}}>마감됨</Text></View>
              ) : (
                <View style={[styles.statusBadge, {backgroundColor: theme.primary + '15'}]}><Text style={{color: theme.primary, fontWeight:'800', fontSize: 12}}>진행 중</Text></View>
              )}
              {vote.deadline && !isClosed && (
                <View style={styles.deadlineInfo}>
                  <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                  <Text style={{color: theme.textSecondary, fontSize: 12, marginLeft: 4, fontWeight: '600'}}>{formatDateFull(vote.deadline)} 마감</Text>
                </View>
              )}
            </View>

            <Text style={[styles.detailTitle, { color: theme.text }]}>{vote.question}</Text>
            <View style={styles.voteMetaRow}>
              <View style={[styles.metaPill, {backgroundColor: theme.border + '30'}]}><Text style={{fontSize: 11, color: theme.textSecondary, fontWeight:'700'}}>{vote.isAnonymous ? '익명' : '기명'}</Text></View>
              <View style={[styles.metaPill, {backgroundColor: theme.border + '30', marginLeft: 8}]}><Text style={{fontSize: 11, color: theme.textSecondary, fontWeight:'700'}}>{vote.allowMultiple ? '복수 응답' : '단일 응답'}</Text></View>
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
                        <Text style={[styles.optionCount, { color: theme.primary }]}>{voters.length}명</Text>
                      </View>
                      <View style={[styles.progressBarBg, {backgroundColor: theme.border + '40'}]}>
                        <View style={[styles.progressBarFill, {backgroundColor: theme.primary, width: `${percentage}%`}]} />
                      </View>
                      {!vote.isAnonymous && voters.length > 0 && (
                        <TouchableOpacity style={{marginTop: 10}} onPress={() => { setVotersToDisplay(voters); setVoterModalTitle(`${opt.text} 투표자`); setShowVoterModal(true); }}>
                          <View style={{flexDirection:'row', flexWrap:'wrap', gap: 4}}>
                            {voters.map(vId => (
                              <View key={vId} style={[styles.smallNamePill, {backgroundColor: theme.primary + '10'}]}><Text style={{fontSize: 10, color: theme.primary, fontWeight:'700'}}>{getUserById(vId)?.name || '?'}</Text></View>
                            ))}
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isClosed && (
              <View style={[styles.resultBanner, {backgroundColor: theme.primary + '15', borderColor: theme.primary}]}>
                <Ionicons name="trophy" size={24} color={theme.primary} />
                <Text style={{color: theme.primary, fontWeight:'900', marginTop: 8, fontSize: 16}}>투표가 마감되었습니다</Text>
              </View>
            )}
          </ScrollView>
          <OptionModal visible={showVoteOptions} onClose={() => setShowVoteOptions(false)} options={voteOptionsList} title="투표 설정" theme={theme} />
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 50 }]}>
      <View style={styles.header}>
        <View><Text style={[styles.headerTitle, { color: theme.text }]}>의사결정 투표</Text><Text style={[styles.headerSub, { color: theme.textSecondary }]}>중요한 결정은 함께 내려보아요!</Text></View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }, Shadows.glow]} onPress={() => { resetForm(); setShowAddModal(true); }}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>
      </View>

      <FlatList data={roomVotes} keyExtractor={item => item.id} contentContainerStyle={{paddingBottom: 100}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} renderItem={renderVoteListItem} ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="checkbox-outline" size={48} color={theme.textSecondary + '30'} /><Text style={[styles.emptyText, { color: theme.textSecondary }]}>등록된 투표가 없습니다.</Text></View>} />

      {renderDetail()}

      <Modal visible={showAddModal || showEditModal} animationType="slide" transparent onRequestClose={() => { setShowAddModal(false); setShowEditModal(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: theme.card, flex: 1, marginTop: 60 }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>{showEditModal ? '투표 수정' : '새 투표'}</Text><TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); }}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false} style={{flex: 1}}>
              <Text style={[styles.label, { color: theme.text }]}>질문 내용</Text><TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} placeholder="무엇을 결정할까요?" placeholderTextColor={theme.textSecondary} value={question} onChangeText={setQuestion} />
              <Text style={[styles.label, { color: theme.text, marginTop: 10 }]}>선택지</Text>
              {options.map((opt, i) => (
                <View key={i} style={{flexDirection:'row', alignItems:'center', marginBottom: 10}}>
                  <TextInput style={[styles.input, { flex: 1, marginBottom: 0, color: theme.text, backgroundColor: theme.background }]} placeholder={`옵션 ${i+1}`} placeholderTextColor={theme.textSecondary} value={opt} onChangeText={text => { const next = [...options]; next[i] = text; setOptions(next); }} />
                  {options.length > 2 && <TouchableOpacity style={{marginLeft: 10}} onPress={() => setOptions(options.filter((_, idx) => idx !== i))}><Ionicons name="remove-circle-outline" size={24} color={theme.error} /></TouchableOpacity>}
                </View>
              ))}
              <TouchableOpacity style={[styles.addOptBtn, { borderColor: theme.primary }]} onPress={() => setOptions([...options, ''])}><Text style={{color: theme.primary, fontWeight: '700'}}>+ 옵션 추가</Text></TouchableOpacity>
              
              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>익명 투표</Text><Switch value={isAnonymous} onValueChange={setIsAnonymous} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>복수 선택 허용</Text><Switch value={allowMultiple} onValueChange={setAllowMultiple} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>푸시 알림 전송</Text><Switch value={useNotification} onValueChange={setUseNotification} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>마감 기한 설정</Text><Switch value={hasDeadline} onValueChange={setHasDeadline} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
              
              <TouchableOpacity onPress={showEditModal ? handleUpdateVote : handleCreateVote} style={[styles.saveBtn, { backgroundColor: theme.primary }, Shadows.glow]} disabled={isUpdating}>{isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: '#fff' }]}>{showEditModal ? '변경사항 저장' : '투표 시작하기'}</Text>}</TouchableOpacity>
            </ScrollView>
          </View></View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showVoterModal} transparent animationType="fade" onRequestClose={() => setShowVoterModal(false)}>
        <View style={styles.modalOverlayCenter}><View style={[styles.voterModalContent, { backgroundColor: theme.card }, Shadows.medium]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text, fontSize: 18, fontWeight: '800' }]}>{voterModalTitle}</Text><TouchableOpacity onPress={() => setShowVoterModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity></View><View style={styles.voterList}>{votersToDisplay.map(vId => <View key={vId} style={styles.voterListItem}><View style={[styles.voterAvatar, {backgroundColor: theme.primary + '20'}]}><Text style={{color: theme.primary, fontWeight: '800'}}>{getUserById(vId)?.name?.[0]}</Text></View><Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>{getUserById(vId)?.name || '알 수 없음'}</Text></View>)}{votersToDisplay.length === 0 && <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>참여자가 없습니다.</Text>}</View></View></View>
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
  voterAvatar: { width: 40, height: 40, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 }
});
