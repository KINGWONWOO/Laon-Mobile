import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ActivityIndicator, useWindowDimensions, KeyboardAvoidingView, Platform, Animated, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview'; // 유튜브 플레이어용
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { VideoFeedback, Comment } from '../../../types';
import { youtubeService } from '../../../services/youtubeService';

export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { videos, addVideo, addComment, getUserById, theme } = useAppContext();
  const { width } = useWindowDimensions();
  
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedback | null>(null);
  const [newComment, setNewComment] = useState('');
  const [currentPosition, setCurrentPosition] = useState(0);
  const [activeBubble, setActiveBubble] = useState<Comment | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  
  const webViewRef = useRef<any>(null);
  const bubbleOpacity = useRef(new Animated.Value(0)).current;

  const roomVideos = videos.filter(v => v.roomId === id);

  // 유튜브 플레이어로부터 메시지 수신 (재생 시간 등)
  const onMessage = (event: any) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'timeupdate') {
      const pos = data.time * 1000;
      setCurrentPosition(pos);
      checkBubbles(pos);
    }
  };

  const checkBubbles = (pos: number) => {
    if (!selectedVideo) return;
    const upcomingComment = selectedVideo.comments.find(c => {
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
  };

  const handleAddVideo = async () => {
    const videoId = youtubeService.extractVideoId(youtubeUrl);
    if (!videoId) {
      alert('올바른 유튜브 URL을 입력해주세요.');
      return;
    }
    setIsLoading(true);
    await addVideo(id, youtubeUrl, videoTitle || '새 연습 영상', videoId);
    setIsLoading(false);
    setShowAddModal(false);
    setYoutubeUrl('');
    setVideoTitle('');
  };

  const handleAddComment = async () => {
    if (!selectedVideo || !newComment.trim()) return;
    await addComment(selectedVideo.id, newComment.trim(), currentPosition);
    setNewComment('');
    setShowCommentInput(false);
  };

  const seekTo = (seconds: number) => {
    webViewRef.current?.injectJavaScript(`player.seekTo(${seconds}, true); true;`);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const videoHeight = (width * 9) / 16;

  if (selectedVideo) {
    const videoId = youtubeService.extractVideoId(selectedVideo.videoUrl);
    const embedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>body { margin: 0; background: black; }</style>
        </head>
        <body>
          <div id="player"></div>
          <script>
            var tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            var player;
            function onYouTubeIframeAPIReady() {
              player = new YT.Player('player', {
                height: '100%',
                width: '100%',
                videoId: '${videoId}',
                playerVars: { 
                  'autoplay': 1, 
                  'controls': 1, 
                  'playsinline': 1,
                  'origin': 'https://www.youtube.com', // 💡 재생 오류 153 해결을 위한 origin 설정
                  'enablejsapi': 1
                },
                events: {
                  'onReady': onPlayerReady,
                  'onError': onPlayerError
                }
              });
            }

            function onPlayerError(event) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                data: event.data
              }));
            }

            function onPlayerReady(event) {
              setInterval(function() {
                try {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'timeupdate',
                    time: player.getCurrentTime()
                  }));
                } catch(e) {}
              }, 500);
            }
          </script>
        </body>
      </html>
    `;

    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.playerHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedVideo(null)}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.playerTitle, { color: theme.text }]} numberOfLines={1}>{selectedVideo.title}</Text>
        </View>

        <View style={{ height: videoHeight, backgroundColor: '#000' }}>
          <WebView
            ref={webViewRef}
            source={{ html: embedHtml, baseUrl: 'https://www.youtube.com' }} // 💡 origin 도메인 일치화
            onMessage={onMessage}
            style={styles.videoPlayer}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={['*']}
          />
          
          {activeBubble && (
            <Animated.View style={[styles.bubbleContainer, { opacity: bubbleOpacity }]} pointerEvents="none">
              <View style={[styles.bubble, { backgroundColor: theme.primary }]}>
                <Text style={[styles.bubbleUser, { color: theme.background }]}>{getUserById(activeBubble.userId)?.name}</Text>
                <Text style={[styles.bubbleText, { color: theme.background }]}>{activeBubble.text}</Text>
              </View>
            </Animated.View>
          )}
        </View>

        <View style={styles.feedbackActionRow}>
          <Text style={[styles.currentTimeText, { color: theme.text }]}>현재 시간: {formatTime(currentPosition)}</Text>
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
              <Text style={[styles.modalTitle, { color: theme.text }]}>{formatTime(currentPosition)} 시점에 피드백 추가</Text>
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
            <TouchableOpacity style={[styles.commentItem, { borderBottomColor: theme.border }]} onPress={() => seekTo(item.timestampMillis / 1000)}>
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
        <Ionicons name="logo-youtube" size={24} color={theme.background} />
        <Text style={[styles.uploadButtonText, { color: theme.background }]}>유튜브 영상 추가</Text>
      </TouchableOpacity>

      <FlatList
        data={roomVideos}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const vId = youtubeService.extractVideoId(item.videoUrl);
          return (
            <TouchableOpacity style={[styles.videoCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setSelectedVideo(item)}>
              <Image 
                source={{ uri: youtubeService.getThumbnailUrl(vId || '') }} 
                style={styles.thumbnail}
              />
              <View style={styles.videoInfo}>
                <Text style={[styles.uploaderName, { color: theme.primary }]}>{getUserById(item.userId)?.name}</Text>
                <Text style={[styles.videoTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.videoMeta, { color: theme.textSecondary }]}>피드백 {item.comments.length}개</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>등록된 영상이 없습니다.</Text>}
      />

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>새 연습 영상 추가</Text>
            <TextInput 
              style={[styles.titleInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} 
              placeholder="영상 제목 (예: 정기 연습 1차)"
              placeholderTextColor={theme.textSecondary}
              value={videoTitle} 
              onChangeText={setVideoTitle} 
            />
            <TextInput 
              style={[styles.titleInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} 
              placeholder="유튜브 URL 주소"
              placeholderTextColor={theme.textSecondary}
              value={youtubeUrl} 
              onChangeText={setYoutubeUrl} 
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.cancelBtn}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleAddVideo} style={[styles.confirmBtn, { backgroundColor: theme.primary }]} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color={theme.background} /> : <Text style={{ color: theme.background, fontWeight: 'bold' }}>추가하기</Text>}
              </TouchableOpacity>
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
  bubbleContainer: { position: 'absolute', top: 20, alignSelf: 'center', maxWidth: '80%' },
  bubble: { padding: 12, borderRadius: 15, elevation: 5 },
  bubbleUser: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  bubbleText: { fontSize: 13, fontWeight: '500' },
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
  thumbnail: { width: 100, height: 60, borderRadius: 8, marginRight: 15 },
  videoInfo: { flex: 1 },
  videoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  uploaderName: { fontSize: 12, fontWeight: 'bold' },
  videoMeta: { fontSize: 12 },
  emptyText: { textAlign: 'center', marginTop: 30, paddingHorizontal: 40 },
  titleInput: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 15 },
});
