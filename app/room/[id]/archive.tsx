import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, Dimensions, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView, RefreshControl } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { Colors } from '../../../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ArchiveScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { photos, addPhoto, deletePhoto, addPhotoComment, getUserById, currentUser, getRoomByIdRemote, markItemAsAccessed, refreshAllData, theme } = useAppContext();
  
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>사진 아카이브</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          data={roomPhotos}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => {
            const uploader = getUserById(item.userId);
            const canDelete = isLeader || item.userId === currentUser?.id;
            const mainComments = (item.comments || []).filter(c => !c.parentId);

            return (
              <View style={[styles.feedCard, { backgroundColor: theme.card }]}>
                <View style={styles.feedHeader}>
                  <View style={styles.uploaderInfo}>
                    {uploader?.profileImage ? (
                      <Image source={{ uri: uploader.profileImage }} style={styles.avatarImg} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: theme.primary }]}><Text style={styles.avatarText}>{uploader?.name?.[0]}</Text></View>
                    )}
                    <View>
                      <Text style={[styles.uploaderName, { color: theme.text }]}>{uploader?.name || '알 수 없음'}</Text>
                      <Text style={[styles.timeText, { color: theme.textSecondary }]}>{formatTime(item.createdAt)}</Text>
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
                      <Text style={[styles.descName, { color: theme.text }]}>{uploader?.name}</Text>
                      <Text style={[styles.descText, { color: theme.textSecondary }]}>{item.description}</Text>
                    </View>
                  )}

                  <View style={styles.commentsList}>
                    {mainComments.map(c => {
                      const cUser = getUserById(c.userId);
                      const replies = (item.comments || []).filter(r => r.parentId === c.id);
                      return (
                        <View key={c.id} style={styles.commentContainer}>
                          <View style={styles.commentRow}>
                            <Text style={[styles.cName, { color: theme.text }]}>{cUser?.name}</Text>
                            <Text style={[styles.cText, { color: theme.textSecondary }]}>{c.text}</Text>
                            <TouchableOpacity onPress={() => { setActiveCommentPhotoId(item.id); setReplyToId(c.id); setCommentText(`@${cUser?.name} `); }}>
                              <Text style={styles.replyBtnText}>답글</Text>
                            </TouchableOpacity>
                          </View>
                          {replies.map(r => {
                            const rUser = getUserById(r.userId);
                            return (
                              <View key={r.id} style={styles.replyRow}>
                                <Ionicons name="return-down-forward" size={12} color={theme.textSecondary} style={{marginRight: 5}}/>
                                <Text style={[styles.cName, { color: theme.text }]}>{rUser?.name}</Text>
                                <Text style={[styles.cText, { color: theme.textSecondary }]}>{r.text}</Text>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>

                  <View style={[styles.commentInputRow, { borderTopColor: theme.border }]}>
                    <TextInput 
                      style={[styles.commentInput, { color: theme.text }]} 
                      placeholder={replyToId ? "답글 남기는 중..." : "댓글 달기..."} 
                      placeholderTextColor={theme.textSecondary}
                      value={activeCommentPhotoId === item.id ? commentText : ''}
                      onChangeText={(t) => { setActiveCommentPhotoId(item.id); setCommentText(t); }}
                      onSubmitEditing={submitComment}
                    />
                  </View>
                </View>
              </View>
            );
          }}
        />

        <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + 80 }]} onPress={handlePickImage}><Ionicons name="camera" size={30} color={theme.background} /></TouchableOpacity>
      </View>

      <Modal visible={showUploadModal} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1, backgroundColor: theme.background}}>
          <ScrollView contentContainerStyle={styles.uploadContainer}>
            <TouchableOpacity onPress={() => { setShowUploadModal(false); setNewImageUri(null); }} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
            {newImageUri && <Image source={{ uri: newImageUri }} style={styles.previewImage} />}
            <TextInput 
              style={[styles.descInput, { color: theme.text }]} 
              placeholder="사진에 대한 설명을 입력하세요..." 
              placeholderTextColor={theme.textSecondary} 
              multiline
              value={description}
              onChangeText={setDescription}
            />
            <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: theme.primary }]} onPress={handleUpload} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color={theme.background} /> : <Text style={[styles.uploadBtnText, { color: theme.background }]}>공유하기</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {selectedPhoto && (
        <Modal visible={!!selectedPhoto} transparent>
          <View style={styles.fullImageContainer}>
            <TouchableOpacity style={styles.fullImageClose} onPress={() => setSelectedPhoto(null)}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: selectedPhoto }} style={styles.fullImage} resizeMode="contain" />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  feedCard: { marginBottom: 15 },
  feedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  uploaderInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarImg: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  avatarText: { fontWeight: 'bold' },
  uploaderName: { fontWeight: 'bold', fontSize: 14 },
  timeText: { fontSize: 11, marginTop: 2 },
  feedImage: { width: width, height: width, backgroundColor: '#111' },
  feedFooter: { padding: 12 },
  descRow: { flexDirection: 'row', marginBottom: 10 },
  descName: { fontWeight: 'bold', marginRight: 8, fontSize: 14 },
  descText: { flex: 1, fontSize: 14 },
  commentsList: { marginBottom: 10 },
  commentContainer: { marginBottom: 8 },
  commentRow: { flexDirection: 'row', alignItems: 'center' },
  cName: { fontWeight: '600', fontSize: 13, marginRight: 6 },
  cText: { fontSize: 13, flex: 1 },
  replyBtnText: { color: '#666', fontSize: 11, marginLeft: 8 },
  replyRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 20, marginTop: 4 },
  commentInputRow: { borderTopWidth: 0.5, paddingTop: 10 },
  commentInput: { fontSize: 14, padding: 5 },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  uploadContainer: { flex: 1, padding: 20, paddingTop: 60 },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 20 },
  previewImage: { width: '100%', height: width - 40, borderRadius: 15, marginBottom: 20 },
  descInput: { fontSize: 16, minHeight: 100, textAlignVertical: 'top', marginBottom: 20 },
  uploadBtn: { padding: 18, borderRadius: 15, alignItems: 'center' },
  uploadBtnText: { fontWeight: 'bold', fontSize: 16 },
  fullImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullImageClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  fullImage: { width: width, height: '100%' }
});
