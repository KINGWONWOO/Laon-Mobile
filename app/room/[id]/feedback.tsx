import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image, RefreshControl, Dimensions } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video'; 
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ScreenOrientation from 'expo-screen-orientation'; 
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { VideoFeedback } from '../../../types';
import { storageService } from '../../../services/storageService';
import { Shadows } from '../../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FormationPlayer from '../../../components/ui/FormationPlayer';
import { formatDateFull } from '../../../components/ui/RoomComponents';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

type FilterType = 'all' | 'my' | 'formation';

export default function FeedbackScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { videos, addVideo, updateVideo, deleteVideo, addComment, updateComment, deleteComment, getUserById, currentUser, theme, markItemAsAccessed, refreshAllData, formations } = useAppContext();

  const insets = useSafeAreaInsets();
  
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedback | null>(null);
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string | null>(null); 
  const [isCaching, setIsCaching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');

  // Edit states
  const [editingVideo, setEditingVideo] = useState<VideoFeedback | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editingComment, setEditingComment] = useState<any>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Formation specific state
  const [isFormationPlaying, setIsFormationPlaying] = useState(false);
  const [formationTime, setFormationTime] = useState(0);
  const [formationDuration, setFormationDuration] = useState(60);
  const formationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isFormation = selectedVideo?.videoUrl?.startsWith('formation://');
  const selectedFormation = useMemo(() => {
    if (!isFormation || !selectedVideo) return null;
    const fId = selectedVideo.videoUrl.replace('formation://', '');
    return formations.find(f => f.id === fId);
  }, [selectedVideo, formations]);

  useEffect(() => {
    if (isFormation && isFormationPlaying) {
      formationTimerRef.current = setInterval(() => {
        setFormationTime(prev => {
          if (prev >= formationDuration * 1000) return 0;
          return prev + 50;
        });
      }, 50);
    } else {
      if (formationTimerRef.current) clearInterval(formationTimerRef.current);
    }
    return () => { if (formationTimerRef.current) clearInterval(formationTimerRef.current); };
  }, [isFormation, isFormationPlaying, formationDuration]);
  
  const roomVideos = useMemo(() => {
    let filtered = videos.filter(v => v.roomId === id);
    if (filter === 'my') {
      filtered = filtered.filter(v => v.userId === currentUser?.id);
    } else if (filter === 'formation') {
      filtered = filtered.filter(v => v.videoUrl.startsWith('formation://'));
    }
    return filtered;
  }, [videos, id, filter, currentUser]);

  const sortedComments = useMemo(() => {
    if (!selectedVideo) return [];
    return [...selectedVideo.comments].sort((a, b) => a.timestampMillis - b.timestampMillis);
  }, [selectedVideo]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

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
      if (!selectedVideo || isFormation) { setCachedVideoUrl(null); return; }
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
    if (isFormation) {
      setFormationTime(0);
      setIsFormationPlaying(true);
    }
  }, [selectedVideo]);

  const player = useVideoPlayer(cachedVideoUrl || '', p => {
    p.loop = true;
    if (cachedVideoUrl) p.play();
  });

  const handlePickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: true, quality: 1 });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (!videoTitle.trim()) return Alert.alert('오류', '영상 제목을 입력해주세요.');
      setIsLoading(true);
      try {
        const videoUri = result.assets[0].uri;
        const fileName = `${Date.now()}.mp4`;
        const publicUrl = await storageService.uploadToR2(`videos/${id}`, videoUri, fileName);
        await addVideo(id || '', publicUrl, videoTitle);
        setShowAddModal(false);
        setVideoTitle('');
      } catch (error: any) {
        Alert.alert('업로드 실패', error.message);
      } finally { setIsLoading(false); }
    }
  };

  const handleAddComment = async () => {
    if (!selectedVideo || !newComment.trim()) return;
    const posMillis = isFormation ? formationTime : Math.floor((player?.currentTime || 0) * 1000);
    await addComment(selectedVideo.id, newComment.trim(), posMillis);
    setNewComment('');
    setShowCommentInput(false);
    // Local state update for smooth UX
    const refreshed = videos.find(v => v.id === selectedVideo.id);
    if (refreshed) setSelectedVideo(refreshed);
  };

  const handleUpdateVideo = async () => {
    if (!editingVideo || !editTitle.trim()) return;
    await updateVideo(editingVideo.id, editTitle);
    setEditingVideo(null);
    refreshAllData();
  };

  const handleDeleteVideo = (video: VideoFeedback) => {
    Alert.alert('영상 삭제', '정말 삭제하시겠습니까?', [
      { text: '취소' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await deleteVideo(video.id);
        if (selectedVideo?.id === video.id) setSelectedVideo(null);
        refreshAllData();
      }}
    ]);
  };

  const handleUpdateComment = async () => {
    if (!editingComment || !editCommentText.trim()) return;
    await updateComment(editingComment.id, editCommentText);
    setEditingComment(null);
    refreshAllData();
  };

  const handleDeleteComment = (cid: string) => {
    Alert.alert('댓글 삭제', '정말 삭제하시겠습니까?', [
      { text: '취소' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await deleteComment(cid);
        refreshAllData();
      }}
    ]);
  };

  const seekTo = (ms: number) => { 
    if (isFormation) setFormationTime(ms);
    else if (player) player.currentTime = ms / 1000; 
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  };

  if (selectedVideo) {
    const videoObj = videos.find(v => v.id === selectedVideo.id) || selectedVideo;
    return (
      <Modal visible={true} animationType="fade" transparent={false}>
        <View style={[styles.fullView, { backgroundColor: '#000', paddingTop: isFullScreen ? 0 : insets.top, paddingBottom: isFullScreen ? 0 : insets.bottom }]}>
          <View style={[styles.mainLayout, isFullScreen && styles.landscapeLayout]}>
            <View style={[styles.videoSection, isFullScreen && styles.landscapeVideo, { backgroundColor: '#000' }]}>
              {isFormation ? (
                selectedFormation ? (
                  <View style={{flex: 1}}>
                    <FormationPlayer formation={selectedFormation} currentTimeMs={formationTime} onDurationDetected={setFormationDuration} />
                    <TouchableOpacity style={styles.formationPlayOverlay} onPress={() => setIsFormationPlaying(!isFormationPlaying)}>
                      <Ionicons name={isFormationPlaying ? "pause" : "play"} size={40} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  </View>
                ) : <View style={styles.errorContainer}><Text style={{color: '#8E8E93'}}>동선 정보를 불러올 수 없습니다.</Text></View>
              ) : (
                isCaching ? <ActivityIndicator size="large" color={theme.primary} /> : <VideoView style={styles.vPlayer} player={player} allowsFullscreen={false} />
              )}
              <View style={styles.vControls}>
                <TouchableOpacity onPress={() => { if(isFullScreen) setIsFullScreen(false); else setSelectedVideo(null); }} style={styles.vControlBtn}>
                  <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={{flex: 1}} />
                {isFullScreen && (
                  <TouchableOpacity style={[styles.vControlBtn, {marginRight: 20}]} onPress={() => setShowSidebar(!showSidebar)}>
                    <Ionicons name="chatbubbles" size={24} color={showSidebar ? theme.primary : "#fff"} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setIsFullScreen(!isFullScreen)} style={styles.vControlBtn}>
                  <Ionicons name={isFullScreen ? "contract" : "expand"} size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {(!isFullScreen || showSidebar) && (
              <View style={[styles.sidebar, isFullScreen && styles.landscapeSidebar, { backgroundColor: '#000', borderLeftColor: '#333' }]}>
                <View style={[styles.sidebarHeader, { borderBottomColor: '#333' }]}>
                  <Text style={[styles.sidebarTitle, { color: '#fff' }]}>피드백 {videoObj.comments.length}</Text>
                  <TouchableOpacity onPress={() => setShowCommentInput(true)} style={[styles.addCommentBtn, {backgroundColor: theme.primary}]}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={videoObj.comments.sort((a,b)=>a.timestampMillis - b.timestampMillis)}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ padding: 15 }}
                  renderItem={({ item }) => {
                    const isMyComment = item.userId === currentUser?.id;
                    const author = getUserById(item.userId);
                    return (
                      <View style={[styles.chatBubbleContainer, isMyComment ? styles.myChatBubble : styles.otherChatBubble]}>
                        {!isMyComment && <ExpoImage source={{uri: author?.profileImage}} style={styles.chatAvatar} />}
                        <View style={{flex: 1}}>
                          {!isMyComment && <Text style={styles.chatUserName}>{author?.name}</Text>}
                          <TouchableOpacity 
                            onPress={() => seekTo(item.timestampMillis)} 
                            style={[styles.chatBubble, { backgroundColor: isMyComment ? theme.primary : '#1C1C1E' }]}
                          >
                            <Text style={[styles.chatTime, { color: isMyComment ? '#E0E0E0' : theme.primary }]}>{formatTime(item.timestampMillis)}</Text>
                            <Text style={[styles.chatText, { color: '#fff' }]}>{item.text}</Text>
                          </TouchableOpacity>
                          {isMyComment && (
                            <View style={styles.chatActions}>
                              <TouchableOpacity onPress={() => { setEditingComment(item); setEditCommentText(item.text); }} style={styles.chatActionBtn}>
                                <Ionicons name="pencil" size={12} color="#8E8E93" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteComment(item.id)} style={styles.chatActionBtn}>
                                <Ionicons name="trash" size={12} color={theme.error} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  }}
                />
              </View>
            )}
          </View>

          <Modal visible={showCommentInput} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? "padding" : undefined} style={[styles.modalContent, { backgroundColor: '#1C1C1E' }]}>
                <Text style={{color: '#fff', marginBottom: 15, fontWeight: '800'}}>{formatTime(isFormation ? formationTime : Math.floor((player?.currentTime || 0)*1000))} 시점에 의견 남기기</Text>
                <TextInput style={[styles.input, { backgroundColor: '#2C2C2E', color: '#fff' }]} value={newComment} onChangeText={setNewComment} placeholder="피드백 입력..." placeholderTextColor="#8E8E93" autoFocus />
                <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
                  <TouchableOpacity onPress={() => setShowCommentInput(false)} style={{marginRight: 20}}><Text style={{color: '#8E8E93', fontWeight: '600'}}>취소</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleAddComment}><Text style={{color: theme.primary, fontWeight:'900'}}>등록</Text></TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>

          <Modal visible={!!editingComment} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: '#1C1C1E' }]}>
                <Text style={{color: '#fff', marginBottom: 15, fontWeight: '800'}}>댓글 수정</Text>
                <TextInput style={[styles.input, { backgroundColor: '#2C2C2E', color: '#fff' }]} value={editCommentText} onChangeText={setEditCommentText} multiline />
                <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
                  <TouchableOpacity onPress={() => setEditingComment(null)} style={{marginRight: 20}}><Text style={{color: '#8E8E93', fontWeight: '600'}}>취소</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleUpdateComment}><Text style={{color: theme.primary, fontWeight:'900'}}>수정</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </Modal>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={28} color={theme.text} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>영상 피드백</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}><Ionicons name="add" size={30} color={theme.primary} /></TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        {(['all', 'my', 'formation'] as FilterType[]).map((f) => (
          <TouchableOpacity 
            key={f} 
            onPress={() => setFilter(f)} 
            style={[styles.filterChip, filter === f && { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.filterText, { color: filter === f ? '#fff' : theme.textSecondary }]}>
              {f === 'all' ? '전체' : f === 'my' ? '내 영상' : '동선'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <FlatList
        data={roomVideos}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        renderItem={({ item }) => {
          const author = getUserById(item.userId);
          const isFm = item.videoUrl.startsWith('formation://');
          return (
            <TouchableOpacity style={[styles.videoCard, { backgroundColor: theme.card }]} onPress={() => setSelectedVideo(item)}>
              <View style={styles.videoThumbnailContainer}>
                {isFm ? (
                  <View style={[styles.formationThumb, { backgroundColor: theme.primary + '20' }]}>
                    <Ionicons name="layers" size={32} color={theme.primary} />
                  </View>
                ) : (
                  <ExpoImage source={{ uri: item.videoUrl }} style={styles.videoThumbnail} contentFit="cover" />
                )}
                <View style={styles.playOverlay}>
                  <Ionicons name="play" size={24} color="#fff" />
                </View>
              </View>
              <View style={styles.videoInfo}>
                <Text style={[styles.videoTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                <View style={styles.authorRow}>
                  <ExpoImage source={{ uri: author?.profileImage }} style={styles.authorSmallAvatar} />
                  <Text style={[styles.authorName, { color: theme.textSecondary }]}>{author?.name} • {formatDateFull(item.createdAt)}</Text>
                </View>
              </View>
              {item.userId === currentUser?.id && (
                <View style={styles.videoCardActions}>
                  <TouchableOpacity onPress={() => { setEditingVideo(item); setEditTitle(item.title); }} style={styles.videoActionBtn}><Ionicons name="pencil" size={18} color={theme.textSecondary} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteVideo(item)} style={styles.videoActionBtn}><Ionicons name="trash" size={18} color={theme.error} /></TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 24, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5}}>영상 업로드</Text>
            <TextInput style={[styles.titleInput, { color: theme.text, backgroundColor: theme.background }]} placeholder="영상 제목" placeholderTextColor={theme.textSecondary} value={videoTitle} onChangeText={setVideoTitle} />
            {isLoading ? <ActivityIndicator size="large" color={theme.primary} /> : <TouchableOpacity onPress={handlePickVideo} style={[styles.pickBtn, {backgroundColor: theme.primary}]}><Text style={{fontWeight: '900', color: '#fff'}}>갤러리에서 선택</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={{marginTop: 20}}><Text style={{color: theme.textSecondary, textAlign: 'center', fontWeight: '600'}}>취소</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editingVideo} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 24, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5}}>제목 수정</Text>
            <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text }]} value={editTitle} onChangeText={setEditTitle} />
            <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
              <TouchableOpacity onPress={() => setEditingVideo(null)} style={{marginRight: 20}}><Text style={{color: theme.textSecondary, fontWeight: '600'}}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateVideo}><Text style={{color: theme.primary, fontWeight:'900'}}>수정</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  filterBar: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  filterText: { fontWeight: '800', fontSize: 13 },
  fullView: { flex: 1 },
  mainLayout: { flex: 1 },
  landscapeLayout: { flexDirection: 'row' },
  videoSection: { width: '100%', aspectRatio: 16/9, justifyContent: 'center' },
  landscapeVideo: { flex: 1, aspectRatio: undefined },
  vPlayer: { flex: 1 },
  vControls: { position: 'absolute', top: 0, left: 0, right: 0, padding: 20, flexDirection: 'row', alignItems: 'center', zIndex: 100 },
  vControlBtn: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 8 },
  sidebar: { flex: 1 },
  landscapeSidebar: { width: 350 },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  sidebarTitle: { fontWeight: '900', fontSize: 18, letterSpacing: -0.5 },
  addCommentBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chatBubbleContainer: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end' },
  myChatBubble: { justifyContent: 'flex-end' },
  otherChatBubble: { justifyContent: 'flex-start' },
  chatAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  chatUserName: { fontSize: 11, fontWeight: '800', color: '#8E8E93', marginBottom: 4, marginLeft: 4 },
  chatBubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, maxWidth: '80%', ...Shadows.soft },
  chatTime: { fontSize: 10, fontWeight: '900', marginBottom: 2 },
  chatText: { fontSize: 14, fontWeight: '500' },
  chatActions: { flexDirection: 'row', marginTop: 4, justifyContent: 'flex-end' },
  chatActionBtn: { marginLeft: 10, padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 30, borderRadius: 32, ...Shadows.card },
  input: { padding: 18, borderRadius: 24, marginBottom: 20, fontWeight: '500' },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, margin: 15, borderRadius: 28, ...Shadows.soft },
  uploadButtonText: { fontWeight: '800', marginLeft: 8, letterSpacing: -0.5 },
  videoCard: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 16, borderRadius: 28, ...Shadows.card },
  videoThumbnailContainer: { width: 80, height: 80, borderRadius: 24, overflow: 'hidden', position: 'relative' },
  videoThumbnail: { width: '100%', height: '100%' },
  formationThumb: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  playOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  videoInfo: { flex: 1, marginLeft: 15 },
  videoTitle: { fontSize: 17, fontWeight: '900', marginBottom: 6, letterSpacing: -0.5 },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  authorSmallAvatar: { width: 18, height: 18, borderRadius: 9, marginRight: 6 },
  authorName: { fontSize: 12, fontWeight: '600' },
  videoCardActions: { flexDirection: 'row' },
  videoActionBtn: { padding: 8 },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 40, borderTopLeftRadius: 40, borderTopRightRadius: 40, ...Shadows.card },
  titleInput: { borderRadius: 24, padding: 18, marginBottom: 20, fontWeight: '500' },
  pickBtn: { padding: 18, borderRadius: 24, alignItems: 'center', ...Shadows.soft },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  formationPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }
});
