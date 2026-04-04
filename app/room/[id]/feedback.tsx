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
import { Colors } from '../../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FeedbackScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { videos, addVideo, addComment, getUserById, currentUser, theme, markItemAsAccessed, refreshAllData } = useAppContext();
...
  const handleSelectVideo = (video: VideoFeedback) => {
    if (video.videoUrl.startsWith('formation://')) {
      const formationId = video.videoUrl.replace('formation://', '');
      router.push(`/room/${id}/formation/${formationId}`);
      return;
    }
    setSelectedVideo(video);
  };
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
        Alert.alert('오류', '영상 제목을 입력해주세요.');
        return;
      }
      
      setIsLoading(true);
      try {
        const videoUri = result.assets[0].uri;
        const ext = videoUri.split('.').pop() || 'mp4';
        const fileName = `${Date.now()}.${ext}`;
        const publicUrl = await storageService.uploadToR2(`videos/${id}`, videoUri, fileName);
        
        await addVideo(id || '', publicUrl, videoTitle);
        
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
            <View style={[styles.videoSection, isFullScreen && styles.landscapeVideo]}>
              {isCaching ? <ActivityIndicator size="large" color={Colors.primary} /> : <VideoView style={styles.vPlayer} player={player} allowsFullscreen={false} />}
              <View style={styles.vControls}>
                <TouchableOpacity onPress={() => { if(isFullScreen) setIsFullScreen(false); else setSelectedVideo(null); }}>
                  <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={{flex: 1}} />
                {isFullScreen && (
                  <TouchableOpacity style={{marginRight: 20}} onPress={() => setShowSidebar(!showSidebar)}>
                    <Ionicons name="chatbubbles" size={24} color={showSidebar ? Colors.primary : "#fff"} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setIsFullScreen(!isFullScreen)}>
                  <Ionicons name={isFullScreen ? "contract" : "expand"} size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {(!isFullScreen || showSidebar) && (
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
    <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom + 80 }]}>
      <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.primary }]} onPress={() => setShowAddModal(true)}>
        <Ionicons name="videocam" size={20} color={theme.background} />
        <Text style={[styles.uploadButtonText, { color: theme.background }]}>연습 영상 올리기</Text>
      </TouchableOpacity>
      <FlatList
        data={roomVideos}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.videoCard, { backgroundColor: theme.card }]} onPress={() => handleSelectVideo(item)}>
            <Ionicons 
              name={item.videoUrl.startsWith('formation://') ? "layers" : "play-circle"} 
              size={24} 
              color={theme.primary} 
            />
            <View style={{marginLeft: 15, flex: 1}}>
              <Text style={{color: theme.text, fontWeight: 'bold'}}>{item.title}</Text>
              <Text style={{color: theme.textSecondary, fontSize: 11}}>{getUserById(item.userId)?.name} • {new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
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
  fullView: { flex: 1, backgroundColor: '#000' },
  mainLayout: { flex: 1 },
  landscapeLayout: { flexDirection: 'row' },
  videoSection: { width: '100%', aspectRatio: 16/9, backgroundColor: '#000', justifyContent: 'center' },
  landscapeVideo: { flex: 1, aspectRatio: undefined },
  vPlayer: { flex: 1 },
  vControls: { position: 'absolute', top: 0, left: 0, right: 0, padding: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100 },
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
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  titleInput: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20, color: '#fff' },
  pickBtn: { padding: 15, borderRadius: 12, alignItems: 'center' }
});
