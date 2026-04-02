import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image, RefreshControl, Dimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video'; 
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { VideoFeedback, Comment } from '../../../types';
import { storageService } from '../../../services/storageService';
import { Colors } from '../../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { videos, addVideo, addComment, getUserById, currentUser, theme, markItemAsAccessed, refreshAllData } = useAppContext();
  
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedback | null>(null);
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string | null>(null); 
  const [isCaching, setIsCaching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');

  // 💡 가로모드 및 댓글창 제어
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // 💡 댓글 시간순 정렬 (오름차순)
  const sortedComments = useMemo(() => {
    if (!selectedVideo) return [];
    return [...selectedVideo.comments].sort((a, b) => a.timestampMillis - b.timestampMillis);
  }, [selectedVideo]);

  const roomVideos = useMemo(() => videos.filter(v => v.roomId === id), [videos, id]);

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
    await addComment(selectedVideo.id, newComment.trim(), posMillis);
    setNewComment('');
    setShowCommentInput(false);
    // 💡 작성 후 즉시 리프레시하여 리스트에 반영
    setTimeout(() => refreshAllData(), 500);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  };

  const seekTo = (ms: number) => {
    if (player) player.currentTime = ms / 1000;
  };

  // 💡 전체화면 토글 함수
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  if (selectedVideo) {
    return (
      <Modal visible={true} animationType="fade" transparent={false}>
        <View style={[styles.fullContainer, { backgroundColor: '#000' }]}>
          {/* 가로모드/전체화면 레이아웃 */}
          <View style={[styles.mainLayout, isFullScreen && styles.landscapeLayout]}>
            
            {/* 비디오 영역 */}
            <View style={[styles.videoWrapper, isFullScreen && styles.landscapeVideo]}>
              {isCaching ? (
                <ActivityIndicator size="large" color={Colors.primary} />
              ) : (
                <VideoView 
                  style={styles.videoPlayer} 
                  player={player} 
                  allowsFullscreen={false} // 커스텀 UI 사용
                />
              )}
              
              {/* 비디오 위 오버레이 (헤더/컨트롤) */}
              <View style={styles.videoOverlay}>
                <TouchableOpacity style={styles.videoBackBtn} onPress={() => { if(isFullScreen) setIsFullScreen(false); else setSelectedVideo(null); }}>
                  <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.fullScreenToggle} onPress={toggleFullScreen}>
                  <Ionicons name={isFullScreen ? "contract" : "expand"} size={24} color="#fff" />
                </TouchableOpacity>
                {isFullScreen && (
                  <TouchableOpacity style={styles.sidebarToggle} onPress={() => setShowSidebar(!showSidebar)}>
                    <Ionicons name="chatbubbles" size={24} color={showSidebar ? Colors.primary : "#fff"} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 댓글/피드백 영역 (사이드바 또는 하단) */}
            {(!isFullScreen || showSidebar) && (
              <View style={[styles.sidebar, isFullScreen && styles.landscapeSidebar]}>
                <View style={styles.sidebarHeader}>
                  <Text style={styles.sidebarTitle}>피드백 {sortedComments.length}</Text>
                  <TouchableOpacity onPress={() => setShowCommentInput(true)} style={styles.addBtnSmall}>
                    <Ionicons name="add-circle" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={sortedComments}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => {
                    const cUser = getUserById(item.userId);
                    return (
                      <TouchableOpacity onPress={() => seekTo(item.timestampMillis)} style={styles.cItem}>
                        <View style={styles.cRow}>
                          <Text style={styles.cTimeText}>{formatTime(item.timestampMillis)}</Text>
                          <Text style={styles.cUserName}>{cUser?.name}</Text>
                        </View>
                        <Text style={styles.cTextContent}>{item.text}</Text>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={<Text style={styles.emptyC}>첫 피드백을 남겨주세요!</Text>}
                />
              </View>
            )}
          </View>

          {/* 댓글 입력 모달 */}
          <Modal visible={showCommentInput} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                <Text style={styles.modalTitle}>{formatTime(Math.floor((player?.currentTime || 0)*1000))} 시점에 메모</Text>
                <TextInput 
                  style={styles.commentInput} 
                  value={newComment} 
                  onChangeText={setNewComment} 
                  placeholder="피드백 내용을 입력하세요..." 
                  placeholderTextColor="#666"
                  autoFocus
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity onPress={() => setShowCommentInput(false)} style={styles.modalBtn}><Text style={{color: '#666'}}>취소</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleAddComment} style={[styles.modalBtn, styles.modalBtnActive]}><Text style={{fontWeight: 'bold'}}>등록</Text></TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>
        </View>
      </Modal>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.primary }]} onPress={() => setShowAddModal(true)}>
        <Ionicons name="videocam" size={20} color={theme.background} />
        <Text style={[styles.uploadButtonText, { color: theme.background }]}>연습 영상 업로드</Text>
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
  fullContainer: { flex: 1 },
  mainLayout: { flex: 1, flexDirection: 'column' },
  landscapeLayout: { flexDirection: 'row' },
  videoWrapper: { width: '100%', aspectRatio: 16/9, backgroundColor: '#000', justifyContent: 'center' },
  landscapeVideo: { width: '70%', height: '100%', aspectRatio: undefined },
  videoPlayer: { flex: 1 },
  videoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, zIndex: 10 },
  videoBackBtn: { padding: 10 },
  fullScreenToggle: { position: 'absolute', bottom: -180, right: 20, padding: 10 }, // 위치 조정 필요
  sidebarToggle: { position: 'absolute', bottom: -180, left: 20, padding: 10 },
  sidebar: { flex: 1, backgroundColor: '#0A0A0A' },
  landscapeSidebar: { width: '30%', borderLeftWidth: 1, borderLeftColor: '#222' },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#111' },
  sidebarTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  addBtnSmall: { padding: 5 },
  cItem: { padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#111' },
  cRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cTimeText: { color: Colors.primary, fontWeight: 'bold', fontSize: 12, marginRight: 10 },
  cUserName: { color: '#666', fontSize: 11 },
  cTextContent: { color: '#ccc', fontSize: 13 },
  emptyC: { color: '#444', textAlign: 'center', marginTop: 50 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1A2E', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalTitle: { color: '#fff', fontSize: 16, marginBottom: 15 },
  commentInput: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 20 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalBtn: { padding: 10, marginLeft: 15 },
  modalBtnActive: { color: Colors.primary },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, margin: 15, borderRadius: 12 },
  uploadButtonText: { fontWeight: 'bold', marginLeft: 8 },
  videoCard: { flexDirection: 'row', alignItems: 'center', padding: 15, marginHorizontal: 15, marginBottom: 10, borderRadius: 15 },
  videoIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  titleInput: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20 },
  pickBtn: { padding: 15, borderRadius: 12, alignItems: 'center' }
});
