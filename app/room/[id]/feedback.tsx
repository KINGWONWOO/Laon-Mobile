import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, RefreshControl, ScrollView, Dimensions, useWindowDimensions } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { ensureStandardMP4 } from '../../../utils/convertMP4';
import { Video as CompressorVideo } from 'react-native-compressor';
import { useAppContext } from '../../../context/AppContext';
import { VideoFeedback } from '../../../types';
import { storageService } from '../../../services/storageService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FormationPlayer from '../../../components/ui/FormationPlayer';
import { FormationPiPPlayer } from '../../../components/ui/FormationPiPPlayer';
import { formatDateFull, OptionModal } from '../../../components/ui/RoomComponents';
import { PopoverMenu } from '../../../components/ui/PopoverMenu';
import { Shadows } from '../../../constants/theme';
import { createTranslator } from '../../../constants/translations';
import Animated, { FadeIn, FadeOut, useSharedValue, useAnimatedStyle, runOnJS, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import AdBanner from '../../../components/ui/AdBanner';
import { saveMediaToDevice } from '../../../services/downloadService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FORMATION_PX_PER_SEC = 60;

function MiniFormationView({ scene, dancers, settings }: { scene: any, dancers: any[], settings: any }) {
  if (!scene || !dancers?.length) return null;
  const aspectRatio = (settings?.gridCols || 20) / (settings?.gridRows || 10);
  return (
    <View style={{ flex: 1, padding: 3 }}>
      <View style={{ width: '100%', aspectRatio, position: 'relative', maxHeight: '100%' }}>
        {dancers.map(d => {
          const pos = scene.positions?.[d.id];
          if (!pos) return null;
          return (
            <View
              key={d.id}
              style={{
                position: 'absolute',
                width: 5, height: 5, borderRadius: 2.5,
                backgroundColor: d.color,
                left: `${pos.x * 100}%`, top: `${pos.y * 100}%`,
                marginLeft: -2.5, marginTop: -2.5,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function FeedbackScreen() {
  const { width: winW, height: winH } = useWindowDimensions();
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { videos, addVideo, updateVideo, deleteVideo, addComment, updateComment, deleteComment, getRoomDisplayUser, currentUser, theme, markItemAsAccessed, refreshAllData, formations, checkProAccess, isPro, rooms, blockUser, reportContent, language } = useAppContext();
  const getUser = (userId: string) => getRoomDisplayUser(id as string, userId);

  const t = useMemo(() => createTranslator(language || 'ko'), [language]);

  const insets = useSafeAreaInsets();

  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);

  const [selectedVideo, setSelectedVideo] = useState<VideoFeedback | null>(null);
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string | null>(null);
  const [cachedChoreographyUrl, setCachedChoreographyUrl] = useState<string | null>(null);
  const [isCaching, setIsCaching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'converting' | 'compressing' | 'uploading'>('converting');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');

  const [editingVideo, setEditingVideo] = useState<VideoFeedback | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editingComment, setEditingComment] = useState<any>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const [showVideoOptions, setShowVideoOptions] = useState(false);
  const [selectedVideoForOptions, setSelectedVideoForOptions] = useState<VideoFeedback | null>(null);
  const [videoMenuAnchor, setVideoMenuAnchor] = useState({ x: 0, y: 0 });
  const [showCommentOptions, setShowCommentOptions] = useState(false);
  const [selectedCommentForOptions, setSelectedCommentForOptions] = useState<any>(null);
  const [commentMenuAnchor, setCommentMenuAnchor] = useState({ x: 0, y: 0 });

  const [isDownloading, setIsDownloading] = useState(false);
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  const [isMirrorMode, setIsMirrorMode] = useState(false);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [enableFloatingComments, setEnableFloatingComments] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const speedOptions = Array.from({ length: 8 }, (_, i) => Math.round((0.25 + i * 0.25) * 100) / 100);

  const [filterType, setFilterType] = useState<'all' | 'choreography' | 'formation'>('all');

  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    if (selectedVideo) resetControlsTimer();
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [selectedVideo?.id]);

  const toggleControls = () => {
    if (showControls) setShowControls(false);
    else resetControlsTimer();
  };

  const [isFormationPlaying, setIsFormationPlaying] = useState(false);
  const [isFormationFullScreen, setIsFormationFullScreen] = useState(false);
  const [formationContainerHeight, setFormationContainerHeight] = useState(0);
  const [formationTime, setFormationTime] = useState(0);
  const [formationDuration, setFormationDuration] = useState(60);
  const [formationSeekMs, setFormationSeekMs] = useState<number | null>(null);
  const formationTimeRef = useRef(0);
  const lastOnTimeUpdateRef = useRef(0);
  const [videoTime, setVideoTime] = useState(0);
  const timelineScrollRef = useRef<ScrollView>(null);

  // 서브 영상 위치·크기 (핀치/드래그)
  const SUB_INIT_W = 130;
  const SUB_INIT_H = Math.round(SUB_INIT_W * (9 / 16));
  const subPosX = useSharedValue(SCREEN_WIDTH - SUB_INIT_W - 16);
  const subPosY = useSharedValue(70);
  const currentTimeMsSV = useSharedValue(0); // shared with FormationPiPPlayer for sync
  const savedPosX = useSharedValue(SCREEN_WIDTH - SUB_INIT_W - 16);
  const savedPosY = useSharedValue(70);
  const subW = useSharedValue(SUB_INIT_W);
  const subH = useSharedValue(SUB_INIT_H);
  const savedSubW = useSharedValue(SUB_INIT_W);
  const [subContainerW, setSubContainerW] = useState(SUB_INIT_W);

  const [videoDuration, setVideoDuration] = useState(0);

  // 영상 핀치줌 (issue #9)
  const videoZoom = useSharedValue(1);
  const savedVideoZoom = useSharedValue(1);
  const videoZoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: videoZoom.value }] }));

  const isFormation = selectedVideo?.videoUrl?.startsWith('formation://');
  const selectedFormation = useMemo(() => {
    if (!isFormation || !selectedVideo) return null;
    const fId = selectedVideo.videoUrl.replace('formation://', '');
    return formations.find(f => f.id === fId);
  }, [selectedVideo, formations]);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // formationTime ref로 최신값 유지 (interval 클로저에서 사용)
  const handleFormationTimeUpdate = useCallback((ms: number) => {
    if (ms > 0) lastOnTimeUpdateRef.current = Date.now();
    formationTimeRef.current = ms;
    setFormationTime(ms);
    currentTimeMsSV.value = ms; // keep PiP in sync
  }, [currentTimeMsSV]);

  const player = useVideoPlayer(cachedVideoUrl || '', p => {
    p.loop = true;
    p.preservesPitch = true;
    if (cachedVideoUrl) p.play();
  });

  const subPlayer = useVideoPlayer('', p => {
    p.loop = true;
    p.muted = true;
    p.preservesPitch = true;
  });

  // 안무 영상 드리프트 보정: swapped일 때만 (non-swapped는 FormationPiPPlayer가 처리)
  useEffect(() => {
    if (!isFormation || !isFormationPlaying || !subPlayer || !cachedChoreographyUrl || !isSwapped) return;
    const interval = setInterval(() => {
      const drift = Math.abs(subPlayer.currentTime * 1000 - formationTimeRef.current);
      if (drift > 800) {
        subPlayer.currentTime = formationTimeRef.current / 1000;
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isFormation, isFormationPlaying, subPlayer, cachedChoreographyUrl, isSwapped]);
  // Wall clock fallback: advance formationTime when audio isn't reporting (no audioUrl or remote device)
  useEffect(() => {
    if (!isFormation || !isFormationPlaying) return;
    let lastTick = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const dt = now - lastTick;
      lastTick = now;
      const audioIsActive = (now - lastOnTimeUpdateRef.current) < 200;
      if (!audioIsActive) {
        const next = formationTimeRef.current + dt * playbackRate;
        const clamped = formationDuration > 0 ? Math.min(next, formationDuration * 1000) : next;
        formationTimeRef.current = clamped;
        currentTimeMsSV.value = clamped;
        setFormationTime(clamped);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isFormation, isFormationPlaying, playbackRate, formationDuration]);

  useEffect(() => {
    if (cachedVideoUrl && player) {
      player.replace(cachedVideoUrl);
      player.muted = false;
      player.play();
    }
  }, [cachedVideoUrl, player]);

  useEffect(() => {
    if (cachedChoreographyUrl && subPlayer) {
      subPlayer.replace(cachedChoreographyUrl);
      subPlayer.muted = true;
      subPlayer.currentTime = 0;
    }
  }, [cachedChoreographyUrl]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (selectedVideo && !isFormation && player) {
      interval = setInterval(() => {
        try {
          if (player && typeof player.currentTime === 'number') {
            const ms = Math.floor(player.currentTime * 1000);
            setVideoTime(ms);
            currentTimeMsSV.value = ms;
            setIsVideoPlaying(!!player.playing);
            if (player.duration > 0 && videoDuration === 0) {
              setVideoDuration(player.duration);
            }
          }
        } catch (e) {}
      }, 100);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [selectedVideo?.id, isFormation, player, videoDuration]);

  const currentPlaybackTime = isFormation ? formationTime : videoTime;

  // 동선 타임라인 자동 스크롤: 현재 재생 위치가 항상 중앙에 오도록
  useEffect(() => {
    if (!isFormation || formationDuration <= 0) return;
    const viewW = SCREEN_WIDTH - 32;
    const targetX = Math.max(0, formationTime / 1000 * FORMATION_PX_PER_SEC - viewW / 2);
    timelineScrollRef.current?.scrollTo({ x: targetX, animated: false });
  }, [formationTime, isFormation, formationDuration]);

  const activeFloatingBubbles = useMemo(() => {
    if (!selectedVideo || !isFullScreen || showSidebar || !enableFloatingComments) return [];
    // 등장한 댓글들을 createdAt 오름차순 정렬 후 최대 6개 pool 선정
    const appeared = selectedVideo.comments
      .filter(c => currentPlaybackTime >= c.timestampMillis - 1000)
      .sort((a, b) => a.createdAt - b.createdAt);
    const pool = appeared.slice(-6);
    // pool 내 index(오래된 순=0)에 따라 0.1초 텀으로 순서대로 사라짐
    return pool.filter((c, index) =>
      currentPlaybackTime < c.timestampMillis - 1000 + 3000 + index * 100
    );
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
      if (isFormationFullScreen && selectedVideo && isFormation) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else if (isFullScreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }
    changeOrientation();
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); };
  }, [isFullScreen, isFormationFullScreen, selectedVideo, isFormation]);

  // 영상 모달 닫힐 때 항상 세로모드로 복귀
  useEffect(() => {
    if (!selectedVideo) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setIsFullScreen(false);
      setIsFormationFullScreen(false);
    }
  }, [selectedVideo]);

  const handleCloseModal = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    setIsFullScreen(false);
    setIsFormationFullScreen(false);
    setSelectedVideo(null);
  };

  useEffect(() => {
    async function cacheAndPlay() {
      if (!selectedVideo) {
        setCachedVideoUrl(null);
        setCachedChoreographyUrl(null);
        setIsSwapped(false);
        setIsMirrorMode(false);
        return;
      }

      markItemAsAccessed('video', selectedVideo.id);
      setVideoDuration(0);
      setIsCaching(true);

      try {
        if (!isFormation) {
          const remoteUrl = selectedVideo.videoUrl;
          const fileName = remoteUrl.split('/').pop()?.split('?')[0] || 'video.mp4';
          const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          const isComplete = fileInfo.exists && (fileInfo as any).size > 10240;
          if (isComplete) {
            setCachedVideoUrl(fileUri);
          } else {
            if (fileInfo.exists) await FileSystem.deleteAsync(fileUri, { idempotent: true });
            const { uri } = await FileSystem.downloadAsync(remoteUrl, fileUri);
            setCachedVideoUrl(uri);
          }
        }

        if (selectedVideo.choreographyVideoUrl) {
          const remoteUrl = selectedVideo.choreographyVideoUrl;
          const fileName = `choreo_${remoteUrl.split('/').pop()?.split('?')[0] || 'video.mp4'}`;
          const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          const isComplete = fileInfo.exists && (fileInfo as any).size > 10240;
          if (isComplete) {
            setCachedChoreographyUrl(fileUri);
          } else {
            if (fileInfo.exists) await FileSystem.deleteAsync(fileUri, { idempotent: true });
            const { uri } = await FileSystem.downloadAsync(remoteUrl, fileUri);
            setCachedChoreographyUrl(uri);
          }
        } else {
          setCachedChoreographyUrl(null);
        }
      } catch (error) {
        setCachedVideoUrl(selectedVideo.videoUrl);
        if (selectedVideo.choreographyVideoUrl) setCachedChoreographyUrl(selectedVideo.choreographyVideoUrl);
      } finally {
        setIsCaching(false);
      }
    }
    cacheAndPlay();
    setPlaybackRate(1.0);
    setShowSpeedPicker(false);
    videoZoom.value = 1;
    savedVideoZoom.value = 1;
    if (isFormation) { setFormationTime(0); setIsFormationPlaying(true); }
  }, [selectedVideo?.id]);

  useEffect(() => {
    if (player && !isFormation) {
      try { player.playbackRate = playbackRate; } catch (e) {}
    }
    // Formation videos: playbackRate is passed as prop to FormationPlayer which handles it internally
  }, [playbackRate, isFormation]);

  useEffect(() => {
    if (!selectedVideo) return;
    if (showCommentInput) {
      if (isFormation) setIsFormationPlaying(false);
      else player.pause();
    } else {
      if (isFormation) setIsFormationPlaying(true);
      else player.play();
    }
  }, [showCommentInput, selectedVideo, isFormation, player]);

  const handlePickVideo = async () => {
    const access = checkProAccess('feedback_limit', id as string);
    if (!access.canAccess && roomVideos.length >= (access.limit || 10)) {
      return Alert.alert(
        t('videoUploadLimitTitle'),
        t('videoUploadLimitMsg').replace('{limit}', String(access.limit)),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('viewMembership'), onPress: () => router.push('/subscription') }
        ]
      );
    }

    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['videos'], 
      allowsEditing: true, 
      quality: 1,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720, // 용량 축소를 위해 720p로 제한
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (!videoTitle.trim()) return Alert.alert(t('errorTitle'), '영상 제목을 입력해주세요.');
      
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 200 * 1024 * 1024) {
        Alert.alert(t('errorTitle'), '파일 용량이 너무 큽니다 (200MB 제한).');
        return;
      }

      setIsLoading(true);
      setConversionProgress(0);
      setUploadPhase('converting');
      try {
        const rawUri = result.assets[0].uri;
        // fMP4 변환
        const convertedUri = await ensureStandardMP4(rawUri, (ratio) => {
          setConversionProgress(Math.floor(ratio * 100));
        });

        // 5MB 초과 시 압축
        let videoUri = convertedUri;
        const fileInfo = await FileSystem.getInfoAsync(convertedUri) as any;
        if (fileInfo.size && fileInfo.size > 5 * 1024 * 1024) {
          setUploadPhase('compressing');
          setConversionProgress(0);
          videoUri = await CompressorVideo.compress(
            convertedUri,
            { compressionMethod: 'auto', maxSize: 1280, bitrate: 2_000_000 },
            (progress) => setConversionProgress(Math.floor(progress * 100))
          );
        }

        setUploadPhase('uploading');
        setConversionProgress(100);
        const fileName = `${Date.now()}.mp4`;
        const publicUrl = await storageService.uploadToR2(`videos/${id}`, videoUri, fileName);

        await addVideo(id || '', publicUrl, videoTitle, true, undefined);
        setShowAddModal(false);
        setVideoTitle('');
      } catch (error: any) { Alert.alert('업로드 실패', error.message); } finally { setIsLoading(false); }
    }
  };

  const handleAddComment = async () => {
    if (!selectedVideo || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const posMillis = isFormation ? formationTime : Math.floor((player?.currentTime || 0) * 1000);
      await addComment(selectedVideo.id, newComment.trim(), posMillis);
      setNewComment('');
      setShowCommentInput(false);
      const refreshed = videos.find(v => v.id === selectedVideo.id);
      if (refreshed) setSelectedVideo(refreshed);
    } catch (error) {
      Alert.alert(t('errorTitle'), '댓글 등록에 실패했습니다.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleUpdateVideo = async () => {
    if (!editingVideo || !editTitle.trim() || isUpdatingTitle) return;
    setIsUpdatingTitle(true);
    try {
      await updateVideo(editingVideo.id, editTitle);
      setEditingVideo(null);
      refreshAllData();
    } finally {
      setIsUpdatingTitle(false);
    }
  };

  const handleDeleteVideo = (video: VideoFeedback) => {
    Alert.alert('영상 삭제', t('deleteConfirmMsg'), [
      { text: t('cancel') },
      { text: t('delete'), style: 'destructive', onPress: async () => {
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
    Alert.alert('댓글 삭제', t('deleteConfirmMsg'), [
      { text: t('cancel') },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        await deleteComment(cid);
        refreshAllData();
      }}
    ]);
  };

  const seekTo = (ms: number) => {
    if (isFormation) {
      formationTimeRef.current = ms;
      currentTimeMsSV.value = ms;
      setFormationTime(ms);
      setFormationSeekMs(ms);
      // subPlayer only controls choreography when swapped to main; FormationPiPPlayer handles !isSwapped
      if (isSwapped && subPlayer && cachedChoreographyUrl) subPlayer.currentTime = ms / 1000;
    } else {
      if (player) player.currentTime = ms / 1000;
      if (isSwapped && subPlayer) subPlayer.currentTime = ms / 1000;
    }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  };

  const handleTogglePlay = () => {
    resetControlsTimer();
    if (isFormation) {
      setIsFormationPlaying(!isFormationPlaying);
      // subPlayer (expo-video) only needed when swapped; FormationPiPPlayer handles !isSwapped
      if (isSwapped && subPlayer) {
        if (!isFormationPlaying) subPlayer.play();
        else subPlayer.pause();
      }
    } else {
      if (player.playing) {
        player.pause();
        if (isSwapped && subPlayer) subPlayer.pause();
      } else {
        player.play();
        if (isSwapped && subPlayer) subPlayer.play();
      }
    }
  };

  const handleSwap = () => {
    resetControlsTimer();
    setIsSwapped(!isSwapped);
    if (player && subPlayer) {
      player.muted = !isSwapped;
      subPlayer.muted = isSwapped;
    }
    if (!isSwapped && subPlayer && cachedChoreographyUrl) {
      // Entering swapped mode: subPlayer (choreo) becomes the main view
      const targetTime = isFormation ? formationTimeRef.current / 1000 : player.currentTime;
      subPlayer.currentTime = targetTime;
      const shouldPlay = isFormation ? isFormationPlaying : player.playing;
      if (shouldPlay) subPlayer.play();
    } else if (isSwapped && subPlayer) {
      subPlayer.pause();
    }
  };

  const handleDownload = async () => {
    if (!selectedVideo || isDownloading) return;

    if (isFormation) {
      const choreographyUrl = cachedChoreographyUrl || selectedVideo.choreographyVideoUrl;
      if (!choreographyUrl) {
        Alert.alert(t('error'), '저장할 안무 영상이 없습니다.');
        return;
      }
      setIsDownloading(true);
      try {
        await saveMediaToDevice(choreographyUrl);
        Alert.alert(t('success'), t('saveSuccess'));
      } catch (e: any) {
        if (e.message !== 'PERMISSION_DENIED' && e.message !== 'SHARING_UNAVAILABLE') {
          Alert.alert('저장 실패', '저장 중 오류가 발생했습니다.');
        }
      } finally {
        setIsDownloading(false);
      }
      return;
    }

    setIsDownloading(true);
    try {
      await saveMediaToDevice(selectedVideo.videoUrl);
      Alert.alert(t('success'), t('saveSuccess'));
    } catch (e: any) {
      if (e.message !== 'PERMISSION_DENIED' && e.message !== 'SHARING_UNAVAILABLE') {
        Alert.alert('저장 실패', '저장 중 오류가 발생했습니다.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const [barWidth, setBarWidth] = useState(0);

  const scrubGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      'worklet';
      runOnJS(setIsScrubbing)(true);
      runOnJS(resetControlsTimer)();
      const totalDuration = isFormation ? formationDuration : videoDuration;
      if (totalDuration <= 0 || barWidth <= 0) return;
      const ratio = Math.max(0, Math.min(1, e.x / barWidth));
      runOnJS(seekTo)(ratio * totalDuration * 1000);
    })
    .onUpdate((e) => {
      'worklet';
      const totalDuration = isFormation ? formationDuration : videoDuration;
      if (totalDuration <= 0 || barWidth <= 0) return;
      const ratio = Math.max(0, Math.min(1, e.x / barWidth));
      runOnJS(seekTo)(ratio * totalDuration * 1000);
    })
    .onEnd(() => {
      'worklet';
      runOnJS(setIsScrubbing)(false);
      runOnJS(resetControlsTimer)();
    });

  // 서브 영상 애니메이션·제스처 — 컴포넌트 최상위에 정의해야 Rules of Hooks를 지킴
  const subAnimStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: subPosX.value,
    top: subPosY.value,
    width: subW.value,
    height: subH.value,
    zIndex: 120,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#000',
  }));

  const panGesture = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      savedPosX.value = subPosX.value;
      savedPosY.value = subPosY.value;
    })
    .onUpdate((e) => {
      subPosX.value = Math.max(0, Math.min(SCREEN_WIDTH - subW.value, savedPosX.value + e.translationX));
      subPosY.value = Math.max(0, savedPosY.value + e.translationY);
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => { savedSubW.value = subW.value; })
    .onUpdate((e) => {
      const newW = Math.max(90, Math.min(300, savedSubW.value * e.scale));
      subW.value = newW;
      subH.value = newW * (9 / 16);
      runOnJS(setSubContainerW)(Math.round(newW));
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(300)
    .onEnd(() => { runOnJS(handleSwap)(); });

  const subGesture = Gesture.Simultaneous(
    Gesture.Race(tapGesture, panGesture),
    pinchGesture
  );

  if (selectedVideo && isFormation && selectedFormation) {
    const videoObj = videos.find((v) => v.id === selectedVideo.id) || selectedVideo;
    const hasChoreography = !!cachedChoreographyUrl || !!selectedVideo.choreographyVideoUrl;
    const isLandscape = isFormationFullScreen;
    const progressPct = formationDuration > 0 ? (formationTime / 1000 / formationDuration) * 100 : 0;

    const renderFormationControls = (compact = false) => (
      <>
        {!compact && (
          <View style={styles.formationSpeedRow}>
            <TouchableOpacity
              style={styles.speedArrowBtn}
              onPress={() => setPlaybackRate((r) => Math.max(0.25, Math.round((r - 0.25) * 100) / 100))}
            >
              <Ionicons name="chevron-back" size={18} color={theme.text} />
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
              {speedOptions.map((speed) => (
                <TouchableOpacity
                  key={speed}
                  style={[styles.formationSpeedChip, { backgroundColor: speed === playbackRate ? theme.primary : (compact ? 'rgba(255,255,255,0.12)' : (theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')) }]}
                  onPress={() => setPlaybackRate(speed)}
                >
                  <Text style={[styles.formationSpeedChipText, { color: speed === playbackRate ? '#fff' : (compact ? 'rgba(255,255,255,0.9)' : theme.text) }]}>
                    {speed % 1 === 0 ? speed.toFixed(1) : speed}×
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.speedArrowBtn}
              onPress={() => setPlaybackRate((r) => Math.min(2.0, Math.round((r + 0.25) * 100) / 100))}
            >
              <Ionicons name="chevron-forward" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        )}

        {/* 재생바: 일반모드=대형 편집 타임라인, 전체화면=간단 스크럽바 */}
        {compact ? (
          <View style={[styles.formationProgressRow, { paddingHorizontal: 8 }]}>
            <TouchableOpacity
              onPress={() => setIsFormationPlaying((v) => !v)}
              style={[styles.formationPlayBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name={isFormationPlaying ? 'pause' : 'play'} size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.timeText, { color: 'rgba(255,255,255,0.8)', width: 42 }]}>{formatTime(formationTime)}</Text>
            <GestureDetector gesture={scrubGesture}>
              <View
                style={[styles.progressBarTouchable, { flex: 1 }]}
                onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
              >
                <View style={[styles.progressBarBg, { backgroundColor: 'rgba(255,255,255,0.25)', height: 6, borderRadius: 3 }]}>
                  <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: theme.primary, height: 6, borderRadius: 3 }]} />
                  {/* 대형 간 블렌딩 구간 X 마크 */}
                  {formationDuration > 0 && selectedFormation && [...selectedFormation.data.timeline]
                    .sort((a: any, b: any) => a.timestampMillis - b.timestampMillis)
                    .map((entry: any, i: number, arr: any[]) => {
                      if (i >= arr.length - 1) return null;
                      const gapStart = entry.timestampMillis + entry.durationMillis;
                      const gapEnd = arr[i + 1].timestampMillis;
                      if (gapEnd <= gapStart) return null;
                      const midMs = (gapStart + gapEnd) / 2;
                      const midPct = (midMs / (formationDuration * 1000)) * 100;
                      return (
                        <View key={entry.id} style={{ position: 'absolute', left: `${midPct}%` as any, top: -3, width: 12, height: 12, marginLeft: -6, justifyContent: 'center', alignItems: 'center' }}>
                          <View style={{ position: 'absolute', width: 10, height: 1.5, backgroundColor: 'rgba(255,255,255,0.9)', transform: [{ rotate: '45deg' }] }} />
                          <View style={{ position: 'absolute', width: 10, height: 1.5, backgroundColor: 'rgba(255,255,255,0.9)', transform: [{ rotate: '-45deg' }] }} />
                        </View>
                      );
                    })
                  }
                  <View style={[styles.progressKnob, { left: `${progressPct}%`, backgroundColor: '#FFF', width: 16, height: 16, borderRadius: 8, marginLeft: -8, top: -5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 }]} />
                </View>
              </View>
            </GestureDetector>
            <Text style={[styles.timeText, { color: 'rgba(255,255,255,0.8)', width: 42, textAlign: 'right' }]}>{formatTime(formationDuration * 1000)}</Text>
            <TouchableOpacity onPress={() => setIsFormationFullScreen(false)} style={{ paddingLeft: 8 }}>
              <Ionicons name="contract" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* 대형 편집 타임라인 재생바 */}
            <View style={{ height: 110, marginBottom: 6, position: 'relative' }}>
              <ScrollView
                ref={timelineScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingHorizontal: (SCREEN_WIDTH - 32) / 2 }}
              >
                <View style={{ width: formationDuration * FORMATION_PX_PER_SEC, height: 110, position: 'relative' }}>
                  {/* 파형 트랙 배경 */}
                  <View style={{ position: 'absolute', top: 38, left: 0, right: 0, height: 34, backgroundColor: theme.primary, opacity: 0.07, borderRadius: 4 }} />
                  {/* 대형 블록 */}
                  {[...selectedFormation.data.timeline]
                    .sort((a, b) => a.timestampMillis - b.timestampMillis)
                    .map((entry) => {
                      const scene = selectedFormation.data.scenes.find(s => s.id === entry.sceneId);
                      const blockLeft = entry.timestampMillis / 1000 * FORMATION_PX_PER_SEC;
                      const blockW = Math.max(24, entry.durationMillis / 1000 * FORMATION_PX_PER_SEC);
                      const isActive = formationTime >= entry.timestampMillis && formationTime < entry.timestampMillis + entry.durationMillis;
                      return (
                        <TouchableOpacity
                          key={entry.id}
                          style={{
                            position: 'absolute',
                            left: blockLeft,
                            width: blockW,
                            top: 18,
                            height: 68,
                            backgroundColor: isActive ? theme.primary + '33' : theme.card,
                            borderWidth: 1,
                            borderColor: isActive ? theme.primary : theme.border,
                            borderRadius: 6,
                            overflow: 'hidden',
                          }}
                          onPress={() => seekTo(entry.timestampMillis)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <MiniFormationView
                              scene={scene}
                              dancers={selectedFormation.data.dancers}
                              settings={selectedFormation.settings}
                            />
                          </View>
                          <Text style={{ color: isActive ? theme.primary : theme.textSecondary, fontSize: 8, textAlign: 'center', paddingBottom: 3, fontWeight: '700' }} numberOfLines={1}>
                            {scene?.name || ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  {/* 대형 간 블렌딩 구간 X 마크 */}
                  {[...selectedFormation.data.timeline]
                    .sort((a: any, b: any) => a.timestampMillis - b.timestampMillis)
                    .map((entry: any, i: number, arr: any[]) => {
                      if (i >= arr.length - 1) return null;
                      const gapStart = entry.timestampMillis + entry.durationMillis;
                      const gapEnd = arr[i + 1].timestampMillis;
                      if (gapEnd <= gapStart) return null;
                      const gapLeft = gapStart / 1000 * FORMATION_PX_PER_SEC;
                      const gapWidth = (gapEnd - gapStart) / 1000 * FORMATION_PX_PER_SEC;
                      const midX = gapLeft + gapWidth / 2;
                      const isInGap = formationTime >= gapStart && formationTime < gapEnd;
                      return (
                        <View key={`gap-${entry.id}`} style={{ position: 'absolute', left: gapLeft, width: gapWidth, top: 18, height: 68, justifyContent: 'center', alignItems: 'center' }}>
                          <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: isInGap ? (theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent', borderRadius: 4 }}>
                            {gapWidth > 12 && (
                              <>
                                <View style={{ position: 'absolute', width: Math.min(gapWidth * 0.7, 40), height: 1.5, backgroundColor: isInGap ? theme.primary : theme.textSecondary, opacity: isInGap ? 0.9 : 0.5, transform: [{ rotate: '45deg' }] }} />
                                <View style={{ position: 'absolute', width: Math.min(gapWidth * 0.7, 40), height: 1.5, backgroundColor: isInGap ? theme.primary : theme.textSecondary, opacity: isInGap ? 0.9 : 0.5, transform: [{ rotate: '-45deg' }] }} />
                              </>
                            )}
                          </View>
                        </View>
                      );
                    })
                  }
                  {/* 시간 마커 */}
                  {Array.from({ length: Math.floor(formationDuration / 5) + 1 }).map((_, i) => (
                    <View key={i} style={{ position: 'absolute', left: i * 5 * FORMATION_PX_PER_SEC, top: 0 }}>
                      <View style={{ width: 1, height: 12, backgroundColor: theme.border, opacity: 0.7 }} />
                      <Text style={{ color: theme.textSecondary, fontSize: 9, opacity: 0.6, fontWeight: '500', marginTop: 1 }}>{formatTime(i * 5000)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
              {/* 고정 바늘 */}
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', marginLeft: -1, width: 2, backgroundColor: theme.primary, opacity: 0.9, borderRadius: 1 }} />
              <View pointerEvents="none" style={{ position: 'absolute', top: -2, left: '50%', marginLeft: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary }} />
            </View>
            {/* 재생버튼 + 시간 */}
            <View style={[styles.formationProgressRow, { justifyContent: 'center', gap: 16, paddingHorizontal: 0 }]}>
              <TouchableOpacity
                onPress={() => setIsFormationPlaying((v) => !v)}
                style={[styles.formationPlayBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name={isFormationPlaying ? 'pause' : 'play'} size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={[styles.timeText, { color: theme.textSecondary, width: 'auto' as any, fontSize: 13 }]}>
                {formatTime(formationTime)}{' '}
                <Text style={{ opacity: 0.45 }}>/ {formatTime(formationDuration * 1000)}</Text>
              </Text>
            </View>
          </>
        )}
      </>
    );

    if (isLandscape) {
      return (
        <Modal visible={true} animationType="fade" transparent={false} onRequestClose={() => { setIsFormationFullScreen(false); ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); }}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={{ flex: 1 }}>
              <FormationPlayer
                formation={selectedFormation}
                currentTimeMs={formationTime}
                externalTimeSV={currentTimeMsSV}
                seekToMs={formationSeekMs}
                onTimeUpdate={handleFormationTimeUpdate}
                onDurationDetected={setFormationDuration}
                isPlaying={isFormationPlaying}
                playbackRate={playbackRate}
                noAudio={!selectedFormation?.audioUrl}
                containerWidth={winW}
                containerHeight={winH - Math.max(70, 56 + insets.bottom)}
                hidePip={true}
                forceDarkMode={false}
              />
              {/* 안무 영상 오버레이 (전체화면) */}
              {cachedChoreographyUrl && (
                <FormationPiPPlayer
                  videoUrl={cachedChoreographyUrl}
                  currentTimeMs={currentTimeMsSV}
                  isPlaying={isFormationPlaying}
                  syncOffset={selectedFormation?.videoSettings?.syncOffset || 0}
                  onClose={() => {}}
                  initialX={winW - 216}
                  initialY={60}
                />
              )}
              {/* 전체화면 컨트롤 오버레이 */}
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: insets.bottom + 4, paddingHorizontal: 4, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                {renderFormationControls(true)}
              </View>
            </View>
          </GestureHandlerRootView>
        </Modal>
      );
    }

    return (
      <Modal visible={true} animationType="slide" transparent={false} onRequestClose={handleCloseModal}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={[{ flex: 1 }, { backgroundColor: theme.background }]}>
            {/* 헤더 */}
            <View style={[styles.formationHeader, { paddingTop: insets.top, backgroundColor: theme.card, borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={handleCloseModal} style={{ padding: 4 }}>
                <Ionicons name="chevron-back" size={28} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.formationHeaderTitle, { color: theme.text }]} numberOfLines={1}>{videoObj.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {hasChoreography && (
                  <TouchableOpacity
                    onPress={handleDownload}
                    disabled={isDownloading}
                    style={[styles.archiveDownloadBtn, { backgroundColor: theme.primary }]}
                  >
                    {isDownloading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><Ionicons name="arrow-down-circle-outline" size={17} color="#fff" /><Text style={styles.archiveDownloadBtnText}>{t('save')}</Text></>
                    }
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setIsFormationFullScreen(true)} style={{ padding: 4 }}>
                  <Ionicons name="expand" size={22} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 대형 배치 뷰 */}
            <View style={{ flex: 1 }} onLayout={(e) => setFormationContainerHeight(e.nativeEvent.layout.height)}>
              <FormationPlayer
                formation={selectedFormation}
                currentTimeMs={formationTime}
                externalTimeSV={currentTimeMsSV}
                seekToMs={formationSeekMs}
                onTimeUpdate={handleFormationTimeUpdate}
                onDurationDetected={setFormationDuration}
                isPlaying={isFormationPlaying}
                playbackRate={playbackRate}
                noAudio={!selectedFormation?.audioUrl}
                containerWidth={winW}
                containerHeight={formationContainerHeight > 0 ? formationContainerHeight : undefined}
                hidePip={true}
                forceDarkMode={false}
              />
              {/* 안무 영상 오버레이 — 드래그·핀치로 위치·크기 자유 조절 */}
              {cachedChoreographyUrl && (
                <FormationPiPPlayer
                  videoUrl={cachedChoreographyUrl}
                  currentTimeMs={currentTimeMsSV}
                  isPlaying={isFormationPlaying}
                  syncOffset={selectedFormation?.videoSettings?.syncOffset || 0}
                  onClose={() => {}}
                  initialX={SCREEN_WIDTH - 216}
                  initialY={60}
                />
              )}
            </View>

            {/* 하단 컨트롤 */}
            <View style={[styles.formationControls, { paddingBottom: insets.bottom + 8, backgroundColor: theme.card, borderTopColor: theme.border }]}>
              {renderFormationControls(false)}
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    );
  }

  if (selectedVideo) {
    const videoObj = videos.find((v) => v.id === selectedVideo.id) || selectedVideo;
    const hasChoreography = !!cachedChoreographyUrl || !!selectedVideo.choreographyVideoUrl;

    const renderMainContent = () => {
      if (isSwapped && hasChoreography) {
        return (
          <View style={styles.vPlayer}>
            <VideoView
              style={[{ flex: 1 }, isMirrorMode && { transform: [{ scaleX: -1 }] }]}
              player={subPlayer}
              contentFit="contain"
              fullscreenOptions={{ enable: false }}
              nativeControls={false}
              surfaceType="textureView"
            />
            {isMirrorMode && (
              <View style={[styles.mirrorIndicator, { left: insets.left + 20 }]}>
                <Ionicons name="swap-horizontal" size={10} color="#fff" />
                <Text style={styles.mirrorIndicatorText}>MIRROR ON</Text>
              </View>
            )}
          </View>
        );
      }

      if (isFormation) {
        return selectedFormation ? (
          <View
            style={[{ flex: 1, padding: 20 }, isMirrorMode && { transform: [{ scaleX: -1 }] }]}
            onLayout={(e) => setFormationContainerHeight(e.nativeEvent.layout.height)}
          >
            <FormationPlayer
              formation={selectedFormation}
              currentTimeMs={formationTime}
              seekToMs={formationSeekMs}
              onTimeUpdate={handleFormationTimeUpdate}
              onDurationDetected={setFormationDuration}
              isPlaying={isFormationPlaying}
              playbackRate={playbackRate}
              noAudio={!selectedFormation?.audioUrl}
              containerWidth={SCREEN_WIDTH - 80}
              containerHeight={formationContainerHeight > 0 ? formationContainerHeight - 40 : undefined}
              hidePip={true}
              forceDarkMode={false}
            />
            {isMirrorMode && (
              <View style={[styles.mirrorIndicator, { left: insets.left + 20, transform: [{ scaleX: -1 }] }]}>
                <Ionicons name="swap-horizontal" size={10} color="#fff" />
                <Text style={styles.mirrorIndicatorText}>MIRROR ON</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={{ color: theme.textSecondary }}>{t('formationLoadError')}</Text>
          </View>
        );
      }

      return isCaching ? (
        <ActivityIndicator size="large" color={theme.primary} />
      ) : (
        <View style={styles.vPlayer}>
          <VideoView
            style={[{ flex: 1 }, isMirrorMode && { transform: [{ scaleX: -1 }] }]}
            player={player}
            contentFit="contain"
            fullscreenOptions={{ enable: false }}
            nativeControls={false}
            surfaceType="textureView"
          />
          {isMirrorMode && (
            <View style={[styles.mirrorIndicator, { left: insets.left + 20 }]}>
              <Ionicons name="swap-horizontal" size={10} color="#fff" />
              <Text style={styles.mirrorIndicatorText}>MIRROR ON</Text>
            </View>
          )}
        </View>
      );
    };

    const renderSubContent = () => {
      if (!hasChoreography) return null;

      // Non-swapped: choreography video floats as PiP → use FormationPiPPlayer
      // Don't render anything while cachedChoreographyUrl is still loading
      if (!isSwapped) {
        if (!cachedChoreographyUrl) return null;
        return (
          <FormationPiPPlayer
            videoUrl={cachedChoreographyUrl}
            currentTimeMs={currentTimeMsSV}
            isPlaying={isFormation ? isFormationPlaying : isVideoPlaying}
            syncOffset={selectedFormation?.videoSettings?.syncOffset || 0}
            onClose={() => {}}
            initialX={subPosX.value}
            initialY={subPosY.value}
          />
        );
      }

      // Swapped: show formation or main video in the draggable sub container
      return (
        <GestureDetector gesture={subGesture}>
          <Animated.View style={[subAnimStyle, Shadows.medium]}>
            {isFormation ? (
              <FormationPlayer
                formation={selectedFormation!}
                currentTimeMs={formationTime}
                isPlaying={isFormationPlaying}
                hidePip={true}
                noAudio={true}
                externalTimeSV={currentTimeMsSV}
                containerWidth={subContainerW}
              />
            ) : (
              <VideoView
                style={{ flex: 1 }}
                player={player}
                contentFit="contain"
                fullscreenOptions={{ enable: false }}
                nativeControls={false}
                surfaceType="textureView"
              />
            )}
            <View style={styles.swapIconOverlay}>
              <Ionicons name="swap-horizontal" size={14} color="#fff" />
            </View>
          </Animated.View>
        </GestureDetector>
      );
    };

    const handleSeek = (event: any) => {
      resetControlsTimer();
      const totalDuration = isFormation ? formationDuration : videoDuration;
      if (totalDuration <= 0 || barWidth <= 0) return;
      const { locationX } = event.nativeEvent;
      const ratio = Math.max(0, Math.min(1, locationX / barWidth));
      seekTo(ratio * totalDuration * 1000);
    };


    const renderCustomControls = () => {
      const totalDuration = isFormation ? formationDuration : videoDuration;
      const progress = totalDuration > 0 ? currentPlaybackTime / 1000 / totalDuration : 0;

      return (
        <View style={[styles.customBottomControls, { paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
          <View style={{ position: "absolute", bottom: 60, left: insets.left + 15, alignItems: "center" }}>
            <View style={styles.speedBtnGroup}>
              <TouchableOpacity
                style={styles.speedArrowBtn}
                onPress={() => {
                  resetControlsTimer();
                  setPlaybackRate((r) => Math.max(0.25, Math.round((r - 0.05) * 100) / 100));
                }}
              >
                <Ionicons name="chevron-back" size={14} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.speedBtn}
                onPress={() => {
                  resetControlsTimer();
                  setShowSpeedPicker((v) => !v);
                }}
              >
                <Text style={styles.speedBtnText}>
                  {playbackRate % 1 === 0 ? playbackRate.toFixed(1) : playbackRate}×
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.speedArrowBtn}
                onPress={() => {
                  resetControlsTimer();
                  setPlaybackRate((r) => Math.min(2.0, Math.round((r + 0.05) * 100) / 100));
                }}
              >
                <Ionicons name="chevron-forward" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity onPress={handleTogglePlay} style={styles.mainPlayBtn}>
            <Ionicons name={(isFormation ? isFormationPlaying : player.playing) ? "pause" : "play"} size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.progressSection}>
            <Text style={styles.timeText}>{formatTime(currentPlaybackTime)}</Text>
            <GestureDetector gesture={scrubGesture}>
              <View 
                style={styles.progressBarTouchable}
                onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
              >
                <View style={[styles.progressBarBg, isScrubbing && { height: 6, borderRadius: 3 }]}>
                  <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: theme.primary }]} />
                  <View style={[
                    styles.progressKnob, 
                    { 
                      left: `${progress * 100}%`, 
                      backgroundColor: '#FFF',
                      transform: [{ scale: isScrubbing ? 1.5 : 1 }]
                    }
                  ]} />
                </View>
              </View>
            </GestureDetector>
            <Text style={styles.timeText}>{formatTime(totalDuration * 1000)}</Text>
          </View>
        </View>
      );
    };

    // 영상 핀치줌 + 더블탭 리셋 제스처 (issue #9)
    const videoPinchGesture = Gesture.Pinch()
      .onStart(() => { 'worklet'; savedVideoZoom.value = videoZoom.value; })
      .onUpdate(e => { 'worklet'; videoZoom.value = Math.max(0.5, Math.min(4, savedVideoZoom.value * e.scale)); });

    const videoDoubleTapGesture = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => { 'worklet'; videoZoom.value = withTiming(1, { duration: 200 }); savedVideoZoom.value = 1; });

    const videoSingleTapGesture = Gesture.Tap()
      .numberOfTaps(1)
      .requireExternalGestureToFail(videoDoubleTapGesture)
      .runOnJS(true)
      .onEnd(() => toggleControls());

    const videoAreaGesture = Gesture.Simultaneous(
      videoPinchGesture,
      Gesture.Exclusive(videoDoubleTapGesture, videoSingleTapGesture)
    );

    return (
      <Modal visible={true} animationType="slide" transparent={false} onRequestClose={handleCloseModal}>
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={[
            styles.fullView,
            {
              backgroundColor: theme.background,
              paddingTop: isFullScreen ? 0 : insets.top,
              paddingBottom: isFullScreen ? 0 : insets.bottom,
            },
          ]}
        >
          <View style={[styles.mainLayout, isFullScreen && styles.landscapeLayout]}>
            <View
              style={[
                styles.videoSection,
                isFullScreen ? styles.landscapeVideo : styles.portraitVideo,
                { backgroundColor: "#000" },
              ]}
            >
              <Animated.View style={[StyleSheet.absoluteFill, videoZoomStyle]}>
                {renderMainContent()}
              </Animated.View>

              <GestureDetector gesture={videoAreaGesture}>
                <View style={StyleSheet.absoluteFill} />
              </GestureDetector>

              {/* 서브 영상은 UI 표시 여부와 무관하게 항상 표시 */}
              {renderSubContent()}

              {showControls && (
                <Animated.View
                  pointerEvents="box-none"
                  entering={FadeIn}
                  exiting={FadeOut}
                  style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
                >
                  {renderCustomControls()}
                  <View style={[styles.vControls, { paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
                    <TouchableOpacity
                      onPress={() => {
                        if (isFullScreen) setIsFullScreen(false);
                        else handleCloseModal();
                      }}
                    >
                      <Ionicons name="chevron-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    {isFullScreen && (
                      <>
                        <TouchableOpacity
                          style={{ marginRight: 16 }}
                          onPress={() => {
                            resetControlsTimer();
                            setEnableFloatingComments(!enableFloatingComments);
                          }}
                        >
                          <Ionicons
                            name={enableFloatingComments ? "chatbox-ellipses" : "chatbox-outline"}
                            size={24}
                            color={enableFloatingComments ? theme.primary : "#fff"}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ marginRight: 16 }}
                          onPress={() => {
                            resetControlsTimer();
                            setShowSidebar(!showSidebar);
                          }}
                        >
                          <Ionicons name="chatbubbles" size={24} color={showSidebar ? theme.primary : "#fff"} />
                        </TouchableOpacity>
                      </>
                    )}
                    <TouchableOpacity
                      style={[
                        styles.mirrorBtn,
                        isMirrorMode && { backgroundColor: theme.primary + "44", borderColor: theme.primary },
                      ]}
                      onPress={() => {
                        resetControlsTimer();
                        setIsMirrorMode((v) => !v);
                      }}
                    >
                      <Ionicons name="swap-horizontal-outline" size={20} color={isMirrorMode ? theme.primary : "#fff"} />
                      <Text style={[styles.mirrorBtnText, { color: isMirrorMode ? theme.primary : "#fff" }]}>
                        {t("mirror")}
                      </Text>
                    </TouchableOpacity>
                    {!isFormation && (
                      <TouchableOpacity
                        style={[styles.archiveDownloadBtn, { marginRight: 8 }]}
                        onPress={() => {
                          resetControlsTimer();
                          handleDownload();
                        }}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <><Ionicons name="arrow-down-circle-outline" size={17} color="#fff" /><Text style={styles.archiveDownloadBtnText}>{t('save')}</Text></>
                        )}
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        resetControlsTimer();
                        setIsFullScreen(!isFullScreen);
                      }}
                    >
                      <Ionicons name={isFullScreen ? "contract" : "expand"} size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {showSpeedPicker && (
                    <View style={[styles.speedPickerPanel, { left: insets.left + 15 }]}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.speedPickerScroll}
                      >
                        {speedOptions.map((speed) => (
                          <TouchableOpacity
                            key={speed}
                            style={[styles.speedOption, speed === playbackRate && { backgroundColor: theme.primary }]}
                            onPress={() => {
                              resetControlsTimer();
                              setPlaybackRate(speed);
                              setShowSpeedPicker(false);
                            }}
                          >
                            <Text style={[styles.speedOptionText, speed === playbackRate && { color: "#fff" }]}>
                              {speed % 1 === 0 ? speed.toFixed(1) : speed}×
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </Animated.View>
              )}

              {/* Floating Comment Bubbles */}
              {activeFloatingBubbles.length > 0 && (
                <View style={styles.floatingContainer} pointerEvents="none">
                  {activeFloatingBubbles.map((c) => (
                    <Animated.View
                      key={c.id}
                      entering={FadeIn.duration(600)}
                      exiting={FadeOut.duration(600)}
                      style={[
                        styles.bubble,
                        { backgroundColor: theme.card + "EE", borderColor: theme.primary, borderLeftWidth: 3 },
                        Shadows.medium,
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                        <Text style={[styles.bubbleUser, { color: theme.primary }]}>{getUser(c.userId)?.name}</Text>
                        <Text style={[styles.bubbleTime, { color: theme.textSecondary }]}>
                          {formatTime(c.timestampMillis)}
                        </Text>
                      </View>
                      <Text style={[styles.bubbleText, { color: theme.text }]} numberOfLines={4}>{c.text}</Text>
                    </Animated.View>
                  ))}
                </View>
              )}
            </View>

            {(!isFullScreen || showSidebar) && (
              <View
                style={[
                  styles.sidebar,
                  isFullScreen && [styles.landscapeSidebar, { borderLeftColor: theme.border }],
                  { backgroundColor: theme.background },
                ]}
              >
                <View style={[styles.sidebarHeader, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.sidebarTitle, { color: theme.text }]}>{t('feedbackSidebar')} {videoObj.comments.length}</Text>
                  <TouchableOpacity onPress={() => setShowCommentInput(true)}>
                    <Ionicons name="add-circle" size={24} color={theme.primary} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={videoObj.comments.sort((a, b) => a.timestampMillis - b.timestampMillis)}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={[styles.cItem, { borderBottomColor: theme.border }]}>
                      <TouchableOpacity onPress={() => seekTo(item.timestampMillis)} style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                          <Text style={[styles.cTime, { color: theme.primary }]}>{formatTime(item.timestampMillis)}</Text>
                          <Text style={[styles.bubbleUser, { color: theme.text, opacity: 0.8 }]}>
                            {getUser(item.userId)?.name}
                          </Text>
                        </View>
                        <Text style={[styles.cText, { color: theme.text }]}>{item.text}</Text>
                      </TouchableOpacity>
                      {(item.userId === currentUser?.id || currentRoom?.leaderId === currentUser?.id) && (
                        <View style={styles.commentActions}>
                          <TouchableOpacity
                            onPress={(e) => {
                              setCommentMenuAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
                              setSelectedCommentForOptions(item);
                              setShowCommentOptions(true);
                            }}
                            style={{ padding: 5 }}
                          >
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

          <PopoverMenu
            visible={showCommentOptions}
            onClose={() => setShowCommentOptions(false)}
            anchor={commentMenuAnchor}
            options={[
              ...(selectedCommentForOptions?.userId === currentUser?.id ? [{
                label: t('edit'),
                icon: 'create-outline',
                onPress: () => {
                  if (!selectedCommentForOptions) return;
                  setEditingComment(selectedCommentForOptions);
                  setEditCommentText(selectedCommentForOptions.text);
                },
              }] : []),
              {
                label: t('delete'),
                icon: 'trash-outline',
                destructive: true,
                onPress: () => {
                  if (!selectedCommentForOptions) return;
                  handleDeleteComment(selectedCommentForOptions.id);
                },
              },
            ]}
            theme={theme}
          />

          <Modal
            visible={showCommentInput}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCommentInput(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 }}
            >
              <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                <Text style={{ color: theme.text, marginBottom: 15, fontWeight: "800" }}>
                  {t('commentAtTime').replace('{time}', formatTime(isFormation ? formationTime : Math.floor((player?.currentTime || 0) * 1000)))}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 },
                  ]}
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder={t('commentInputPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                />
                <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                  <TouchableOpacity onPress={() => setShowCommentInput(false)} style={{ marginRight: 20, padding: 10 }}>
                    <Text style={{ color: theme.textSecondary, fontWeight: "700" }}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAddComment} style={{ padding: 10 }} disabled={isSubmittingComment}>
                    {isSubmittingComment ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <Text style={{ color: theme.primary, fontWeight: "900" }}>{t('commentRegister')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <Modal
            visible={!!editingComment}
            transparent
            animationType="fade"
            onRequestClose={() => setEditingComment(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                <Text style={{ color: theme.text, marginBottom: 15, fontWeight: "900" }}>{t('editCommentTitle')}</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 },
                  ]}
                  value={editCommentText}
                  onChangeText={setEditCommentText}
                  multiline
                />
                <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                  <TouchableOpacity onPress={() => setEditingComment(null)} style={{ marginRight: 20, padding: 10 }}>
                    <Text style={{ color: theme.textSecondary, fontWeight: "700" }}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleUpdateComment} style={{ padding: 10 }}>
                    <Text style={{ color: theme.primary, fontWeight: "900" }}>{t('edit')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
        </GestureHandlerRootView>
      </Modal>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={28} color={theme.text} /></TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t('videoFeedback')}</Text>
          <Text style={{fontSize: 10, color: theme.textSecondary, fontWeight: '700'}}>{roomVideos.length} / {(isPro || currentRoom?.leaderIsPro) ? '100' : '10'}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAddModal(true)}><Ionicons name="add" size={30} color={theme.primary} /></TouchableOpacity>
      </View>

      <View style={[styles.autoDeleteBanner, { backgroundColor: theme.isDark ? 'rgba(255,180,0,0.12)' : 'rgba(255,160,0,0.1)' }]}>
        <Ionicons name="time-outline" size={13} color="#E6A000" />
        <Text style={styles.autoDeleteBannerText}>{t('inactiveAutoDeleteWarning')}</Text>
      </View>

      <View style={styles.filterBar}>
        {['all', 'choreography', 'formation'].map((type) => (
          <TouchableOpacity key={type} style={[styles.filterBtn, filterType === type ? {backgroundColor: theme.primary} : {backgroundColor: theme.card}]} onPress={() => setFilterType(type as any)}>
            <Text style={[styles.filterText, {color: filterType === type ? '#fff' : theme.textSecondary}]}>
              {type === 'all' ? t('allFilter') : type === 'choreography' ? t('choreographyFilter') : t('formationFilter')}
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
              <Text style={{color: theme.textSecondary, fontSize: 12, fontWeight: '500', opacity: 0.7, marginTop: 4}}>{getUser(item.userId)?.name} • {formatDateFull(item.createdAt, language)}</Text>
            </View>
            {(item.userId === currentUser?.id || currentRoom?.leaderId === currentUser?.id) && (
              <TouchableOpacity onPress={(e) => { setVideoMenuAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }); setSelectedVideoForOptions(item); setShowVideoOptions(true); }} style={{padding: 8}}>
                <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />

      <PopoverMenu visible={showVideoOptions} onClose={() => setShowVideoOptions(false)} anchor={videoMenuAnchor} options={[
        ...(selectedVideoForOptions?.userId === currentUser?.id ? [{
          label: t('titleEditTitle'), icon: 'create-outline', onPress: () => {
            if (!selectedVideoForOptions) return;
            setEditingVideo(selectedVideoForOptions);
            setEditTitle(selectedVideoForOptions.title);
          }
        }] : []),
        { label: t('delete'), icon: 'trash-outline', destructive: true, onPress: () => handleDeleteVideo(selectedVideoForOptions!) }
      ]} theme={theme} />

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 24, letterSpacing: -0.5}}>{t('videoUploadTitle')}</Text>
            <TextInput style={[styles.titleInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]} placeholder={t('videoTitleInput')} placeholderTextColor={theme.textSecondary} value={videoTitle} onChangeText={setVideoTitle} />
            {isLoading ? (
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
                {uploadPhase === 'converting' && conversionProgress > 0 && conversionProgress < 100 && (
                  <Text style={{ color: theme.primary, marginTop: 10, fontWeight: 'bold' }}>변환 중 {conversionProgress}%</Text>
                )}
                {uploadPhase === 'compressing' && (
                  <Text style={{ color: theme.primary, marginTop: 10, fontWeight: 'bold' }}>
                    {conversionProgress < 100 ? `압축 중 ${conversionProgress}%` : '압축 완료'}
                  </Text>
                )}
                {uploadPhase === 'uploading' && (
                  <Text style={{ color: theme.textSecondary, marginTop: 10, fontSize: 12 }}>{t('posting')}</Text>
                )}
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickVideo} style={[styles.pickBtn, { backgroundColor: theme.primary }, Shadows.glow]}>
                <Text style={{ fontWeight: '800', color: '#fff', fontSize: 16 }}>{t('selectFromGallery')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={{marginTop: 24}}><Text style={{color: theme.textSecondary, textAlign: 'center', fontWeight: '700'}}>{t('cancel')}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editingVideo} transparent animationType="fade" onRequestClose={() => setEditingVideo(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }, Shadows.medium]}>
            <Text style={{color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 20}}>{t('titleEditTitle')}</Text>
            <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={editTitle} onChangeText={setEditTitle} />
            <View style={{flexDirection:'row', justifyContent:'flex-end'}}>
              <TouchableOpacity onPress={() => setEditingVideo(null)} style={{marginRight: 20, padding: 10}}><Text style={{color: theme.textSecondary, fontWeight: '700'}}>{t('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateVideo} style={{padding: 10}} disabled={isUpdatingTitle}>
                {isUpdatingTitle ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={{color: theme.primary, fontWeight:'900'}}>{t('edit')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={{ paddingHorizontal: 24 }}>
        <AdBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 0.5 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  autoDeleteBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, marginBottom: 0, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  autoDeleteBannerText: { fontSize: 11, color: '#E6A000', fontWeight: '700', marginLeft: 6, flex: 1 },
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
  speedBtnGroup: { flexDirection: 'row', alignItems: 'center' },
  speedArrowBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  speedBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, minWidth: 45, alignItems: 'center' },
  speedBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  speedPickerPanel: { position: 'absolute', bottom: 100, left: 15, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 16, zIndex: 200, width: 220, overflow: 'hidden' },
  speedPickerScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  speedOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', minWidth: 50, alignItems: 'center' },
  speedOptionText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 13 },
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
  floatingContainer: { position: 'absolute', right: 20, bottom: 80, width: 220, flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end', zIndex: 90 },
  bubble: { padding: 8, paddingHorizontal: 12, borderRadius: 12, width: '100%', maxWidth: 200, marginBottom: 8 },
  bubbleUser: { fontSize: 10, fontWeight: '800' },
  bubbleTime: { fontSize: 8, fontWeight: '600', marginLeft: 6 },
  bubbleText: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  subVideoContainer: { position: 'absolute', top: 70, right: 20, width: 120, height: 68, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', backgroundColor: '#000', zIndex: 110 },
  swapIconOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  saveBtn: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, padding: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  customBottomControls: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 20, gap: 15 },
  mainPlayBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  progressSection: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBarTouchable: { flex: 1, height: 40, justifyContent: 'center' },
  progressBarBg: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },
  progressKnob: { position: 'absolute', width: 12, height: 12, borderRadius: 6, top: -4, marginLeft: -6, zIndex: 10 },
  timeText: { color: '#fff', fontSize: 11, fontWeight: '600', width: 35 },
  mirrorBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', marginRight: 16 },
  mirrorBtnText: { fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  mirrorIndicator: { position: 'absolute', top: 60, left: 20, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  mirrorIndicatorText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  // 아카이브 스타일 다운로드 버튼 (피드백 + 동선 공용)
  archiveDownloadBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  archiveDownloadBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, marginLeft: 5 },
  // 동선영상 전용 뷰
  formationHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
  formationHeaderTitle: { flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, marginHorizontal: 12 },
  formationControls: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 0.5 },
  formationSpeedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  formationSpeedChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  formationSpeedChipText: { fontWeight: '700', fontSize: 12 },
  formationProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  formationPlayBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
