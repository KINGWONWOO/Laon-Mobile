import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, Switch, Alert, RefreshControl, Image, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';

const { width } = Dimensions.get('window');

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
        style={[styles.voteListCard, { backgroundColor: theme.card }, Shadows.soft]} 
        onPress={() => setSelectedVoteId(vote.id)}
      >
        <View style={styles.voteListInfo}>
          <View style={{flexDirection:'row', alignItems:'center', marginBottom: 6}}>
            <Text style={[styles.voteListTitle, { color: theme.text }]} numberOfLines={1}>{vote.question}</Text>
            {isClosed && (
              <View style={[styles.closedBadge, {backgroundColor: theme.textSecondary + '20'}]}>
                <Text style={{fontSize: 10, color: theme.textSecondary, fontWeight: '800'}}>종료</Text>
              </View>
            )}
          </View>
          <Text style={[styles.voteListMeta, { color: theme.textSecondary }]}>참여 {participants}명 • {formatDateFull(vote.createdAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} style={{opacity: 0.5}} />
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
            
            <Text style={[styles.voteQuestion, { color: theme.text }]}>{vote.question}</Text>
            
            <View style={styles.optionsArea}>
              {vote.options.map((opt: any) => {
                const votersForThisOpt = Object.entries(vote.responses).filter(([_, optIds]: any) => optIds.includes(opt.id)).map(([uId]) => uId);
                const isSelected = (vote.responses[currentUser?.id || ''] || []).includes(opt.id);
                return (
                  <TouchableOpacity 
                    key={opt.id} 
                    disabled={isClosed} 
                    style={[styles.optItem, { backgroundColor: theme.card }, isSelected && { borderColor: theme.primary, borderWidth: 2 }, Shadows.soft]} 
                    onPress={() => {
                      const currentRes = vote.responses[currentUser?.id || ''] || [];
                      respondToVote(vote.id, isSelected ? currentRes.filter((id: string) => id !== opt.id) : (vote.allowMultiple ? [...currentRes, opt.id] : [opt.id]));
                    }}
                  >
                    <View style={styles.optContent}>
                      <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={22} color={isSelected ? theme.primary : theme.textSecondary} />
                      <Text style={[styles.optText, { color: theme.text, fontWeight: isSelected ? '800' : '600' }]}>{opt.text}</Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.voterCountBadge, {backgroundColor: theme.background}]} 
                      onPress={() => {
                        if (vote.isAnonymous) return Alert.alert('알림', '익명 투표입니다.');
                        setVotersToDisplay(votersForThisOpt); setVoterModalTitle(`'${opt.text}' 투표자`); setShowVoterModal(true);
                      }}
                    >
                      <Text style={{color: theme.primary, fontWeight: '800'}}>{votersForThisOpt.length}</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Participants Summary */}
            <View style={[styles.voterSummaryCard, { backgroundColor: theme.card }, Shadows.soft]}>
              <View style={styles.voterRow}>
                <View style={[styles.voterLabelPill, {backgroundColor: theme.primary + '15'}]}><Text style={{color: theme.primary, fontWeight:'800', fontSize: 11}}>참여 {participants.length}</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarScroll}>
                  {participants.map(vId => (
                    <View key={vId} style={styles.avatarMini}><Text style={{fontSize: 10, fontWeight: '800', color: theme.textSecondary}}>{getUserById(vId)?.name[0]}</Text></View>
                  ))}
                </ScrollView>
              </View>
              <View style={[styles.voterRow, { marginTop: 12 }]}>
                <View style={[styles.voterLabelPill, {backgroundColor: theme.textSecondary + '15'}]}><Text style={{color: theme.textSecondary, fontWeight:'800', fontSize: 11}}>미참여 {nonParticipants.length}</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarScroll}>
                  {nonParticipants.map(vId => (
                    <View key={vId} style={styles.avatarMini}><Text style={{fontSize: 10, fontWeight: '800', color: theme.textSecondary + '80'}}>{getUserById(vId)?.name[0]}</Text></View>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Ranking: Podium UI */}
            <View style={[styles.rankingSection, { backgroundColor: theme.card }, Shadows.soft]}>
              <Text style={[styles.rankingHeader, { color: theme.text }]}>투표 순위</Text>
              {ranked.length > 0 ? (
                <View style={styles.podiumContainer}>
                  {/* 2nd Place */}
                  {ranked[1] && (
                    <View style={styles.podiumColumn}>
                      <Text style={[styles.podiumVotes, {color: theme.textSecondary}]}>{ranked[1].votes}표</Text>
                      <View style={[styles.podiumBar, {height: 60, backgroundColor: '#C0C0C0'}]}><Text style={styles.podiumRankText}>2</Text></View>
                      <Text style={[styles.podiumLabel, {color: theme.text}]} numberOfLines={1}>{ranked[1].text}</Text>
                    </View>
                  )}
                  {/* 1st Place */}
                  {ranked[0] && (
                    <View style={styles.podiumColumn}>
                      <Ionicons name="trophy" size={24} color="#FFD700" style={{marginBottom: 4}} />
                      <Text style={[styles.podiumVotes, {color: theme.primary}]}>{ranked[0].votes}표</Text>
                      <View style={[styles.podiumBar, {height: 90, backgroundColor: '#FFD700'}]}><Text style={styles.podiumRankText}>1</Text></View>
                      <Text style={[styles.podiumLabel, {color: theme.text, fontWeight: '800'}]} numberOfLines={1}>{ranked[0].text}</Text>
                    </View>
                  )}
                  {/* 3rd Place */}
                  {ranked[2] && (
                    <View style={styles.podiumColumn}>
                      <Text style={[styles.podiumVotes, {color: theme.textSecondary}]}>{ranked[2].votes}표</Text>
                      <View style={[styles.podiumBar, {height: 40, backgroundColor: '#CD7F32'}]}><Text style={styles.podiumRankText}>3</Text></View>
                      <Text style={[styles.podiumLabel, {color: theme.text}]} numberOfLines={1}>{ranked[2].text}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>아직 투표 데이터가 없습니다.</Text>
              )}
            </View>

            {isOwner && !isClosed && (
              <TouchableOpacity style={[styles.manualCloseBtn, {backgroundColor: theme.error + '10', borderColor: theme.error}]} onPress={() => handleCloseVoteManual(vote.id)}>
                <Ionicons name="stop-circle" size={20} color={theme.error} />
                <Text style={{color: theme.error, fontWeight: '800', marginLeft: 8}}>지금 투표 종료하기</Text>
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 50 }]}>
      <View style={styles.header}>
        <View><Text style={[styles.headerTitle, { color: theme.text }]}>연습 투표</Text><Text style={[styles.headerSub, { color: theme.textSecondary }]}>중요한 결정을 함께 내려요!</Text></View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }, Shadows.glow]} onPress={() => { resetForm(); setShowAddModal(true); }}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>
      </View>

      <FlatList 
        data={roomVotes} 
        keyExtractor={item => item.id} 
        contentContainerStyle={{paddingBottom: 100}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} 
        renderItem={renderVoteListItem} 
        ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="checkbox-outline" size={48} color={theme.textSecondary + '30'} /><Text style={[styles.emptyText, { color: theme.textSecondary }]}>아직 투표가 없습니다.</Text></View>} 
      />

      {renderDetail()}

      <Modal visible={showVoterModal} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}><View style={[styles.voterModalContent, { backgroundColor: theme.card }, Shadows.medium]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text, fontSize: 18, fontWeight: '800' }]}>{voterModalTitle}</Text><TouchableOpacity onPress={() => setShowVoterModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity></View><View style={styles.voterList}>{votersToDisplay.map(vId => <View key={vId} style={styles.voterListItem}><View style={[styles.voterAvatar, {backgroundColor: theme.primary + '20'}]}><Text style={{color: theme.primary, fontWeight: '800'}}>{getUserById(vId)?.name[0]}</Text></View><Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>{getUserById(vId)?.name || '알 수 없음'}</Text></View>)}{votersToDisplay.length === 0 && <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>투표자가 없습니다.</Text>}</View></View></View>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal || showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>{showEditModal ? '투표 수정' : '새 투표'}</Text><TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); }}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false} style={{flex: 1}}>
            <Text style={[styles.label, { color: theme.text }]}>질문</Text>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} placeholder="무엇을 투표할까요?" placeholderTextColor={theme.textSecondary} value={question} onChangeText={setQuestion} multiline />
            
            {!showEditModal && <Text style={[styles.label, { color: theme.text, marginTop: 20 }]}>선택지</Text>}
            {!showEditModal && options.map((opt, idx) => (
              <View key={idx} style={styles.optInputRow}>
                <TextInput style={[styles.input, { flex: 1, color: theme.text, backgroundColor: theme.background, marginBottom: 0 }]} placeholder={`옵션 ${idx + 1}`} placeholderTextColor={theme.textSecondary} value={opt} onChangeText={(val) => { const newOpts = [...options]; newOpts[idx] = val; setOptions(newOpts); }} />
                {options.length > 2 && <TouchableOpacity onPress={() => setOptions(options.filter((_, i) => i !== idx))} style={{marginLeft: 12}}><Ionicons name="remove-circle" size={24} color={theme.error} /></TouchableOpacity>}
              </View>
            ))}
            {!showEditModal && <TouchableOpacity onPress={() => setOptions([...options, ''])} style={[styles.addOptBtn, { backgroundColor: theme.background }]}><Text style={{ color: theme.primary, fontWeight: '800' }}>+ 옵션 추가</Text></TouchableOpacity>}
            
            <View style={styles.settingsGrid}>
              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>익명 투표</Text><Switch value={isAnonymous} onValueChange={setIsAnonymous} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
              <View style={styles.settingItem}><Text style={[styles.settingLabel, { color: theme.text }]}>복수 선택</Text><Switch value={allowMultiple} onValueChange={setAllowMultiple} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
            </View>
            
            <View style={[styles.settingItem, {marginTop: 10}]}><Text style={[styles.settingLabel, { color: theme.text }]}>마감 기한 설정</Text><Switch value={hasDeadline} onValueChange={setHasDeadline} trackColor={{ true: theme.primary }} thumbColor="#fff" /></View>
            {hasDeadline && (
              <View style={{marginTop: 10, marginBottom: 20}}>
                <TouchableOpacity style={[styles.compactRow, {backgroundColor: theme.background}]} onPress={() => setShowPicker(showPicker === 'date' ? null : 'date')}>
                  <Ionicons name="calendar" size={18} color={theme.primary} />
                  <Text style={{color: theme.text, marginLeft: 10, fontWeight: '700'}}>{formatDateFull(deadline.getTime())}</Text>
                </TouchableOpacity>
                {showPicker && <CompactPicker date={deadline} onDateChange={setDeadline} show={showPicker} setShow={setShowPicker} />}
              </View>
            )}

            <TouchableOpacity onPress={showEditModal ? handleUpdateVote : handleCreateVote} style={[styles.saveBtn, { backgroundColor: theme.primary }, Shadows.glow]} disabled={isUpdating}>{isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: '#fff' }]}>{showEditModal ? '변경사항 저장' : '투표 만들기'}</Text>}</TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingHorizontal: 4 },
  headerTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  headerSub: { fontSize: 14, fontWeight: '500', marginTop: 2, opacity: 0.7 },
  addButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  
  voteListCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 32, marginBottom: 16 },
  voteListInfo: { flex: 1 },
  voteListTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  voteListMeta: { fontSize: 12, fontWeight: '500', opacity: 0.6, marginTop: 4 },
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
  voteQuestion: { fontSize: 26, fontWeight: '900', marginBottom: 32, letterSpacing: -1, lineHeight: 34 },
  
  optionsArea: { marginBottom: 32 },
  optItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, marginBottom: 14 },
  optContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  optText: { fontSize: 17, marginLeft: 14, letterSpacing: -0.3 },
  voterCountBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  
  voterSummaryCard: { padding: 20, borderRadius: 32, marginBottom: 24 },
  voterRow: { flexDirection: 'row', alignItems: 'center' },
  voterLabelPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginRight: 12 },
  avatarScroll: { flex: 1 },
  avatarMini: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  
  rankingSection: { padding: 24, borderRadius: 32, marginBottom: 24 },
  rankingHeader: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  podiumContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: 180, marginTop: 10 },
  podiumColumn: { alignItems: 'center', width: (width - 100) / 3, marginHorizontal: 5 },
  podiumBar: { width: '100%', borderTopLeftRadius: 12, borderTopRightRadius: 12, alignItems: 'center', justifyContent: 'center' },
  podiumRankText: { color: '#fff', fontSize: 20, fontWeight: '900', opacity: 0.9 },
  podiumVotes: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  podiumLabel: { fontSize: 11, fontWeight: '700', marginTop: 8, width: '100%', textAlign: 'center' },
  
  resultBanner: { padding: 20, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', marginBottom: 24 },
  manualCloseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 24, borderWidth: 1.5, marginTop: 10, borderStyle: 'dashed' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { padding: 28, borderTopLeftRadius: 40, borderTopRightRadius: 40, maxHeight: '92%' },
  voterModalContent: { padding: 24, borderRadius: 32, width: '100%' },
  voterList: { marginTop: 16 },
  voterListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  voterAvatar: { width: 40, height: 40, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  label: { fontSize: 15, fontWeight: '800', marginBottom: 12, opacity: 0.8 },
  input: { borderRadius: 20, padding: 18, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  optInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  addOptBtn: { padding: 16, borderRadius: 20, alignItems: 'center', marginBottom: 24 },
  settingsGrid: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 12 },
  settingLabel: { fontSize: 16, fontWeight: '700' },
  compactRow: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20 },
  compactPicker: { borderRadius: 24, marginTop: 12, overflow: 'hidden', paddingBottom: 10 },
  pickerHeader: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.02)' },
  pickerTab: { flex: 1, padding: 15, alignItems: 'center' },
  smallDateBtn: { width: 50, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, marginRight: 10 },
  smallTimeBtn: { padding: 18, alignItems: 'center' },
  saveBtn: { padding: 20, borderRadius: 24, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 18, fontWeight: '900' },
  emptyContainer: { alignItems: 'center', marginTop: 120 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 }
});
