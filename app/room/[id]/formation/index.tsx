import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FormationListScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { formations, addFormation, deleteFormation, theme, currentUser } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const roomFormations = useMemo(() => 
    formations.filter(f => f.roomId === id).sort((a, b) => b.createdAt - a.createdAt), 
    [formations, id]
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('오류', '동선 제목을 입력해주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      const newId = await addFormation(id, title.trim(), audioUrl.trim() || undefined);
      setShowAddModal(false);
      setTitle('');
      setAudioUrl('');
      // 생성 후 에디터로 바로 이동
      router.push(`/room/${id}/formation/${newId}`);
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (fid: string) => {
    Alert.alert('동선 삭제', '정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteFormation(fid) }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>동선 관리</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addBtn}>
          <Ionicons name="add" size={28} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={roomFormations}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push(`/room/${id}/formation/${item.id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 10 }}>
              <Ionicons name="trash-outline" size={20} color={theme.error} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={60} color={theme.border} style={{ marginBottom: 15 }} />
            <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
              아직 작성된 동선이 없습니다.{'\n'}우측 상단의 + 버튼을 눌러 새 동선을 만들어보세요!
            </Text>
          </View>
        }
      />

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>새 동선 만들기</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.label, { color: theme.text }]}>동선 제목</Text>
            <TextInput 
              style={[styles.input, { color: theme.text, borderColor: theme.border }]} 
              placeholder="예: 1절 코러스" 
              placeholderTextColor="#888" 
              value={title} 
              onChangeText={setTitle} 
            />

            <Text style={[styles.label, { color: theme.text }]}>음원 URL (선택)</Text>
            <TextInput 
              style={[styles.input, { color: theme.text, borderColor: theme.border }]} 
              placeholder="mp3/wav 파일 링크 (입력하지 않아도 됩니다)" 
              placeholderTextColor="#888" 
              value={audioUrl} 
              onChangeText={setAudioUrl} 
            />

            <TouchableOpacity 
              style={[styles.submitBtn, { backgroundColor: theme.primary }]} 
              onPress={handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color={theme.background} /> : <Text style={[styles.submitBtnText, { color: theme.background }]}>만들기</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  addBtn: { padding: 5 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  cardMeta: { fontSize: 12 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 25, borderRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20, fontSize: 15 },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { fontWeight: 'bold', fontSize: 16 },
});
