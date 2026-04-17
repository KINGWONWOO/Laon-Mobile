import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { User, Room, Notice, VideoFeedback, Photo, Schedule, Vote, ThemeType, Formation, FormationScene, TimelineEntry, Dancer, Position, FormationSettings } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { storageService } from '../services/storageService';
import { contentService } from '../services/contentService';
import { getThemeColors } from '../constants/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface AppContextType {
  currentUser: User | null;
  isLoadingUser: boolean;
  login: (email: string, pass: string) => Promise<void>;
  updateUserProfile: (name: string, image?: string) => Promise<void>;
  logout: () => Promise<void>;
  
  rooms: Room[];
  isLoadingRooms: boolean;
  users: User[];
  getUserById: (id: string) => User | undefined;
  getRoomByIdRemote: (id: string) => Promise<any>;
  createRoom: (name: string, passcode: string, image?: string) => Promise<any>;
  joinRoom: (roomId: string, passcode: string) => Promise<any>;
  updateRoom: (roomId: string, name: string, image?: string | null) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;

  notices: Notice[];
  addNotice: (rid: string, t: string, c: string, p?: boolean, imgs?: string[], useNoti?: boolean) => Promise<void>;
  updateNotice: (id: string, updates: Partial<Notice>) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
  addNoticeComment: (nid: string, t: string, pid?: string) => Promise<void>;
  updateNoticeComment: (id: string, t: string) => Promise<void>;
  deleteNoticeComment: (id: string) => Promise<void>;

  videos: VideoFeedback[];
  addVideo: (rid: string, url: string, t: string, useNoti?: boolean) => Promise<void>;
  updateVideo: (id: string, t: string) => Promise<void>;
  deleteVideo: (id: string) => Promise<void>;
  addComment: (vid: string, t: string, ts: number, pid?: string) => Promise<void>;
  updateComment: (id: string, t: string) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;

  photos: Photo[];
  addPhoto: (rid: string, url: string, d?: string, useNoti?: boolean) => Promise<void>;
  updatePhoto: (id: string, d: string) => Promise<void>;
  deletePhoto: (id: string, url: string) => Promise<void>;
  addPhotoComment: (phid: string, t: string, pid?: string) => Promise<void>;
  updatePhotoComment: (id: string, t: string) => Promise<void>;
  deletePhotoComment: (id: string) => Promise<void>;
  markItemAsAccessed: (type: string, id: string) => Promise<void>;

  schedules: Schedule[];
  addSchedule: (rid: string, t: string, opts: string[], useNoti?: boolean, dl?: number, reminderMinutes?: number) => Promise<void>;
  updateSchedule: (id: string, updates: Partial<Schedule>) => Promise<void>;
  respondToSchedule: (sid: string, oids: string[]) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  closeSchedule: (id: string) => Promise<void>;

  votes: Vote[];
  addVote: (rid: string, q: string, opts: string[], settings: any) => Promise<void>;
  updateVote: (id: string, updates: Partial<Vote>) => Promise<void>;
  respondToVote: (vid: string, oids: string[]) => Promise<void>;
  deleteVote: (id: string) => Promise<void>;
  closeVote: (id: string) => Promise<void>;

  formations: Formation[];
  addFormation: (rid: string, title: string, audioUrl?: string, settings?: any, data?: any) => Promise<string>;
  updateFormation: (fid: string, updates: Partial<Formation>) => Promise<void>;
  deleteFormation: (fid: string) => Promise<void>;
  publishFormationAsFeedback: (roomId: string, formationId: string, title: string, currentData?: any) => Promise<void>;

  refreshAllData: () => Promise<void>;
  themeType: ThemeType;
  setThemeType: (type: ThemeType) => Promise<void>;
  customColor: string;
  setCustomColor: (color: string) => Promise<void>;
  customBackgroundColor: string;
  setCustomBackgroundColor: (color: string) => Promise<void>;
  theme: any;
  updateRoomUserProfile: (roomId: string, name: string, profileImage: string | null) => Promise<void>;
  getRoomUserProfile: (roomId: string, userId: string) => { name: string, profileImage: string | null } | null;
  roomProfiles: Record<string, { name: string, profileImage: string | null }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [themeType, setThemeTypeState] = useState<ThemeType>('light');
  const [customColor, setCustomColorState] = useState('#6366F1');
  const [customBackgroundColor, setCustomBackgroundColorState] = useState('#F8FAFC');
  const [roomProfiles, setRoomProfiles] = useState<Record<string, { name: string, profileImage: string | null }>>({});
  const [queryVersion, setQueryVersion] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem('theme_type').then(val => { if (val) setThemeTypeState(val as ThemeType); });
    AsyncStorage.getItem('theme_custom_color').then(val => { if (val) setCustomColorState(val); });
    AsyncStorage.getItem('theme_custom_bg_color').then(val => { if (val) setCustomBackgroundColorState(val); });
    AsyncStorage.getItem('room_profiles').then(val => { if (val) setRoomProfiles(JSON.parse(val)); });
  }, []);

  const setThemeType = async (type: ThemeType) => {
    setThemeTypeState(type);
    await AsyncStorage.setItem('theme_type', type);
  };

  const setCustomColor = async (color: string) => {
    setCustomColorState(color);
    await AsyncStorage.setItem('theme_custom_color', color);
  };

  const setCustomBackgroundColor = async (color: string) => {
    setCustomBackgroundColorState(color);
    await AsyncStorage.setItem('theme_custom_bg_color', color);
  };

  const updateRoomUserProfile = async (roomId: string, name: string, profileImage: string | null) => {
    const key = `${roomId}_${currentUser?.id}`;
    const newProfiles = { ...roomProfiles, [key]: { name, profileImage } };
    setRoomProfiles(newProfiles);
    await AsyncStorage.setItem('room_profiles', JSON.stringify(newProfiles));
  };

  const getRoomUserProfile = (roomId: string, userId: string) => roomProfiles[`${roomId}_${userId}`] || null;

  const theme = getThemeColors(themeType, customColor, customBackgroundColor);

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
      if (session) fetchMyProfile(session.user.id);
      setIsLoadingUser(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchMyProfile(session.user.id);
      else setCurrentUser(null);
      setIsLoadingUser(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['profiles', queryVersion],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name, profile_image');
      return (data || []).map(u => ({ id: u.id, name: u.name, profileImage: u.profile_image }));
    }
  });

  const getUserById = (id: string) => allUsers.find(u => u.id === id);

  const refreshAllData = useCallback(async () => {
    setQueryVersion(v => v + 1);
    await queryClient.invalidateQueries();
    await queryClient.refetchQueries();
  }, [queryClient]);

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('global-sync').on('postgres_changes', { event: '*', schema: 'public' }, () => refreshAllData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser, refreshAllData]);

  const { data: roomsData = [], isLoading: isLoadingRooms } = useQuery({
    queryKey: ['rooms', currentUser?.id, queryVersion],
    queryFn: async () => currentUser ? await roomService.getMyRooms(currentUser.id) : [],
    enabled: !!currentUser,
  });

  const roomIds = useMemo(() => roomsData.map(r => r.id), [roomsData]);

  const videosQuery = useQuery({ queryKey: ['videos', roomIds, queryVersion], queryFn: async () => {
    const { data: v } = await supabase.from('videos').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: c } = await supabase.from('video_comments').select('*').in('video_id', (v || []).map(x => x.id)).order('created_at', { ascending: true });
    return (v || []).map(video => ({ ...video, video_comments: (c || []).filter(comment => comment.video_id === video.id) }));
  }, enabled: roomIds.length > 0 });

  const photosQuery = useQuery({ queryKey: ['photos', roomIds, queryVersion], queryFn: async () => {
    const { data: p } = await supabase.from('gallery_items').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: c } = await supabase.from('gallery_comments').select('*').in('gallery_item_id', (p || []).map(x => x.id)).order('created_at', { ascending: true });
    return (p || []).map(photo => ({ ...photo, gallery_comments: (c || []).filter(comment => comment.gallery_item_id === photo.id) }));
  }, enabled: roomIds.length > 0 });

  const schedulesQuery = useQuery({ queryKey: ['schedules', roomIds, queryVersion], queryFn: async () => {
    const { data: s } = await supabase.from('schedules').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: o } = await supabase.from('schedule_options').select('*').in('schedule_id', (s || []).map(x => x.id));
    const { data: r = [] } = await supabase.from('schedule_responses').select('*').in('schedule_id', (s || []).map(x => x.id));
    return (s || []).map(sch => ({ ...sch, schedule_options: (o || []).filter(opt => opt.schedule_id === sch.id).map(opt => ({ ...opt, schedule_responses: (r || []).filter(res => res.option_ids?.includes(opt.id)) })) }));
  }, enabled: roomIds.length > 0 });

  const votesQuery = useQuery({ queryKey: ['votes', roomIds, queryVersion], queryFn: async () => {
    const { data: v } = await supabase.from('votes').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: o = [] } = await supabase.from('vote_options').select('*').in('vote_id', (v || []).map(x => x.id));
    const { data: r = [] } = await supabase.from('vote_responses').select('*').in('vote_id', (v || []).map(x => x.id));
    return (v || []).map(vote => ({ ...vote, vote_options: (o || []).filter(opt => opt.vote_id === vote.id).map(opt => ({ ...opt, vote_responses: (r || []).filter(res => res.option_ids?.includes(opt.id)) })) }));
  }, enabled: roomIds.length > 0 });

  const noticesQuery = useQuery({ queryKey: ['notices', roomIds, queryVersion], queryFn: async () => {
    const { data: n } = await supabase.from('notices').select('*').in('room_id', roomIds);
    const { data: c = [] } = await supabase.from('notice_comments').select('*').in('notice_id', (n || []).map(x => x.id)).order('created_at', { ascending: true });
    return (n || []).map(notice => ({ ...notice, notice_comments: (c || []).filter(comment => comment.notice_id === notice.id) }));
  }, enabled: roomIds.length > 0 });

  const formationsQuery = useQuery({ queryKey: ['formations', roomIds, queryVersion], queryFn: async () => {
    const { data: remote } = await supabase.from('formations').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const localRaw = await AsyncStorage.getItem('local_formations');
    const local = localRaw ? JSON.parse(localRaw) : [];
    const mappedRemote = (remote || []).map(form => ({ id: form.id, roomId: form.room_id, userId: form.user_id, title: form.title, audioUrl: form.audio_url, settings: form.settings, data: form.data, createdAt: new Date(form.created_at).getTime(), isLocal: false })) as Formation[];
    const filteredLocal = local.filter((f: any) => roomIds.includes(f.roomId)).map((f: any) => ({ ...f, isLocal: true }));
    return [...filteredLocal, ...mappedRemote] as Formation[];
  }, enabled: roomIds.length > 0 });

  const noticesMapped: Notice[] = (noticesQuery.data || []).map(n => ({
    id: n.id, roomId: n.room_id, userId: n.user_id, title: n.title, content: n.content, isPinned: n.is_pinned, useNotification: n.use_notification, imageUrls: n.image_urls || [], viewedBy: n.viewed_by || [], createdAt: new Date(n.created_at).getTime(),
    comments: (n.notice_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() }))
  })).sort((a, b) => (a.isPinned === b.isPinned) ? b.createdAt - a.createdAt : (a.isPinned ? -1 : 1));

  const videosMapped: VideoFeedback[] = (videosQuery.data || []).map(v => ({ id: v.id, roomId: v.room_id, userId: v.user_id, videoUrl: v.storage_path || v.youtube_url, title: v.title, useNotification: v.use_notification, createdAt: new Date(v.created_at).getTime(), comments: (v.video_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, timestampMillis: c.timestamp_millis, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() })) }));
  const photosMapped: Photo[] = (photosQuery.data || []).map(p => ({ id: p.id, roomId: p.room_id, userId: p.user_id, photoUrl: p.file_path, description: p.description, useNotification: p.use_notification, createdAt: new Date(p.created_at).getTime(), comments: (p.gallery_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() })) }));
  const schedulesMapped: Schedule[] = (schedulesQuery.data || []).map(s => {
    const resp: Record<string, string[]> = {}; (s.schedule_options || []).forEach((o: any) => (o.schedule_responses || []).forEach((r: any) => { if (!resp[r.user_id]) resp[r.user_id] = []; if (!resp[r.user_id].includes(o.id)) resp[r.user_id].push(o.id); }));
    return { id: s.id, roomId: s.room_id, userId: s.user_id, title: s.title, options: (s.schedule_options || []).map((o:any)=>({id:o.id, dateTime: o.date_time})), responses: resp, viewedBy: s.viewed_by || [], useNotification: s.use_notification, reminderMinutes: s.reminder_before, deadline: s.deadline ? new Date(s.deadline).getTime() : undefined, createdAt: new Date(s.created_at).getTime() };
  });
  const votesMapped: Vote[] = (votesQuery.data || []).map(v => {
    const resp: Record<string, string[]> = {}; (v.vote_options || []).forEach((o: any) => (v.vote_responses || []).forEach((r: any) => { if (!resp[r.user_id]) resp[r.user_id] = []; if (!resp[r.user_id].includes(o.id)) resp[r.user_id].push(o.id); }));
    return { id: v.id, roomId: v.room_id, userId: v.user_id, question: v.question, isAnonymous: v.is_anonymous, allowMultiple: v.allow_multiple, options: (v.vote_options || []).map((o:any)=>({id:o.id, text: o.text})), responses: resp, viewedBy: v.viewed_by || [], useNotification: v.use_notification, reminderMinutes: v.reminder_before, deadline: v.deadline ? new Date(v.deadline).getTime() : undefined, createdAt: new Date(v.created_at).getTime(), comments: [] };
  });

  const login = async (e: string, p: string) => { await supabase.auth.signInWithPassword({ email: e, password: p }); };
  const logout = async () => { setCurrentUser(null); await supabase.auth.signOut(); queryClient.clear(); };
  const updateUserProfile = async (n: string, i?: string) => { 
    let final = i; 
    if (i && !i.startsWith('http')) final = await storageService.uploadProfileImage('user', currentUser!.id, i); 
    await supabase.from('profiles').update({ name: n, profile_image: final }).eq('id', currentUser!.id); 
    setCurrentUser(prev => prev ? { ...prev, name: n, profileImage: final || null } : null);
    await refreshAllData(); 
  };
  const createRoom = async (n: string, p: string, i?: string) => { const room = await roomService.createRoom(n, p, currentUser!.id, i); await refreshAllData(); return room; };
  const joinRoom = async (rid: string, pc: string) => { const room = await roomService.joinRoom(rid, pc, currentUser!.id); if (room) await refreshAllData(); return room; };
  const updateRoom = async (rid: string, n: string, i?: string | null) => { await roomService.updateRoom(rid, n, i); await refreshAllData(); };
  const deleteRoom = async (id: string) => { await roomService.deleteRoom(id); await refreshAllData(); };
  
  const addNotice = async (rid: string, t: string, c: string, p = false, imgs: string[] = [], useNoti = true) => { await contentService.addNotice(rid, currentUser!.id, t, c, p, imgs, useNoti); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 공지사항', t); await refreshAllData(); };
  const updateNotice = async (id: string, updates: Partial<Notice>) => { await contentService.updateNotice(id, { title: updates.title, content: updates.content, is_pinned: updates.isPinned, image_urls: updates.imageUrls }); await refreshAllData(); };
  const deleteNotice = async (id: string) => { await contentService.deleteNotice(id); await refreshAllData(); };
  const addNoticeComment = async (nid: string, t: string, pid?: string) => { await contentService.addNoticeComment(nid, currentUser!.id, t, pid); const notice = noticesMapped.find(n => n.id === nid); if (notice && notice.userId !== currentUser!.id) sendPushNotification([notice.userId], '공지에 새로운 댓글', t); await refreshAllData(); };
  const updateNoticeComment = async (id: string, t: string) => { await contentService.updateNoticeComment(id, t); await refreshAllData(); };
  const deleteNoticeComment = async (id: string) => { await contentService.deleteNoticeComment(id); await refreshAllData(); };

  const addVideo = async (rid: string, url: string, t: string, useNoti = true) => { await contentService.addVideo(rid, currentUser!.id, url, t, useNoti); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 피드백 영상', t); await refreshAllData(); };
  const updateVideo = async (id: string, t: string) => { await contentService.updateVideo(id, t); await refreshAllData(); };
  const deleteVideo = async (id: string) => { await contentService.deleteVideo(id); await refreshAllData(); };
  const addComment = async (vid: string, t: string, ts: number, pid?: string) => { await contentService.addVideoComment(vid, currentUser!.id, t, ts, pid); const video = videosMapped.find(v => v.id === vid); if (video && video.userId !== currentUser!.id) sendPushNotification([video.userId], '영상에 새로운 피드백', t); await refreshAllData(); };
  const updateComment = async (id: string, t: string) => { await contentService.updateVideoComment(id, t); await refreshAllData(); };
  const deleteComment = async (id: string) => { await contentService.deleteVideoComment(id); await refreshAllData(); };

  const addPhoto = async (rid: string, url: string, d?: string, useNoti = true) => { await storageService.uploadToGallery(rid, currentUser!.id, url, d); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 아카이브', d || '새로운 사진'); await refreshAllData(); };
  const updatePhoto = async (id: string, d: string) => { await contentService.updatePhoto(id, d); await refreshAllData(); };
  const deletePhoto = async (id: string) => { await contentService.deletePhoto(id); await refreshAllData(); };
  const addPhotoComment = async (phid: string, t: string, pid?: string) => { await contentService.addPhotoComment(phid, currentUser!.id, t, pid); const photo = photosMapped.find(p => p.id === phid); if (photo && photo.userId !== currentUser!.id) sendPushNotification([photo.userId], '아카이브에 새로운 댓글', t); await refreshAllData(); };
  const updatePhotoComment = async (id: string, t: string) => { await contentService.updatePhotoComment(id, t); await refreshAllData(); };
  const deletePhotoComment = async (id: string) => { await contentService.deletePhotoComment(id); await refreshAllData(); };

  const addVote = async (rid: string, q: string, opts: string[], s: any) => { 
    const { data: v, error } = await contentService.addVote(rid, currentUser!.id, q, s.isAnonymous, s.allowMultiple, s.useNotification ?? true, s.deadline ? new Date(s.deadline).toISOString() : undefined, s.reminderMinutes); 
    if (error) throw error;
    if (v) {
      const { error: oError } = await contentService.addVoteOptions(v.id, opts);
      if (oError) throw oError;
    }
    if (s.useNotification !== false) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 투표', q); 
    await refreshAllData(); 
  };
  const updateVote = async (id: string, updates: Partial<Vote>) => { await contentService.updateVote(id, { question: updates.question, deadline: updates.deadline ? new Date(updates.deadline).toISOString() : undefined, use_notification: updates.useNotification, reminder_before: updates.reminderMinutes }); await refreshAllData(); };
  const closeVote = async (id: string) => { await updateVote(id, { deadline: Date.now() }); const vote = votesMapped.find(v => v.id === id); if (vote) sendPushNotification((roomsData.find(r=>r.id===vote.roomId)?.members || []).filter(uid=>uid!==currentUser?.id), '투표 종료', `"${vote.question}" 투표가 종료되었습니다.`); await refreshAllData(); };
  const respondToVote = async (vid: string, oids: string[]) => { await contentService.respondToVote(vid, currentUser!.id, oids); await refreshAllData(); };
  const deleteVote = async (id: string) => { await contentService.deleteVote(id); await refreshAllData(); };

  const addSchedule = async (rid: string, t: string, opts: string[], useNoti = true, dl?: number, reminderMinutes?: number) => { 
    const { data: s, error } = await contentService.addSchedule(rid, currentUser!.id, t, useNoti, dl ? new Date(dl).toISOString() : undefined, reminderMinutes); 
    if (error) throw error;
    if (s) {
      const { error: oError } = await contentService.addScheduleOptions(s.id, opts);
      if (oError) throw oError;
    }
    if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 일정 조율', t); 
    await refreshAllData(); 
  };
  const updateSchedule = async (id: string, updates: Partial<Schedule>) => { await contentService.updateSchedule(id, { title: updates.title, deadline: updates.deadline ? new Date(updates.deadline).toISOString() : undefined, use_notification: updates.useNotification, reminder_before: updates.reminderMinutes }); await refreshAllData(); };
  const closeSchedule = async (id: string) => { await updateSchedule(id, { deadline: Date.now() }); const sch = schedulesMapped.find(s => s.id === id); if (sch) sendPushNotification((roomsData.find(r=>r.id===sch.roomId)?.members || []).filter(uid=>uid!==currentUser?.id), '일정 조율 종료', `"${sch.title}" 일정 조율이 종료되었습니다.`); await refreshAllData(); };
  const respondToSchedule = async (sid: string, oids: string[]) => { await contentService.respondToSchedule(sid, currentUser!.id, oids); await refreshAllData(); };
  const deleteSchedule = async (id: string) => { await contentService.deleteSchedule(id); await refreshAllData(); };

  const markItemAsAccessed = async (type: string, id: string) => { await supabase.from(type === 'video' ? 'videos' : 'gallery_items').update({ last_accessed_at: new Date() }).eq('id', id); };

  const addFormation = async (rid: string, title: string, audioUrl?: string, settings?: any, data?: any) => { if (!currentUser?.id) throw new Error('로그인이 필요합니다.'); const newId = Math.random().toString(36).substr(2, 9); const newFormation: Formation = { id: newId, roomId: rid, userId: currentUser.id, title, audioUrl, settings: settings || { gridRows: 10, gridCols: 20, stageDirection: 'top', snapToGrid: true }, data: data || { dancers: [], scenes: [], timeline: [] }, createdAt: Date.now() }; const localRaw = await AsyncStorage.getItem('local_formations'); const local = localRaw ? JSON.parse(localRaw) : []; await AsyncStorage.setItem('local_formations', JSON.stringify([...local, newFormation])); await refreshAllData(); return newId; };
  const updateFormation = async (fid: string, updates: Partial<Formation>) => { const localRaw = await AsyncStorage.getItem('local_formations'); if (localRaw) { const local = JSON.parse(localRaw); if (local.some((f: any) => f.id === fid)) { await AsyncStorage.setItem('local_formations', JSON.stringify(local.map((f: any) => f.id === fid ? { ...f, ...updates } : f))); await refreshAllData(); return; } } await contentService.updateRemoteFormation(fid, updates); await refreshAllData(); };
  const deleteFormation = async (fid: string) => { const localRaw = await AsyncStorage.getItem('local_formations'); if (localRaw) { const local = JSON.parse(localRaw); if (local.some((f: any) => f.id === fid)) { await AsyncStorage.setItem('local_formations', JSON.stringify(local.filter((f: any) => f.id !== fid))); await refreshAllData(); return; } } await contentService.deleteRemoteFormation(fid); await refreshAllData(); };
  const publishFormationAsFeedback = async (roomId: string, formationId: string, title: string, currentData?: any) => { let formation = formationsQuery.data?.find(f => f.id === formationId); const finalData = currentData?.data || formation?.data; const finalSettings = currentData?.settings || formation?.settings; const finalAudioUrl = currentData?.audioUrl || formation?.audioUrl; if (!finalData) throw new Error('동선 정보를 찾을 수 없습니다.'); const { data: remote, error } = await contentService.publishFormation(roomId, currentUser!.id, title, finalAudioUrl, finalSettings, finalData); if (error) throw error; await addVideo(roomId, `formation://${remote.id}`, `[동선] ${title}`); await refreshAllData(); };

  return (
    <AppContext.Provider value={{
      currentUser, isLoadingUser, login, updateUserProfile, logout,
      rooms: roomsData, isLoadingRooms, users: allUsers, getUserById, getRoomByIdRemote: roomService.getRoomByIdRemote, createRoom, joinRoom, updateRoom, deleteRoom,
      notices: noticesMapped, addNotice, updateNotice, deleteNotice, addNoticeComment, updateNoticeComment, deleteNoticeComment,
      videos: videosMapped, addVideo, updateVideo, deleteVideo, addComment, updateComment, deleteComment,
      photos: photosMapped, addPhoto, updatePhoto, deletePhoto, addPhotoComment, updatePhotoComment, deletePhotoComment, markItemAsAccessed,
      schedules: schedulesMapped, addSchedule, updateSchedule, respondToSchedule, deleteSchedule, closeSchedule,
      votes: votesMapped, addVote, updateVote, respondToVote, deleteVote, closeVote,
      formations: formationsQuery.data || [], addFormation, updateFormation, deleteFormation, publishFormationAsFeedback,
      refreshAllData, themeType, setThemeType, customColor, setCustomColor, customBackgroundColor, setCustomBackgroundColor, theme,
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
