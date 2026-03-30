import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ActivityIndicator, useWindowDimensions, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { VideoFeedback, Comment } from '../../../types';

export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { videos, addVideo, addComment, getUserById, theme } = useAppContext();
  const { width } = useWindowDimensions();
  
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedback | null>(null);
  const [newComment, setNewComment] = useState('');
  const [currentPosition, setCurrentPosition] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [activeBubble, setActiveBubble] = useState<Comment | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [tempVideoUri, setTempVideoUri] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  
  const bubbleOpacity = useRef(new Animated.Value(0)).current;

  // Initialize player
  const player = useVideoPlayer(selectedVideo?.videoUrl || '', (p) => {
    p.loop = false;
  });

  const roomVideos = videos.filter(v => v.roomId === id);

  // Time update and bubble logic
  useEffect(() => {
    if (!selectedVideo || !player.playing) return;

    const interval = setInterval(() => {
      const pos = player.currentTime * 1000;
      setCurrentPosition(pos);

      const currentVideoData = videos.find(v => v.id === selectedVideo.id);
      if (currentVideoData) {
        const upcomingComment = currentVideoData.comments.find(c => {
          const diff = c.timestampMillis - pos;
          return diff > 500 && diff < 1500;
        });

        if (upcomingComment && !activeBubble) {
          setActiveBubble(upcomingComment);
          Animated.timing(bubbleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
          setTimeout(() => {
            Animated.timing(bubbleOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
              setActiveBubble(null);
            });
          }, 3000);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [selectedVideo, player.playing, activeBubble, videos]);

  const handleUpload = async () => {
    if (!tempVideoUri) return;
    setShowTitleModal(false);
    setIsUploading(true);
    await addVideo(id, tempVideoUri, videoTitle || `연습 영상 ${new Date().toLocaleDateString()}`);
    setIsUploading(false);
    setTempVideoUri(null);
    setVideoTitle('');
  };

  const handleAddComment = () => {
    if (!selectedVideo || !newComment.trim()) return;
    addComment(selectedVideo.id, newComment.trim(), player.currentTime * 1000);
    setNewComment('');
    setShowCommentInput(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const videoHeight = (width * 9) / 16;

  if (selectedVideo) {
    const currentVideoData = videos.find(v => v.id === selectedVideo.id) || selectedVideo;
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.playerHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedVideo(null)}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.playerTitle, { color: theme.text }]} numberOfLines={1}>{currentVideoData.title}</Text>
        </View>

        <View style={{ height: videoHeight, backgroundColor: '#000', position: 'relative' }}>
          <VideoView
            player={player}
            style={styles.videoPlayer}
            contentFit="contain"
          />
          
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1}
            onPress={() => setShowControls(!showControls)}
          />

          {activeBubble && (
            <Animated.View style={[styles.bubbleContainer, { opacity: bubbleOpacity }]}>
              <View style={[styles.bubble, { backgroundColor: theme.primary }]}>
                <Text style={[styles.bubbleUser, { color: theme.background }]}>{getUserById(activeBubble.userId)?.name}</Text>
                <Text style={[styles.bubbleText, { color: theme.background }]}>{activeBubble.text}</Text>
              </View>
              <View style={[styles.bubbleTail, { borderLeftColor: theme.primary }]} />
            </Animated.View>
          )}

          {showControls && (
            <View style={styles.controlsOverlay} pointerEvents="box-none">
              <TouchableOpacity style={styles.mainPlayBtn} onPress={() => player.playing ? player.pause() : player.play()}>
                <Ionicons name={player.playing ? "pause" : "play"} size={50} color="#fff" />
              </TouchableOpacity>

              <View style={styles.bottomControls}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0}%`, backgroundColor: theme.primary }]} />
                </View>
                
                <View style={styles.controlsRow}>
                  <Text style={styles.timeText}>{formatTime(player.currentTime)} / {formatTime(player.duration)}</Text>
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setShowCommentInput(true)}>
                      <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        <Modal visible={showCommentInput} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{formatTime(player.currentTime)} 시점에 피드백 추가</Text>
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

        <Text style={[styles.commentsTitle, { color: theme.text }]}>피드백 ({currentVideoData.comments.length})</Text>
        <FlatList
          data={currentVideoData.comments}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.commentItem, { borderBottomColor: theme.border }]} onPress={() => player.seekBy(item.timestampMillis / 1000 - player.currentTime)}>
              <View style={[styles.timestampBadge, { backgroundColor: theme.primary + '20' }]}>
                <Text style={[styles.timestampText, { color: theme.primary }]}>{formatTime(item.timestampMillis / 1000)}</Text>
              </View>
              <View style={styles.commentContent}>
                <Text style={[styles.commentUserId, { color: theme.primary }]}>{getUserById(item.userId)?.name}</Text>
                <Text style={[styles.commentText, { color: theme.text }]}>{item.text}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>플레이어의 버튼을 눌러 피드백을 남겨보세요.</Text>}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isUploading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>영상을 업로드 중입니다...</Text>
        </View>
      ) : (
        <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.primary }]} onPress={async () => {
          let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
          if (!result.canceled && result.assets) {
            setTempVideoUri(result.assets[0].uri);
            setVideoTitle(`연습 영상 ${new Date().toLocaleDateString()}`);
            setShowTitleModal(true);
          }
        }}>
          <Ionicons name="cloud-upload-outline" size={24} color={theme.background} />
          <Text style={[styles.uploadButtonText, { color: theme.background }]}>새 영상 업로드</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={roomVideos}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.videoCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setSelectedVideo(item)}>
            <View style={[styles.videoThumbnailPlaceholder, { backgroundColor: theme.background }]}>
              <Ionicons name="play-circle" size={40} color={theme.textSecondary} />
            </View>
            <View style={styles.videoInfo}>
              <Text style={[styles.uploaderName, { color: theme.primary }]}>{getUserById(item.userId)?.name}</Text>
              <Text style={[styles.videoTitle, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.videoMeta, { color: theme.textSecondary }]}>피드백 {item.comments.length}개</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={showTitleModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>영상 제목 설정</Text>
            <TextInput style={[styles.titleInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={videoTitle} onChangeText={setVideoTitle} />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowTitleModal(false)}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpload}><Text style={{ color: theme.primary, fontWeight: 'bold', marginLeft: 20 }}>업로드</Text></TouchableOpacity>
            </View>
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
  videoPlayer: { width: '100%', height: '100%' },
  controlsOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  mainPlayBtn: { padding: 20 },
  bottomControls: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 15 },
  progressBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, marginBottom: 10 },
  progressBarFill: { height: '100%', borderRadius: 2 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeText: { color: '#fff', fontSize: 12 },
  iconBtn: { marginLeft: 20 },
  bubbleContainer: { position: 'absolute', top: 40, right: 20, alignItems: 'flex-end', maxWidth: '70%' },
  bubble: { padding: 12, borderRadius: 15, elevation: 5 },
  bubbleUser: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  bubbleText: { fontSize: 13, fontWeight: '500' },
  bubbleTail: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 10, borderRightWidth: 0, borderBottomWidth: 10, borderTopWidth: 0, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderTopColor: 'transparent', marginTop: -1, marginRight: 15, transform: [{ rotate: '90deg' }] },
  commentsTitle: { fontSize: 16, fontWeight: 'bold', padding: 15 },
  commentItem: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1 },
  timestampBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 10, height: 24, justifyContent: 'center' },
  timestampText: { fontSize: 12, fontWeight: 'bold' },
  commentContent: { flex: 1 },
  commentUserId: { fontSize: 12, marginBottom: 2, fontWeight: 'bold' },
  commentText: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 25 },
  modalContent: { borderRadius: 24, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  commentInput: { width: '100%', borderRadius: 12, padding: 15, height: 100, textAlignVertical: 'top', marginBottom: 20, borderWidth: 1 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%' },
  cancelBtn: { padding: 15 },
  confirmBtn: { paddingVertical: 10, paddingHorizontal: 25, borderRadius: 10 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, margin: 15, borderRadius: 12 },
  uploadButtonText: { fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  videoCard: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 10, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  videoThumbnailPlaceholder: { width: 80, height: 60, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  videoInfo: { flex: 1 },
  videoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  uploaderName: { fontSize: 12, fontWeight: 'bold' },
  videoMeta: { fontSize: 12 },
  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { marginTop: 10 },
  emptyText: { textAlign: 'center', marginTop: 30, paddingHorizontal: 40 },
  titleInput: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20 },
});
