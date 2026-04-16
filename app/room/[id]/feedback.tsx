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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FormationPlayer from '../../../components/ui/FormationPlayer';
import { formatDateFull, OptionModal } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';

export default function FeedbackScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { videos, addVideo, updateVideo, deleteVideo, addComment, updateComment, deleteComment, getUserById, currentUser, theme, markItemAsAccessed, refreshAllData, formations } = useAppContext();

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

  // Edit states
  const [editingVideo, setEditingVideo] = useState<VideoFeedback | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editingComment, setEditingComment] = useState<any>(null);
  const [editCommentText, setEditCommentText] = useState('');

  // Option Modal states
  const [showVideoOptions, setShowVideoOptions] = useState(false);
  const [selectedVideoForOptions, setSelectedVideoForOptions] = useState<VideoFeedback | null>(null);
  const [showCommentOptions, setShowCommentOptions] = useState(false);
  const [selectedCommentForOptions, setSelectedCommentForOptions] = useState<any>(null);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [enableFloatingComments, setEnableFloatingComments] = useState(true);
  
  const [filterType, setFilterType] = useState<'all' | 'choreography' | 'formation'>('all');

  const [isFormationPlaying, setIsFormationPlaying] = useState(false);
  const [formationTime, setFormationTime] = useState(0);
  const [formationDuration, setFormationDuration] = useState(60);
  const formationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [videoTime, setVideoTime] = useState(0);

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

  const player = useVideoPlayer(cachedVideoUrl || '', p => {
    p.loop = true;
    if (cachedVideoUrl) p.play();
  });

  // Track regular video time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedVideo && !isFormation && player) {
      interval = setInterval(() => {
        setVideoTime(Math.floor(player.currentTime * 1000));
      }, 100);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [selectedVideo, isFormation, player]);
  
  const currentPlaybackTime = isFormation ? formationTime : videoTime;

  const activeFloatingBubbles = useMemo(() => {
    if (!selectedVideo || !isFullScreen || showSidebar || !enableFloatingComments) return [];
    return selectedVideo.comments.filter(c => {
      const triggerTime = c.timestampMillis - 1000;
      return currentPlaybackTime >= triggerTime && currentPlaybackTime < triggerTime + 2000;
    });
  }, [selectedVideo, isFullScreen, showSidebar, enableFloatingComments, currentPlaybackTime]);

  const roomVideos = useMemo(() => videos.filter(v => v.roomId === id), [videos, id]);

  const filteredVideos = useMemo(() => {
    switch (filterType) {
      case 'choreography':
        return roomVideos.filter(v => !v.title.includes('[동선]') && !v.videoUrl.startsWith('formation://'));
      case 'formation':
        return roomVideos.filter(v => v.title.includes('[동선]') || v.videoUrl.startsWith('formation://'));
      default:
        return roomVideos;
    }
  }, [roomVideos, filterType]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  useEffect(() => {
    async function changeOrientation() {
      if (isFullScreen) await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      else await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
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
    if (isFormation) { setFormationTime(0); setIsFormationPlaying(true); }
  }, [selectedVideo]);

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
      } catch (error: any) { Alert.alert('업로드 실패', error.message); } finally { setIsLoading(false); }
    }
  };

  const handleAddComment = async () => {
    if (!selectedVideo || !newComment.trim()) return;
    const posMillis = isFormation ? formationTime : Math.floor((player?.currentTime || 0) * 1000);
    await addComment(selectedVideo.id, newComment.trim(), posMillis);
    setNewComment('');
    setShowCommentInput(false);
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

  const videoOptions = [
    { label: '제목 수정', icon: 'create-outline', onPress: () => {
      if (!selectedVideoForOptions) return;
      setEditingVideo(selectedVideoForOptions);
      setEditTitle(selectedVideoForOptions.title);
    }},
    { label: '삭제', icon: 'trash-outline', destructive: true, onPress: () => handleDeleteVideo(selectedVideoForOptions!) }
  ];

  const commentOptions = [
    { label: '수정', icon: 'create-outline', onPress: () => {
      if (!selectedCommentForOptions) return;
      setEditingComment(selectedCommentForOptions);
      setEditCommentText(selectedCommentForOptions.text);
    }},
    { label: '삭제', icon: 'trash-outline', destructive: true, onPress: () => {
      if (!selectedCommentForOptions) return;
      handleDeleteComment(selectedCommentForOptions.id);
    }}
  ];

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
      <Modal visible={true} animationType="slide" transparent={false} onRequestClose={() => setSelectedVideo(null)}>
        <View style={[styles.fullView, { backgroundColor: theme.background, paddingTop: isFullScreen ? 0 : insets.top, paddingBottom: isFullScreen ? 0 : insets.bottom }]}>
          <View style={[styles.mainLayout, isFullScreen && styles.landscapeLayout]}>
            <View style={[styles.videoSection, isFullScreen ? styles.landscapeVideo : styles.portraitVideo, { backgroundColor: '#000' }]}>
              {isFormation ? (
                selectedFormation ? (
                  <View style={{flex: 1}}>
                    <FormationPlayer formation={selectedFormation} currentTimeMs={formationTime} onDurationDetected={setFormationDuration} />
                    <TouchableOpacity style={styles.formationPlayOverlay} onPress={() => setIsFormationPlaying(!isFormationPlaying)}>
                      <Ionicons name={isFormationPlaying ? "pause" : "play"} size={40} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  </View>
                ) : <View style={styles.errorContainer}><Text style={{color: theme.textSecondary}}>동선 정보를 불러올 수 없습니다.</Text></View>
              ) : (
                isCaching ? <ActivityIndicator size="large" color={theme.primary} /> : <VideoView style={styles.vPlayer} player={player} allowsFullscreen={false} contentFit="contain" />
              )}
              <View style={styles.vControls}>
                <TouchableOpacity onPress={() => { if(isFullScreen) setIsFullScreen(false); else setSelectedVideo(null); }}>
                  <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={{flex: 1}} />
                {isFullScreen && (
                  <>
                    <TouchableOpacity style={{marginRight: 20}} onPress={() => setEnableFloatingComments(!enableFloatingComments)}>
                      <Ionicons name={enableFloatingComments ? "chatbox-ellipses" : "chatbox-outline"} size={24} color={enableFloatingComments ? theme.primary : "#fff"} />
                    </TouchableOpacity>
                    <TouchableOpacity style={{marginRight: 20}} onPress={() => setShowSidebar(!showSidebar)}>
                      <Ionicons name="chatbubbles" size={24} color={showSidebar ? theme.primary : "#fff"} />
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity onPress={() => setIsFullScreen(!isFullScreen)}>
                  <Ionicons name={isFullScreen ? "contract" : "expand"} size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Floating Comment Bubbles */}
              {activeFloatingBubbles.length > 0 && (
                <View style={styles.floatingContainer} pointerEvents="none">
                  {activeFloatingBubbles.map((c, idx) => (
                    <View key={c.id} style={[styles.bubble, { backgroundColor: theme.card + 'EE', borderColor: theme.primary, borderLeftWidth: 4, marginTop: idx > 0 ? 8 : 0 }, Shadows.medium]}>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 2}}>
                        <Text style={[styles.bubbleUser, { color: theme.primary }]}>{getUserById(c.userId)?.name}</Text>
                        <Text style={[styles.bubbleTime, { color: theme.textSecondary }]}>{formatTime(c.timestampMillis)}</Text>
                      </View>
                      <Text style={[styles.bubbleText, { color: theme.text }]}>{c.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {(!isFullScreen || showSidebar) && (
              <View style={[styles.sidebar, isFullScreen && styles.landscapeSidebar, { backgroundColor: theme.background, borderLeftColor: theme.border }]}>
                <View style={[styles.sidebarHeader, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.sidebarTitle, { color: theme.text }]}>피드백 {videoObj.comments.length}</Text>
                  <TouchableOpacity onPress={() => setShowCommentInput(true)}><Ionicons name="add-circle" size={24} color={theme.primary} /></TouchableOpacity>
                </View>
                <FlatList
                  data={videoObj.comments.sort((a,b)=>a.timestampMillis - b.timestampMillis)}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <View style={[styles.cItem, { borderBottomColor: theme.border }]}>
                      <TouchableOpacity onPress={() => seekTo(item.timestampMillis)} style={{flex: 1}}>
                        <View style={{flexDirection:'row', alignItems:'center', marginBottom: 4}}>
                          <Text style={[styles.cTime, { color: theme.primary }]}>{formatTime(item.timestampMillis)}</Text>
                          <Text style={[styles.cUser, { color: theme.textSecondary }]}>{getUserById(item.userId)?.name}</Text>
                        </View>
                        <Text style={[styles.cText, { color: theme.text }]}>{item.text}</Text>
                      </TouchableOpacity>
                      {item.userId === currentUser?.id && (
                        <View style={styles.commentActions}>
                          <TouchableOpacity onPress={() => { setSelectedCommentForOptions(item); setShowCommentOptions(true); }}>
                            <Ionicons name="ellipsis-vertical" size={16} color={theme.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                />
              </View>
            )}
          </View>

          <OptionModal visible={showCommentOptions} onClose={() => setShowCommentOptions(false)} options={commentOptions} title="댓글 설정" theme={theme} />

          <Modal visible={showCommentInput} transparent animationType="fade" onRequestClose={() => setShowCommentInput(false)}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? "padding" : undefined} style={[styles.modalContent, { backgroundColor: theme.card }]}>
                <Text style={{color: theme.text, marginBottom: 15, fontWeight: '800'}}>{formatTime(isFormation ? formationTime : Math.floor((player?.currentTime || 0)*1000))} 시점에 의견 남기기</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={newComment} onChangeText={setNewComment} placeholder="피드백 입력..." placeholderTextColor={theme.textSecondary} autoFocus />
                <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
                  <TouchableOpacity onPress={() => setShowCommentInput(false)} style={{marginRight: 20, padding: 10}}><Text style={{color: theme.textSecondary, fontWeight: '700'}}>취소</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleAddComment} style={{padding: 10}}><Text style={{color: theme.primary, fontWeight:'900'}}>등록</Text></TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>

          <Modal visible={!!editingComment} transparent animationType="fade" onRequestClose={() => setEditingComment(null)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                <Text style={{color: theme.text, marginBottom: 15, fontWeight: '900'}}>댓글 수정</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={editCommentText} onChangeText={setEditCommentText} multiline />
                <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
                  <TouchableOpacity onPress={() => setEditingComment(null)} style={{marginRight: 20, padding: 10}}><Text style={{color: theme.textSecondary, fontWeight: '700'}}>취소</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleUpdateComment} style={{padding: 10}}><Text style={{color: theme.primary, fontWeight:'900'}}>수정</Text></TouchableOpacity>
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
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={28} color={theme.text} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>영상 피드백</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}><Ionicons name="add" size={30} color={theme.primary} /></TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        {['all', 'choreography', 'formation'].map((type) => (
          <TouchableOpacity key={type} style={[styles.filterBtn, filterType === type ? {backgroundColor: theme.primary} : {backgroundColor: theme.card}]} onPress={() => setFilterType(type as any)}>
            <Text style={[styles.filterText, {color: filterType === type ? '#fff' : theme.textSecondary}]}>
              {type === 'all' ? '전체' : type === 'choreography' ? '안무' : '동선'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <FlatList
        data={filteredVideos}
        keyExtractor={item => item.id}
        contentContainerStyle={{paddingBottom: 50}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.8} style={[styles.videoCard, { backgroundColor: theme.card }, Shadows.soft]} onPress={() => setSelectedVideo(item)}>
            <View style={[styles.vThumbPlaceholder, {backgroundColor: theme.primary + '10'}]}>
              <Ionicons name={item.videoUrl.startsWith('formation://') ? "layers" : "play"} size={24} color={theme.primary} />
            </View>
            <View style={{marginLeft: 15, flex: 1}}>
              <Text style={{color: theme.text, fontWeight: '800', fontSize: 16, letterSpacing: -0.5}} numberOfLines={1}>{item.title}</Text>
              <Text style={{color: theme.textSecondary, fontSize: 12, fontWeight: '500', opacity: 0.7, marginTop: 4}}>{getUserById(item.userId)?.name} • {formatDateFull(item.createdAt)}</Text>
            </View>
            {item.userId === currentUser?.id && (
              <TouchableOpacity onPress={() => { setSelectedVideoForOptions(item); setShowVideoOptions(true); }} style={{padding: 8}}>
                <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />

      <OptionModal visible={showVideoOptions} onClose={() => setShowVideoOptions(false)} options={videoOptions} title="영상 설정" theme={theme} />

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 24, letterSpacing: -0.5}}>영상 업로드</Text>
            <TextInput style={[styles.titleInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]} placeholder="영상 제목" placeholderTextColor={theme.textSecondary} value={videoTitle} onChangeText={setVideoTitle} />
            {isLoading ? <ActivityIndicator size="large" color={theme.primary} /> : <TouchableOpacity onPress={handlePickVideo} style={[styles.pickBtn, {backgroundColor: theme.primary}, Shadows.glow]}><Text style={{fontWeight: '800', color: '#fff', fontSize: 16}}>갤러리에서 선택</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={{marginTop: 24}}><Text style={{color: theme.textSecondary, textAlign: 'center', fontWeight: '700'}}>취소</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editingVideo} transparent animationType="fade" onRequestClose={() => setEditingVideo(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }, Shadows.medium]}>
            <Text style={{color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 20}}>제목 수정</Text>
            <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={editTitle} onChangeText={setEditTitle} />
            <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
              <TouchableOpacity onPress={() => setEditingVideo(null)} style={{marginRight: 20, padding: 10}}><Text style={{color: theme.textSecondary, fontWeight: '700'}}>취소</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateVideo} style={{padding: 10}}><Text style={{color: theme.primary, fontWeight:'900'}}>수정</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 0.5 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  filterBar: { flexDirection: 'row', padding: 15, paddingHorizontal: 20 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, ...Shadows.soft },
  filterText: { fontSize: 13, fontWeight: '800' },
  videoCard: { flexDirection: 'row', alignItems: 'center', padding: 18, marginHorizontal: 20, marginBottom: 14, borderRadius: 28 },
  vThumbPlaceholder: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  fullView: { flex: 1 },
  mainLayout: { flex: 1 },
  landscapeLayout: { flexDirection: 'row' },
  videoSection: { width: '100%', justifyContent: 'center', overflow: 'hidden' },
  portraitVideo: { aspectRatio: 16/9 },
  landscapeVideo: { flex: 1 },
  vPlayer: { flex: 1 },
  vControls: { position: 'absolute', top: 0, left: 0, right: 0, padding: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100 },
  sidebar: { flex: 1 },
  landscapeSidebar: { width: 300, borderLeftWidth: 1, flex: undefined },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, alignItems: 'center' },
  sidebarTitle: { fontWeight: '900', letterSpacing: -0.5 },
  cItem: { padding: 15, borderBottomWidth: 0.5, flexDirection: 'row', alignItems: 'center' },
  commentActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  cTime: { fontWeight: '900', fontSize: 12, marginRight: 10 },
  cUser: { fontSize: 11, fontWeight: '600', opacity: 0.7 },
  cText: { fontSize: 14, fontWeight: '500', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 28, borderRadius: 32 },
  input: { padding: 16, borderRadius: 18, marginBottom: 20, fontWeight: '600' },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 32, borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  titleInput: { borderRadius: 20, padding: 18, marginBottom: 20, fontSize: 16, fontWeight: '600' },
  pickBtn: { padding: 20, borderRadius: 24, alignItems: 'center' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  formationPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  floatingContainer: { position: 'absolute', right: 20, top: 80, bottom: 20, width: 250, justifyContent: 'center', alignItems: 'flex-end', zIndex: 90 },
  bubble: { padding: 12, borderRadius: 16, width: '100%', maxWidth: 240 },
  bubbleUser: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  bubbleTime: { fontSize: 9, fontWeight: '600', marginLeft: 6 },
  bubbleText: { fontSize: 13, fontWeight: '600' }
});
