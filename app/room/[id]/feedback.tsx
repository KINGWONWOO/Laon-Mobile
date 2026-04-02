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
import { Colors } from '../../../constants/theme'; // 💡 Colors 임포트 추가

export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { videos, addVideo, addComment, getUserById, currentUser, theme, markItemAsAccessed } = useAppContext();
  
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedback | null>(null);
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string | null>(null); 
  const [isCaching, setIsCaching] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [replyToId, setReplyToId] = useState<string | undefined>(undefined);
  const [showCommentInput, setShowCommentInput] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  
  const roomVideos = useMemo(() => videos.filter(v => v.roomId === id), [videos, id]);

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

  const player = useVideoPlayer(cachedVideoUrl || '', player => {
    player.loop = true;
    player.play();
  });

  const handlePickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: true, quality: 1 });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (!videoTitle.trim()) { Alert.alert('오류', '영상 제목을 입력해주세요.'); return; }
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
          {isCaching ? <ActivityIndicator size="large" color={theme.primary} /> : <VideoView style={styles.videoPlayer} player={player} allowsFullscreen />}
        </View>

        <View style={styles.feedbackActionRow}>
          <Text style={{color: theme.text}}>현재 시점: {formatTime(Math.floor((player?.currentTime || 0)*1000))}</Text>
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
                    {cUser?.profileImage ? (
                      <Image source={{uri: cUser.profileImage}} style={styles.cAvatar}/>
                    ) : (
                      <View style={[styles.cAvatar, {backgroundColor: theme.primary}]}><Text style={{fontSize: 10}}>{cUser?.name?.[0]}</Text></View>
                    )}
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
                        <View style={styles.cUserRow}>
                          <Text style={[styles.cName, {color: theme.text}]}>{rUser?.name}</Text>
                        </View>
                        <Text style={[styles.cText, {color: theme.textSecondary}]}>{r.text}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={{textAlign:'center', color: '#444', marginTop: 40}}>첫 번째 피드백을 남겨보세요!</Text>}
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
        ListEmptyComponent={<Text style={{textAlign:'center', color: '#444', marginTop: 100}}>등록된 영상이 없습니다.</Text>}
      />
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={{color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 20}}>연습 영상 업로드</Text>
            <TextInput style={[styles.titleInput, { color: theme.text, borderColor: theme.border }]} placeholder="영상 제목 (예: 4월 1주차 안무)" placeholderTextColor="#666" value={videoTitle} onChangeText={setVideoTitle} />
            {isLoading ? (
              <View style={{alignItems:'center'}}><ActivityIndicator size="large" color={theme.primary} /><Text style={{color: theme.textSecondary, marginTop: 10}}>업로드 중...</Text></View>
            ) : (
              <TouchableOpacity onPress={handlePickVideo} style={[styles.pickBtn, {backgroundColor: theme.primary}]}><Text style={{fontWeight: 'bold', color: '#000'}}>갤러리에서 선택</Text></TouchableOpacity>
            )}
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
