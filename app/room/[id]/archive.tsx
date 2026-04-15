import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, ScrollView, TextInput, Alert, ActivityIndicator, RefreshControl, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const ITEM_MARGIN = 12;
const ITEM_SIZE = (width - 48 - (ITEM_MARGIN * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

export default function ArchiveScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { photos, addPhoto, updatePhoto, deletePhoto, addPhotoComment, updatePhotoComment, deletePhotoComment, theme, currentUser, refreshAllData, getUserById, markItemAsAccessed, rooms } = useAppContext();
  const insets = useSafeAreaInsets();

  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Edit states
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editingComment, setEditingComment] = useState<any>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const roomPhotos = useMemo(() => photos.filter(p => p.roomId === id), [photos, id]);
  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setIsLoading(true);
      try {
        await addPhoto(id || '', result.assets[0].uri, description);
        setShowAddModal(false);
        setDescription('');
      } catch (error: any) { Alert.alert('업로드 실패', error.message); } finally { setIsLoading(false); }
    }
  };

  const handleAddComment = async () => {
    if (!selectedPhoto || !newComment.trim()) return;
    await addPhotoComment(selectedPhoto.id, newComment.trim());
    setNewComment('');
    const refreshed = photos.find(p => p.id === selectedPhoto.id);
    if (refreshed) setSelectedPhoto(refreshed);
  };

  const handleUpdatePhoto = async () => {
    if (!selectedPhoto || !editDesc.trim()) return;
    await updatePhoto(selectedPhoto.id, editDesc);
    setIsEditingPhoto(false);
    const refreshed = photos.find(p => p.id === selectedPhoto.id);
    if (refreshed) setSelectedPhoto(refreshed);
  };

  const handleDeletePhoto = (photo: any) => {
    Alert.alert('사진 삭제', '정말 삭제하시겠습니까?', [
      { text: '취소' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await deletePhoto(photo.id, photo.photoUrl);
        setSelectedPhoto(null);
        refreshAllData();
      }}
    ]);
  };

  const handleUpdateComment = async () => {
    if (!editingComment || !editCommentText.trim()) return;
    await updatePhotoComment(editingComment.id, editCommentText);
    setEditingComment(null);
    const refreshed = photos.find(p => p.id === selectedPhoto.id);
    if (refreshed) setSelectedPhoto(refreshed);
  };

  const handleDeleteComment = (cid: string) => {
    Alert.alert('댓글 삭제', '정말 삭제하시겠습니까?', [
      { text: '취소' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await deletePhotoComment(cid);
        const refreshed = photos.find(p => p.id === selectedPhoto.id);
        if (refreshed) setSelectedPhoto(refreshed);
      }}
    ]);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      activeOpacity={0.9}
      style={[styles.gridItem, { backgroundColor: theme.card }, Shadows.soft]} 
      onPress={() => { setSelectedPhoto(item); markItemAsAccessed('photo', item.id); }}
    >
      <Image source={{ uri: item.photoUrl }} style={styles.gridImage} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={28} color={theme.text} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>팀 아카이브</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}><Ionicons name="add" size={30} color={theme.primary} /></TouchableOpacity>
      </View>

      <FlatList
        data={roomPhotos}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={COLUMN_COUNT}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        contentContainerStyle={styles.listContent}
      />

      <Modal visible={!!selectedPhoto} animationType="fade" transparent>
        <View style={styles.detailOverlay}>
          <View style={[styles.detailContent, { backgroundColor: theme.background }]}>
            <View style={[styles.detailHeader, { paddingTop: insets.top + 10, backgroundColor: theme.card }]}>
              <TouchableOpacity onPress={() => setSelectedPhoto(null)} style={styles.closeBtn}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
              <View style={{flex: 1}} />
              {(selectedPhoto?.userId === currentUser?.id || currentRoom?.leaderId === currentUser?.id) && (
                <View style={{flexDirection: 'row'}}>
                  <TouchableOpacity onPress={() => { setEditDesc(selectedPhoto.description || ''); setIsEditingPhoto(true); }} style={styles.headerActionBtn}>
                    <Ionicons name="pencil" size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeletePhoto(selectedPhoto)} style={styles.headerActionBtn}>
                    <Ionicons name="trash" size={22} color={theme.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Image source={{ uri: selectedPhoto?.photoUrl }} style={styles.detailImage} resizeMode="contain" />
              <View style={styles.detailInfoArea}>
                <View style={[styles.authorSection, { backgroundColor: theme.card }, Shadows.soft]}>
                  <Image source={{ uri: getUserById(selectedPhoto?.userId)?.profileImage }} style={styles.authorImg} />
                  <View>
                    <Text style={{color: theme.text, fontWeight: '800', fontSize: 16}}>{getUserById(selectedPhoto?.userId)?.name}</Text>
                    <Text style={{color: theme.textSecondary, fontSize: 12, fontWeight: '500'}}>{selectedPhoto && formatDateFull(selectedPhoto.createdAt)}</Text>
                  </View>
                </View>
                
                <View style={[styles.descSection, { backgroundColor: theme.card }, Shadows.soft]}>
                  <Text style={{color: theme.text, fontSize: 16, lineHeight: 24, fontWeight: '500'}}>{selectedPhoto?.description || '설명이 없습니다.'}</Text>
                </View>
                
                <View style={styles.commentSection}>
                  <Text style={{color: theme.text, fontWeight: '900', fontSize: 18, marginBottom: 20, letterSpacing: -0.5}}>댓글 {selectedPhoto?.comments?.length || 0}</Text>
                  {selectedPhoto?.comments?.map((c: any) => (
                    <View key={c.id} style={[styles.cItem, { backgroundColor: theme.card }, Shadows.soft]}>
                      <Image source={{ uri: getUserById(c.userId)?.profileImage }} style={styles.cAuthorImg} />
                      <View style={{flex: 1}}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                          <Text style={{color: theme.text, fontWeight: '800', fontSize: 14}}>{getUserById(c.userId)?.name}</Text>
                          {c.userId === currentUser?.id && (
                            <View style={{flexDirection: 'row'}}>
                              <TouchableOpacity onPress={() => { setEditingComment(c); setEditCommentText(c.text); }} style={{padding: 4}}><Ionicons name="pencil" size={14} color={theme.textSecondary} /></TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteComment(c.id)} style={{padding: 4}}><Ionicons name="trash" size={14} color={theme.error} /></TouchableOpacity>
                            </View>
                          )}
                        </View>
                        <Text style={{color: theme.text, fontSize: 15, marginTop: 4, lineHeight: 20}}>{c.text}</Text>
                        <Text style={{color: theme.textSecondary, fontSize: 11, marginTop: 8, opacity: 0.6}}>{formatDateFull(c.createdAt)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={[styles.commentInputArea, { backgroundColor: theme.card, paddingBottom: insets.bottom + 10 }]}>
                <TextInput style={[styles.cInput, { color: theme.text, backgroundColor: theme.background }]} placeholder="따뜻한 댓글을 남겨주세요..." placeholderTextColor={theme.textSecondary} value={newComment} onChangeText={setNewComment} />
                <TouchableOpacity onPress={handleAddComment} style={[styles.sendBtn, { backgroundColor: theme.primary }, Shadows.glow]}><Ionicons name="send" size={18} color="#fff" /></TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* Edit & Add Modals remain consistent... */}
      <Modal visible={isEditingPhoto} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }, Shadows.medium]}>
            <Text style={{color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 20}}>설명 수정</Text>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]} value={editDesc} onChangeText={setEditDesc} multiline />
            <View style={{flexDirection:'row', justifyContent:'flex-end', marginTop: 10}}>
              <TouchableOpacity onPress={() => setIsEditingPhoto(false)} style={{marginRight: 20, padding: 10}}><Text style={{color: theme.textSecondary, fontWeight: '700'}}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdatePhoto} style={{padding: 10}}><Text style={{color: theme.primary, fontWeight:'900'}}>수정</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 24, letterSpacing: -0.5}}>사진 업로드</Text>
            <TextInput style={[styles.titleInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]} placeholder="사진에 대한 짧은 설명" placeholderTextColor={theme.textSecondary} value={description} onChangeText={setDescription} multiline />
            {isLoading ? <ActivityIndicator size="large" color={theme.primary} /> : <TouchableOpacity onPress={handlePickImage} style={[styles.pickBtn, {backgroundColor: theme.primary}, Shadows.glow]}><Text style={{fontWeight: '800', color: '#fff', fontSize: 16}}>갤러리에서 선택</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={{marginTop: 24}}><Text style={{color: theme.textSecondary, textAlign: 'center', fontWeight: '700'}}>취소</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 0.5 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  listContent: { padding: 16 },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE * 1.2, margin: 8, borderRadius: 28, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  detailOverlay: { flex: 1, backgroundColor: '#000' },
  detailContent: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, paddingBottom: 15 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  headerActionBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  detailImage: { width: '100%', height: width * 1.1, backgroundColor: '#000' },
  detailInfoArea: { padding: 24 },
  authorSection: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, marginBottom: 16 },
  authorImg: { width: 44, height: 44, borderRadius: 18, marginRight: 14 },
  descSection: { padding: 20, borderRadius: 24, marginBottom: 32 },
  commentSection: { marginTop: 10 },
  cItem: { flexDirection: 'row', padding: 16, borderRadius: 24, marginBottom: 14 },
  cAuthorImg: { width: 36, height: 36, borderRadius: 14, marginRight: 12 },
  commentInputArea: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.05)' },
  cInput: { flex: 1, height: 48, borderRadius: 24, paddingHorizontal: 20, marginRight: 12, fontWeight: '600' },
  sendBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 28, borderRadius: 32 },
  input: { padding: 18, borderRadius: 20, minHeight: 100, textAlignVertical: 'top', fontSize: 16, fontWeight: '600' },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 32, borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  titleInput: { borderRadius: 20, padding: 18, marginBottom: 24, fontSize: 16, fontWeight: '600', minHeight: 120, textAlignVertical: 'top' },
  pickBtn: { padding: 20, borderRadius: 24, alignItems: 'center' }
});
