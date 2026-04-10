import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, Dimensions, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView, RefreshControl } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { Colors } from '../../../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

const { width } = Dimensions.get('window');
const GRID_SIZE = width / 3;

const VideoItem = ({ url, style, usePlayerControls = false }: { url: string, style?: any, usePlayerControls?: boolean }) => {
  const player = useVideoPlayer(url, p => {
    p.loop = true;
    p.play();
  });
  return <VideoView style={style || styles.feedImage} player={player} allowsFullscreen={false} contentFit="cover" nativeControls={usePlayerControls} />;
};

export default function ArchiveScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { photos, addPhoto, deletePhoto, addPhotoComment, getUserById, currentUser, getRoomByIdRemote, markItemAsAccessed, refreshAllData, theme } = useAppContext();
  
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newFileUri, setNewFileUri] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video'>('image');
  const [description, setDescription] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
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

  const handlePickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images', 'videos'], 
      quality: 0.5 
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset.type === 'video' && asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('용량 초과', '영상은 5MB 이하만 업로드 가능합니다.');
        return;
      }
      setNewFileUri(asset.uri);
      setFileType(asset.type === 'video' ? 'video' : 'image');
      setShowUploadModal(true);
    }
  };

  const handleUpload = async () => {
    if (!newFileUri) return;
    setIsUploading(true);
    try {
      await addPhoto(id || '', newFileUri, description);
      setShowUploadModal(false);
      setNewFileUri(null);
      setDescription('');
    } catch (e: any) { Alert.alert('실패', e.message); } finally { setIsUploading(false); }
  };

  const submitComment = async () => {
    if (!selectedItem || !commentText.trim()) return;
    await addPhotoComment(selectedItem.id, commentText.trim(), replyToId);
    setCommentText('');
    setReplyToId(undefined);
    // 상세 모달 데이터 갱신을 위해 roomPhotos에서 다시 찾기
    refreshAllData();
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

  const isVideo = (url: string) => url.toLowerCase().match(/\.(mp4|mov|m4v|webm)$/) || url.includes('video');

  // 상세 모달에서 사용할 최신 데이터 선택
  const activeDetailItem = useMemo(() => {
    if (!selectedItem) return null;
    return roomPhotos.find(p => p.id === selectedItem.id) || selectedItem;
  }, [roomPhotos, selectedItem]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>아카이브</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          data={roomPhotos}
          keyExtractor={item => item.id}
          numColumns={3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => {
            const itemIsVideo = isVideo(item.photoUrl);
            return (
              <TouchableOpacity 
                style={styles.gridItem} 
                onPress={() => { setSelectedItem(item); markItemAsAccessed('photo', item.id); }}
              >
                {itemIsVideo ? (
                  <View style={styles.gridImage}>
                    <VideoItem url={item.photoUrl} style={styles.gridImage} />
                    <View style={styles.videoBadge}><Ionicons name="play" size={12} color="#FFF" /></View>
                  </View>
                ) : (
                  <Image source={{ uri: item.photoUrl }} style={styles.gridImage} />
                )}
              </TouchableOpacity>
            );
          }}
        />

        <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + 80 }]} onPress={handlePickMedia}><Ionicons name="add" size={30} color={theme.background} /></TouchableOpacity>
      </View>

      {/* 업로드 모달 */}
      <Modal visible={showUploadModal} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1, backgroundColor: theme.background}}>
          <ScrollView contentContainerStyle={styles.uploadContainer}>
            <TouchableOpacity onPress={() => { setShowUploadModal(false); setNewFileUri(null); }} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
            {newFileUri && (
              fileType === 'video' ? (
                <VideoItem url={newFileUri} style={styles.previewImage} />
              ) : (
                <Image source={{ uri: newFileUri }} style={styles.previewImage} />
              )
            )}
            <TextInput 
              style={[styles.descInput, { color: theme.text }]} 
              placeholder="설명을 입력하세요..." 
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

      {/* 상세 보기 및 댓글 모달 */}
      {activeDetailItem && (
        <Modal visible={!!activeDetailItem} animationType="fade" transparent={false}>
          <View style={[styles.detailContainer, { backgroundColor: theme.background, paddingTop: insets.top }]}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.detailHeaderTitle, { color: theme.text }]}>상세 보기</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
              {isVideo(activeDetailItem.photoUrl) ? (
                <VideoItem url={activeDetailItem.photoUrl} style={styles.detailMedia} usePlayerControls={true} />
              ) : (
                <Image source={{ uri: activeDetailItem.photoUrl }} style={styles.detailMedia} resizeMode="contain" />
              )}

              <View style={styles.detailInfoSection}>
                <View style={styles.detailUploaderRow}>
                  <View style={styles.uploaderInfo}>
                    <Text style={[styles.uploaderName, { color: theme.text }]}>{getUserById(activeDetailItem.userId)?.name}</Text>
                    <Text style={[styles.timeText, { color: theme.textSecondary }]}>{formatTime(activeDetailItem.createdAt)}</Text>
                  </View>
                  {(isLeader || activeDetailItem.userId === currentUser?.id) && (
                    <TouchableOpacity onPress={() => {
                      Alert.alert('삭제', '이 콘텐츠를 삭제할까요?', [
                        { text: '취소' },
                        { text: '삭제', style: 'destructive', onPress: () => { deletePhoto(activeDetailItem.id, activeDetailItem.photoUrl); setSelectedItem(null); } }
                      ]);
                    }}>
                      <Ionicons name="trash-outline" size={20} color={theme.error} />
                    </TouchableOpacity>
                  )}
                </View>

                {activeDetailItem.description && (
                  <Text style={[styles.detailDescription, { color: theme.textSecondary }]}>{activeDetailItem.description}</Text>
                )}

                <View style={[styles.detailCommentsSection, { borderTopColor: theme.border }]}>
                  <Text style={[styles.commentsTitle, { color: theme.text }]}>댓글 {(activeDetailItem.comments || []).length}</Text>
                  {(activeDetailItem.comments || []).filter((c:any) => !c.parentId).map((c:any) => {
                    const cUser = getUserById(c.userId);
                    const replies = (activeDetailItem.comments || []).filter((r:any) => r.parentId === c.id);
                    return (
                      <View key={c.id} style={styles.commentItem}>
                        <View style={styles.commentMainRow}>
                          <Text style={[styles.cName, { color: theme.text }]}>{cUser?.name}</Text>
                          <Text style={[styles.cText, { color: theme.textSecondary }]}>{c.text}</Text>
                          <TouchableOpacity onPress={() => { setReplyToId(c.id); setCommentText(`@${cUser?.name} `); }}>
                            <Text style={styles.replyBtnText}>답글</Text>
                          </TouchableOpacity>
                        </View>
                        {replies.map((r:any) => (
                          <View key={r.id} style={styles.replyRow}>
                            <Ionicons name="return-down-forward" size={12} color={theme.textSecondary} style={{marginRight: 5}}/>
                            <Text style={[styles.cName, { color: theme.text }]}>{getUserById(r.userId)?.name}</Text>
                            <Text style={[styles.cText, { color: theme.textSecondary }]}>{r.text}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.detailCommentInputContainer}>
              <View style={[styles.detailCommentInputRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <TextInput 
                  style={[styles.detailCommentInput, { color: theme.text }]} 
                  placeholder={replyToId ? "답글 남기는 중..." : "댓글 달기..."} 
                  placeholderTextColor={theme.textSecondary}
                  value={commentText}
                  onChangeText={setCommentText}
                />
                <TouchableOpacity onPress={submitComment}>
                  <Ionicons name="send" size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
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
  gridItem: { width: GRID_SIZE, height: GRID_SIZE, padding: 1 },
  gridImage: { width: '100%', height: '100%', backgroundColor: '#111' },
  videoBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 4 },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  uploadContainer: { flex: 1, padding: 20, paddingTop: 60 },
  closeBtn: { padding: 5 },
  previewImage: { width: '100%', height: width - 40, borderRadius: 15, marginBottom: 20 },
  descInput: { fontSize: 16, minHeight: 100, textAlignVertical: 'top', marginBottom: 20 },
  uploadBtn: { padding: 18, borderRadius: 15, alignItems: 'center' },
  uploadBtnText: { fontWeight: 'bold', fontSize: 16 },
  
  detailContainer: { flex: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' },
  detailHeaderTitle: { fontSize: 16, fontWeight: 'bold' },
  detailMedia: { width: width, height: width, backgroundColor: '#000' },
  detailInfoSection: { padding: 15 },
  detailUploaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  uploaderInfo: { flexDirection: 'row', alignItems: 'center' },
  uploaderName: { fontWeight: 'bold', fontSize: 15, marginRight: 10 },
  timeText: { fontSize: 12 },
  detailDescription: { fontSize: 14, marginBottom: 20 },
  detailCommentsSection: { borderTopWidth: 0.5, paddingTop: 20 },
  commentsTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 15 },
  commentItem: { marginBottom: 15 },
  commentMainRow: { flexDirection: 'row', alignItems: 'center' },
  cName: { fontWeight: '600', fontSize: 13, marginRight: 8 },
  cText: { fontSize: 13, flex: 1 },
  replyBtnText: { color: '#666', fontSize: 11, marginLeft: 8 },
  replyRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 20, marginTop: 6 },
  detailCommentInputContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 15, backgroundColor: 'transparent' },
  detailCommentInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 25, borderWidth: 1 },
  detailCommentInput: { flex: 1, fontSize: 14, marginRight: 10 },
});
