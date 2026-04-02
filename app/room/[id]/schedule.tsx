import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';

export default function ScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { schedules, addSchedule, respondToSchedule, theme, currentUser } = useAppContext();
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState(['']);

  // 💡 useMemo를 사용하여 schedules 데이터가 바뀔 때마다 즉시 리스트 갱신
  const roomSchedules = useMemo(() => {
    return schedules.filter(s => s.roomId === id);
  }, [schedules, id]);

  const handleAddSchedule = async () => {
    if (!title.trim() || options.some(opt => !opt.trim())) {
      Alert.alert('오류', '제목과 모든 시간 옵션을 입력해주세요.');
      return;
    }
    try {
      await addSchedule(id || '', title, options);
      setShowAddModal(false);
      setTitle('');
      setOptions(['']);
    } catch (e: any) {
      Alert.alert('오류', e.message || '일정을 생성할 수 없습니다.');
    }
  };

  const addOptionField = () => setOptions([...options, '']);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={24} color={theme.background} />
        <Text style={[styles.addButtonText, { color: theme.background }]}>새 일정 투표</Text>
      </TouchableOpacity>

      <FlatList
        data={roomSchedules}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.scheduleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.scheduleTitle, { color: theme.text }]}>{item.title}</Text>
            {item.options.map(opt => {
              const responses = item.responses[currentUser?.id || ''] || [];
              const isSelected = responses.includes(opt.id);
              return (
                <TouchableOpacity 
                  key={opt.id} 
                  style={[styles.optionBtn, { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: isSelected ? theme.primary + '20' : 'transparent' }]}
                  onPress={() => {
                    const newResponses = isSelected ? responses.filter(r => r !== opt.id) : [...responses, opt.id];
                    respondToSchedule(item.id, newResponses);
                  }}
                >
                  <Text style={{ color: isSelected ? theme.primary : theme.text }}>{opt.dateTime}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>등록된 일정이 없습니다.</Text>}
      />

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>연습 시간 투표 만들기</Text>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} placeholder="일정 제목 (예: 4월 정기 연습)" value={title} onChangeText={setTitle} />
            {options.map((opt, index) => (
              <TextInput 
                key={index} 
                style={[styles.input, { color: theme.text, borderColor: theme.border }]} 
                placeholder={`시간 옵션 ${index + 1}`} 
                value={opt} 
                onChangeText={text => {
                  const newOpts = [...options];
                  newOpts[index] = text;
                  setOptions(newOpts);
                }} 
              />
            ))}
            <TouchableOpacity onPress={addOptionField} style={styles.addOptionBtn}>
              <Text style={{ color: theme.primary }}>+ 시간 추가</Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.cancelBtn}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleAddSchedule} style={[styles.saveBtn, { backgroundColor: theme.primary }]}><Text style={{ color: theme.background }}>등록</Text></TouchableOpacity>
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
  scheduleCard: { borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1 },
  scheduleTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  optionBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  emptyText: { textAlign: 'center', marginTop: 50 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { padding: 25, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 12 },
  addOptionBtn: { padding: 10, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center' },
  saveBtn: { flex: 2, padding: 15, borderRadius: 12, alignItems: 'center' }
});
