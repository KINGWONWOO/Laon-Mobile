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

  const handlePhotoOptions = () => {
    if (!selectedPhoto) return;
    Alert.alert('아카이브 설정', '어떤 작업을 하시겠습니까?', [
      { text: '설명 수정', onPress: () => {
        setEditDesc(selectedPhoto.description || '');
        setIsEditingPhoto(true);
      }},
      { text: '삭제', style: 'destructive', onPress: () => handleDeletePhoto(selectedPhoto) },
      { text: '취소', style: 'cancel' }
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
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
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

      <Modal visible={!!selectedPhoto} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={[styles.container, { backgroundColor: theme.background }]}
        >
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setSelectedPhoto(null)} style={styles.backBtn}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>아카이브 상세</Text>
            {(selectedPhoto?.userId === currentUser?.id || currentRoom?.leaderId === currentUser?.id) ? (
              <TouchableOpacity onPress={handlePhotoOptions} style={styles.deleteBtn}>
                <Ionicons name="ellipsis-vertical" size={24} color={theme.text} />
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
          </View>

          <FlatList
            data={selectedPhoto?.comments || []}
            keyExtractor={item => item.id}
            ListHeaderComponent={
              <View style={styles.contentSection}>
                <View style={styles.authorRow}>
                  {getUserById(selectedPhoto?.userId)?.profileImage ? (
                    <Image source={{ uri: getUserById(selectedPhoto?.userId).profileImage }} style={styles.authorAvatar} />
                  ) : (
                    <View style={[styles.authorAvatar, { backgroundColor: theme.primary + '15' }]}>
                      <Text style={{ color: theme.primary, fontWeight: '800' }}>{getUserById(selectedPhoto?.userId)?.name?.[0]}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={[styles.authorName, { color: theme.text, letterSpacing: -0.5, fontWeight: '800' }]}>{getUserById(selectedPhoto?.userId)?.name || '알 수 없음'}</Text>
                    <Text style={[styles.dateText, { color: theme.textSecondary, fontWeight: '500', opacity: 0.7 }]}>{selectedPhoto && formatDateFull(selectedPhoto.createdAt)}</Text>
                  </View>
                </View>

                <Image source={{ uri: selectedPhoto?.photoUrl }} style={styles.detailImage} resizeMode="cover" />
                
                <Text style={[styles.content, { color: theme.text, marginTop: 20 }]}>{selectedPhoto?.description || '설명이 없습니다.'}</Text>

                <View style={[styles.divider, { backgroundColor: theme.border, opacity: 0.5, marginTop: 20 }]} />
                <Text style={[styles.commentCount, { color: theme.text, letterSpacing: -0.5, fontWeight: '800' }]}>댓글 {selectedPhoto?.comments?.length || 0}</Text>
              </View>
            }
            renderItem={({ item: comment }) => {
              const cAuthor = getUserById(comment.userId);
              const isEditing = editingComment?.id === comment.id;

              return (
                <View style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <Text style={[styles.commentAuthor, { color: theme.text, letterSpacing: -0.5, fontWeight: '800' }]}>{cAuthor?.name || '...'}</Text>
                    <Text style={[styles.commentDate, { color: theme.textSecondary, fontWeight: '500', opacity: 0.7 }]}>{formatDateFull(comment.createdAt)}</Text>
                    {comment.userId === currentUser?.id && !isEditing && (
                      <TouchableOpacity onPress={() => {
                        Alert.alert('댓글 설정', '어떤 작업을 하시겠습니까?', [
                          { text: '수정', onPress: () => {
                            setEditingComment(comment);
                            setEditCommentText(comment.text);
                          }},
                          { text: '삭제', style: 'destructive', onPress: () => handleDeleteComment(comment.id) },
                          { text: '취소', style: 'cancel' }
                        ]);
                      }}>
                        <Ionicons name="ellipsis-horizontal" size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {isEditing ? (
                    <View style={styles.commentEditBox}>
                      <TextInput
                        style={[styles.commentEditInput, { color: theme.text, backgroundColor: theme.background }]}
                        value={editCommentText}
                        onChangeText={setEditCommentText}
                        multiline
                        autoFocus
                      />
                      <View style={styles.commentEditBtns}>
                        <TouchableOpacity onPress={() => setEditingComment(null)}><Text style={{ color: theme.textSecondary, marginRight: 15, fontWeight: '500', opacity: 0.7 }}>취소</Text></TouchableOpacity>
                        <TouchableOpacity onPress={handleUpdateComment}>
                          <Text style={{ color: theme.primary, fontWeight: '800' }}>저장</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.commentText, { color: theme.text }]}>{comment.text}</Text>
                  )}
                </View>
              );
            }}
            contentContainerStyle={{ paddingBottom: 100 }}
          />

          <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 10, backgroundColor: theme.card }]}>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder="댓글을 입력하세요..."
              placeholderTextColor="#888"
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendBtn, { backgroundColor: theme.primary }]} 
              onPress={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit & Add Modals remain consistent... */}
      <Modal visible={isEditingPhoto} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }, Shadows.medium]}>
            <Text style={{color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 20}}>설명 수정</Text>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]} value={editDesc} onChangeText={setEditDesc} multiline />
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
  deleteBtn: { padding: 5 },
  listContent: { padding: 16 },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE * 1.2, margin: 8, borderRadius: 28, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  contentSection: { padding: 20 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  authorAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  authorName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.5 },
  dateText: { fontSize: 12, marginTop: 2, fontWeight: '500', opacity: 0.7 },
  detailImage: { width: '100%', height: width * 1.1, borderRadius: 28, ...Shadows.soft },
  content: { fontSize: 16, lineHeight: 26, marginBottom: 20 },
  divider: { height: 1, width: '100%', marginBottom: 15 },
  commentCount: { fontSize: 14, fontWeight: '800', marginBottom: 15, letterSpacing: -0.5 },
  commentItem: { paddingVertical: 15, paddingHorizontal: 20 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  commentAuthor: { fontSize: 14, fontWeight: '800', marginRight: 10, letterSpacing: -0.5 },
  commentDate: { fontSize: 11, flex: 1, fontWeight: '500', opacity: 0.7 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentEditBox: { marginTop: 5 },
  commentEditInput: { borderRadius: 20, padding: 12, fontSize: 14, minHeight: 60, textAlignVertical: 'top', ...Shadows.soft },
  commentEditBtns: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, alignItems: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, maxHeight: 100, marginRight: 10, ...Shadows.soft },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 28, borderRadius: 32 },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 32, borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  titleInput: { borderRadius: 20, padding: 18, marginBottom: 24, fontSize: 16, fontWeight: '600', minHeight: 120, textAlignVertical: 'top' },
  pickBtn: { padding: 20, borderRadius: 24, alignItems: 'center' }
});
