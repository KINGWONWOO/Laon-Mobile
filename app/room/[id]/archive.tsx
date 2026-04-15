import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, ScrollView, TextInput, Alert, ActivityIndicator, RefreshControl, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { Shadows } from '../../../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull } from '../../../components/ui/RoomComponents';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;

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
      style={styles.gridItem} 
      onPress={() => { setSelectedPhoto(item); markItemAsAccessed('photo', item.id); }}
    >
      <Image source={{ uri: item.photoUrl }} style={styles.gridImage} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme.card }]}>
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
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Photo Detail Modal */}
      <Modal visible={!!selectedPhoto} animationType="fade" transparent>
        <View style={styles.detailOverlay}>
          <View style={[styles.detailContent, { backgroundColor: theme.background }]}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setSelectedPhoto(null)}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
              <View style={{flex: 1}} />
              {(selectedPhoto?.userId === currentUser?.id || currentRoom?.leaderId === currentUser?.id) && (
                <View style={{flexDirection: 'row'}}>
                  <TouchableOpacity onPress={() => { setEditDesc(selectedPhoto.description || ''); setIsEditingPhoto(true); }} style={{marginRight: 15}}>
                    <Ionicons name="pencil" size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeletePhoto(selectedPhoto)}>
                    <Ionicons name="trash" size={22} color={theme.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Image source={{ uri: selectedPhoto?.photoUrl }} style={styles.detailImage} resizeMode="contain" />
              <View style={styles.detailInfo}>
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}>
                  <Image source={{ uri: getUserById(selectedPhoto?.userId)?.profileImage }} style={styles.authorImg} />
                  <View>
                    <Text style={{color: theme.text, fontWeight: '800', letterSpacing: -0.5}}>{getUserById(selectedPhoto?.userId)?.name}</Text>
                    <Text style={{color: theme.textSecondary, fontSize: 11, fontWeight: '500', opacity: 0.7}}>{selectedPhoto && formatDateFull(selectedPhoto.createdAt)}</Text>
                  </View>
                </View>
                <Text style={{color: theme.text, fontSize: 15, lineHeight: 22, marginBottom: 20}}>{selectedPhoto?.description || '설명이 없습니다.'}</Text>
                
                <View style={styles.commentSection}>
                  <Text style={{color: theme.text, fontWeight: '800', marginBottom: 15, letterSpacing: -0.5}}>댓글 {selectedPhoto?.comments?.length || 0}</Text>
                  {selectedPhoto?.comments?.map((c: any) => (
                    <View key={c.id} style={styles.cItem}>
                      <Image source={{ uri: getUserById(c.userId)?.profileImage }} style={styles.cAuthorImg} />
                      <View style={{flex: 1}}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                          <Text style={{color: theme.text, fontWeight: '800', fontSize: 13, letterSpacing: -0.5}}>{getUserById(c.userId)?.name}</Text>
                          {c.userId === currentUser?.id && (
                            <View style={{flexDirection: 'row'}}>
                              <TouchableOpacity onPress={() => { setEditingComment(c); setEditCommentText(c.text); }}><Ionicons name="pencil" size={12} color={theme.textSecondary} style={{marginRight: 8}} /></TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteComment(c.id)}><Ionicons name="trash" size={12} color={theme.error} /></TouchableOpacity>
                            </View>
                          )}
                        </View>
                        <Text style={{color: theme.text, fontSize: 14, marginTop: 2}}>{c.text}</Text>
                        <Text style={{color: theme.textSecondary, fontSize: 10, marginTop: 4, fontWeight: '500', opacity: 0.7}}>{formatDateFull(c.createdAt)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={[styles.commentInputRow, { paddingBottom: insets.bottom + 10 }]}>
                <TextInput style={[styles.cInput, { color: theme.text, backgroundColor: theme.card }]} placeholder="댓글 달기..." placeholderTextColor={theme.textSecondary} value={newComment} onChangeText={setNewComment} />
                <TouchableOpacity onPress={handleAddComment} style={[styles.sendBtn, { backgroundColor: theme.primary }]}><Ionicons name="send" size={18} color={theme.background} /></TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* Edit Description Modal */}
      <Modal visible={isEditingPhoto} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 20, fontWeight: '800', marginBottom: 20, letterSpacing: -0.5}}>설명 수정</Text>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} value={editDesc} onChangeText={setEditDesc} multiline />
            <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
              <TouchableOpacity onPress={() => setIsEditingPhoto(false)} style={{marginRight: 20}}><Text style={{color: theme.textSecondary}}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdatePhoto}><Text style={{color: theme.primary, fontWeight:'bold'}}>수정</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Comment Modal */}
      <Modal visible={!!editingComment} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 20, letterSpacing: -0.5}}>댓글 수정</Text>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} value={editCommentText} onChangeText={setEditCommentText} multiline />
            <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
              <TouchableOpacity onPress={() => setEditingComment(null)} style={{marginRight: 20}}><Text style={{color: theme.textSecondary, fontWeight: '500', opacity: 0.7}}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateComment}><Text style={{color: theme.primary, fontWeight:'800'}}>수정</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Photo Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 20, letterSpacing: -0.5}}>사진 업로드</Text>
            <TextInput style={[styles.titleInput, { color: theme.text, backgroundColor: theme.background }]} placeholder="사진 설명 (선택)" placeholderTextColor={theme.textSecondary} value={description} onChangeText={setDescription} multiline />
            {isLoading ? <ActivityIndicator size="large" color={theme.primary} /> : <TouchableOpacity onPress={handlePickImage} style={[styles.pickBtn, {backgroundColor: theme.primary}]}><Text style={{fontWeight: '800', color: theme.background, letterSpacing: -0.5}}>갤러리에서 선택</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={{marginTop: 20}}><Text style={{color: theme.textSecondary, textAlign: 'center', fontWeight: '500', opacity: 0.7}}>취소</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, padding: 1 },
  gridImage: { width: '100%', height: '100%' },
  detailOverlay: { flex: 1, backgroundColor: '#000' },
  detailContent: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  detailImage: { width: '100%', height: width * 1.2 },
  detailInfo: { padding: 20 },
  authorImg: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  commentSection: { marginTop: 20, paddingTop: 20 },
  cItem: { flexDirection: 'row', marginBottom: 20 },
  cAuthorImg: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  cInput: { flex: 1, height: 44, borderRadius: 20, paddingHorizontal: 15, marginRight: 10, ...Shadows.soft },
  sendBtn: { width: 44, height: 44, borderRadius: 999, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 25, borderRadius: 28, ...Shadows.card },
  input: { borderRadius: 20, padding: 15, marginBottom: 20, minHeight: 80, ...Shadows.soft },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 30, borderTopLeftRadius: 32, borderTopRightRadius: 32, ...Shadows.card },
  titleInput: { borderRadius: 20, padding: 15, marginBottom: 20, minHeight: 100, ...Shadows.soft },
  pickBtn: { padding: 15, borderRadius: 28, alignItems: 'center', ...Shadows.soft }
});
