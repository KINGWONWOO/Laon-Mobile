import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video'; 
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system'; // 💡 캐싱을 위한 추가
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { VideoFeedback, Comment } from '../../../types';
import { storageService } from '../../../services/storageService';
import { Video as VideoCompressor } from 'react-native-compressor'; 

export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { videos, addVideo, addComment, getUserById, theme } = useAppContext();
  
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedback | null>(null);
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string | null>(null); // 💡 캐싱된 로컬 URL 저장
  const [isCaching, setIsCaching] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  
  const roomVideos = useMemo(() => videos.filter(v => v.roomId === id), [videos, id]);

  // 💡 비디오 선택 시 캐싱 로직 실행
  useEffect(() => {
    async function cacheAndPlay() {
      if (!selectedVideo) {
        setCachedVideoUrl(null);
        return;
      }

      setIsCaching(true);
      try {
        const remoteUrl = selectedVideo.videoUrl;
        const fileName = remoteUrl.split('/').pop()?.split('?')[0] || 'video.mp4';
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          console.log('[Cache] Playing from local cache:', fileUri);
          setCachedVideoUrl(fileUri);
        } else {
          console.log('[Cache] Downloading to cache...');
          const { uri } = await FileSystem.downloadAsync(remoteUrl, fileUri);
          console.log('[Cache] Download complete:', uri);
          setCachedVideoUrl(uri);
        }
      } catch (error) {
        console.error('[Cache] Error:', error);
        // 에러 시 원본 URL로 폴백
        setCachedVideoUrl(selectedVideo.videoUrl);
      } finally {
        setIsCaching(false);
      }
    }
    cacheAndPlay();
  }, [selectedVideo]);

  const player = useVideoPlayer(cachedVideoUrl || '', player => {
    player.loop = true;
    player.play();
  });

  const handlePickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '비디오 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (!videoTitle.trim()) {
        Alert.alert('오류', '먼저 영상 제목을 입력해주세요.');
        return;
      }
      
      setIsLoading(true);
      try {
        const originalUri = result.assets[0].uri;
        const compressedUri = await VideoCompressor.compress(originalUri, { compressionMethod: 'auto' });
        
        const ext = compressedUri.split('.').pop() || 'mp4';
        const fileName = `${Date.now()}.${ext}`;
        const publicUrl = await storageService.uploadToR2(`videos/${id}`, compressedUri, fileName);
        
        await addVideo(id || '', publicUrl, videoTitle, 'direct_upload');
        
        setShowAddModal(false);
        setVideoTitle('');
        Alert.alert('업로드 완료', '연습 영상이 성공적으로 업로드되었습니다.');
      } catch (error: any) {
        Alert.alert('업로드 실패', error.message || '영상을 올리는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAddComment = async () => {
    if (!selectedVideo || !newComment.trim()) return;
    const posMillis = Math.floor((player?.currentTime || 0) * 1000);
    await addComment(selectedVideo.id, newComment.trim(), posMillis);
    setNewComment('');
    setShowCommentInput(false);
  };

  const seekTo = (millis: number) => {
    if (player) player.currentTime = millis / 1000;
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (selectedVideo) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.playerHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedVideo(null)}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.playerTitle, { color: theme.text }]} numberOfLines={1}>{selectedVideo.title}</Text>
        </View>

        <View style={styles.videoContainer}>
          {isCaching ? (
            <View style={styles.cachingOverlay}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={{ color: theme.text, marginTop: 10 }}>영상을 로딩 중입니다 (데이터 절약)</Text>
            </View>
          ) : (
            <VideoView 
              style={styles.videoPlayer} 
              player={player} 
              allowsFullscreen 
              allowsPictureInPicture 
            />
          )}
        </View>

        <View style={styles.feedbackActionRow}>
          <Text style={[styles.currentTimeText, { color: theme.text }]}>
            현재 시간: {formatTime(Math.floor((player?.currentTime || 0) * 1000))}
          </Text>
          <TouchableOpacity 
            style={[styles.addCommentBtn, { backgroundColor: theme.primary }]} 
            onPress={() => setShowCommentInput(true)}
          >
            <Ionicons name="chatbubble-outline" size={20} color={theme.background} />
            <Text style={[styles.addCommentBtnText, { color: theme.background }]}>피드백 남기기</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showCommentInput} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>피드백 추가</Text>
              <TextInput
                style={[styles.commentInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={newComment}
                onChangeText={setNewComment}
                placeholder="연습 피드백을 입력하세요"
                placeholderTextColor={theme.textSecondary}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCommentInput(false)}>
                  <Text style={{ color: theme.textSecondary }}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={handleAddComment}>
                  <Text style={{ color: theme.background, fontWeight: 'bold' }}>등록</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <FlatList
          data={selectedVideo.comments}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.commentItem, { borderBottomColor: theme.border }]} onPress={() => seekTo(item.timestampMillis)}>
              <View style={[styles.timestampBadge, { backgroundColor: theme.primary + '20' }]}>
                <Text style={[styles.timestampText, { color: theme.primary }]}>{formatTime(item.timestampMillis)}</Text>
              </View>
              <View style={styles.commentContent}>
                <Text style={[styles.commentUserId, { color: theme.primary }]}>{getUserById(item.userId)?.name}</Text>
                <Text style={[styles.commentText, { color: theme.text }]}>{item.text}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListHeaderComponent={<Text style={[styles.commentsTitle, { color: theme.text }]}>피드백 ({selectedVideo.comments.length})</Text>}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>현재 시간에 피드백을 남겨보세요.</Text>}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.primary }]} onPress={() => setShowAddModal(true)}>
        <Ionicons name="cloud-upload" size={24} color={theme.background} />
        <Text style={[styles.uploadButtonText, { color: theme.background }]}>기기에서 영상 업로드</Text>
      </TouchableOpacity>

      <FlatList
        data={roomVideos}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.videoCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setSelectedVideo(item)}>
            <View style={styles.videoPlaceholder}>
              <Ionicons name="play-circle" size={40} color={theme.primary} />
            </View>
            <View style={styles.videoInfo}>
              <Text style={[styles.uploaderName, { color: theme.primary }]}>{getUserById(item.userId)?.name}</Text>
              <Text style={[styles.videoTitle, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.videoMeta, { color: theme.textSecondary }]}>피드백 {item.comments.length}개</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>등록된 영상이 없습니다.</Text>}
      />

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>새 연습 영상 업로드</Text>
            <TextInput 
              style={[styles.titleInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} 
              placeholder="영상 제목 (예: 정기 연습 1차)"
              placeholderTextColor={theme.textSecondary}
              value={videoTitle} 
              onChangeText={setVideoTitle} 
            />
            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{ color: theme.text, marginTop: 10 }}>영상을 압축하고 업로드 중입니다...</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>앱을 종료하지 마세요.</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickVideo} style={[styles.pickVideoBtn, { backgroundColor: theme.primary }]}>
                <Ionicons name="videocam" size={24} color={theme.background} />
                <Text style={{ color: theme.background, fontWeight: 'bold', marginLeft: 10 }}>갤러리에서 영상 선택</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.cancelBtnUpload}>
              <Text style={{ color: theme.textSecondary }}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  playerHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, paddingTop: 50 },
  playerTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 10, flex: 1 },
  backButton: { padding: 5 },
  videoContainer: { width: '100%', aspectRatio: 16/9, backgroundColor: '#000', justifyContent: 'center' },
  cachingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)' },
  videoPlayer: { width: '100%', height: '100%' },
  feedbackActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  currentTimeText: { fontSize: 14, fontWeight: '600' },
  addCommentBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
  addCommentBtnText: { marginLeft: 6, fontWeight: 'bold', fontSize: 14 },
  commentsTitle: { fontSize: 16, fontWeight: 'bold', padding: 15 },
  commentItem: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1 },
  timestampBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 10, height: 24, justifyContent: 'center' },
  timestampText: { fontSize: 12, fontWeight: 'bold' },
  commentContent: { flex: 1 },
  commentUserId: { fontSize: 12, marginBottom: 2, fontWeight: 'bold' },
  commentText: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 25 },
  modalContent: { borderRadius: 24, padding: 25, alignItems: 'center', width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  commentInput: { width: '100%', borderRadius: 12, padding: 15, height: 100, textAlignVertical: 'top', marginBottom: 20, borderWidth: 1 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  cancelBtn: { padding: 15, marginRight: 10 },
  confirmBtn: { paddingVertical: 10, paddingHorizontal: 25, borderRadius: 10 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, margin: 15, borderRadius: 12 },
  uploadButtonText: { fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  videoCard: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 10, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  videoPlaceholder: { width: 100, height: 60, borderRadius: 8, marginRight: 15, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  videoInfo: { flex: 1 },
  videoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  uploaderName: { fontSize: 12, fontWeight: 'bold' },
  videoMeta: { fontSize: 12 },
  emptyText: { textAlign: 'center', marginTop: 30, paddingHorizontal: 40 },
  titleInput: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 15 },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 25, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  pickVideoBtn: { flexDirection: 'row', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  cancelBtnUpload: { padding: 15, alignItems: 'center', marginTop: 10 },
  loadingBox: { alignItems: 'center', marginVertical: 20 },
});
