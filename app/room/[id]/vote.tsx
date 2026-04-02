import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, Switch, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';

export default function VoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { votes, addVote, respondToVote, currentUser, theme, refreshAllData } = useAppContext();

  const [showAddModal, setShowAddModal] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const roomVotes = useMemo(() => votes.filter(v => v.roomId === id), [votes, id]);

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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={() => setShowAddModal(true)}>
        <Ionicons name="stats-chart" size={24} color={theme.background} />
        <Text style={[styles.addButtonText, { color: theme.background }]}>새 투표 만들기</Text>
      </TouchableOpacity>

      <FlatList
        data={roomVotes}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        renderItem={({ item }) => (
          <View style={[styles.voteCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.voteQuestion, { color: theme.text }]}>{item.question}</Text>
            <View style={styles.badgeRow}>
              {item.isAnonymous && <View style={styles.badge}><Text style={styles.badgeText}>익명</Text></View>}
              {item.allowMultiple && <View style={styles.badge}><Text style={styles.badgeText}>복수선택</Text></View>}
            </View>
            
            {item.options.map(opt => {
              const userResponses = item.responses[currentUser?.id || ''] || [];
              const isSelected = userResponses.includes(opt.id);
              return (
                <TouchableOpacity 
                  key={opt.id} 
                  style={[styles.optionRow, { borderColor: isSelected ? theme.primary : theme.border }]}
                  onPress={() => {
                    let newResponses = isSelected ? userResponses.filter(id => id !== opt.id) : (item.allowMultiple ? [...userResponses, opt.id] : [opt.id]);
                    respondToVote(item.id, newResponses);
                  }}
                >
                  <Text style={{ color: theme.text }}>{opt.text}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>진행 중인 투표가 없습니다.</Text>}
      />

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>새 투표 만들기</Text>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} placeholder="질문 내용을 입력하세요" placeholderTextColor="#666" value={question} onChangeText={setQuestion} />
            {options.map((opt, index) => (
              <TextInput key={index} style={[styles.input, { color: theme.text, borderColor: theme.border }]} placeholder={`항목 ${index + 1}`} placeholderTextColor="#666" value={opt} onChangeText={text => { const newOpts = [...options]; newOpts[index] = text; setOptions(newOpts); }} />
            ))}
            <TouchableOpacity onPress={() => setOptions([...options, ''])} style={styles.addOptionBtn}><Text style={{ color: theme.primary }}>+ 항목 추가</Text></TouchableOpacity>
            <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>익명 투표</Text><Switch value={isAnonymous} onValueChange={setIsAnonymous} trackColor={{ true: theme.primary }} /></View>
            <View style={styles.settingRow}><Text style={[styles.settingLabel, { color: theme.text }]}>복수 선택 허용</Text><Switch value={allowMultiple} onValueChange={setAllowMultiple} trackColor={{ true: theme.primary }} /></View>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.cancelBtn}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleCreateVote} style={[styles.saveBtn, { backgroundColor: theme.primary }]}><Text style={{ color: theme.background }}>만들기</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 12, marginBottom: 20, marginTop: 40 },
  addButtonText: { fontWeight: 'bold', marginLeft: 8 },
  voteCard: { borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1 },
  voteQuestion: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', marginBottom: 15 },
  badge: { backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 6 },
  badgeText: { fontSize: 10, color: '#aaa' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  emptyText: { textAlign: 'center', marginTop: 50 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { padding: 25, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 12 },
  addOptionBtn: { padding: 10, marginBottom: 15 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  settingLabel: { fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center' },
  saveBtn: { flex: 2, padding: 15, borderRadius: 12, alignItems: 'center' }
});
