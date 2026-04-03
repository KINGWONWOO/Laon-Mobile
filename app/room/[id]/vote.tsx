import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, Switch, Alert, RefreshControl, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function VoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { votes, addVote, respondToVote, deleteVote, currentUser, theme, refreshAllData, rooms, getUserById } = useAppContext();
  const insets = useSafeAreaInsets();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const roomVotes = useMemo(() => votes.filter(v => v.roomId === id), [votes, id]);
  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);
  const selectedVote = useMemo(() => roomVotes.find(v => v.id === selectedVoteId), [roomVotes, selectedVoteId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  const handleCreateVote = async () => {
    if (!question.trim() || options.some(opt => !opt.trim())) {
      Alert.alert('오류', '질문과 모든 선택지 내용을 입력해주세요.');
      return;
    }
    try {
      await addVote(id || '', question, options, { isAnonymous, allowMultiple });
      setShowAddModal(false);
      setQuestion('');
      setOptions(['', '']);
    } catch (e: any) { Alert.alert('오류', e.message); }
  };

  const handleDeleteVote = (voteId: string) => {
    Alert.alert('투표 삭제', '이 투표를 정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await deleteVote(voteId);
        setSelectedVoteId(null);
      }}
    ]);
  };

  const renderVoteListItem = ({ item: vote }: { item: any }) => {
    const participants = Object.keys(vote.responses).length;
    const isOwner = vote.userId === currentUser?.id || (currentRoom as any)?.leader_id === currentUser?.id;

    return (
      <TouchableOpacity 
        style={[styles.voteListCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => setSelectedVoteId(vote.id)}
      >
        <View style={styles.voteListInfo}>
          <Text style={[styles.voteListTitle, { color: theme.text }]} numberOfLines={1}>{vote.question}</Text>
          <Text style={[styles.voteListMeta, { color: theme.textSecondary }]}>참여 {participants}명 • {new Date(vote.createdAt).toLocaleDateString()}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderDetail = () => {
    if (!selectedVote) return null;
    const vote = selectedVote;
    const totalVotes = Object.values(vote.responses).flat().length;
    const participants = Object.keys(vote.responses);
    const nonParticipants = (currentRoom?.members || []).filter(mId => !participants.includes(mId));
    const isOwner = vote.userId === currentUser?.id || (currentRoom as any)?.leader_id === currentUser?.id;

    return (
      <Modal visible={!!selectedVoteId} animationType="slide">
        <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedVoteId(null)} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.detailHeaderTitle, { color: theme.text }]} numberOfLines={1}>투표 상세</Text>
            {isOwner ? (
              <TouchableOpacity onPress={() => handleDeleteVote(vote.id)} style={styles.detailDeleteBtn}>
                <Ionicons name="trash-outline" size={24} color={theme.error} />
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll}>
            <Text style={[styles.voteQuestion, { color: theme.text }]}>{vote.question}</Text>
            <View style={styles.badgeRow}>
              {vote.isAnonymous && <View style={[styles.badge, { backgroundColor: theme.primary + '33' }]}><Text style={[styles.badgeText, { color: theme.primary }]}>익명</Text></View>}
              {vote.allowMultiple && <View style={[styles.badge, { backgroundColor: theme.accent + '33' }]}><Text style={[styles.badgeText, { color: theme.accent }]}>복수선택</Text></View>}
            </View>

            {vote.options.map((opt: any) => {
              const votersForThisOpt = Object.entries(vote.responses)
                .filter(([_, optIds]: any) => optIds.includes(opt.id))
                .map(([uId]) => uId);
              
              const count = votersForThisOpt.length;
              const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
              const userResponses = vote.responses[currentUser?.id || ''] || [];
              const isSelected = userResponses.includes(opt.id);

              return (
                <View key={opt.id} style={styles.optionContainer}>
                  <TouchableOpacity 
                    style={[styles.optionRow, { borderColor: isSelected ? theme.primary : theme.border }]}
                    onPress={() => {
                      let newResponses = isSelected ? userResponses.filter((id: string) => id !== opt.id) : (vote.allowMultiple ? [...userResponses, opt.id] : [opt.id]);
                      respondToVote(vote.id, newResponses);
                    }}
                  >
                    <View style={[styles.progressBg, { backgroundColor: theme.border + '33', width: '100%' }]}>
                      <View style={[styles.progressBar, { backgroundColor: theme.primary + '44', width: `${percentage}%` }]} />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionText, { color: theme.text }]}>{opt.text}</Text>
                      <View style={styles.countBadge}>
                        <Text style={[styles.countText, { color: theme.primary }]}>{count}명</Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={18} color={theme.primary} style={{marginLeft: 4}} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                  
                  {!vote.isAnonymous && count > 0 && (
                    <View style={styles.voterList}>
                      {votersForThisOpt.map(vId => {
                        const voter = getUserById(vId);
                        return (
                          <View key={vId} style={styles.miniProfile}>
                            {voter?.profileImage ? (
                              <Image source={{ uri: voter.profileImage }} style={styles.miniAvatar} />
                            ) : (
                              <View style={[styles.miniAvatar, { backgroundColor: theme.border }]}><Ionicons name="person" size={10} color={theme.textSecondary} /></View>
                            )}
                            <Text style={[styles.miniName, { color: theme.textSecondary }]}>{voter?.name || '알 수 없음'}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

            <View style={[styles.statusSection, { borderTopColor: theme.border }]}>
              <Text style={[styles.statusTitle, { color: theme.textSecondary }]}>참여 현황</Text>
              <View style={styles.participantStats}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: theme.primary }]}>{participants.length}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>참여</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: theme.error }]}>{nonParticipants.length}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>미참여</Text>
                </View>
              </View>

              {!vote.isAnonymous && participants.length > 0 && (
                <View style={styles.participantListDetail}>
                  <Text style={[styles.statusTitle, { color: theme.textSecondary, marginTop: 10 }]}>참여자 명단</Text>
                  <View style={styles.namesRowDetail}>
                    {participants.map(vId => (
                      <Text key={vId} style={[styles.participantName, { color: theme.text }]}>{getUserById(vId)?.name || '...'} </Text>
                    ))}
                  </View>
                </View>
              )}

              {nonParticipants.length > 0 && (
                <View style={styles.nonParticipantListDetail}>
                  <Text style={[styles.nonParticipantText, { color: theme.error }]}>미참여자: </Text>
                  <View style={styles.namesRowDetail}>
                    {nonParticipants.map(vId => (
                      <Text key={vId} style={[styles.nonParticipantName, { color: theme.error }]}>{getUserById(vId)?.name || '...'} </Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 50 }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>연습 투표</Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={24} color={theme.background} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={roomVotes}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        renderItem={renderVoteListItem}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>진행 중인 투표가 없습니다.</Text>}
      />

      {renderDetail()}

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>새 투표 만들기</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
            </View>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} placeholder="투표 질문 (예: 오늘 연습 시간 어때요?)" placeholderTextColor="#888" value={question} onChangeText={setQuestion} />
            {options.map((opt, index) => (
              <View key={index} style={styles.optionInputRow}>
                <TextInput style={[styles.input, { flex: 1, color: theme.text, borderColor: theme.border, marginBottom: 0 }]} placeholder={`항목 ${index + 1}`} placeholderTextColor="#888" value={opt} onChangeText={text => { const newOpts = [...options]; newOpts[index] = text; setOptions(newOpts); }} />
                {options.length > 2 && (
                  <TouchableOpacity onPress={() => setOptions(options.filter((_, i) => i !== index))} style={styles.removeOptionBtn}>
                    <Ionicons name="remove-circle-outline" size={24} color={theme.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity onPress={() => setOptions([...options, ''])} style={styles.addOptionBtn}><Text style={{ color: theme.primary, fontWeight: '600' }}>+ 항목 추가</Text></TouchableOpacity>
            
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            
            <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>익명 투표</Text><Switch value={isAnonymous} onValueChange={setIsAnonymous} trackColor={{ true: theme.primary }} /></View>
            <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>복수 선택 허용</Text><Switch value={allowMultiple} onValueChange={setAllowMultiple} trackColor={{ true: theme.primary }} /></View>
            
            <TouchableOpacity onPress={handleCreateVote} style={[styles.saveBtn, { backgroundColor: theme.primary }]}><Text style={[styles.saveBtnText, { color: theme.background }]}>투표 시작하기</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  addButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  
  voteListCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  voteListInfo: { flex: 1 },
  voteListTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  voteListMeta: { fontSize: 12 },

  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee2' },
  detailHeaderTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  closeBtn: { padding: 5 },
  detailDeleteBtn: { padding: 5 },
  detailScroll: { padding: 20 },

  voteQuestion: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', marginBottom: 20 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  optionContainer: { marginBottom: 12 },
  optionRow: { height: 55, borderRadius: 14, borderWidth: 1, overflow: 'hidden', justifyContent: 'center' },
  progressBg: { position: 'absolute', height: '100%' },
  progressBar: { position: 'absolute', height: '100%' },
  optionContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15 },
  optionText: { fontSize: 16, fontWeight: '500' },
  countBadge: { flexDirection: 'row', alignItems: 'center' },
  countText: { fontSize: 14, fontWeight: '700' },
  voterList: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, paddingLeft: 10 },
  miniProfile: { flexDirection: 'row', alignItems: 'center', marginRight: 10, marginBottom: 4 },
  miniAvatar: { width: 18, height: 18, borderRadius: 9, marginRight: 4 },
  miniName: { fontSize: 12 },
  statusSection: { marginTop: 25, paddingTop: 20, borderTopWidth: 1 },
  statusTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  participantStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 12 },
  statDivider: { width: 1, height: 25, backgroundColor: '#8883' },
  participantListDetail: { marginBottom: 15 },
  nonParticipantListDetail: { marginTop: 10 },
  nonParticipantText: { fontSize: 13, fontWeight: '600' },
  nonParticipantName: { fontSize: 13 },
  namesRowDetail: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  participantName: { fontSize: 13, marginRight: 6 },
  
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 15, fontSize: 16 },
  optionInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  removeOptionBtn: { marginLeft: 10 },
  addOptionBtn: { padding: 10, marginBottom: 10 },
  divider: { height: 1, width: '100%', marginVertical: 15 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  saveBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  saveBtnText: { fontSize: 17, fontWeight: 'bold' }
});
