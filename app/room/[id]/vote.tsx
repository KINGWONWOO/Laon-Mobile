import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, Switch, Alert, RefreshControl, Image, ActivityIndicator, Platform } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';

export default function VoteScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { votes, addVote, respondToVote, updateVote, deleteVote, closeVote, currentUser, theme, refreshAllData, rooms, getUserById } = useAppContext();
  const insets = useSafeAreaInsets();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  
  const [showVoterModal, setShowVoterModal] = useState(false);
  const [voterModalTitle, setVoterModalTitle] = useState('');
  const [votersToDisplay, setVotersToDisplay] = useState<string[]>([]);

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [useNotification, setUseNotification] = useState(true);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const roomVotes = useMemo(() => votes.filter(v => v.roomId === id), [votes, id]);
  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);
  const selectedVote = useMemo(() => roomVotes.find(v => v.id === selectedVoteId), [roomVotes, selectedVoteId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  const handleCreateVote = async () => {
    if (!question.trim() || options.some(opt => !opt.trim())) return Alert.alert('오류', '질문과 모든 선택지 내용을 입력해주세요.');
    setIsUpdating(true);
    try {
      await addVote(id || '', question, options, { isAnonymous, allowMultiple, useNotification, deadline: hasDeadline ? deadline.getTime() : undefined });
      setShowAddModal(false); resetForm();
    } catch (e: any) { Alert.alert('오류', e.message); }
    finally { setIsUpdating(false); }
  };

  const resetForm = () => {
    setQuestion(''); setOptions(['', '']); setIsAnonymous(false); setAllowMultiple(false); setHasDeadline(false);
  };

  const openEditModal = () => {
    if (!selectedVote) return;
    setQuestion(selectedVote.question);
    setIsAnonymous(selectedVote.isAnonymous);
    setAllowMultiple(selectedVote.allowMultiple);
    setHasDeadline(!!selectedVote.deadline);
    if (selectedVote.deadline) setDeadline(new Date(selectedVote.deadline));
    setShowEditModal(true);
  };

  const handleUpdateVote = async () => {
    if (!question.trim() || !selectedVoteId) return;
    setIsUpdating(true);
    try {
      await updateVote(selectedVoteId, { question: question.trim(), deadline: hasDeadline ? deadline.getTime() : undefined, isAnonymous, allowMultiple } as any);
      setShowEditModal(false);
    } catch (e: any) { Alert.alert('오류', e.message); }
    finally { setIsUpdating(false); }
  };

  const handleCloseVoteManual = (voteId: string) => {
    Alert.alert('투표 종료', '지금 즉시 투표를 마감할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '종료하기', style: 'destructive', onPress: async () => {
        await closeVote(voteId);
        Alert.alert('완료', '투표가 종료되었습니다.');
      }}
    ]);
  };

  const renderVoteListItem = ({ item: vote }: { item: any }) => {
    const participants = Object.keys(vote.responses).length;
    const isClosed = vote.deadline && new Date(vote.deadline) < new Date();
    return (
      <TouchableOpacity 
        style={[
          styles.voteListCard, 
          { backgroundColor: theme.card }
        ]} 
        onPress={() => setSelectedVoteId(vote.id)}
      >
        <View style={styles.voteListInfo}>
          <View style={{flexDirection:'row', alignItems:'center', marginBottom: 8}}>
            <Text style={[styles.voteListTitle, { color: theme.text }]} numberOfLines={1}>{vote.question}</Text>
            {isClosed && <View style={[styles.closedBadge, {backgroundColor: theme.textSecondary + '22'}]}><Text style={{fontSize: 10, color: theme.textSecondary, fontWeight: 'bold'}}>종료</Text></View>}
          </View>
          <Text style={[styles.voteListMeta, { color: theme.textSecondary }]}>참여 {participants}명 • {formatDateFull(vote.createdAt)}</Text>
        </View>
        <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
          <Ionicons name="chevron-forward" size={18} color={theme.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetail = () => {
    if (!selectedVote) return null;
    const vote = selectedVote;
    const isClosed = vote.deadline && new Date(vote.deadline) < new Date();
    const participants = Object.keys(vote.responses);
    const nonParticipants = (currentRoom?.members || []).filter(mId => !participants.includes(mId));
    const isOwner = vote.userId === currentUser?.id || (currentRoom as any)?.leader_id === currentUser?.id;

    const ranked = vote.options.map((opt: any) => ({
      ...opt,
      votes: Object.entries(vote.responses).filter(([_, optIds]: any) => optIds.includes(opt.id)).length,
      voters: Object.entries(vote.responses).filter(([_, optIds]: any) => optIds.includes(opt.id)).map(([uId]) => uId)
    })).sort((a: any, b: any) => b.votes - a.votes);

    return (
      <Modal visible={!!selectedVoteId} animationType="slide">
        <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedVoteId(null)} style={styles.closeBtn}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            <Text style={[styles.detailHeaderTitle, { color: theme.text }]}>투표 상세</Text>
            {isOwner && !isClosed ? (
              <TouchableOpacity onPress={openEditModal} style={styles.detailDeleteBtn}><Ionicons name="create-outline" size={24} color={theme.text} /></TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
            <View style={{flexDirection:'row', alignItems:'center', marginBottom: 12}}>
              {isClosed ? <View style={[styles.statusBadge, {backgroundColor: theme.error + '15'}]}><Text style={{color: theme.error, fontWeight:'800', fontSize: 12}}>마감됨</Text></View> : <View style={[styles.statusBadge, {backgroundColor: theme.primary + '15'}]}><Text style={{color: theme.primary, fontWeight:'800', fontSize: 12}}>진행 중</Text></View>}
              {vote.deadline && !isClosed && <Text style={{color: theme.error, fontSize: 12, marginLeft: 10, fontWeight: '600'}}>마감: {formatDateFull(vote.deadline)}</Text>}
            </View>
            <Text style={[styles.voteQuestion, { color: theme.text }]}>{vote.question}</Text>
            
            <View style={styles.optionsSection}>
              {vote.options.map((opt: any) => {
                const votersForThisOpt = Object.entries(vote.responses).filter(([_, optIds]: any) => optIds.includes(opt.id)).map(([uId]) => uId);
                const isSelected = (vote.responses[currentUser?.id || ''] || []).includes(opt.id);
                return (
                  <TouchableOpacity 
                    key={opt.id} 
                    disabled={isClosed} 
                    style={[
                      styles.optItem, 
                      { backgroundColor: theme.card },
                      isSelected && { backgroundColor: theme.primary + '10' }
                    ]} 
                    onPress={() => {
                      const currentRes = vote.responses[currentUser?.id || ''] || [];
                      respondToVote(vote.id, isSelected ? currentRes.filter((id: string) => id !== opt.id) : (vote.allowMultiple ? [...currentRes, opt.id] : [opt.id]));
                    }}
                  >
                    <View style={{flex: 1}}><Text style={{color: theme.text, fontSize: 16, fontWeight: isSelected ? '700' : '500'}}>{opt.text}</Text></View>
                    <TouchableOpacity style={[styles.voterCountBadge, { backgroundColor: theme.primary + '15' }]} onPress={() => {
                      if (vote.isAnonymous) return Alert.alert('알림', '익명 투표입니다.');
                      setVotersToDisplay(votersForThisOpt); setVoterModalTitle(`'${opt.text}' 투표자`); setShowVoterModal(true);
                    }}>
                      <Text style={{color: theme.primary, fontWeight: '800'}}>{votersForThisOpt.length}명</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.voterSummaryCard, { backgroundColor: theme.card }]}>
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

            <View style={[styles.rankingBox, { backgroundColor: theme.card }]}>
              <View style={{flexDirection:'row', alignItems:'center', marginBottom: 20}}>
                <View style={[styles.iconCircleSmall, { backgroundColor: theme.accent + '15', marginRight: 10 }]}>
                  <Ionicons name="trophy" size={16} color={theme.accent} />
                </View>
                <Text style={[styles.rankingHeader, { color: theme.text }]}>투표 순위 TOP 3</Text>
              </View>
              
              {ranked.filter(r => r.votes > 0).slice(0, 3).map((r, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.rankingItem} 
                  onPress={() => { if(vote.isAnonymous) return Alert.alert('알림', '익명 투표입니다.'); setVotersToDisplay(r.voters); setVoterModalTitle(`'${r.text}' 투표자`); setShowVoterModal(true); }}
                >
                  <View style={[styles.rankingBadge, { backgroundColor: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : '#CD7F32' }]}>
                    <Text style={styles.rankingBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.rankingText, { color: theme.text }]} numberOfLines={1}>{r.text}</Text>
                  <View style={styles.rankingCountRow}>
                    <Text style={[styles.rankingCount, { color: theme.primary }]}>{r.votes}표</Text>
                    <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
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
              <View style={[styles.resultBanner, {backgroundColor: theme.primary}]}>
                <Ionicons name="checkmark-circle" size={20} color={theme.background} style={{ marginRight: 8 }} />
                <Text style={{color: theme.background, fontWeight:'800', fontSize: 15}}>최종 선택: {ranked[0].text}</Text>
              </View>
            )}

            {isOwner && !isClosed && (
              <TouchableOpacity style={styles.manualCloseBtn} onPress={() => handleCloseVoteManual(vote.id)}>
                <Ionicons name="stop-circle-outline" size={20} color={theme.error} />
                <Text style={{color: theme.error, fontWeight: '800', marginLeft: 8}}>투표 마감하기</Text>
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
        <View><Text style={[styles.headerTitle, { color: theme.text }]}>연습 투표</Text><Text style={[styles.headerSub, { color: theme.textSecondary }]}>중요한 결정을 함께 내려요!</Text></View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]} onPress={() => { resetForm(); setShowAddModal(true); }}><Ionicons name="add" size={28} color={theme.background} /></TouchableOpacity>
      </View>

      <FlatList 
        data={roomVotes} 
        keyExtractor={item => item.id} 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} 
        renderItem={renderVoteListItem} 
        ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="clipboard-outline" size={60} color={theme.border} /><Text style={[styles.emptyText, { color: theme.textSecondary }]}>진행 중인 투표가 없습니다.</Text></View>} 
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
              {votersToDisplay.length === 0 && <Text style={{ color: theme.textSecondary, textAlign: 'center', marginVertical: 20 }}>투표자가 없습니다.</Text>}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal || showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{showEditModal ? '투표 수정' : '새 투표 만들기'}</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); }}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>질문</Text>
              <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} placeholder="무엇을 투표할까요?" placeholderTextColor="#888" value={question} onChangeText={setQuestion} />
              
              {!showEditModal && (
                <>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>선택지</Text>
                  {options.map((opt, idx) => (
                    <View key={idx} style={styles.optInputRow}>
                      <TextInput style={[styles.input, { flex: 1, color: theme.text, backgroundColor: theme.background, marginBottom: 0 }]} placeholder={`선택지 ${idx + 1}`} placeholderTextColor="#888" value={opt} onChangeText={(val) => { const newOpts = [...options]; newOpts[idx] = val; setOptions(newOpts); }} />
                      {options.length > 2 && <TouchableOpacity onPress={() => setOptions(options.filter((_, i) => i !== idx))} style={styles.removeOptBtn}><Ionicons name="remove-circle" size={24} color={theme.error} /></TouchableOpacity>}
                    </View>
                  ))}
                  <TouchableOpacity onPress={() => setOptions([...options, ''])} style={[styles.addOptBtn, { backgroundColor: theme.primary + '08' }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>+ 선택지 추가</Text></TouchableOpacity>
                </>
              )}
              
              <View style={styles.settingCard}>
                <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>익명 투표</Text><Switch value={isAnonymous} onValueChange={setIsAnonymous} trackColor={{ true: theme.primary, false: '#ddd' }} thumbColor={Platform.OS === 'android' ? (isAnonymous ? theme.primary : '#f4f3f4') : ''} /></View>
                <View style={[styles.settingRow, { marginTop: 10, paddingTop: 10 }]}><Text style={[styles.settingLabel, { color: theme.text }]}>복수 선택 허용</Text><Switch value={allowMultiple} onValueChange={setAllowMultiple} trackColor={{ true: theme.primary, false: '#ddd' }} thumbColor={Platform.OS === 'android' ? (allowMultiple ? theme.primary : '#f4f3f4') : ''} /></View>
              </View>
              
              <View style={[styles.settingCard, { marginTop: 15 }]}>
                <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>마감 기한 설정</Text><Switch value={hasDeadline} onValueChange={setHasDeadline} trackColor={{ true: theme.primary, false: '#ddd' }} thumbColor={Platform.OS === 'android' ? (hasDeadline ? theme.primary : '#f4f3f4') : ''} /></View>
                {hasDeadline && (
                  <View style={{marginTop: 15}}>
                    <TouchableOpacity style={[styles.compactRow, {backgroundColor: theme.card}]} onPress={() => setShowPicker(showPicker === 'date' ? null : 'date')}>
                      <Ionicons name="calendar" size={20} color={theme.primary} />
                      <Text style={{color: theme.text, marginLeft: 10, fontWeight: '600'}}>{formatDateFull(deadline.getTime())}</Text>
                    </TouchableOpacity>
                    {showPicker && <CompactPicker date={deadline} onDateChange={setDeadline} show={showPicker} setShow={setShowPicker} />}
                  </View>
                )}
              </View>

              <TouchableOpacity onPress={showEditModal ? handleUpdateVote : handleCreateVote} style={[styles.saveBtn, { backgroundColor: theme.primary }]} disabled={isUpdating}>{isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: theme.background }]}>{showEditModal ? '수정 완료' : '등록하기'}</Text>}</TouchableOpacity>
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
  headerTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  headerSub: { fontSize: 14, marginTop: 4, fontWeight: '500', opacity: 0.7 },
  addButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...Shadows.glow },
  voteListCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 24, 
    borderRadius: 28, 
    marginBottom: 16,
    ...Shadows.card
  },
  voteListInfo: { flex: 1 },
  voteListTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  voteListMeta: { fontSize: 13, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  closedBadge: { marginLeft: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconCircleSmall: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  detailHeaderTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.8 },
  closeBtn: { padding: 5 },
  detailDeleteBtn: { padding: 5 },
  detailScroll: { padding: 24 },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, alignSelf: 'flex-start' },
  voteQuestion: { fontSize: 26, fontWeight: '800', marginBottom: 30, lineHeight: 34, letterSpacing: -1 },
  optionsSection: { marginBottom: 25 },
  optItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    borderRadius: 28, 
    marginBottom: 14,
    ...Shadows.soft
  },
  voterCountBadge: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  voterSummaryCard: { 
    padding: 24, 
    borderRadius: 28, 
    marginBottom: 20,
    ...Shadows.card
  },
  voterRow: { flexDirection: 'row', alignItems: 'flex-start' },
  voterLabelContainer: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, width: 90, alignItems: 'center', marginRight: 12 },
  voterLabel: { fontSize: 12, fontWeight: '800' },
  voterNamesRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  voterName: { fontSize: 14, fontWeight: '500', marginRight: 6, marginBottom: 4, opacity: 0.8 },
  rankingBox: { 
    padding: 24, 
    borderRadius: 32, 
    marginBottom: 25,
    ...Shadows.card
  },
  rankingHeader: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  rankingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  rankingBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  rankingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  rankingText: { flex: 1, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  rankingCountRow: { flexDirection: 'row', alignItems: 'center' },
  rankingCount: { fontSize: 15, fontWeight: '800', marginRight: 4 },
  resultBanner: { 
    flexDirection: 'row',
    padding: 20, 
    borderRadius: 28, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 20,
    ...Shadows.glow
  },
  manualCloseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 28, marginTop: 10, backgroundColor: '#8E8E9310' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { padding: 25, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '92%', ...Shadows.card },
  voterModalContent: { padding: 25, borderRadius: 32, width: '85%', maxHeight: '70%', ...Shadows.card },
  voterList: { marginTop: 10 },
  voterListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -1 },
  label: { fontSize: 14, fontWeight: '800', marginTop: 20, marginBottom: 10, marginLeft: 4, letterSpacing: -0.5 },
  input: { borderRadius: 20, padding: 18, fontSize: 16, marginBottom: 12, ...Shadows.soft },
  settingCard: { padding: 20, borderRadius: 28, backgroundColor: '#8E8E9308' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLabel: { fontSize: 16, fontWeight: '800', letterSpacing: -0.5 },
  compactRow: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, ...Shadows.soft },
  compactPicker: { borderRadius: 28, marginTop: 12, overflow: 'hidden', ...Shadows.soft },
  pickerHeader: { flexDirection: 'row' },
  pickerTab: { flex: 1, padding: 15, alignItems: 'center' },
  smallDateBtn: { width: 50, height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: 16, marginRight: 10 },
  smallTimeBtn: { padding: 18, alignItems: 'center' },
  optInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  removeOptBtn: { marginLeft: 12 },
  addOptBtn: { padding: 18, borderRadius: 28, alignItems: 'center', marginTop: 5, marginBottom: 20, backgroundColor: '#FF6B8B10' },
  saveBtn: { padding: 20, borderRadius: 28, alignItems: 'center', marginTop: 25, ...Shadows.glow },
  saveBtnText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { textAlign: 'center', marginTop: 15, fontSize: 16, fontWeight: '600', opacity: 0.7 }
});
