import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video'; 
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { VideoFeedback, Comment } from '../../../types';
import { storageService } from '../../../services/storageService';

export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { videos, addVideo, addComment, getUserById, theme, markItemAsAccessed } = useAppContext();
  
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedback | null>(null);
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string | null>(null); 
  const [isCaching, setIsCaching] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  
  const roomVideos = useMemo(() => videos.filter(v => v.roomId === id), [videos, id]);

  useEffect(() => {
    async function cacheAndPlay() {
      if (!selectedVideo) {
        setCachedVideoUrl(null);
        return;
      }
      markItemAsAccessed('video', selectedVideo.id);
      setIsCaching(true);
      try {
        const remoteUrl = selectedVideo.videoUrl;
        const fileName = remoteUrl.split('/').pop()?.split('?')[0] || 'video.mp4';
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          setCachedVideoUrl(fileUri);
        } else {
          const { uri } = await FileSystem.downloadAsync(remoteUrl, fileUri);
          setCachedVideoUrl(uri);
        }
      } catch (error) {
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
        const videoUri = result.assets[0].uri;
        const ext = videoUri.split('.').pop() || 'mp4';
        const fileName = `${Date.now()}.${ext}`;
        const publicUrl = await storageService.uploadToR2(`videos/${id}`, videoUri, fileName);
        
        await addVideo(id || '', publicUrl, videoTitle, 'direct_upload');
        
        setShowAddModal(false);
        setVideoTitle('');
        Alert.alert('업로드 완료', '연습 영상이 업로드되었습니다.');
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
            <View style={styles.cachingOverlay}><ActivityIndicator size="large" color={theme.primary} /></View>
          ) : (
            <VideoView style={styles.videoPlayer} player={player} allowsFullscreen allowsPictureInPicture />
          )}
        </View>
        <View style={styles.feedbackActionRow}>
          <Text style={[styles.currentTimeText, { color: theme.text }]}>현재 시간: {formatTime(Math.floor((player?.currentTime || 0) * 1000))}</Text>
          <TouchableOpacity style={[styles.addCommentBtn, { backgroundColor: theme.primary }]} onPress={() => setShowCommentInput(true)}>
            <Text style={[styles.addCommentBtnText, { color: theme.background }]}>피드백 남기기</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={selectedVideo.comments}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[styles.commentItem, { borderBottomColor: theme.border }]}>
              <Text style={[styles.timestampText, { color: theme.primary }]}>{formatTime(item.timestampMillis)}</Text>
              <Text style={[styles.commentText, { color: theme.text }]}>{item.text}</Text>
            </View>
          )}
        />
        <Modal visible={showCommentInput} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <TextInput style={[styles.commentInput, { color: theme.text, borderColor: theme.border }]} value={newComment} onChangeText={setNewComment} placeholder="피드백 내용" />
              <TouchableOpacity onPress={handleAddComment}><Text style={{ color: theme.primary }}>등록</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowCommentInput(false)}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.primary }]} onPress={() => setShowAddModal(true)}>
        <Text style={[styles.uploadButtonText, { color: theme.background }]}>영상 업로드</Text>
      </TouchableOpacity>
      <FlatList
        data={roomVideos}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.videoCard, { backgroundColor: theme.card }]} onPress={() => setSelectedVideo(item)}>
            <Text style={{ color: theme.text }}>{item.title}</Text>
          </TouchableOpacity>
        )}
      />
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <TextInput style={[styles.titleInput, { color: theme.text, borderColor: theme.border }]} placeholder="제목" value={videoTitle} onChangeText={setVideoTitle} />
            {isLoading ? <ActivityIndicator size="large" color={theme.primary} /> : <TouchableOpacity onPress={handlePickVideo} style={{ padding: 20, backgroundColor: theme.primary }}><Text>영상 선택</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => setShowAddModal(false)}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity>
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
  addCommentBtn: { padding: 10, borderRadius: 20 },
  addCommentBtnText: { fontWeight: 'bold' },
  commentItem: { padding: 15, borderBottomWidth: 1, flexDirection: 'row' },
  timestampText: { fontWeight: 'bold', marginRight: 10 },
  commentText: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 25 },
  modalContent: { borderRadius: 24, padding: 25 },
  commentInput: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20 },
  uploadButton: { padding: 15, margin: 15, borderRadius: 12, alignItems: 'center' },
  uploadButtonText: { fontWeight: 'bold' },
  videoCard: { padding: 20, marginHorizontal: 15, marginBottom: 10, borderRadius: 12 },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 25, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  titleInput: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 15 },
});
