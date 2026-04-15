import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, ScrollView, TextInput, Alert, ActivityIndicator, RefreshControl, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
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
                    <Text style={{color: theme.text, fontWeight: 'bold'}}>{getUserById(selectedPhoto?.userId)?.name}</Text>
                    <Text style={{color: theme.textSecondary, fontSize: 11}}>{selectedPhoto && formatDateFull(selectedPhoto.createdAt)}</Text>
                  </View>
                </View>
                <Text style={{color: theme.text, fontSize: 15, lineHeight: 22, marginBottom: 20}}>{selectedPhoto?.description || '설명이 없습니다.'}</Text>
                
                <View style={[styles.commentSection, { borderTopColor: theme.border }]}>
                  <Text style={{color: theme.text, fontWeight: 'bold', marginBottom: 15}}>댓글 {selectedPhoto?.comments?.length || 0}</Text>
                  {selectedPhoto?.comments?.map((c: any) => (
                    <View key={c.id} style={styles.cItem}>
                      <Image source={{ uri: getUserById(c.userId)?.profileImage }} style={styles.cAuthorImg} />
                      <View style={{flex: 1}}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                          <Text style={{color: theme.text, fontWeight: 'bold', fontSize: 13}}>{getUserById(c.userId)?.name}</Text>
                          {c.userId === currentUser?.id && (
                            <View style={{flexDirection: 'row'}}>
                              <TouchableOpacity onPress={() => { setEditingComment(c); setEditCommentText(c.text); }}><Ionicons name="pencil" size={12} color={theme.textSecondary} style={{marginRight: 8}} /></TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteComment(c.id)}><Ionicons name="trash" size={12} color={theme.error} /></TouchableOpacity>
                            </View>
                          )}
                        </View>
                        <Text style={{color: theme.text, fontSize: 14, marginTop: 2}}>{c.text}</Text>
                        <Text style={{color: theme.textSecondary, fontSize: 10, marginTop: 4}}>{formatDateFull(c.createdAt)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={[styles.commentInputRow, { borderTopColor: theme.border, paddingBottom: insets.bottom + 10 }]}>
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
            <Text style={{color: theme.text, fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>설명 수정</Text>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} value={editDesc} onChangeText={setEditDesc} multiline />
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
            <Text style={{color: theme.text, fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>댓글 수정</Text>
            <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} value={editCommentText} onChangeText={setEditCommentText} multiline />
            <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
              <TouchableOpacity onPress={() => setEditingComment(null)} style={{marginRight: 20}}><Text style={{color: theme.textSecondary}}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateComment}><Text style={{color: theme.primary, fontWeight:'bold'}}>수정</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Photo Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>사진 업로드</Text>
            <TextInput style={[styles.titleInput, { color: theme.text, borderColor: theme.border }]} placeholder="사진 설명 (선택)" placeholderTextColor={theme.textSecondary} value={description} onChangeText={setDescription} multiline />
            {isLoading ? <ActivityIndicator size="large" color={theme.primary} /> : <TouchableOpacity onPress={handlePickImage} style={[styles.pickBtn, {backgroundColor: theme.primary}]}><Text style={{fontWeight: 'bold', color: theme.background}}>갤러리에서 선택</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={{marginTop: 20}}><Text style={{color: theme.textSecondary, textAlign: 'center'}}>취소</Text></TouchableOpacity>
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
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, padding: 1 },
  gridImage: { width: '100%', height: '100%' },
  detailOverlay: { flex: 1, backgroundColor: '#000' },
  detailContent: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  detailImage: { width: '100%', height: width * 1.2 },
  detailInfo: { padding: 20 },
  authorImg: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  commentSection: { marginTop: 20, paddingTop: 20, borderTopWidth: 0.5 },
  cItem: { flexDirection: 'row', marginBottom: 20 },
  cAuthorImg: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderTopWidth: 0.5 },
  cInput: { flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 15, marginRight: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 25, borderRadius: 20 },
  input: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20, minHeight: 80 },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  titleInput: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20, minHeight: 100 },
  pickBtn: { padding: 15, borderRadius: 12, alignItems: 'center' }
});
