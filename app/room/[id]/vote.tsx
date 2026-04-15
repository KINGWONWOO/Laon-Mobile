import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, Switch, Alert, RefreshControl, Image, ActivityIndicator } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull } from '../../../components/ui/RoomComponents';

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
    try {
      await addVote(id || '', question, options, { isAnonymous, allowMultiple, useNotification, deadline: hasDeadline ? deadline.getTime() : undefined });
      setShowAddModal(false); resetForm();
    } catch (e: any) { Alert.alert('오류', e.message); }
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
      <TouchableOpacity style={[styles.voteListCard, { backgroundColor: theme.card, borderColor: isClosed ? theme.border : theme.primary, borderWidth: isClosed ? 1 : 1.5 }]} onPress={() => setSelectedVoteId(vote.id)}>
        <View style={styles.voteListInfo}>
          <View style={{flexDirection:'row', alignItems:'center', marginBottom: 4}}>
            <Text style={[styles.voteListTitle, { color: theme.text }]} numberOfLines={1}>{vote.question}</Text>
            {isClosed && <View style={[styles.closedBadge, {backgroundColor: theme.textSecondary + '33'}]}><Text style={{fontSize: 10, color: theme.textSecondary}}>종료</Text></View>}
          </View>
          <Text style={[styles.voteListMeta, { color: theme.textSecondary }]}>참여 {participants}명 • {formatDateFull(vote.createdAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
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

          <ScrollView contentContainerStyle={styles.detailScroll}>
            <View style={{flexDirection:'row', alignItems:'center', marginBottom: 10}}>
              {isClosed ? <View style={[styles.statusBadge, {backgroundColor: theme.error + '22'}]}><Text style={{color: theme.error, fontWeight:'bold', fontSize: 12}}>마감됨</Text></View> : <View style={[styles.statusBadge, {backgroundColor: theme.primary + '22'}]}><Text style={{color: theme.primary, fontWeight:'bold', fontSize: 12}}>진행 중</Text></View>}
              {vote.deadline && !isClosed && <Text style={{color: theme.error, fontSize: 12, marginLeft: 10}}>마감: {formatDateFull(vote.deadline)}</Text>}
            </View>
            <Text style={[styles.voteQuestion, { color: theme.text }]}>{vote.question}</Text>
            
            {vote.options.map((opt: any) => {
              const votersForThisOpt = Object.entries(vote.responses).filter(([_, optIds]: any) => optIds.includes(opt.id)).map(([uId]) => uId);
              const isSelected = (vote.responses[currentUser?.id || ''] || []).includes(opt.id);
              return (
                <TouchableOpacity key={opt.id} disabled={isClosed} style={[styles.optItem, { backgroundColor: theme.card, borderColor: isSelected ? theme.primary : theme.border }]} onPress={() => {
                  const currentRes = vote.responses[currentUser?.id || ''] || [];
                  respondToVote(vote.id, isSelected ? currentRes.filter((id: string) => id !== opt.id) : (vote.allowMultiple ? [...currentRes, opt.id] : [opt.id]));
                }}>
                  <View style={{flex: 1}}><Text style={{color: theme.text, fontWeight: isSelected ? 'bold' : 'normal'}}>{opt.text}</Text></View>
                  <TouchableOpacity style={styles.voterCountBadge} onPress={() => {
                    if (vote.isAnonymous) return Alert.alert('알림', '익명 투표입니다.');
                    setVotersToDisplay(votersForThisOpt); setVoterModalTitle(`'${opt.text}' 투표자`); setShowVoterModal(true);
                  }}><Text style={{color: theme.primary, fontWeight: 'bold'}}>{votersForThisOpt.length}명</Text></TouchableOpacity>
                </TouchableOpacity>
              );
            })}

            <View style={styles.voterSummaryDetail}>
              <View style={styles.voterRow}><Text style={[styles.voterLabel, { color: theme.textSecondary }]}>참여({participants.length})</Text><View style={styles.voterNamesRow}>{participants.map(vId => <Text key={vId} style={[styles.voterName, { color: theme.textSecondary }]}>{getUserById(vId)?.name} </Text>)}</View></View>
              <View style={[styles.voterRow, { marginTop: 10 }]}><Text style={[styles.voterLabel, { color: theme.error }]}>미참여({nonParticipants.length})</Text><View style={styles.voterNamesRow}>{nonParticipants.map(vId => <Text key={vId} style={[styles.voterName, { color: theme.error }]}>{getUserById(vId)?.name} </Text>)}</View></View>
            </View>

            {isClosed && ranked[0].votes > 0 && (
              <View style={[styles.resultBanner, {backgroundColor: theme.primary + '11', borderColor: theme.primary}]}>
                <Text style={{color: theme.primary, fontWeight:'bold'}}>최다 선택 결과: {ranked[0].text} ({ranked[0].votes}표)</Text>
              </View>
            )}

            {isOwner && !isClosed && (
              <TouchableOpacity style={[styles.manualCloseBtn, {borderColor: theme.error}]} onPress={() => handleCloseVoteManual(vote.id)}><Ionicons name="stop-circle-outline" size={20} color={theme.error} /><Text style={{color: theme.error, fontWeight: 'bold', marginLeft: 8}}>지금 투표 종료하기</Text></TouchableOpacity>
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
        {show === 'date' && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{padding: 10}}>{days.map((d, i) => <TouchableOpacity key={i} style={[styles.smallDateBtn, date.toDateString() === d.toDateString() && {backgroundColor: theme.primary}]} onPress={() => { const newD = new Date(date); newD.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); onDateChange(newD); }}><Text style={{fontSize: 10, color: date.toDateString() === d.toDateString() ? theme.background : theme.textSecondary}}>{['일','월','화','수','목','금','토'][d.getDay()]}</Text><Text style={{fontWeight: 'bold', color: date.toDateString() === d.toDateString() ? theme.background : theme.text}}>{d.getDate()}</Text></TouchableOpacity>)}</ScrollView>}
        {show === 'time' && <View style={{flexDirection:'row', height: 100}}><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>{hours.map(h => <TouchableOpacity key={h} style={[styles.smallTimeBtn, date.getHours() === h && {backgroundColor: theme.primary}]} onPress={() => { const newD = new Date(date); newD.setHours(h); onDateChange(newD); }}><Text style={{color: date.getHours() === h ? theme.background : theme.text}}>{h}시</Text></TouchableOpacity>)}</ScrollView><ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>{minutes.map(m => <TouchableOpacity key={m} style={[styles.smallTimeBtn, date.getMinutes() === m && {backgroundColor: theme.primary}]} onPress={() => { const newD = new Date(date); newD.setMinutes(m); onDateChange(newD); }}><Text style={{color: date.getMinutes() === m ? theme.background : theme.text}}>{m}분</Text></TouchableOpacity>)}</ScrollView></View>}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 50 }]}>
      <View style={styles.header}>
        <View><Text style={[styles.headerTitle, { color: theme.text }]}>연습 투표</Text><Text style={[styles.headerSub, { color: theme.textSecondary }]}>중요한 결정을 함께 내려요!</Text></View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={() => { resetForm(); setShowAddModal(true); }}><Ionicons name="add" size={24} color={theme.background} /></TouchableOpacity>
      </View>

      <FlatList data={roomVotes} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} renderItem={renderVoteListItem} ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>진행 중인 투표가 없습니다.</Text>} />

      {renderDetail()}

      <Modal visible={showVoterModal} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}><View style={[styles.voterModalContent, { backgroundColor: theme.card }]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text, fontSize: 16 }]}>{voterModalTitle}</Text><TouchableOpacity onPress={() => setShowVoterModal(false)}><Ionicons name="close" size={20} color={theme.text} /></TouchableOpacity></View><View style={styles.voterList}>{votersToDisplay.map(vId => <View key={vId} style={styles.voterListItem}><Ionicons name="person-circle" size={24} color={theme.primary} style={{ marginRight: 10 }} /><Text style={{ color: theme.text }}>{getUserById(vId)?.name || '알 수 없음'}</Text></View>)}{votersToDisplay.length === 0 && <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>투표자가 없습니다.</Text>}</View></View></View>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal || showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}><View style={[styles.modalContent, { backgroundColor: theme.card }]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>{showEditModal ? '투표 수정' : '새 투표 만들기'}</Text><TouchableOpacity onPress={() => { setShowAddModal(false); setShowEditModal(false); }}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity></View><ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>질문</Text>
          <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} placeholder="무엇을 투표할까요?" placeholderTextColor="#888" value={question} onChangeText={setQuestion} />
          
          {!showEditModal && options.map((opt, idx) => (
            <View key={idx} style={styles.optInputRow}>
              <TextInput style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.border }]} placeholder={`선택지 ${idx + 1}`} placeholderTextColor="#888" value={opt} onChangeText={(val) => { const newOpts = [...options]; newOpts[idx] = val; setOptions(newOpts); }} />
              {options.length > 2 && <TouchableOpacity onPress={() => setOptions(options.filter((_, i) => i !== idx))} style={{marginLeft: 10}}><Ionicons name="remove-circle-outline" size={24} color={theme.error} /></TouchableOpacity>}
            </View>
          ))}
          {!showEditModal && <TouchableOpacity onPress={() => setOptions([...options, ''])} style={[styles.addOptBtn, { borderColor: theme.border }]}><Text style={{ color: theme.textSecondary }}>+ 선택지 추가</Text></TouchableOpacity>}
          
          <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>익명 투표</Text><Switch value={isAnonymous} onValueChange={setIsAnonymous} trackColor={{ true: theme.primary }} /></View>
          <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>복수 선택 허용</Text><Switch value={allowMultiple} onValueChange={setAllowMultiple} trackColor={{ true: theme.primary }} /></View>
          
          <View style={[styles.settingRow, {borderTopWidth: 0.5, borderTopColor: '#eee2', paddingTop: 15}]}><Text style={[styles.settingLabel, { color: theme.text }]}>마감 기한 설정</Text><Switch value={hasDeadline} onValueChange={setHasDeadline} trackColor={{ true: theme.primary }} /></View>
          {hasDeadline && <View style={{marginBottom: 20}}><TouchableOpacity style={[styles.compactRow, {borderColor: theme.border}]} onPress={() => setShowPicker(showPicker === 'date' ? null : 'date')}><Ionicons name="calendar-outline" size={18} color={theme.primary} /><Text style={{color: theme.text, marginLeft: 10}}>{formatDateFull(deadline.getTime())}</Text></TouchableOpacity>{showPicker && <CompactPicker date={deadline} onDateChange={setDeadline} show={showPicker} setShow={setShowPicker} />}</View>}

          <TouchableOpacity onPress={showEditModal ? handleUpdateVote : handleCreateVote} style={[styles.saveBtn, { backgroundColor: theme.primary }]} disabled={isUpdating}>{isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: theme.background }]}>{showEditModal ? '수정 완료' : '등록하기'}</Text>}</TouchableOpacity>
        </ScrollView></View></View>
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
  voteListCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, marginBottom: 12, borderWidth: 1 },
  voteListInfo: { flex: 1 },
  voteListTitle: { fontSize: 17, fontWeight: 'bold' },
  voteListMeta: { fontSize: 12 },
  closedBadge: { marginLeft: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee2' },
  detailHeaderTitle: { fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  detailDeleteBtn: { padding: 5 },
  detailScroll: { padding: 20 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  voteQuestion: { fontSize: 22, fontWeight: 'bold', marginBottom: 25 },
  optItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 15, marginBottom: 12, borderWidth: 1 },
  voterCountBadge: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)' },
  voterSummaryDetail: { paddingHorizontal: 5, paddingBottom: 30, marginTop: 20 },
  voterRow: { flexDirection: 'row' },
  voterLabel: { fontSize: 13, fontWeight: 'bold', width: 70 },
  voterNamesRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  voterName: { fontSize: 13 },
  resultBanner: { padding: 15, borderRadius: 15, borderWidth: 1, alignItems: 'center', marginBottom: 20 },
  manualCloseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 15, borderWidth: 1, marginTop: 10, borderStyle: 'dashed' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { padding: 25, borderTopLeftRadius: 35, borderTopRightRadius: 35, maxHeight: '90%' },
  voterModalContent: { padding: 20, borderRadius: 25, width: '80%' },
  voterList: { marginTop: 10 },
  voterListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
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
  optInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  addOptBtn: { padding: 15, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', marginTop: 5, marginBottom: 20 },
  saveBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  saveBtnText: { fontSize: 17, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 100, fontSize: 16 }
});
