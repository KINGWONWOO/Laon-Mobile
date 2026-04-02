import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, Dimensions, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { Colors } from '../../../constants/theme';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

export default function ArchiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, addPhoto, deletePhoto, addPhotoComment, getUserById, currentUser, getRoomByIdRemote, markItemAsAccessed, refreshAllData } = useAppContext();
  
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  const [activeCommentPhotoId, setActiveCommentPhotoId] = useState<string | null>(null);
  const [replyToId, setReplyToId] = useState<string | undefined>(undefined);
  const [commentText, setCommentText] = useState('');

  const roomPhotos = useMemo(() => photos.filter(p => p.roomId === id), [photos, id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  const [isLeader, setIsLeader] = useState(false);
  React.useEffect(() => {
    if (id) getRoomByIdRemote(id as string).then(room => { if (room && room.leader_id === currentUser?.id) setIsLeader(true); });
  }, [id, currentUser]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!result.canceled) { setNewImageUri(result.assets[0].uri); setShowUploadModal(true); }
  };

  const handleUpload = async () => {
    if (!newImageUri) return;
    setIsUploading(true);
    try {
      await addPhoto(id || '', newImageUri, description);
      setShowUploadModal(false);
      setNewImageUri(null);
      setDescription('');
    } catch (e: any) { Alert.alert('실패', e.message); } finally { setIsUploading(false); }
  };

  const submitComment = async () => {
    if (!activeCommentPhotoId || !commentText.trim()) return;
    await addPhotoComment(activeCommentPhotoId, commentText.trim(), replyToId);
    setCommentText('');
    setReplyToId(undefined);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return `${Math.floor(diff/60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}시간 전`;
    return `${d.getMonth()+1}월 ${d.getDate()}일`;
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <FlatList
        data={roomPhotos}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => {
          const uploader = getUserById(item.userId);
          const canDelete = isLeader || item.userId === currentUser?.id;
          const mainComments = (item.comments || []).filter(c => !c.parentId);

          return (
            <View style={styles.feedCard}>
              <View style={styles.feedHeader}>
                <View style={styles.uploaderInfo}>
                  {uploader?.profileImage ? (
                    <Image source={{ uri: uploader.profileImage }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: Colors.primary }]}><Text style={styles.avatarText}>{uploader?.name?.[0]}</Text></View>
                  )}
                  <View>
                    <Text style={styles.uploaderName}>{uploader?.name || '알 수 없음'}</Text>
                    <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
                  </View>
                </View>
                {canDelete && (
                  <TouchableOpacity onPress={() => deletePhoto(item.id, item.photoUrl)}>
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity onPress={() => { setSelectedPhoto(item.photoUrl); markItemAsAccessed('photo', item.id); }}>
                <Image source={{ uri: item.photoUrl }} style={styles.feedImage} />
              </TouchableOpacity>

              <View style={styles.feedFooter}>
                {item.description && (
                  <View style={styles.descRow}>
                    <Text style={styles.descName}>{uploader?.name}</Text>
                    <Text style={styles.descText}>{item.description}</Text>
                  </View>
                )}

                <View style={styles.commentsList}>
                  {mainComments.map(c => {
                    const cUser = getUserById(c.userId);
                    const replies = (item.comments || []).filter(r => r.parentId === c.id);
                    return (
                      <View key={c.id} style={styles.commentContainer}>
                        <View style={styles.commentRow}>
                          <Text style={styles.cName}>{cUser?.name}</Text>
                          <Text style={styles.cText}>{c.text}</Text>
                          <TouchableOpacity onPress={() => { setActiveCommentPhotoId(item.id); setReplyToId(c.id); setCommentText(`@${cUser?.name} `); }}>
                            <Text style={styles.replyBtnText}>답글</Text>
                          </TouchableOpacity>
                        </View>
                        {replies.map(r => {
                          const rUser = getUserById(r.userId);
                          return (
                            <View key={r.id} style={styles.replyRow}>
                              <Ionicons name="return-down-forward" size={12} color="#444" style={{marginRight: 5}}/>
                              <Text style={styles.cName}>{rUser?.name}</Text>
                              <Text style={styles.cText}>{r.text}</Text>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.commentInputRow}>
                  <TextInput 
                    style={styles.commentInput} 
                    placeholder={replyToId ? "답글 남기는 중..." : "댓글 달기..."} 
                    placeholderTextColor="#444"
                    value={activeCommentPhotoId === item.id ? commentText : ''}
                    onChangeText={(t) => { setActiveCommentPhotoId(item.id); setCommentText(t); }}
                  />
                  {activeCommentPhotoId === item.id && commentText.trim() && (
                    <TouchableOpacity onPress={submitComment}><Text style={{color: Colors.primary}}>게시</Text></TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
        ListHeaderComponent={
          <TouchableOpacity style={styles.uploadBox} onPress={handlePickImage}>
            <Ionicons name="camera" size={30} color={Colors.primary} />
            <Text style={{ color: Colors.primary, marginLeft: 10, fontWeight: 'bold' }}>새로운 추억 공유하기</Text>
          </TouchableOpacity>
        }
      />

      <Modal visible={!!selectedPhoto} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPhoto(null)}><Ionicons name="close" size={30} color="#fff" /></TouchableOpacity>
          {selectedPhoto && <Image source={{ uri: selectedPhoto }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>

      <Modal visible={showUploadModal} transparent animationType="slide">
        <View style={styles.modalOverlayUpload}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.uploadContent}>
            <Text style={styles.uploadTitle}>새 게시물</Text>
            {newImageUri && <Image source={{ uri: newImageUri }} style={styles.previewImg} />}
            <TextInput style={styles.descInput} placeholder="설명을 입력하세요..." placeholderTextColor="#666" multiline value={description} onChangeText={setDescription} />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowUploadModal(false)} style={styles.btnCancel}><Text style={{color: '#666'}}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpload} style={styles.btnSubmit} disabled={isUploading}>
                {isUploading ? <ActivityIndicator color="#000" /> : <Text style={{fontWeight: 'bold'}}>공유</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  uploadBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#161622', margin: 15, padding: 20, borderRadius: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: '#333' },
  feedCard: { marginBottom: 15, backgroundColor: '#000' },
  feedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  uploaderInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarImg: { width: 34, height: 34, borderRadius: 12, marginRight: 10 },
  avatarText: { fontWeight: 'bold', fontSize: 14 },
  uploaderName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  timeText: { color: '#444', fontSize: 10 },
  feedImage: { width: width, height: width },
  feedFooter: { padding: 12 },
  descRow: { flexDirection: 'row', marginBottom: 10 },
  descName: { color: '#fff', fontWeight: 'bold', marginRight: 8, fontSize: 14 },
  descText: { color: '#ccc', flex: 1, fontSize: 14 },
  commentsList: { marginBottom: 10 },
  commentContainer: { marginBottom: 8 },
  commentRow: { flexDirection: 'row', alignItems: 'center' },
  replyRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 20, marginTop: 4 },
  cName: { color: '#fff', fontWeight: 'bold', fontSize: 12, marginRight: 6 },
  cText: { color: '#aaa', fontSize: 12, flex: 1 },
  replyBtnText: { color: '#444', fontSize: 10, marginLeft: 10 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: '#222', paddingTop: 10 },
  commentInput: { flex: 1, color: '#fff', fontSize: 13, marginRight: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  fullImage: { width: '100%', height: '80%' },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  uploadContent: { backgroundColor: '#1A1A2E', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  uploadTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  previewImg: { width: '100%', height: 250, borderRadius: 15, marginBottom: 20 },
  descInput: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 12, height: 80, marginBottom: 20 },
  modalActions: { flexDirection: 'row' },
  btnCancel: { flex: 1, alignItems: 'center', padding: 15 },
  btnSubmit: { flex: 2, backgroundColor: Colors.primary, alignItems: 'center', padding: 15, borderRadius: 12 }
});
