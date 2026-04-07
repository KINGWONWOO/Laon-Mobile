import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function FormationListScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { formations, addFormation, updateFormation, deleteFormation, theme } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const roomFormations = useMemo(() => 
    formations.filter(f => f.roomId === id).sort((a, b) => b.createdAt - a.createdAt), 
    [formations, id]
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedAudio, setSelectedAudio] = useState<{ uri: string, name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedAudio({
          uri: result.assets[0].uri,
          name: result.assets[0].name
        });
      }
    } catch (err) {
      Alert.alert('오류', '파일을 선택할 수 없습니다.');
    }
  };

  const handleImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
        const importedData = JSON.parse(fileContent);
        
        if (!importedData.data || !importedData.settings) {
          throw new Error('올바른 동선 파일 형식이 아닙니다.');
        }

        setIsSubmitting(true);
        const newId = await addFormation(id as string, importedData.title || '가져온 동선', undefined);
        await updateFormation(newId, {
          settings: importedData.settings,
          data: importedData.data
        });
        
        Alert.alert('성공', '동선 파일을 성공적으로 가져왔습니다.');
      }
    } catch (err: any) {
      Alert.alert('오류', err.message || '파일을 가져오는 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('오류', '동선 제목을 입력해주세요.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      let audioUrl = selectedAudio ? selectedAudio.uri : undefined;
      const newId = await addFormation(id as string, title.trim(), audioUrl);
      setShowAddModal(false);
      setTitle('');
      setSelectedAudio(null);
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
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={handleImportFile} style={styles.headerIconBtn}>
            <Ionicons name="download-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.headerIconBtn}>
            <Ionicons name="add" size={28} color={theme.primary} />
          </TouchableOpacity>
        </View>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                {!item.isLocal && (
                  <View style={[styles.publishedBadge, { backgroundColor: theme.primary + '22' }]}>
                    <Text style={{ color: theme.primary, fontSize: 10, fontWeight: 'bold' }}>공유됨</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                {item.isLocal ? '로컬 작업 중' : '서버 저장됨'} • {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 5 }}>
              <Ionicons name="trash-outline" size={20} color="#FF4444" />
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

            <Text style={[styles.label, { color: theme.text }]}>음원 설정</Text>
            <TouchableOpacity 
              style={[styles.audioPickBtn, { borderColor: theme.border, backgroundColor: theme.background }]} 
              onPress={handlePickAudio}
            >
              <Ionicons name="musical-notes" size={20} color={theme.primary} />
              <Text style={{ color: selectedAudio ? theme.text : theme.textSecondary, marginLeft: 10, flex: 1 }} numberOfLines={1}>
                {selectedAudio ? selectedAudio.name : '기기에서 오디오 파일 선택'}
              </Text>
              {selectedAudio && (
                <TouchableOpacity onPress={() => setSelectedAudio(null)}>
                  <Ionicons name="close-circle" size={20} color={theme.error} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

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
  headerIconBtn: { padding: 5, justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1 },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  publishedBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 25, borderRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20, fontSize: 15 },
  audioPickBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20 },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { fontWeight: 'bold', fontSize: 16 },
});
