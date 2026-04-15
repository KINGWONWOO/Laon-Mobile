import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, Room, Notice, VideoFeedback, Photo, Schedule, Vote, Alarm, AlarmType, ThemeType, Formation } from '../types';
import * as Crypto from 'expo-crypto';
import { getThemeColors } from '../constants/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { storageService } from '../services/storageService';
import { roomService } from '../services/roomService';
import { contentService } from '../services/contentService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const uuidv4 = () => Crypto.randomUUID();

type AppContextType = {
  currentUser: User | null;
  isLoadingUser: boolean;
  login: (email: string, password: string) => Promise<void>;
  updateUserProfile: (name: string, profileImage?: string) => Promise<void>;
  logout: () => Promise<void>;
  
  rooms: Room[];
  isLoadingRooms: boolean;
  users: User[];
  getUserById: (id: string) => User | undefined;
  getRoomByIdRemote: (roomId: string) => Promise<Room | null>;
  createRoom: (name: string, passcode: string, imageUri?: string) => Promise<Room>;
  joinRoom: (roomId: string, passcode: string) => Promise<Room | null>;
  deleteRoom: (roomId: string) => Promise<void>;
  
  notices: Notice[];
  addNotice: (roomId: string, title: string, content: string, isPinned?: boolean, images?: string[], useNotification?: boolean) => Promise<void>;
  updateNotice: (id: string, updates: Partial<Notice>) => Promise<void>;
  deleteNotice: (noticeId: string) => Promise<void>;
  addNoticeComment: (noticeId: string, text: string, parentId?: string) => Promise<void>;
  updateNoticeComment: (commentId: string, text: string) => Promise<void>;
  deleteNoticeComment: (commentId: string) => Promise<void>;
  
  videos: VideoFeedback[];
  addVideo: (roomId: string, videoUrl: string, title: string, useNotification?: boolean) => Promise<void>;
  updateVideo: (id: string, title: string) => Promise<void>;
  deleteVideo: (id: string) => Promise<void>;
  addComment: (videoId: string, text: string, timestampMillis: number, parentId?: string) => Promise<void>;
  updateComment: (id: string, text: string) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
  
  photos: Photo[];
  addPhoto: (roomId: string, photoUrl: string, description?: string, useNotification?: boolean) => Promise<void>;
  updatePhoto: (id: string, description: string) => Promise<void>;
  deletePhoto: (photoId: string, photoUrl: string) => Promise<void>;
  addPhotoComment: (photoId: string, text: string, parentId?: string) => Promise<void>;
  updatePhotoComment: (id: string, text: string) => Promise<void>;
  deletePhotoComment: (id: string) => Promise<void>;
  markItemAsAccessed: (type: 'video' | 'photo', id: string) => Promise<void>;

  schedules: Schedule[];
  addSchedule: (roomId: string, title: string, options: string[], useNotification?: boolean, deadline?: number) => Promise<void>;
  updateSchedule: (id: string, updates: Partial<Schedule>) => Promise<void>;
  respondToSchedule: (scheduleId: string, optionIds: string[]) => Promise<void>;
  deleteSchedule: (scheduleId: string) => Promise<void>;

  votes: Vote[];
  addVote: (roomId: string, question: string, options: string[], settings: any) => Promise<void>;
  updateVote: (id: string, updates: Partial<Vote>) => Promise<void>;
  respondToVote: (voteId: string, optionIds: string[]) => Promise<void>;
  deleteVote: (voteId: string) => Promise<void>;

  formations: Formation[];
  addFormation: (roomId: string, title: string, audioUrl?: string, settings?: any, data?: any) => Promise<string>;
  updateFormation: (formationId: string, updates: Partial<Formation>) => Promise<void>;
  deleteFormation: (formationId: string) => Promise<void>;
  publishFormationAsFeedback: (roomId: string, formationId: string, title: string, currentData?: any) => Promise<void>;

  refreshAllData: () => Promise<void>;
  themeType: ThemeType;
  setThemeType: (theme: ThemeType) => void;
  theme: any;
  updateRoomUserProfile: (roomId: string, name: string, profileImage: string | null) => Promise<void>;
  getRoomUserProfile: (roomId: string, userId: string) => { name?: string, profileImage?: string } | null;
  roomProfiles: Record<string, any>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [themeType, setThemeType] = useState<ThemeType>('dark');
  const [roomProfiles, setRoomProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    AsyncStorage.getItem('room_profiles').then(val => {
      if (val) setRoomProfiles(JSON.parse(val));
    });
  }, []);

  const updateRoomUserProfile = async (roomId: string, name: string, profileImage: string | null) => {
    const key = `${roomId}_${currentUser?.id}`;
    const newProfiles = { ...roomProfiles, [key]: { name, profileImage } };
    setRoomProfiles(newProfiles);
    await AsyncStorage.setItem('room_profiles', JSON.stringify(newProfiles));
  };

  const getRoomUserProfile = (roomId: string, userId: string) => roomProfiles[`${roomId}_${userId}`] || null;

  const theme = getThemeColors(themeType);

  const sendPushNotification = async (userIds: string[], title: string, body: string, data?: any) => {
    if (!userIds || userIds.length === 0) return;
    try {
      await supabase.functions.invoke('push-notification', { body: { user_ids: userIds, title, body, data } });
    } catch (err) {
      console.warn('Failed to send push notification:', err);
    }
  };

  const fetchMyProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setCurrentUser({ id: data.id, name: data.name || '댄서', profileImage: data.profile_image });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchMyProfile(session.user.id);
      setIsLoadingUser(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchMyProfile(session.user.id);
      else setCurrentUser(null);
      setIsLoadingUser(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name, profile_image');
      return (data || []).map(u => ({ id: u.id, name: u.name, profileImage: u.profile_image }));
    }
  });

  const getUserById = (id: string) => allUsers.find(u => u.id === id);

  const refreshAllData = async () => { 
    await queryClient.invalidateQueries();
    await queryClient.refetchQueries();
  };

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('global-sync').on('postgres_changes', { event: '*', schema: 'public' }, () => refreshAllData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // --- Queries ---
  const { data: roomsData = [], isLoading: isLoadingRooms } = useQuery({
    queryKey: ['rooms', currentUser?.id],
    queryFn: async () => currentUser ? await roomService.getMyRooms(currentUser.id) : [],
    enabled: !!currentUser,
  });

  const roomIds = roomsData.map(r => r.id);

  const videosQuery = useQuery({ queryKey: ['videos', roomIds], queryFn: async () => {
    const { data: v } = await supabase.from('videos').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: c } = await supabase.from('video_comments').select('*').in('video_id', (v || []).map(x => x.id)).order('created_at', { ascending: true });
    return (v || []).map(video => ({ ...video, video_comments: (c || []).filter(comment => comment.video_id === video.id) }));
  }, enabled: roomIds.length > 0 });

  const photosQuery = useQuery({ queryKey: ['photos', roomIds], queryFn: async () => {
    const { data: p } = await supabase.from('gallery_items').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: c } = await supabase.from('gallery_comments').select('*').in('gallery_item_id', (p || []).map(x => x.id)).order('created_at', { ascending: true });
    return (p || []).map(photo => ({ ...photo, gallery_comments: (c || []).filter(comment => comment.gallery_item_id === photo.id) }));
  }, enabled: roomIds.length > 0 });

  const schedulesQuery = useQuery({ queryKey: ['schedules', roomIds], queryFn: async () => {
    const { data: s } = await supabase.from('schedules').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: o } = await supabase.from('schedule_options').select('*').in('schedule_id', (s || []).map(x => x.id));
    const { data: r = [] } = await supabase.from('schedule_responses').select('*').in('schedule_id', (s || []).map(x => x.id));
    return (s || []).map(sch => ({ ...sch, schedule_options: (o || []).filter(opt => opt.schedule_id === sch.id).map(opt => ({ ...opt, schedule_responses: (r || []).filter(res => res.option_ids?.includes(opt.id)) })) }));
  }, enabled: roomIds.length > 0 });

  const votesQuery = useQuery({ queryKey: ['votes', roomIds], queryFn: async () => {
    const { data: v } = await supabase.from('votes').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: o = [] } = await supabase.from('vote_options').select('*').in('vote_id', (v || []).map(x => x.id));
    const { data: r = [] } = await supabase.from('vote_responses').select('*').in('vote_id', (v || []).map(x => x.id));
    return (v || []).map(vote => ({ ...vote, vote_options: (o || []).filter(opt => opt.vote_id === vote.id).map(opt => ({ ...opt, vote_responses: (r || []).filter(res => res.option_ids?.includes(opt.id)) })) }));
  }, enabled: roomIds.length > 0 });

  const noticesQuery = useQuery({ queryKey: ['notices', roomIds], queryFn: async () => {
    const { data: n } = await supabase.from('notices').select('*').in('room_id', roomIds);
    const { data: c } = await supabase.from('notice_comments').select('*').in('notice_id', (n || []).map(x => x.id)).order('created_at', { ascending: true });
    return (n || []).map(notice => ({ ...notice, notice_comments: (c || []).filter(comment => comment.notice_id === notice.id) }));
  }, enabled: roomIds.length > 0 });

  const formationsQuery = useQuery({ queryKey: ['formations', roomIds], queryFn: async () => {
    const { data: remote } = await supabase.from('formations').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const localRaw = await AsyncStorage.getItem('local_formations');
    const local = localRaw ? JSON.parse(localRaw) : [];
    const mappedRemote = (remote || []).map(form => ({ id: form.id, roomId: form.room_id, userId: form.user_id, title: form.title, audioUrl: form.audio_url, settings: form.settings, data: form.data, createdAt: new Date(form.created_at).getTime(), isLocal: false })) as Formation[];
    const filteredLocal = local.filter((f: any) => roomIds.includes(f.roomId)).map((f: any) => ({ ...f, isLocal: true }));
    return [...filteredLocal, ...mappedRemote] as Formation[];
  }, enabled: roomIds.length > 0 });

  // --- Mappings ---
  const noticesMapped: Notice[] = (noticesQuery.data || []).map(n => ({
    id: n.id, roomId: n.room_id, userId: n.user_id, title: n.title, content: n.content, isPinned: n.is_pinned, useNotification: n.use_notification, imageUrls: n.image_urls || [], viewedBy: n.viewed_by || [], createdAt: new Date(n.created_at).getTime(),
    comments: (n.notice_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() }))
  })).sort((a, b) => (a.isPinned === b.isPinned) ? b.createdAt - a.createdAt : (a.isPinned ? -1 : 1));

  const videosMapped: VideoFeedback[] = (videosQuery.data || []).map(v => ({ id: v.id, roomId: v.room_id, userId: v.user_id, videoUrl: v.storage_path || v.youtube_url, title: v.title, useNotification: v.use_notification, createdAt: new Date(v.created_at).getTime(), comments: (v.video_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, timestampMillis: c.timestamp_millis, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() })) }));
  const photosMapped: Photo[] = (photosQuery.data || []).map(p => ({ id: p.id, roomId: p.room_id, userId: p.user_id, photoUrl: p.file_path, description: p.description, useNotification: p.use_notification, createdAt: new Date(p.created_at).getTime(), comments: (p.gallery_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() })) }));
  const schedulesMapped: Schedule[] = (schedulesQuery.data || []).map(s => {
    const resp: Record<string, string[]> = {}; (s.schedule_options || []).forEach((o: any) => (o.schedule_responses || []).forEach((r: any) => { if (!resp[r.user_id]) resp[r.user_id] = []; if (!resp[r.user_id].includes(o.id)) resp[r.user_id].push(o.id); }));
    return { id: s.id, roomId: s.room_id, userId: s.user_id, title: s.title, options: (s.schedule_options || []).map((o:any)=>({id:o.id, dateTime: o.date_time})), responses: resp, viewedBy: s.viewed_by || [], useNotification: s.use_notification, deadline: s.deadline ? new Date(s.deadline).getTime() : undefined, createdAt: new Date(s.created_at).getTime() };
  });
  const votesMapped: Vote[] = (votesQuery.data || []).map(v => {
    const resp: Record<string, string[]> = {}; (v.vote_options || []).forEach((o: any) => (o.vote_responses || []).forEach((r: any) => { if (!resp[r.user_id]) resp[r.user_id] = []; if (!resp[r.user_id].includes(o.id)) resp[r.user_id].push(o.id); }));
    return { id: v.id, roomId: v.room_id, userId: v.user_id, question: v.question, isAnonymous: v.is_anonymous, allowMultiple: v.allow_multiple, options: (v.vote_options || []).map((o:any)=>({id:o.id, text: o.text})), responses: resp, viewedBy: v.viewed_by || [], useNotification: v.use_notification, deadline: v.deadline ? new Date(v.deadline).getTime() : undefined, createdAt: new Date(v.created_at).getTime(), comments: [] };
  });

  // --- Handlers ---
  const login = async (e: string, p: string) => { await supabase.auth.signInWithPassword({ email: e, password: p }); };
  const logout = async () => { setCurrentUser(null); await supabase.auth.signOut(); queryClient.clear(); };
  const updateUserProfile = async (n: string, i?: string) => { let final = i; if (i && !i.startsWith('http')) final = await storageService.uploadProfileImage('user', currentUser!.id, i); await supabase.from('profiles').update({ name: n, profile_image: final }).eq('id', currentUser!.id); await fetchMyProfile(currentUser!.id); refreshAllData(); };
  const createRoom = async (n: string, p: string, i?: string) => { const room = await roomService.createRoom(n, p, currentUser!.id, i); refreshAllData(); return room; };
  const joinRoom = async (rid: string, pc: string) => { const room = await roomService.joinRoom(rid, pc, currentUser!.id); if (room) refreshAllData(); return room; };
  const deleteRoom = async (id: string) => { await roomService.deleteRoom(id); refreshAllData(); };
  
  const addNotice = async (rid: string, t: string, c: string, p = false, imgs: string[] = [], useNoti = true) => { await contentService.addNotice(rid, currentUser!.id, t, c, p, imgs, useNoti); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 공지사항', t); refreshAllData(); };
  const updateNotice = async (id: string, updates: Partial<Notice>) => { await contentService.updateNotice(id, { title: updates.title, content: updates.content, is_pinned: updates.isPinned, image_urls: updates.imageUrls }); refreshAllData(); };
  const deleteNotice = async (id: string) => { await contentService.deleteNotice(id); refreshAllData(); };
  const addNoticeComment = async (nid: string, t: string, pid?: string) => { await contentService.addNoticeComment(nid, currentUser!.id, t, pid); const notice = noticesMapped.find(n => n.id === nid); if (notice && notice.userId !== currentUser!.id) sendPushNotification([notice.userId], '공지에 새로운 댓글', t); refreshAllData(); };
  const updateNoticeComment = async (id: string, t: string) => { await contentService.updateNoticeComment(id, t); refreshAllData(); };
  const deleteNoticeComment = async (id: string) => { await contentService.deleteNoticeComment(id); refreshAllData(); };

  const addVideo = async (rid: string, url: string, t: string, useNoti = true) => { await contentService.addVideo(rid, currentUser!.id, url, t, useNoti); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 피드백 영상', t); refreshAllData(); };
  const updateVideo = async (id: string, t: string) => { await contentService.updateVideo(id, t); refreshAllData(); };
  const deleteVideo = async (id: string) => { await contentService.deleteVideo(id); refreshAllData(); };
  const addComment = async (vid: string, t: string, ts: number, pid?: string) => { await contentService.addVideoComment(vid, currentUser!.id, t, ts, pid); const video = videosMapped.find(v => v.id === vid); if (video && video.userId !== currentUser!.id) sendPushNotification([video.userId], '영상에 새로운 피드백', t); refreshAllData(); };
  const updateComment = async (id: string, t: string) => { await contentService.updateVideoComment(id, t); refreshAllData(); };
  const deleteComment = async (id: string) => { await contentService.deleteVideoComment(id); refreshAllData(); };

  const addPhoto = async (rid: string, url: string, d?: string, useNoti = true) => { await storageService.uploadToGallery(rid, currentUser!.id, url, d); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 아카이브', d || '새로운 사진'); refreshAllData(); };
  const updatePhoto = async (id: string, d: string) => { await contentService.updatePhoto(id, d); refreshAllData(); };
  const deletePhoto = async (id: string) => { await contentService.deletePhoto(id); refreshAllData(); };
  const addPhotoComment = async (phid: string, t: string, pid?: string) => { await contentService.addPhotoComment(phid, currentUser!.id, t, pid); const photo = photosMapped.find(p => p.id === phid); if (photo && photo.userId !== currentUser!.id) sendPushNotification([photo.userId], '아카이브에 새로운 댓글', t); refreshAllData(); };
  const updatePhotoComment = async (id: string, t: string) => { await contentService.updatePhotoComment(id, t); refreshAllData(); };
  const deletePhotoComment = async (id: string) => { await contentService.deletePhotoComment(id); refreshAllData(); };

  const addVote = async (rid: string, q: string, opts: string[], s: any) => { const { data: v } = await contentService.addVote(rid, currentUser!.id, q, s.isAnonymous, s.allowMultiple, s.useNotification ?? true, s.deadline ? new Date(s.deadline).toISOString() : undefined); if (v) await contentService.addVoteOptions(v.id, opts); if (s.useNotification !== false) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 투표', q); refreshAllData(); };
  const updateVote = async (id: string, updates: Partial<Vote>) => { await contentService.updateVote(id, { question: updates.question, deadline: updates.deadline ? new Date(updates.deadline).toISOString() : undefined }); refreshAllData(); };
  const respondToVote = async (vid: string, oids: string[]) => { await contentService.respondToVote(vid, currentUser!.id, oids); refreshAllData(); };
  const deleteVote = async (id: string) => { await contentService.deleteVote(id); refreshAllData(); };

  const addSchedule = async (rid: string, t: string, opts: string[], useNoti = true, dl?: number) => { const { data: s } = await contentService.addSchedule(rid, currentUser!.id, t, useNoti, dl ? new Date(dl).toISOString() : undefined); if (s) await contentService.addScheduleOptions(s.id, opts); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 일정 투표', t); refreshAllData(); };
  const updateSchedule = async (id: string, updates: Partial<Schedule>) => { await contentService.updateSchedule(id, { title: updates.title, deadline: updates.deadline ? new Date(updates.deadline).toISOString() : undefined }); refreshAllData(); };
  const respondToSchedule = async (sid: string, oids: string[]) => { await contentService.respondToSchedule(sid, currentUser!.id, oids); refreshAllData(); };
  const deleteSchedule = async (id: string) => { await contentService.deleteSchedule(id); refreshAllData(); };

  const markItemAsAccessed = async (type: string, id: string) => { await supabase.from(type === 'video' ? 'videos' : 'gallery_items').update({ last_accessed_at: new Date() }).eq('id', id); };

  const addFormation = async (rid: string, title: string, audioUrl?: string, settings?: any, data?: any) => { if (!currentUser?.id) throw new Error('로그인이 필요합니다.'); const newId = Math.random().toString(36).substr(2, 9); const newFormation: Formation = { id: newId, roomId: rid, userId: currentUser.id, title, audioUrl, settings: settings || { gridRows: 10, gridCols: 20, stageDirection: 'top', snapToGrid: true }, data: data || { dancers: [], scenes: [], timeline: [] }, createdAt: Date.now() }; const localRaw = await AsyncStorage.getItem('local_formations'); const local = localRaw ? JSON.parse(localRaw) : []; await AsyncStorage.setItem('local_formations', JSON.stringify([...local, newFormation])); refreshAllData(); return newId; };
  const updateFormation = async (fid: string, updates: Partial<Formation>) => { const localRaw = await AsyncStorage.getItem('local_formations'); if (localRaw) { const local = JSON.parse(localRaw); if (local.some((f: any) => f.id === fid)) { await AsyncStorage.setItem('local_formations', JSON.stringify(local.map((f: any) => f.id === fid ? { ...f, ...updates } : f))); refreshAllData(); return; } } await contentService.updateRemoteFormation(fid, updates); refreshAllData(); };
  const deleteFormation = async (fid: string) => { const localRaw = await AsyncStorage.getItem('local_formations'); if (localRaw) { const local = JSON.parse(localRaw); if (local.some((f: any) => f.id === fid)) { await AsyncStorage.setItem('local_formations', JSON.stringify(local.filter((f: any) => f.id !== fid))); refreshAllData(); return; } } await contentService.deleteRemoteFormation(fid); refreshAllData(); };
  const publishFormationAsFeedback = async (roomId: string, formationId: string, title: string, currentData?: any) => { let formation = formationsQuery.data?.find(f => f.id === formationId); const finalData = currentData?.data || formation?.data; const finalSettings = currentData?.settings || formation?.settings; const finalAudioUrl = currentData?.audioUrl || formation?.audioUrl; if (!finalData) throw new Error('동선 정보를 찾을 수 없습니다.'); const { data: remote, error } = await contentService.publishFormation(roomId, currentUser!.id, title, finalAudioUrl, finalSettings, finalData); if (error) throw error; await addVideo(roomId, `formation://${remote.id}`, `[동선] ${title}`); refreshAllData(); };

  return (
    <AppContext.Provider value={{
      currentUser, isLoadingUser, login, updateUserProfile, logout,
      rooms: roomsData, isLoadingRooms, users: allUsers, getUserById, getRoomByIdRemote: roomService.getRoomByIdRemote, createRoom, joinRoom, deleteRoom,
      notices: noticesMapped, addNotice, updateNotice, deleteNotice, addNoticeComment, updateNoticeComment, deleteNoticeComment,
      videos: videosMapped, addVideo, updateVideo, deleteVideo, addComment, updateComment, deleteComment,
      photos: photosMapped, addPhoto, updatePhoto, deletePhoto, addPhotoComment, updatePhotoComment, deletePhotoComment, markItemAsAccessed,
      schedules: schedulesMapped, addSchedule, updateSchedule, respondToSchedule, deleteSchedule,
      votes: votesMapped, addVote, updateVote, respondToVote, deleteVote,
      formations: formationsQuery.data || [], addFormation, updateFormation, deleteFormation, publishFormationAsFeedback,
      refreshAllData, themeType, setThemeType, theme,
      updateRoomUserProfile, getRoomUserProfile, roomProfiles
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within an AppProvider");
  return context;
};
