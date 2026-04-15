import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ScrollView, TextInput, Alert, ActivityIndicator, RefreshControl, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { Shadows } from '../../../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull } from '../../../components/ui/RoomComponents';
import { Image as ExpoImage } from 'expo-image';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2; // Two columns for a more "designer" high-end feel
const SPACING = 20;
const ITEM_SIZE = (width - (SPACING * (COLUMN_COUNT + 1))) / COLUMN_COUNT;

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
      } catch (error: any) {
        Alert.alert('업로드 실패', error.message);
      } finally { setIsLoading(false); }
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
      style={[styles.gridItem, { backgroundColor: theme.card }]} 
      onPress={() => { setSelectedPhoto(item); markItemAsAccessed('photo', item.id); }}
    >
      <ExpoImage source={{ uri: item.photoUrl }} style={styles.gridImage} contentFit="cover" transition={300} />
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
        columnWrapperStyle={{ paddingHorizontal: SPACING, justifyContent: 'space-between' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
      />

      {/* Photo Detail Modal */}
      <Modal visible={!!selectedPhoto} animationType="slide" transparent>
        <View style={styles.detailOverlay}>
          <View style={[styles.detailContent, { backgroundColor: theme.background, marginTop: insets.top + 20, borderTopLeftRadius: 40, borderTopRightRadius: 40 }]}>
            <View style={styles.detailHeader}>
              <View style={styles.detailAuthor}>
                <ExpoImage source={{ uri: getUserById(selectedPhoto?.userId)?.profileImage }} style={styles.authorImg} />
                <View>
                  <Text style={[styles.authorName, { color: theme.text }]}>{getUserById(selectedPhoto?.userId)?.name}</Text>
                  <Text style={[styles.dateText, { color: theme.textSecondary }]}>{selectedPhoto && formatDateFull(selectedPhoto.createdAt)}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelectedPhoto(null)} style={styles.closeBtn}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <ExpoImage source={{ uri: selectedPhoto?.photoUrl }} style={styles.detailImage} contentFit="cover" />
              
              <View style={styles.detailActions}>
                {(selectedPhoto?.userId === currentUser?.id || currentRoom?.leaderId === currentUser?.id) && (
                  <View style={{flexDirection: 'row'}}>
                    <TouchableOpacity onPress={() => { setEditDesc(selectedPhoto.description || ''); setIsEditingPhoto(true); }} style={styles.actionIcon}>
                      <Ionicons name="pencil" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeletePhoto(selectedPhoto)} style={styles.actionIcon}>
                      <Ionicons name="trash" size={20} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.detailInfo}>
                <Text style={[styles.description, { color: theme.text }]}>{selectedPhoto?.description || '설명이 없습니다.'}</Text>
                
                <View style={styles.commentSection}>
                  <Text style={[styles.commentTitle, { color: theme.text }]}>댓글 {selectedPhoto?.comments?.length || 0}개</Text>
                  {selectedPhoto?.comments?.map((c: any) => {
                    const author = getUserById(c.userId);
                    return (
                      <View key={c.id} style={styles.cItem}>
                        <ExpoImage source={{ uri: author?.profileImage }} style={styles.cAuthorImg} />
                        <View style={{flex: 1}}>
                          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Text style={[styles.cUserName, { color: theme.text }]}>{author?.name}</Text>
                            {c.userId === currentUser?.id && (
                              <View style={{flexDirection: 'row'}}>
                                <TouchableOpacity onPress={() => { setEditingComment(c); setEditCommentText(c.text); }} style={{padding: 4}}><Ionicons name="pencil" size={12} color={theme.textSecondary} /></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteComment(c.id)} style={{padding: 4}}><Ionicons name="trash" size={12} color={theme.error} /></TouchableOpacity>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.cText, { color: theme.text }]}>{c.text}</Text>
                          <Text style={[styles.cDate, { color: theme.textSecondary }]}>{formatDateFull(c.createdAt)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
            
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={[styles.commentInputRow, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <TextInput 
                  style={[styles.cInput, { color: theme.text, backgroundColor: theme.card }]} 
                  placeholder="댓글 남기기..." 
                  placeholderTextColor={theme.textSecondary} 
                  value={newComment} 
                  onChangeText={setNewComment} 
                />
                <TouchableOpacity onPress={handleAddComment} style={[styles.sendBtn, { backgroundColor: theme.primary }]}><Ionicons name="arrow-up" size={20} color="#fff" /></TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* Edit Description Modal */}
      <Modal visible={isEditingPhoto} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 24, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5}}>설명 수정</Text>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} value={editDesc} onChangeText={setEditDesc} multiline />
            <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
              <TouchableOpacity onPress={() => setIsEditingPhoto(false)} style={{marginRight: 20}}><Text style={{color: theme.textSecondary, fontWeight: '600'}}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdatePhoto}><Text style={{color: theme.primary, fontWeight:'900'}}>수정</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Comment Modal */}
      <Modal visible={!!editingComment} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 24, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5}}>댓글 수정</Text>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} value={editCommentText} onChangeText={setEditCommentText} multiline />
            <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
              <TouchableOpacity onPress={() => setEditingComment(null)} style={{marginRight: 20}}><Text style={{color: theme.textSecondary, fontWeight: '600'}}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateComment}><Text style={{color: theme.primary, fontWeight:'900'}}>수정</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Photo Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 24, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5}}>사진 업로드</Text>
            <TextInput style={[styles.titleInput, { color: theme.text, backgroundColor: theme.background }]} placeholder="사진 설명 (선택)" placeholderTextColor={theme.textSecondary} value={description} onChangeText={setDescription} multiline />
            {isLoading ? <ActivityIndicator size="large" color={theme.primary} /> : <TouchableOpacity onPress={handlePickImage} style={[styles.pickBtn, {backgroundColor: theme.primary}]}><Text style={{fontWeight: '900', color: '#fff', letterSpacing: -0.5}}>갤러리에서 선택</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={{marginTop: 20}}><Text style={{color: theme.textSecondary, textAlign: 'center', fontWeight: '600'}}>취소</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE * 1.2, marginBottom: SPACING, borderRadius: 32, ...Shadows.card, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  detailContent: { flex: 1, overflow: 'hidden' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  detailAuthor: { flexDirection: 'row', alignItems: 'center' },
  authorImg: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  authorName: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  dateText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  closeBtn: { padding: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 20 },
  detailImage: { width: '100%', aspectRatio: 1, backgroundColor: '#f0f0f0' },
  detailActions: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 15 },
  actionIcon: { marginLeft: 20, padding: 5 },
  detailInfo: { padding: 20 },
  description: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  commentSection: { marginTop: 30, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 20 },
  commentTitle: { fontSize: 18, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5 },
  cItem: { flexDirection: 'row', marginBottom: 20 },
  cAuthorImg: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  cUserName: { fontSize: 14, fontWeight: '900' },
  cText: { fontSize: 15, marginTop: 4, lineHeight: 20, fontWeight: '500' },
  cDate: { fontSize: 11, marginTop: 6, fontWeight: '600' },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', padding: 20, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  cInput: { flex: 1, height: 50, borderRadius: 25, paddingHorizontal: 20, marginRight: 12, fontWeight: '500' },
  sendBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 30, borderRadius: 32, ...Shadows.card },
  input: { borderRadius: 24, padding: 20, marginBottom: 20, minHeight: 120, fontWeight: '500' },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 40, borderTopLeftRadius: 40, borderTopRightRadius: 40, ...Shadows.card },
  titleInput: { borderRadius: 24, padding: 20, marginBottom: 20, minHeight: 120, fontWeight: '500' },
  pickBtn: { padding: 20, borderRadius: 24, alignItems: 'center', ...Shadows.soft }
});
