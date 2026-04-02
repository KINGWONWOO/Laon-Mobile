import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image, RefreshControl, Dimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video'; 
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ScreenOrientation from 'expo-screen-orientation'; // 💡 화면 회전 제어
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { VideoFeedback } from '../../../types';
import { storageService } from '../../../services/storageService';
import { Colors } from '../../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { videos, addVideo, addComment, getUserById, currentUser, theme, markItemAsAccessed, refreshAllData } = useAppContext();
  const insets = useSafeAreaInsets();
  
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedback | null>(null);
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string | null>(null); 
  const [isCaching, setIsCaching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');

  // 💡 가로모드 및 사이드바 제어
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  const roomVideos = useMemo(() => videos.filter(v => v.roomId === id), [videos, id]);

  const sortedComments = useMemo(() => {
    if (!selectedVideo) return [];
    return [...selectedVideo.comments].sort((a, b) => a.timestampMillis - b.timestampMillis);
  }, [selectedVideo]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  // 💡 가로모드 전환 로직
  useEffect(() => {
    async function changeOrientation() {
      if (isFullScreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }
    changeOrientation();
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); };
  }, [isFullScreen]);

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
        if (fileInfo.exists) setCachedVideoUrl(fileUri);
        else {
          const { uri } = await FileSystem.downloadAsync(remoteUrl, fileUri);
          setCachedVideoUrl(uri);
        }
      } catch (error) { setCachedVideoUrl(selectedVideo.videoUrl); } finally { setIsCaching(false); }
    }
    cacheAndPlay();
  }, [selectedVideo]);

  const player = useVideoPlayer(cachedVideoUrl || '', p => {
    p.loop = true;
    p.play();
  });

  const handleAddComment = async () => {
    if (!selectedVideo || !newComment.trim()) return;
    const posMillis = Math.floor((player?.currentTime || 0) * 1000);
    await addComment(selectedVideo.id, newComment.trim(), posMillis);
    setNewComment('');
    setShowCommentInput(false);
    setTimeout(() => refreshAllData(), 500);
  };

  const seekTo = (ms: number) => { if (player) player.currentTime = ms / 1000; };
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  };

  if (selectedVideo) {
    return (
      <Modal visible={true} animationType="slide" transparent={false}>
        <View style={[styles.fullView, { paddingTop: isFullScreen ? 0 : insets.top, paddingBottom: isFullScreen ? 0 : insets.bottom }]}>
          
          <View style={[styles.mainLayout, isFullScreen && styles.landscapeLayout]}>
            
            {/* 비디오 영역 */}
            <View style={[styles.videoSection, isFullScreen && styles.landscapeVideo]}>
              {isCaching ? <ActivityIndicator size="large" color={Colors.primary} /> : <VideoView style={styles.vPlayer} player={player} allowsFullscreen={false} />}
              
              {/* 비디오 컨트롤 오버레이 */}
              <View style={styles.vControls}>
                <TouchableOpacity onPress={() => { if(isFullScreen) setIsFullScreen(false); else setSelectedVideo(null); }}>
                  <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={{flex: 1}} />
                <TouchableOpacity style={{marginRight: 20}} onPress={() => setShowSidebar(!showSidebar)}>
                  <Ionicons name="chatbubbles" size={24} color={showSidebar ? Colors.primary : "#fff"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsFullScreen(!isFullScreen)}>
                  <Ionicons name={isFullScreen ? "contract" : "expand"} size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 댓글 사이드바 (가로모드 시 오른쪽, 세로모드 시 하단) */}
            {showSidebar && (
              <View style={[styles.sidebar, isFullScreen && styles.landscapeSidebar]}>
                <View style={styles.sidebarHeader}>
                  <Text style={styles.sidebarTitle}>피드백 {sortedComments.length}</Text>
                  <TouchableOpacity onPress={() => setShowCommentInput(true)}><Ionicons name="add-circle" size={24} color={Colors.primary} /></TouchableOpacity>
                </View>
                <FlatList
                  data={sortedComments}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => seekTo(item.timestampMillis)} style={styles.cItem}>
                      <View style={{flexDirection:'row', alignItems:'center', marginBottom: 4}}>
                        <Text style={styles.cTime}>{formatTime(item.timestampMillis)}</Text>
                        <Text style={styles.cUser}>{getUserById(item.userId)?.name}</Text>
                      </View>
                      <Text style={styles.cText}>{item.text}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </View>

          {/* 댓글 입력창 */}
          <Modal visible={showCommentInput} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior="padding" style={styles.modalContent}>
                <Text style={{color:'#fff', marginBottom: 15}}>{formatTime(Math.floor(player.currentTime*1000))} 시점에 의견 남기기</Text>
                <TextInput style={styles.input} value={newComment} onChangeText={setNewComment} placeholder="피드백 입력..." placeholderTextColor="#666" autoFocus />
                <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
                  <TouchableOpacity onPress={() => setShowCommentInput(false)} style={{marginRight: 20}}><Text style={{color:'#666'}}>취소</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleAddComment}><Text style={{color:Colors.primary, fontWeight:'bold'}}>등록</Text></TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>
        </View>
      </Modal>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom + 60 }]}>
      <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.primary }]} onPress={() => setShowAddModal(true)}>
        <Ionicons name="videocam" size={20} color={theme.background} />
        <Text style={[styles.uploadButtonText, { color: theme.background }]}>연습 영상 올리기</Text>
      </TouchableOpacity>
      <FlatList
        data={roomVideos}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.videoCard, { backgroundColor: theme.card }]} onPress={() => setSelectedVideo(item)}>
            <Ionicons name="play-circle" size={24} color={theme.primary} />
            <View style={{marginLeft: 15, flex: 1}}>
              <Text style={{color: theme.text, fontWeight: 'bold'}}>{item.title}</Text>
              <Text style={{color: theme.textSecondary, fontSize: 11}}>{getUserById(item.userId)?.name} • {new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      {/* 업로드 모달 생략 (동일) */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fullView: { flex: 1, backgroundColor: '#000' },
  mainLayout: { flex: 1 },
  landscapeLayout: { flexDirection: 'row' },
  videoSection: { width: '100%', aspectRatio: 16/9, backgroundColor: '#000', justifyContent: 'center' },
  landscapeVideo: { flex: 1, aspectRatio: undefined },
  vPlayer: { flex: 1 },
  vControls: { position: 'absolute', top: 0, left: 0, right: 0, padding: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  sidebar: { flex: 1, backgroundColor: '#0A0A0A' },
  landscapeSidebar: { width: 300, borderLeftWidth: 1, borderLeftColor: '#222' },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#111' },
  sidebarTitle: { color: '#fff', fontWeight: 'bold' },
  cItem: { padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#111' },
  cTime: { color: Colors.primary, fontWeight: 'bold', fontSize: 12, marginRight: 10 },
  cUser: { color: '#666', fontSize: 11 },
  cText: { color: '#ccc', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 },
  modalContent: { backgroundColor: '#1A1A2E', padding: 25, borderRadius: 20 },
  input: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 20 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, margin: 15, borderRadius: 12 },
  uploadButtonText: { fontWeight: 'bold', marginLeft: 8 },
  videoCard: { flexDirection: 'row', alignItems: 'center', padding: 20, marginHorizontal: 15, marginBottom: 10, borderRadius: 15 },
});
