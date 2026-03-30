import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Switch, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { Colors } from '../../../constants/theme';
import { DanceButton } from '../../../components/ui/Interactions';

export default function VoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { votes, addVote, updateVote, deleteVote, respondToVote, markVoteAsViewed, currentUser, getUserById, theme } = useAppContext();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedSection, setExpandedSection] = useState<{ id: string, type: 'readers' | 'voters' | 'option' | null }>({ id: '', type: null });
  
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [deadlineMinutes, setDeadlineMinutes] = useState('60');
  const [editingId, setEditingId] = useState<string | null>(null);

  const roomVotes = votes.filter(v => v.roomId === id).sort((a, b) => b.createdAt - a.createdAt);

  const handleCreateVote = () => {
    if (!question.trim()) {
      Alert.alert('오류', '질문을 입력해주세요.');
      return;
    }

    if (editingId) {
      updateVote(editingId, question.trim());
      resetForm();
    } else {
      if (options.some(opt => !opt.trim())) {
        Alert.alert('오류', '모든 선택지를 입력해주세요.');
        return;
      }
      const deadline = Date.now() + parseInt(deadlineMinutes) * 60 * 1000;
      addVote(id, question, options, { isAnonymous, allowMultiple, sendNotification, deadline, notificationMinutes: 10 });
      resetForm();
    }
  };

  const resetForm = () => {
    setQuestion('');
    setOptions(['', '']);
    setIsAnonymous(false);
    setAllowMultiple(false);
    setSendNotification(true);
    setDeadlineMinutes('60');
    setEditingId(null);
    setShowCreateModal(false);
  };

  const startEdit = (vote: any) => {
    setQuestion(vote.question);
    setEditingId(vote.id);
    setShowCreateModal(true);
  };

  const confirmDelete = (voteId: string) => {
    Alert.alert('투표 삭제', '이 투표를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteVote(voteId) }
    ]);
  };

  const handleOptionChange = (text: string, index: number) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
  };

  const addOptionField = () => setOptions([...options, '']);

  const toggleVote = (voteId: string, optionId: string) => {
    const vote = votes.find(v => v.id === voteId);
    if (!vote || !currentUser) return;
    const currentResponses = vote.responses[currentUser.id] || [];
    let newResponses: string[];
    if (currentResponses.includes(optionId)) {
      newResponses = currentResponses.filter(id => id !== optionId);
    } else {
      newResponses = vote.allowMultiple ? [...currentResponses, optionId] : [optionId];
    }
    respondToVote(voteId, newResponses);
    markVoteAsViewed(voteId);
  };

  const toggleExpand = (id: string, type: 'readers' | 'voters' | 'option') => {
    if (expandedSection.id === id && expandedSection.type === type) {
      setExpandedSection({ id: '', type: null });
    } else {
      setExpandedSection({ id, type });
      if (type === 'readers') markVoteAsViewed(id);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity style={[styles.createBtn, { backgroundColor: theme.primary }]} onPress={() => setShowCreateModal(true)}>
        <Ionicons name="add-circle" size={24} color={theme.background} />
        <Text style={[styles.createBtnText, { color: theme.background }]}>새 투표 만들기</Text>
      </TouchableOpacity>

      <FlatList
        data={roomVotes}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => {
          const voterIds = Object.keys(item.responses);
          const totalVoters = voterIds.length;
          const userResponses = currentUser ? (item.responses[currentUser.id] || []) : [];
          const isMine = currentUser?.id === item.userId;

          return (
            <View style={[styles.voteCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.voteHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.creatorName, { color: theme.primary }]}>{getUserById(item.userId)?.name || '알 수 없음'}님의 투표</Text>
                  <Text style={[styles.voteQuestion, { color: theme.text }]}>{item.question}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {item.isAnonymous && <View style={[styles.anonymousBadge, { backgroundColor: theme.background + '40' }]}><Text style={[styles.anonymousText, { color: theme.textSecondary }]}>익명</Text></View>}
                  {isMine && (
                    <View style={styles.adminButtons}>
                      <TouchableOpacity onPress={() => startEdit(item)} style={styles.adminBtn}><Ionicons name="pencil" size={16} color={theme.textSecondary} /></TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDelete(item.id)} style={styles.adminBtn}><Ionicons name="trash" size={16} color={theme.error} /></TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {item.options.map(opt => {
                const optionVoterIds = voterIds.filter(uid => item.responses[uid].includes(opt.id));
                const voteCount = optionVoterIds.length;
                const percentage = totalVoters > 0 ? (voteCount / totalVoters) * 100 : 0;
                const isSelected = userResponses.includes(opt.id);
                const isOptionExpanded = expandedSection.id === opt.id && expandedSection.type === 'option';

                return (
                  <View key={opt.id}>
                    <TouchableOpacity style={[styles.optionRow, { backgroundColor: theme.background + '40' }, isSelected && { borderColor: theme.primary, borderWidth: 1 }]} onPress={() => toggleVote(item.id, opt.id)}>
                      <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: theme.primary + '30' }]} />
                      <Text style={[styles.optionText, { color: theme.text }]}>{opt.text}</Text>
                      <TouchableOpacity 
                        style={[styles.countBadge, { backgroundColor: theme.background + '40' }]} 
                        onPress={() => !item.isAnonymous && toggleExpand(opt.id, 'option')}
                        disabled={item.isAnonymous || voteCount === 0}
                      >
                        <Text style={[styles.countText, { color: theme.text }]}>{voteCount}명</Text>
                        {!item.isAnonymous && voteCount > 0 && <Ionicons name={isOptionExpanded ? "chevron-up" : "chevron-down"} size={12} color={theme.textSecondary} />}
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {isOptionExpanded && !item.isAnonymous && (
                      <View style={[styles.expandedVotersList, { backgroundColor: theme.background + '20' }]}>
                        <Text style={[styles.voterNamesText, { color: theme.textSecondary }]}>투표자: {optionVoterIds.map(uid => getUserById(uid)?.name).join(', ')}</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              <View style={[styles.voteFooter, { borderTopColor: theme.border }]}>
                <TouchableOpacity style={styles.footerInfo} onPress={() => toggleExpand(item.id, 'readers')}>
                  <Ionicons name="eye-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.footerText, { color: theme.textSecondary }]}>{item.viewedBy.length}명 읽음</Text>
                  <Ionicons name={expandedSection.id === item.id && expandedSection.type === 'readers' ? "chevron-up" : "chevron-down"} size={12} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerInfo} onPress={() => toggleExpand(item.id, 'voters')}>
                  <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.footerText, { color: theme.textSecondary }]}>{totalVoters}명 투표</Text>
                  <Ionicons name={expandedSection.id === item.id && expandedSection.type === 'voters' ? "chevron-up" : "chevron-down"} size={12} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {expandedSection.id === item.id && expandedSection.type === 'readers' && (
                <View style={[styles.footerExpandable, { backgroundColor: theme.background + '20' }]}>
                  <Text style={[styles.voterNamesText, { color: theme.textSecondary }]}>읽은 사람: {item.viewedBy.map(uid => getUserById(uid)?.name).join(', ')}</Text>
                </View>
              )}
              {expandedSection.id === item.id && expandedSection.type === 'voters' && (
                <View style={[styles.footerExpandable, { backgroundColor: theme.background + '20' }]}>
                  <Text style={[styles.voterNamesText, { color: theme.textSecondary }]}>투표한 사람: {voterIds.map(uid => getUserById(uid)?.name).join(', ')}</Text>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>진행 중인 투표가 없습니다.</Text>}
      />

      <Modal visible={showCreateModal} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={resetForm}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{editingId ? '투표 수정' : '투표 만들기'}</Text>
            <TouchableOpacity onPress={handleCreateVote}><Text style={[styles.completeText, { color: theme.primary }]}>{editingId ? '수정' : '완료'}</Text></TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>질문</Text>
            <TextInput style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} value={question} onChangeText={setQuestion} placeholder="무엇을 결정할까요?" placeholderTextColor={theme.textSecondary} />

            {!editingId && (
              <>
                <Text style={[styles.label, { color: theme.textSecondary }]}>선택지</Text>
                {options.map((opt, idx) => (
                  <TextInput key={idx} style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} value={opt} onChangeText={(text) => handleOptionChange(text, idx)} placeholder={`선택지 ${idx + 1}`} placeholderTextColor={theme.textSecondary} />
                ))}
                <TouchableOpacity style={styles.addOptionBtn} onPress={addOptionField}><Ionicons name="add" size={20} color={theme.primary} /><Text style={[styles.addOptionText, { color: theme.primary }]}>선택지 추가</Text></TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>익명 투표</Text><Switch value={isAnonymous} onValueChange={setIsAnonymous} trackColor={{ true: theme.primary }} /></View>
                <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>복수 선택 허용</Text><Switch value={allowMultiple} onValueChange={setAllowMultiple} trackColor={{ true: theme.primary }} /></View>
                <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>알림 보내기</Text><Switch value={sendNotification} onValueChange={setSendNotification} trackColor={{ true: theme.primary }} /></View>

                <Text style={[styles.label, { color: theme.textSecondary }]}>투표 종료 (분 뒤)</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} value={deadlineMinutes} onChangeText={setDeadlineMinutes} keyboardType="number-pad" placeholder="예: 60" />
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  createBtn: { flexDirection: 'row', margin: 15, padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  createBtnText: { fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  voteCard: { borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1 },
  voteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  voteQuestion: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  creatorName: { fontSize: 12, marginBottom: 4 },
  adminButtons: { flexDirection: 'row', marginTop: 5 },
  adminBtn: { marginLeft: 15 },
  optionRow: { height: 44, borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, overflow: 'hidden', position: 'relative' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  optionText: { flex: 1, fontSize: 15 },
  countBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  countText: { fontSize: 12, fontWeight: 'bold', marginRight: 4 },
  expandedVotersList: { paddingHorizontal: 15, paddingBottom: 10, marginTop: -4, marginBottom: 8, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  voterNamesText: { fontSize: 11, fontStyle: 'italic' },
  voteFooter: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1, alignItems: 'center' },
  footerInfo: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  footerText: { fontSize: 12, marginHorizontal: 4 },
  footerExpandable: { marginTop: 8, padding: 8, borderRadius: 8 },
  anonymousBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  anonymousText: { fontSize: 10 },
  emptyText: { textAlign: 'center', marginTop: 50 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  completeText: { fontWeight: 'bold', fontSize: 16 },
  modalContent: { padding: 20 },
  label: { fontSize: 14, marginBottom: 10, marginTop: 20 },
  input: { borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1, marginBottom: 10 },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  addOptionText: { marginLeft: 5, fontWeight: 'bold' },
  divider: { height: 1, marginVertical: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  settingLabel: { fontSize: 16 },
});
