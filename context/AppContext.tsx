import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { User, Room, Notice, VideoFeedback, Photo, Schedule, Vote, ThemeType, Formation, UserSubscription } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { storageService } from '../services/storageService';
import { contentService } from '../services/contentService';
import { getThemeColors } from '../constants/theme';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Alert } from 'react-native';

interface AppContextType {
  currentUser: User | null;
  isLoadingUser: boolean;
  login: (email: string, pass: string) => Promise<void>;
  updateUserProfile: (name: string, image?: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  blockedUsers: string[];
  blockUser: (userId: string) => Promise<void>;
  reportContent: (id: string, type: string) => Promise<void>;
  rooms: Room[];  isLoadingRooms: boolean;
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
  isPro: boolean;
  purchasePro: () => Promise<void>;
  checkProAccess: (type: 'room_count' | 'archive_limit' | 'formation' | 'feedback_limit' | 'reminder') => { canAccess: boolean, limit?: number, current?: number };
  sendProReminder: (roomId: string, type: 'vote' | 'schedule', targetId: string) => Promise<void>;
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
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('theme_type').then(val => { if (val) setThemeTypeState(val as ThemeType); });
    AsyncStorage.getItem('theme_custom_color').then(val => { if (val) setCustomColorState(val); });
    AsyncStorage.getItem('theme_custom_bg_color').then(val => { if (val) setCustomBackgroundColorState(val); });
    AsyncStorage.getItem('room_profiles').then(val => { if (val) setRoomProfiles(JSON.parse(val)); });
    AsyncStorage.getItem('blocked_users').then(val => { if (val) setBlockedUsers(JSON.parse(val)); });
  }, []);

  const fetchMyProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error || !data) {
        setCurrentUser({ id: userId, name: '댄서', profileImage: null, subscription: { tier: 'free', isTrialUsed: false } });
        return;
      }
      setCurrentUser({ 
        id: data.id, 
        name: data.name || '댄서', 
        profileImage: data.profile_image,
        subscription: data.subscription_tier ? {
          tier: data.subscription_tier,
          startDate: data.subscription_start ? new Date(data.subscription_start).getTime() : undefined,
          expiryDate: data.subscription_expiry ? new Date(data.subscription_expiry).getTime() : undefined,
          isTrialUsed: data.is_trial_used || false
        } : { tier: 'free', isTrialUsed: false }
      });
    } catch (e) {
      console.error('[fetchMyProfile] Error:', e);
      setCurrentUser({ id: userId, name: '댄서', profileImage: null, subscription: { tier: 'free', isTrialUsed: false } });
    }
  };

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (session) {
        setIsLoadingUser(true);
        try {
          await fetchMyProfile(session.user.id);
        } finally {
          setIsLoadingUser(false);
        }
      } else {
        setCurrentUser(null);
        setIsLoadingUser(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const blockUser = async (userId: string) => {
    const newList = [...blockedUsers, userId];
    setBlockedUsers(newList);
    await AsyncStorage.setItem('blocked_users', JSON.stringify(newList));
  };

  const reportContent = async (id: string, type: string) => {
    Alert.alert('신고 접수', '부적절한 콘텐츠로 신고가 접수되었습니다.');
  };

  const setThemeType = async (type: ThemeType) => { setThemeTypeState(type); await AsyncStorage.setItem('theme_type', type); };
  const setCustomColor = async (color: string) => { setCustomColorState(color); await AsyncStorage.setItem('theme_custom_color', color); };
  const setCustomBackgroundColor = async (color: string) => { setCustomBackgroundColorState(color); await AsyncStorage.setItem('theme_custom_bg_color', color); };

  const updateRoomUserProfile = async (roomId: string, name: string, profileImage: string | null) => {
    const key = `${roomId}_${currentUser?.id}`;
    const newProfiles = { ...roomProfiles, [key]: { name, profileImage } };
    setRoomProfiles(newProfiles);
    await AsyncStorage.setItem('room_profiles', JSON.stringify(newProfiles));
  };

  const getRoomUserProfile = (roomId: string, userId: string) => roomProfiles[`${roomId}_${userId}`] || null;
  const theme = useMemo(() => getThemeColors(themeType, customColor, customBackgroundColor), [themeType, customColor, customBackgroundColor]);

  const sendPushNotification = async (userIds: string[], title: string, body: string, data?: any) => {
    if (!userIds.length) return;
    try { await supabase.functions.invoke('push-notification', { body: { user_ids: userIds, title, body, data } }); } catch (err) {}
  };

  const isPro = useMemo(() => {
    if (!currentUser?.subscription) return false;
    const { tier, expiryDate } = currentUser.subscription;
    return tier === 'pro' && (!expiryDate || expiryDate > Date.now());
  }, [currentUser]);

  const purchasePro = async () => {
    if (!currentUser) return;
    const now = Date.now();
    const nextMonth = now + (30 * 24 * 60 * 60 * 1000);
    const { error } = await supabase.from('profiles').update({ subscription_tier: 'pro', subscription_start: new Date(now).toISOString(), subscription_expiry: new Date(nextMonth).toISOString(), is_trial_used: true }).eq('id', currentUser.id);
    if (!error) await fetchMyProfile(currentUser.id);
  };

  const { data: allUsers = [] } = useQuery({ queryKey: ['profiles'], queryFn: async () => { const { data } = await supabase.from('profiles').select('id, name, profile_image'); return (data || []).map(u => ({ id: u.id, name: u.name, profileImage: u.profile_image })); }, placeholderData: keepPreviousData });
  const getUserById = (id: string) => allUsers.find(u => u.id === id);

  const refreshAllData = useCallback(async () => { await queryClient.invalidateQueries(); }, [queryClient]);

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('global-sync').on('postgres_changes', { event: '*', schema: 'public' }, () => refreshAllData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser, refreshAllData]);

  const { data: roomsData = [], isLoading: isLoadingRooms } = useQuery({ queryKey: ['rooms', currentUser?.id], queryFn: async () => currentUser ? await roomService.getMyRooms(currentUser.id) : [], enabled: !!currentUser, placeholderData: keepPreviousData });
  const roomIds = useMemo(() => roomsData.map(r => r.id), [roomsData]);

  const videosQuery = useQuery({ queryKey: ['videos', roomIds], queryFn: async () => { const { data: v } = await supabase.from('videos').select('*').in('room_id', roomIds).order('created_at', { ascending: false }); const { data: c } = await supabase.from('video_comments').select('*').in('video_id', (v || []).map(x => x.id)).order('created_at', { ascending: true }); return (v || []).map(video => ({ ...video, video_comments: (c || []).filter(comment => comment.video_id === video.id) })); }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });
  const photosQuery = useQuery({ queryKey: ['photos', roomIds], queryFn: async () => { const { data: p } = await supabase.from('gallery_items').select('*').in('room_id', roomIds).order('created_at', { ascending: false }); const { data: c = [] } = await supabase.from('gallery_comments').select('*').in('gallery_item_id', (p || []).map(x => x.id)).order('created_at', { ascending: true }); return (p || []).map(photo => ({ ...photo, gallery_comments: (c || []).filter(comment => comment.gallery_item_id === photo.id) })); }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });
  const schedulesQuery = useQuery({ queryKey: ['schedules', roomIds], queryFn: async () => { const { data: s } = await supabase.from('schedules').select('*').in('room_id', roomIds).order('created_at', { ascending: false }); const { data: o } = await supabase.from('schedule_options').select('*').in('schedule_id', (s || []).map(x => x.id)); const { data: r = [] } = await supabase.from('schedule_responses').select('*').in('schedule_id', (s || []).map(x => x.id)); return (s || []).map(sch => ({ ...sch, schedule_options: (o || []).filter(opt => opt.schedule_id === sch.id).map(opt => ({ ...opt, schedule_responses: (r || []).filter(res => res.option_ids?.includes(opt.id)) })) })); }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });
  const votesQuery = useQuery({ queryKey: ['votes', roomIds], queryFn: async () => { const { data: v } = await supabase.from('votes').select('*').in('room_id', roomIds).order('created_at', { ascending: false }); const { data: o = [] } = await supabase.from('vote_options').select('*').in('vote_id', (v || []).map(x => x.id)); const { data: r = [] } = await supabase.from('vote_responses').select('*').in('vote_id', (v || []).map(x => x.id)); return (v || []).map(vote => ({ ...vote, vote_options: (o || []).filter(opt => opt.vote_id === vote.id).map(opt => ({ ...opt, vote_responses: (r || []).filter(res => res.option_ids?.includes(opt.id)) })) })); }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });
  const noticesQuery = useQuery({ queryKey: ['notices', roomIds], queryFn: async () => { const { data: n } = await supabase.from('notices').select('*').in('room_id', roomIds); const { data: c = [] } = await supabase.from('notice_comments').select('*').in('notice_id', (n || []).map(x => x.id)).order('created_at', { ascending: true }); return (n || []).map(notice => ({ ...notice, notice_comments: (c || []).filter(comment => comment.notice_id === notice.id) })); }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });
  const formationsQuery = useQuery({ queryKey: ['formations', roomIds], queryFn: async () => { const { data: remote } = await supabase.from('formations').select('*').in('room_id', roomIds).order('created_at', { ascending: false }); const localRaw = await AsyncStorage.getItem('local_formations'); const local = localRaw ? JSON.parse(localRaw) : []; const mappedRemote = (remote || []).map(form => ({ id: form.id, roomId: form.room_id, userId: form.user_id, title: form.title, audioUrl: form.audio_url, settings: form.settings, data: form.data, createdAt: new Date(form.created_at).getTime(), isLocal: false })) as Formation[]; const filteredLocal = local.filter((f: any) => roomIds.includes(f.roomId)).map((f: any) => ({ ...f, isLocal: true })); return [...filteredLocal, ...mappedRemote] as Formation[]; }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });

  const noticesMapped: Notice[] = (noticesQuery.data || []).map(n => ({ id: n.id, roomId: n.room_id, userId: n.user_id, title: n.title, content: n.content, isPinned: n.is_pinned, useNotification: n.use_notification, imageUrls: n.image_urls || [], viewedBy: n.viewed_by || [], createdAt: new Date(n.created_at).getTime(), comments: (n.notice_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() })) })).filter(n => !blockedUsers.includes(n.userId)).sort((a, b) => (a.isPinned === b.isPinned) ? b.createdAt - a.createdAt : (a.isPinned ? -1 : 1));
  const videosMapped: VideoFeedback[] = (videosQuery.data || []).map(v => ({ id: v.id, roomId: v.room_id, userId: v.user_id, videoUrl: v.storage_path || v.youtube_url, title: v.title, useNotification: v.use_notification, createdAt: new Date(v.created_at).getTime(), comments: (v.video_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, timestampMillis: c.timestamp_millis, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() })).filter((c: any) => !blockedUsers.includes(c.userId)) })).filter(v => !blockedUsers.includes(v.userId));
  const photosMapped: Photo[] = (photosQuery.data || []).map(p => ({ id: p.id, roomId: p.room_id, userId: p.user_id, photoUrl: p.file_path, description: p.description, useNotification: p.use_notification, createdAt: new Date(p.created_at).getTime(), comments: (p.gallery_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() })).filter((c: any) => !blockedUsers.includes(c.userId)) })).filter(p => !blockedUsers.includes(p.userId));
  const schedulesMapped: Schedule[] = (schedulesQuery.data || []).map(s => { const resp: Record<string, string[]> = {}; (s.schedule_options || []).forEach((o: any) => (o.schedule_responses || []).forEach((r: any) => { if (!resp[r.user_id]) resp[r.user_id] = []; if (!resp[r.user_id].includes(o.id)) resp[r.user_id].push(o.id); })); return { id: s.id, roomId: s.room_id, userId: s.user_id, title: s.title, options: (s.schedule_options || []).map((o:any)=>({id:o.id, dateTime: o.date_time})), responses: resp, viewedBy: s.viewed_by || [], useNotification: s.use_notification, reminderMinutes: s.reminder_before, deadline: s.deadline ? new Date(s.deadline).getTime() : undefined, createdAt: new Date(s.created_at).getTime() }; }).filter(s => !blockedUsers.includes(s.userId));
  const votesMapped: Vote[] = (votesQuery.data || []).map(v => { const resp: Record<string, string[]> = {}; (v.vote_options || []).forEach((o: any) => (v.vote_responses || []).forEach((r: any) => { if (!resp[r.user_id]) resp[r.user_id] = []; if (!resp[r.user_id].includes(o.id)) resp[r.user_id].push(o.id); })); return { id: v.id, roomId: v.room_id, userId: v.user_id, question: v.question, isAnonymous: v.is_anonymous, allowMultiple: v.allow_multiple, options: (v.vote_options || []).map((o:any)=>({id:o.id, text: o.text})), responses: resp, viewedBy: v.viewed_by || [], useNotification: v.use_notification, reminderMinutes: v.reminder_before, deadline: v.deadline ? new Date(v.deadline).getTime() : undefined, createdAt: new Date(v.created_at).getTime(), comments: [] }; }).filter(v => !blockedUsers.includes(v.userId));

  const checkProAccess = (type: any) => {
    if (isPro) return { canAccess: true };
    const rData = queryClient.getQueryData(['rooms', currentUser?.id]) as any[] || [];
    switch (type) {
      case 'room_count': return { canAccess: rData.length < 3, limit: 3, current: rData.length };
      case 'archive_limit': return { canAccess: false, limit: 20 };
      default: return { canAccess: true };
    }
  };

  const respondToVote = async (vid: string, oids: string[]) => {
    const oldData = queryClient.getQueryData(['votes', roomIds]);
    if (oldData) { queryClient.setQueryData(['votes', roomIds], (old: any[]) => (old || []).map(v => v.id === vid ? { ...v, vote_responses: [...(v.vote_responses || []).filter((r: any) => r.user_id !== currentUser!.id), { user_id: currentUser!.id, option_ids: oids }] } : v)); }
    try { await contentService.respondToVote(vid, currentUser!.id, oids); } catch (e) { if (oldData) queryClient.setQueryData(['votes', roomIds], oldData); }
    await refreshAllData();
  };

  const respondToSchedule = async (sid: string, oids: string[]) => {
    const oldData = queryClient.getQueryData(['schedules', roomIds]);
    if (oldData) { queryClient.setQueryData(['schedules', roomIds], (old: any[]) => (old || []).map(s => s.id === sid ? { ...s, schedule_responses: [...(s.schedule_responses || []).filter((r: any) => r.user_id !== currentUser!.id), { user_id: currentUser!.id, option_ids: oids }] } : s)); }
    try { await contentService.respondToSchedule(sid, currentUser!.id, oids); } catch (e) { if (oldData) queryClient.setQueryData(['schedules', roomIds], oldData); }
    await refreshAllData();
  };

  return (
    <AppContext.Provider value={{
      currentUser, isLoadingUser, login: async (e, p) => { await supabase.auth.signInWithPassword({ email: e, password: p }); },
      updateUserProfile: async (n, i) => { let final = i; if (i && !i.startsWith('http')) final = await storageService.uploadProfileImage('user', currentUser!.id, i); await supabase.from('profiles').update({ name: n, profile_image: final }).eq('id', currentUser!.id); await fetchMyProfile(currentUser!.id); await refreshAllData(); },
      logout: async () => { setCurrentUser(null); await supabase.auth.signOut(); queryClient.clear(); },
      deleteAccount: async () => { try { await supabase.rpc('delete_user'); await supabase.auth.signOut(); setCurrentUser(null); queryClient.clear(); } catch (e) { await supabase.auth.signOut(); setCurrentUser(null); queryClient.clear(); } },
      blockUser, reportContent, blockedUsers, rooms: roomsData, isLoadingRooms, users: allUsers, getUserById, getRoomByIdRemote: roomService.getRoomByIdRemote,
      createRoom: async (n, p, i) => { const room = await roomService.createRoom(n, p, currentUser!.id, i); await refreshAllData(); return room; },
      joinRoom: async (rid, pc) => { const room = await roomService.joinRoom(rid, pc, currentUser!.id); if (room) await refreshAllData(); return room; },
      updateRoom: async (rid, n, i) => { await roomService.updateRoom(rid, n, i); await refreshAllData(); },
      deleteRoom: async (id) => { await roomService.deleteRoom(id); await refreshAllData(); },
      notices: noticesMapped, addNotice: async (rid, t, c, p = false, imgs = [], useNoti = true) => { await contentService.addNotice(rid, currentUser!.id, t, c, p, imgs, useNoti); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 공지사항', t); await refreshAllData(); },
      updateNotice: async (id, updates) => { await contentService.updateNotice(id, { title: updates.title, content: updates.content, is_pinned: updates.isPinned, image_urls: updates.imageUrls }); await refreshAllData(); },
      deleteNotice: async (id) => { await contentService.deleteNotice(id); await refreshAllData(); },
      addNoticeComment: async (nid, t, pid) => { await contentService.addNoticeComment(nid, currentUser!.id, t, pid); const notice = noticesMapped.find(n => n.id === nid); if (notice && notice.userId !== currentUser!.id) sendPushNotification([notice.userId], '공지에 새로운 댓글', t); await refreshAllData(); },
      updateNoticeComment: async (id, t) => { await contentService.updateNoticeComment(id, t); await refreshAllData(); },
      deleteNoticeComment: async (id) => { await contentService.deleteNoticeComment(id); await refreshAllData(); },
      videos: videosMapped, addVideo: async (rid, url, t, useNoti = true) => { await contentService.addVideo(rid, currentUser!.id, url, t, useNoti); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 피드백 영상', t); await refreshAllData(); },
      updateVideo: async (id, t) => { await contentService.updateVideo(id, t); await refreshAllData(); },
      deleteVideo: async (id) => { await contentService.deleteVideo(id); await refreshAllData(); },
      addComment: async (vid, t, ts, pid) => { await contentService.addVideoComment(vid, currentUser!.id, t, ts, pid); const video = videosMapped.find(v => v.id === vid); if (video && video.userId !== currentUser!.id) sendPushNotification([video.userId], '영상에 새로운 피드백', t); await refreshAllData(); },
      updateComment: async (id, t) => { await contentService.updateVideoComment(id, t); await refreshAllData(); },
      deleteComment: async (id) => { await contentService.deleteVideoComment(id); await refreshAllData(); },
      photos: photosMapped, addPhoto: async (rid, url, d, useNoti = true) => { await storageService.uploadToGallery(rid, currentUser!.id, url, d); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 아카이브', d || '새로운 사진'); await refreshAllData(); },
      updatePhoto: async (id, d) => { await contentService.updatePhoto(id, d); await refreshAllData(); },
      deletePhoto: async (id, url) => { await contentService.deletePhoto(id); await refreshAllData(); },
      addPhotoComment: async (phid, t, pid) => { await contentService.addPhotoComment(phid, currentUser!.id, t, pid); const photo = photosMapped.find(p => p.id === phid); if (photo && photo.userId !== currentUser!.id) sendPushNotification([photo.userId], '아카이브에 새로운 댓글', t); await refreshAllData(); },
      updatePhotoComment: async (id, t) => { await contentService.updatePhotoComment(id, t); await refreshAllData(); },
      deletePhotoComment: async (id) => { await contentService.deletePhotoComment(id); await refreshAllData(); },
      markItemAsAccessed: async (type, id) => { await supabase.from(type === 'video' ? 'videos' : 'gallery_items').update({ last_accessed_at: new Date() }).eq('id', id); },
      schedules: schedulesMapped, addSchedule: async (rid, t, opts, useNoti = true, dl, rm) => { const { data: s, error } = await contentService.addSchedule(rid, currentUser!.id, t, useNoti, dl ? new Date(dl).toISOString() : undefined, rm); if (s) await contentService.addScheduleOptions(s.id, opts); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 일정 조율', t); await refreshAllData(); },
      updateSchedule: async (id, updates) => { await contentService.updateSchedule(id, { title: updates.title, deadline: updates.deadline ? new Date(updates.deadline).toISOString() : undefined, use_notification: updates.use_notification, reminder_before: updates.reminder_before }); await refreshAllData(); },
      respondToSchedule, deleteSchedule: async (id) => { await contentService.deleteSchedule(id); await refreshAllData(); },
      closeSchedule: async (id) => { await updateSchedule(id, { deadline: Date.now() }); const sch = schedulesMapped.find(s => s.id === id); if (sch) sendPushNotification((roomsData.find(r=>r.id===sch.roomId)?.members || []).filter(uid=>uid!==currentUser?.id), '일정 조율 종료', `"${sch.title}" 일정 조율이 종료되었습니다.`); await refreshAllData(); },
      votes: votesMapped, addVote: async (rid, q, opts, s) => { const { data: v } = await contentService.addVote(rid, currentUser!.id, q, s.isAnonymous, s.allowMultiple, s.useNotification ?? true, s.deadline ? new Date(s.deadline).toISOString() : undefined, s.reminderMinutes); if (v) await contentService.addVoteOptions(v.id, opts); if (s.useNotification !== false) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUser?.id), '새로운 투표', q); await refreshAllData(); },
      updateVote: async (id, updates) => { await contentService.updateVote(id, { question: updates.question, deadline: updates.deadline ? new Date(updates.deadline).toISOString() : undefined, use_notification: updates.use_notification, reminder_before: updates.reminder_before }); await refreshAllData(); },
      respondToVote, deleteVote: async (id) => { await contentService.deleteVote(id); await refreshAllData(); },
      closeVote: async (id) => { await updateVote(id, { deadline: Date.now() }); const vote = votesMapped.find(v => v.id === id); if (vote) sendPushNotification((roomsData.find(r=>r.id===vote.roomId)?.members || []).filter(uid=>uid!==currentUser?.id), '투표 종료', `"${vote.question}" 투표가 종료되었습니다.`); await refreshAllData(); },
      formations: formationsQuery.data || [], addFormation: async (rid, title, audioUrl, settings, data) => { const newId = Math.random().toString(36).substr(2, 9); const newFormation: Formation = { id: newId, roomId: rid, userId: currentUser!.id, title, audioUrl, settings: settings || { gridRows: 10, gridCols: 20, stageDirection: 'top', snapToGrid: true }, data: data || { dancers: [], scenes: [], timeline: [] }, createdAt: Date.now() }; const localRaw = await AsyncStorage.getItem('local_formations'); const local = localRaw ? JSON.parse(localRaw) : []; await AsyncStorage.setItem('local_formations', JSON.stringify([...local, newFormation])); await refreshAllData(); return newId; },
      updateFormation: async (fid, updates) => { const localRaw = await AsyncStorage.getItem('local_formations'); if (localRaw) { const local = JSON.parse(localRaw); if (local.some((f: any) => f.id === fid)) { await AsyncStorage.setItem('local_formations', JSON.stringify(local.map((f: any) => f.id === fid ? { ...f, ...updates } : f))); await refreshAllData(); return; } } await contentService.updateRemoteFormation(fid, updates); await refreshAllData(); },
      deleteFormation: async (fid) => { const localRaw = await AsyncStorage.getItem('local_formations'); if (localRaw) { const local = JSON.parse(localRaw); if (local.some((f: any) => f.id === fid)) { await AsyncStorage.setItem('local_formations', JSON.stringify(local.filter((f: any) => f.id !== fid))); await refreshAllData(); return; } } await contentService.deleteRemoteFormation(fid); await refreshAllData(); },
      publishFormationAsFeedback: async (roomId, formationId, title, currentData) => { let formation = (formationsQuery.data as any[] || []).find(f => f.id === formationId); const finalData = currentData?.data || formation?.data; const finalSettings = currentData?.settings || formation?.settings; const finalAudioUrl = currentData?.audioUrl || formation?.audioUrl; if (!finalData) throw new Error('동선 정보를 찾을 수 없습니다.'); const { data: remote } = await contentService.publishFormation(roomId, currentUser!.id, title, finalAudioUrl || '', finalSettings, finalData); await addVideo(roomId, `formation://${remote.id}`, `[동선] ${title}`); await refreshAllData(); },
      refreshAllData, themeType, setThemeType, customColor, setCustomColor, customBackgroundColor, setCustomBackgroundColor, theme, updateRoomUserProfile, getRoomUserProfile, roomProfiles, isPro, checkProAccess, purchasePro, sendProReminder: async (roomId, type, targetId) => { const rooms = queryClient.getQueryData(['rooms', currentUser?.id]) as any[] || []; const room = rooms.find(r => r.id === roomId); if (!room) return; let targetTitle = ''; let nonResponders: string[] = []; if (type === 'vote') { const vote = votesMapped.find(v => v.id === targetId); if (vote) { targetTitle = vote.question; nonResponders = (room.members || []).filter(mid => !(vote.responses[mid] || []).length && mid !== currentUser?.id); } } else { const sch = schedulesMapped.find(s => s.id === targetId); if (sch) { targetTitle = sch.title; nonResponders = (room.members || []).filter(mid => !(sch.responses[mid] || []).length && mid !== currentUser?.id); } } if (nonResponders.length > 0) await sendPushNotification(nonResponders, '응답 요청', `"${targetTitle}"에 아직 참여하지 않으셨습니다.`); }
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
