import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image, RefreshControl, Animated } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video'; 
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { VideoFeedback, Comment } from '../../../types';
import { storageService } from '../../../services/storageService';
import { Colors } from '../../../constants/theme';

export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { videos, addVideo, addComment, getUserById, currentUser, theme, markItemAsAccessed, refreshAllData } = useAppContext();
  
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedback | null>(null);
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string | null>(null); 
  const [isCaching, setIsCaching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [replyToId, setReplyToId] = useState<string | undefined>(undefined);
  const [showCommentInput, setShowCommentInput] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');

  // 팝업을 위한 상태
  const [activeBubble, setActiveBubble] = useState<Comment | null>(null);
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  
  const roomVideos = useMemo(() => {
    const filtered = videos.filter(v => v.roomId === id);
    console.log(`[Feedback] Room Videos Count: ${filtered.length} (Room ID: ${id})`);
    return filtered;
  }, [videos, id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  useEffect(() => {
    async function cacheAndPlay() {
      if (!selectedVideo) { setCachedVideoUrl(null); return; }
      markItemAsAccessed('video', selectedVideo.id);
      setIsCaching(true);
      try {
        const remoteUrl = selectedVideo.videoUrl;
        const fileName = remoteUrl.split('/').pop()?.split('?')[0] || 'video.mp4';
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          console.log('[Feedback] Playing from cache:', fileUri);
          setCachedVideoUrl(fileUri);
        } else {
          console.log('[Feedback] Downloading to cache...');
          const { uri } = await FileSystem.downloadAsync(remoteUrl, fileUri);
          setCachedVideoUrl(uri);
        }
      } catch (error) {
        console.error('[Feedback] Cache Error:', error);
        setCachedVideoUrl(selectedVideo.videoUrl);
      } finally {
        setIsCaching(false);
      }
    }
    cacheAndPlay();
  }, [selectedVideo]);

  const player = useVideoPlayer(cachedVideoUrl || '', p => {
    p.loop = true;
    p.play();
  });

  // 💡 댓글 팝업 디버깅 로그 및 로직
  useEffect(() => {
    if (!player || !selectedVideo) return;
    
    console.log('[Feedback] Starting Popup Watcher...');
    const interval = setInterval(() => {
      if (!player.playing) return;

      const currentTimeMs = Math.floor(player.currentTime * 1000);
      
      // 현재 시점에 딱 맞는 댓글 찾기
      const hit = selectedVideo.comments.find(c => 
        !c.parentId && Math.abs(c.timestampMillis - currentTimeMs) < 400
      );

      if (hit && activeBubble?.id !== hit.id) {
        console.log(`[Feedback] POPUP HIT! Time: ${currentTimeMs}ms, Text: ${hit.text}`);
        setActiveBubble(hit);
        
        Animated.sequence([
          Animated.timing(bubbleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.delay(3000),
          Animated.timing(bubbleAnim, { toValue: 0, duration: 500, useNativeDriver: true })
        ]).start(() => {
          setActiveBubble(null);
        });
      }
    }, 400);

    return () => clearInterval(interval);
  }, [player, selectedVideo, activeBubble]);

  const handlePickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: true, quality: 1 });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (!videoTitle.trim()) { Alert.alert('오류', '제목을 입력하세요.'); return; }
      setIsLoading(true);
      try {
        const videoUri = result.assets[0].uri;
        const ext = videoUri.split('.').pop() || 'mp4';
        const fileName = `${Date.now()}.${ext}`;
        const publicUrl = await storageService.uploadToR2(`videos/${id}`, videoUri, fileName);
        await addVideo(id || '', publicUrl, videoTitle);
        setShowAddModal(false);
        setVideoTitle('');
      } catch (e: any) { Alert.alert('실패', e.message); } finally { setIsLoading(false); }
    }
  };

  const handleAddComment = async () => {
    if (!selectedVideo || !newComment.trim()) return;
    const posMillis = Math.floor((player?.currentTime || 0) * 1000);
    console.log(`[Feedback] Adding comment at: ${posMillis}ms`);
    await addComment(selectedVideo.id, newComment.trim(), posMillis, replyToId);
    setNewComment('');
    setReplyToId(undefined);
    setShowCommentInput(false);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  };

  const seekTo = (ms: number) => {
    if (player) player.currentTime = ms / 1000;
  };

  if (selectedVideo) {
    const mainComments = selectedVideo.comments.filter(c => !c.parentId);
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.playerHeader}>
          <TouchableOpacity onPress={() => setSelectedVideo(null)}><Ionicons name="arrow-back" size={24} color={theme.primary} /></TouchableOpacity>
          <Text style={[styles.playerTitle, { color: theme.text }]} numberOfLines={1}>{selectedVideo.title}</Text>
        </View>
        
        <View style={styles.videoContainer}>
          {isCaching ? (
            <ActivityIndicator size="large" color={theme.primary} />
          ) : (
            <View style={{ flex: 1 }}>
              <VideoView style={styles.videoPlayer} player={player} allowsFullscreen />
              {/* 💡 팝업 말풍선 UI */}
              {activeBubble && (
                <Animated.View style={[styles.bubbleWrapper, { opacity: bubbleAnim, transform: [{ translateY: bubbleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                  <View style={[styles.bubble, { backgroundColor: theme.primary }]}>
                    <Text style={styles.bubbleUser}>{getUserById(activeBubble.userId)?.name}</Text>
                    <Text style={styles.bubbleText} numberOfLines={2}>{activeBubble.text}</Text>
                  </View>
                </Animated.View>
              )}
            </View>
          )}
        </View>

        <View style={styles.feedbackActionRow}>
          <Text style={{color: theme.text}}>현재: {formatTime(Math.floor((player?.currentTime || 0)*1000))}</Text>
          <TouchableOpacity style={[styles.addCommentBtn, { backgroundColor: theme.primary }]} onPress={() => setShowCommentInput(true)}>
            <Text style={{color: theme.background, fontWeight: 'bold'}}>피드백 남기기</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={mainComments}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const cUser = getUserById(item.userId);
            const rpl = selectedVideo.comments.filter(r => r.parentId === item.id);
            return (
              <View style={styles.commentBlock}>
                <TouchableOpacity onPress={() => seekTo(item.timestampMillis)} style={styles.commentMain}>
                  <View style={styles.cUserRow}>
                    {cUser?.profileImage ? <Image source={{uri: cUser.profileImage}} style={styles.cAvatar}/> : <View style={[styles.cAvatar, {backgroundColor: theme.primary}]}><Text style={{fontSize: 10}}>{cUser?.name?.[0]}</Text></View>}
                    <Text style={[styles.cName, {color: theme.text}]}>{cUser?.name}</Text>
                    <View style={styles.timeBadge}><Text style={styles.cTime}>{formatTime(item.timestampMillis)}</Text></View>
                  </View>
                  <Text style={[styles.cText, {color: theme.textSecondary}]}>{item.text}</Text>
                  <TouchableOpacity onPress={() => { setReplyToId(item.id); setNewComment(`@${cUser?.name} `); setShowCommentInput(true); }}>
                    <Text style={{color: theme.primary, fontSize: 10, marginTop: 5}}>답글 달기</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
                {rpl.map(r => {
                  const rUser = getUserById(r.userId);
                  return (
                    <View key={r.id} style={styles.replyMain}>
                      <Ionicons name="return-down-forward" size={12} color="#444" />
                      <View style={{marginLeft: 5, flex: 1}}>
                        <Text style={[styles.cName, {color: theme.text}]}>{rUser?.name}</Text>
                        <Text style={[styles.cText, {color: theme.textSecondary}]}>{r.text}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          }}
        />

        <Modal visible={showCommentInput} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <TextInput style={[styles.commentInput, { color: theme.text, borderColor: theme.border }]} value={newComment} onChangeText={setNewComment} placeholder="내용 입력..." placeholderTextColor="#666" autoFocus />
              <View style={{flexDirection: 'row', justifyContent: 'flex-end'}}>
                <TouchableOpacity onPress={() => { setShowCommentInput(false); setReplyToId(undefined); }} style={{marginRight: 20}}><Text style={{color: '#666'}}>취소</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleAddComment}><Text style={{color: theme.primary, fontWeight: 'bold'}}>등록</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.primary }]} onPress={() => setShowAddModal(true)}>
        <Ionicons name="videocam" size={20} color={theme.background} />
        <Text style={[styles.uploadButtonText, { color: theme.background }]}>새 연습 영상 올리기</Text>
      </TouchableOpacity>
      <FlatList
        data={roomVideos}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.videoCard, { backgroundColor: theme.card }]} onPress={() => setSelectedVideo(item)}>
            <View style={styles.videoIconBox}><Ionicons name="play" size={20} color={theme.background} /></View>
            <View style={{marginLeft: 15, flex: 1}}>
              <Text style={{color: theme.text, fontWeight: 'bold'}} numberOfLines={1}>{item.title}</Text>
              <Text style={{color: theme.textSecondary, fontSize: 11}}>{getUserById(item.userId)?.name || '댄서'} • {new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#333" />
          </TouchableOpacity>
        )}
      />
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={{color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>영상 업로드</Text>
            <TextInput style={[styles.titleInput, { color: theme.text, borderColor: theme.border }]} placeholder="영상 제목" placeholderTextColor="#666" value={videoTitle} onChangeText={setVideoTitle} />
            {isLoading ? <ActivityIndicator size="large" color={theme.primary} /> : <TouchableOpacity onPress={handlePickVideo} style={[styles.pickBtn, {backgroundColor: theme.primary}]}><Text style={{fontWeight: 'bold', color: '#000'}}>갤러리에서 선택</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={{marginTop: 20}}><Text style={{color: '#666', textAlign: 'center'}}>취소</Text></TouchableOpacity>
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
  videoContainer: { width: '100%', aspectRatio: 16/9, backgroundColor: '#000', justifyContent: 'center' },
  videoPlayer: { width: '100%', height: '100%' },
  bubbleWrapper: { position: 'absolute', bottom: 30, alignSelf: 'center', maxWidth: '85%', zIndex: 999 },
  bubble: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 25, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
  bubbleUser: { fontSize: 10, fontWeight: 'bold', color: 'rgba(0,0,0,0.4)', marginBottom: 2 },
  bubbleText: { fontSize: 14, fontWeight: 'bold', color: '#000' },
  feedbackActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  addCommentBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 15 },
  commentBlock: { padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#111' },
  commentMain: { marginBottom: 5 },
  replyMain: { flexDirection: 'row', alignItems: 'flex-start', marginLeft: 30, marginTop: 10 },
  cUserRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  cAvatar: { width: 24, height: 24, borderRadius: 8, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  cName: { fontSize: 12, fontWeight: 'bold' },
  timeBadge: { backgroundColor: '#222', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 10 },
  cTime: { fontSize: 10, color: Colors.primary, fontWeight: 'bold' },
  cText: { fontSize: 13, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 25 },
  modalContent: { borderRadius: 20, padding: 25 },
  commentInput: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, margin: 15, borderRadius: 12 },
  uploadButtonText: { fontWeight: 'bold', marginLeft: 8 },
  videoCard: { flexDirection: 'row', alignItems: 'center', padding: 15, marginHorizontal: 15, marginBottom: 10, borderRadius: 15 },
  videoIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  titleInput: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20 },
  pickBtn: { padding: 15, borderRadius: 12, alignItems: 'center' }
});
