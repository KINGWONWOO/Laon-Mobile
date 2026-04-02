import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, Dimensions, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { Colors } from '../../../constants/theme';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

export default function ArchiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, addPhoto, deletePhoto, addPhotoComment, getUserById, currentUser, getRoomByIdRemote, theme } = useAppContext();
  
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  
  const [activeCommentPhotoId, setActiveCommentPhotoId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // 💡 즉시 갱신을 위한 useMemo
  const roomPhotos = useMemo(() => {
    return photos.filter(p => p.roomId === id);
  }, [photos, id]);

  const [isLeader, setIsLeader] = useState(false);
  React.useEffect(() => {
    if (id) {
      getRoomByIdRemote(id as string).then(room => {
        if (room && room.leader_id === currentUser?.id) {
          setIsLeader(true);
        }
      });
    }
  }, [id, currentUser]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setNewImageUri(result.assets[0].uri);
      setShowUploadModal(true);
    }
  };

  const handleUpload = async () => {
    if (!newImageUri) return;
    setIsUploading(true);
    try {
      await addPhoto(id || '', newImageUri, description);
      setShowUploadModal(false);
      setNewImageUri(null);
      setDescription('');
    } catch (error: any) {
      console.error('[Archive] Upload Error:', error);
      Alert.alert('업로드 실패', error.message || '서버와의 통신에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (photoId: string, photoUrl: string) => {
    Alert.alert('사진 삭제', '이 사진을 정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          await deletePhoto(photoId, photoUrl);
        } catch (e: any) {
          Alert.alert('삭제 실패', e.message);
        }
      }}
    ]);
  };

  const submitComment = async () => {
    if (!activeCommentPhotoId || !commentText.trim()) return;
    try {
      await addPhotoComment(activeCommentPhotoId, commentText.trim());
      setCommentText('');
    } catch (e: any) {
      Alert.alert('댓글 실패', e.message);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <FlatList
        data={roomPhotos}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const uploader = getUserById(item.userId);
          const canDelete = isLeader || item.userId === currentUser?.id;

          return (
            <View style={styles.feedCard}>
              <View style={styles.feedHeader}>
                <View style={styles.uploaderInfo}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{uploader?.name?.[0] || '?'}</Text></View>
                  <View>
                    <Text style={styles.uploaderName}>{uploader?.name || '알 수 없음'}</Text>
                    <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
                  </View>
                </View>
                {canDelete && (
                  <TouchableOpacity onPress={() => handleDelete(item.id, item.photoUrl)}>
                    <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity onPress={() => setSelectedPhoto(item.photoUrl)}>
                <Image source={{ uri: item.photoUrl }} style={styles.feedImage} />
              </TouchableOpacity>

              <View style={styles.feedFooter}>
                {item.description ? (
                  <Text style={styles.descriptionText}>
                    <Text style={{fontWeight: 'bold', color: '#fff'}}>{uploader?.name} </Text>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.commentsSection}>
                  {(item.comments || []).map(c => {
                    const cUser = getUserById(c.userId);
                    return (
                      <Text key={c.id} style={styles.commentText}>
                        <Text style={{fontWeight: 'bold', color: '#fff'}}>{cUser?.name} </Text>
                        {c.text}
                      </Text>
                    );
                  })}
                </View>

                {activeCommentPhotoId === item.id ? (
                  <View style={styles.commentInputRow}>
                    <TextInput 
                      style={styles.commentInput} 
                      placeholder="댓글 달기..." 
                      placeholderTextColor="#666"
                      value={commentText}
                      onChangeText={setCommentText}
                      autoFocus
                    />
                    <TouchableOpacity onPress={submitComment}><Text style={{color: Colors.primary, fontWeight: 'bold'}}>게시</Text></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setActiveCommentPhotoId(item.id)}>
                    <Text style={styles.addCommentHint}>댓글 달기...</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListHeaderComponent={
          <TouchableOpacity 
            style={[styles.uploadBox, { borderColor: Colors.primary + '40' }]} 
            onPress={handlePickImage}
          >
            <Ionicons name="add" size={40} color={Colors.primary} />
            <Text style={{ color: Colors.primary, marginTop: 8, fontWeight: 'bold' }}>새 추억 올리기</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={60} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>아직 등록된 사진이 없습니다.</Text>
          </View>
        }
      />

      {/* 사진 크게 보기 모달 */}
      <Modal visible={!!selectedPhoto} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPhoto(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {selectedPhoto && <Image source={{ uri: selectedPhoto }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* 업로드 및 글 작성 모달 */}
      <Modal visible={showUploadModal} transparent animationType="slide">
        <View style={styles.modalOverlayUpload}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.uploadModalContent}>
            <Text style={styles.uploadTitle}>새 게시물 작성</Text>
            {newImageUri && <Image source={{ uri: newImageUri }} style={styles.previewImage} />}
            <TextInput 
              style={styles.descInput}
              placeholder="문구를 입력해주세요..."
              placeholderTextColor="#666"
              multiline
              value={description}
              onChangeText={setDescription}
            />
            <View style={styles.uploadBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowUploadModal(false)}><Text style={{color: '#999'}}>취소</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleUpload} disabled={isUploading}>
                {isUploading ? <ActivityIndicator color="#000" /> : <Text style={{color: '#000', fontWeight: 'bold'}}>공유하기</Text>}
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
  uploadBox: { height: 100, margin: 15, borderWidth: 2, borderStyle: 'dashed', borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#161622' },
  feedCard: { marginBottom: 20, backgroundColor: '#0A0A0A', borderBottomWidth: 1, borderBottomColor: '#222' },
  feedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  uploaderInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { fontWeight: 'bold', color: '#000' },
  uploaderName: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  timeText: { color: '#666', fontSize: 11 },
  feedImage: { width: width, height: width },
  feedFooter: { padding: 12 },
  descriptionText: { color: '#ccc', fontSize: 14, marginBottom: 8, lineHeight: 20 },
  commentsSection: { marginBottom: 8 },
  commentText: { color: '#aaa', fontSize: 13, marginBottom: 4 },
  addCommentHint: { color: '#666', fontSize: 13 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  commentInput: { flex: 1, color: '#fff', borderBottomWidth: 1, borderBottomColor: '#333', paddingVertical: 5, marginRight: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: Colors.textSecondary, marginTop: 15, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: '100%', height: '80%' },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  uploadModalContent: { backgroundColor: '#1A1A2E', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  uploadTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  previewImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 15 },
  descInput: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 12, height: 100, textAlignVertical: 'top', marginBottom: 20 },
  uploadBtns: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center' },
  submitBtn: { flex: 2, backgroundColor: Colors.primary, padding: 15, borderRadius: 12, alignItems: 'center' },
});
