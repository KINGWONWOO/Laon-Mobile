import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, RefreshControl, ScrollView, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { ensureStandardMP4 } from '../../../utils/convertMP4';
import { useAppContext } from '../../../context/AppContext';
import { VideoFeedback } from '../../../types';
import { storageService } from '../../../services/storageService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FormationPlayer from '../../../components/ui/FormationPlayer';
import { FormationPiPPlayer } from '../../../components/ui/FormationPiPPlayer';
import { formatDateFull, OptionModal } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';
import { createTranslator } from '../../../constants/translations';
import Animated, { FadeIn, FadeOut, LinearTransition, useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import AdBanner from '../../../components/ui/AdBanner';
import { saveMediaToDevice } from '../../../services/downloadService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FeedbackScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { videos, addVideo, updateVideo, deleteVideo, addComment, updateComment, deleteComment, getUserById, currentUser, theme, markItemAsAccessed, refreshAllData, formations, checkProAccess, isPro, rooms, blockUser, reportContent, language } = useAppContext();

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
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');

  const [editingVideo, setEditingVideo] = useState<VideoFeedback | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editingComment, setEditingComment] = useState<any>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const [showVideoOptions, setShowVideoOptions] = useState(false);
  const [selectedVideoForOptions, setSelectedVideoForOptions] = useState<VideoFeedback | null>(null);
  const [showCommentOptions, setShowCommentOptions] = useState(false);
  const [selectedCommentForOptions, setSelectedCommentForOptions] = useState<any>(null);

  const [isDownloading, setIsDownloading] = useState(false);
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
  const [formationTime, setFormationTime] = useState(0);
  const [formationDuration, setFormationDuration] = useState(60);
  const [formationSeekMs, setFormationSeekMs] = useState<number | null>(null);
  const formationTimeRef = useRef(0);
  const [videoTime, setVideoTime] = useState(0);

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

  const isFormation = selectedVideo?.videoUrl?.startsWith('formation://');
  const selectedFormation = useMemo(() => {
    if (!isFormation || !selectedVideo) return null;
    const fId = selectedVideo.videoUrl.replace('formation://', '');
    return formations.find(f => f.id === fId);
  }, [selectedVideo, formations]);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // formationTime ref로 최신값 유지 (interval 클로저에서 사용)
  const handleFormationTimeUpdate = useCallback((ms: number) => {
    formationTimeRef.current = ms;
    setFormationTime(ms);
    currentTimeMsSV.value = ms; // keep PiP in sync
  }, [currentTimeMsSV]);

  const player = useVideoPlayer(cachedVideoUrl || '', p => {
    p.loop = true;
    p.preservesPitch = true;
    if (cachedVideoUrl) p.play();
  });

  const subPlayer = useVideoPlayer(cachedChoreographyUrl || '', p => {
    p.loop = true;
    p.muted = true;
    p.preservesPitch = true;
    if (cachedChoreographyUrl) p.play();
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
      subPlayer.pause();
      subPlayer.currentTime = 0;
    }
  }, [cachedChoreographyUrl, subPlayer]);

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

  const activeFloatingBubbles = useMemo(() => {
    if (!selectedVideo || !isFullScreen || showSidebar || !enableFloatingComments) return [];
    return selectedVideo.comments.filter(c => {
      const triggerTime = c.timestampMillis - 1000;
      const sequentialOffset = (c.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 5) * 200;
      return currentPlaybackTime >= triggerTime && currentPlaybackTime < triggerTime + 3000 + sequentialOffset;
    }).sort((a, b) => a.timestampMillis - b.timestampMillis);
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
      if (!selectedVideo) {
        setCachedVideoUrl(null);
        setCachedChoreographyUrl(null);
        setIsSwapped(false);
        setIsMirrorMode(false);
        return;
      }

      markItemAsAccessed('video', selectedVideo.id);
      setIsCaching(true);

      try {
        if (!isFormation) {
          const remoteUrl = selectedVideo.videoUrl;
          const fileName = remoteUrl.split('/').pop()?.split('?')[0] || 'video.mp4';
          const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          if (fileInfo.exists) setCachedVideoUrl(fileUri);
          else {
            const { uri } = await FileSystem.downloadAsync(remoteUrl, fileUri);
            setCachedVideoUrl(uri);
          }
        }

        if (selectedVideo.choreographyVideoUrl) {
          const remoteUrl = selectedVideo.choreographyVideoUrl;
          const fileName = `choreo_${remoteUrl.split('/').pop()?.split('?')[0] || 'video.mp4'}`;
          const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          if (fileInfo.exists) setCachedChoreographyUrl(fileUri);
          else {
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
    if (isFormation) { setFormationTime(0); setIsFormationPlaying(true); }
  }, [selectedVideo?.id]);

  useEffect(() => {
    if (player && !isFormation) {
      try { player.playbackRate = playbackRate; } catch (e) {}
    }
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
  }, [showCommentInput]);

  const handlePickVideo = async () => {
    const access = checkProAccess('feedback_limit');
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
      try {
        const rawUri = result.assets[0].uri;
        // fMP4 변환
        const videoUri = await ensureStandardMP4(rawUri, (ratio) => {
          setConversionProgress(Math.floor(ratio * 100));
        });
        
        const fileName = `${Date.now()}.mp4`;
        const publicUrl = await storageService.uploadToR2(`videos/${id}`, videoUri, fileName);

        // 대형 영상인 경우 PiP 안무 영상 포함 여부 확인
        let choreographyUrl: string | undefined = undefined;
        const currentFormation = formations.find(f => f.roomId === id && !f.isLocal); // 최근 저장된 대형
        if (currentFormation?.videoSettings?.videoUrl) {
          const includePip = await new Promise<boolean>((resolve) => {
            Alert.alert(
              t('includePipTitle'),
              t('includePipMsg'),
              [
                { text: t('uploadOnlyFormation'), onPress: () => resolve(false), style: 'cancel' },
                { text: t('includeChoreographyVideo'), onPress: () => resolve(true) }
              ]
            );
          });
          if (includePip) {
            choreographyUrl = currentFormation.videoSettings.videoUrl;
          }
        }

        await addVideo(id || '', publicUrl, videoTitle, true, choreographyUrl);
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
    if (!editingVideo || !editTitle.trim()) return;
    await updateVideo(editingVideo.id, editTitle);
    setEditingVideo(null);
    refreshAllData();
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
  };

  const handleDownload = async () => {
    if (!selectedVideo || isFormation || isDownloading) return;
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
          <View style={[{ flex: 1, padding: 20 }, isMirrorMode && { transform: [{ scaleX: -1 }] }]}>
            <FormationPlayer
              formation={selectedFormation}
              currentTimeMs={formationTime}
              seekToMs={formationSeekMs}
              onTimeUpdate={handleFormationTimeUpdate}
              onDurationDetected={setFormationDuration}
              isPlaying={isFormationPlaying}
              playbackRate={playbackRate}
              containerWidth={SCREEN_WIDTH - 80}
              hidePip={true}
              forceDarkMode={true}
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

      // Non-swapped: choreography video floats as PiP → use FormationPiPPlayer (react-native-video)
      if (!isSwapped && cachedChoreographyUrl) {
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

    return (
      <Modal visible={true} animationType="slide" transparent={false} onRequestClose={() => setSelectedVideo(null)}>
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
              {renderMainContent()}

              <TouchableWithoutFeedback onPress={toggleControls}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>

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
                        else setSelectedVideo(null);
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
                        style={[styles.saveBtn, { marginRight: 16 }]}
                        onPress={() => {
                          resetControlsTimer();
                          handleDownload();
                        }}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="cloud-download-outline" size={22} color="#fff" />
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

              {/* Floating Comment Bubbles with Absolute Fixed Height Container */}
              {activeFloatingBubbles.length > 0 && (
                <View style={styles.floatingContainer} pointerEvents="none">
                  {activeFloatingBubbles.map((c) => (
                    <Animated.View
                      key={c.id}
                      entering={FadeIn.duration(800)}
                      exiting={FadeOut.duration(800)}
                      layout={LinearTransition.springify().damping(20).stiffness(90)}
                      style={[
                        styles.bubble,
                        { backgroundColor: theme.card + "EE", borderColor: theme.primary, borderLeftWidth: 3 },
                        Shadows.medium,
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                        <Text style={[styles.bubbleUser, { color: theme.primary }]}>{getUserById(c.userId)?.name}</Text>
                        <Text style={[styles.bubbleTime, { color: theme.textSecondary }]}>
                          {formatTime(c.timestampMillis)}
                        </Text>
                      </View>
                      <Text style={[styles.bubbleText, { color: theme.text }]}>{c.text}</Text>
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
                            {getUserById(item.userId)?.name}
                          </Text>
                        </View>
                        <Text style={[styles.cText, { color: theme.text }]}>{item.text}</Text>
                      </TouchableOpacity>
                      {item.userId === currentUser?.id && (
                        <View style={styles.commentActions}>
                          <TouchableOpacity
                            onPress={() => {
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

          <OptionModal
            visible={showCommentOptions}
            onClose={() => setShowCommentOptions(false)}
            options={[
              {
                label: t('edit'),
                icon: "create-outline",
                onPress: () => {
                  if (!selectedCommentForOptions) return;
                  setEditingComment(selectedCommentForOptions);
                  setEditCommentText(selectedCommentForOptions.text);
                },
              },
              {
                label: t('delete'),
                icon: "trash-outline",
                destructive: true,
                onPress: () => {
                  if (!selectedCommentForOptions) return;
                  handleDeleteComment(selectedCommentForOptions.id);
                },
              },
            ]}
            title={t('commentSettingsTitle')}
            theme={theme}
            cancelLabel={t('cancel')}
          />

          <Modal
            visible={showCommentInput}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCommentInput(false)}
          >
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={[styles.modalContent, { backgroundColor: theme.card }]}
              >
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
              </KeyboardAvoidingView>
            </View>
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
          <Text style={{fontSize: 10, color: theme.textSecondary, fontWeight: '700'}}>{roomVideos.length} / {isPro ? '100' : '10'}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAddModal(true)}><Ionicons name="add" size={30} color={theme.primary} /></TouchableOpacity>
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
              <Text style={{color: theme.textSecondary, fontSize: 12, fontWeight: '500', opacity: 0.7, marginTop: 4}}>{getUserById(item.userId)?.name} • {formatDateFull(item.createdAt, language)}</Text>
            </View>
            {item.userId === currentUser?.id && (
              <TouchableOpacity onPress={() => { setSelectedVideoForOptions(item); setShowVideoOptions(true); }} style={{padding: 8}}>
                <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />

      <OptionModal visible={showVideoOptions} onClose={() => setShowVideoOptions(false)} options={[
        { label: t('titleEditTitle'), icon: 'create-outline', onPress: () => {
          if (!selectedVideoForOptions) return;
          setEditingVideo(selectedVideoForOptions);
          setEditTitle(selectedVideoForOptions.title);
        }},
        { label: t('delete'), icon: 'trash-outline', destructive: true, onPress: () => handleDeleteVideo(selectedVideoForOptions!) }
      ]} title={t('videoSettings')} theme={theme} cancelLabel={t('cancel')} />

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 24, letterSpacing: -0.5}}>{t('videoUploadTitle')}</Text>
            <TextInput style={[styles.titleInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]} placeholder={t('videoTitleInput')} placeholderTextColor={theme.textSecondary} value={videoTitle} onChangeText={setVideoTitle} />
            {isLoading ? (
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
                {conversionProgress > 0 && conversionProgress < 100 && (
                  <Text style={{ color: theme.primary, marginTop: 10, fontWeight: 'bold' }}>
                    {conversionProgress}%
                  </Text>
                )}
                {conversionProgress >= 100 && (
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
              <TouchableOpacity onPress={handleUpdateVideo} style={{padding: 10}}><Text style={{color: theme.primary, fontWeight:'900'}}>{t('edit')}</Text></TouchableOpacity>
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
  floatingContainer: { position: 'absolute', right: 20, top: 20, bottom: 70, width: 220, flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end', zIndex: 90 },
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
});
