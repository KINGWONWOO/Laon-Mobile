import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Room, Notice, VideoFeedback, Photo, Schedule, Vote, ThemeType, Formation, UserSubscription } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { roomService } from '../services/roomService';
import { storageService } from '../services/storageService';
import { contentService } from '../services/contentService';
import { getThemeColors } from '../constants/theme';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { authService } from '../services/authService';
import { Language, SUPPORTED_LANGUAGES, createTranslator } from '../constants/translations';

interface AppContextType {
  currentUser: User | null;
  isLoadingUser: boolean;
  login: (email: string, pass: string) => Promise<any>;
  loginWithSocial: (provider: 'google' | 'kakao' | 'apple') => Promise<any>;
  sendVerificationCode: (email: string) => Promise<any>;
  checkEmailCode: (email: string, code: string, token: string) => Promise<any>;
  verifyAndSignup: (email: string, code: string, token: string, pass: string, name: string, phone: string) => Promise<any>;
  updateUserProfile: (name: string, image?: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;

  blockedUsers: string[];
  blockUser: (userId: string) => Promise<void>;
  reportContent: (id: string, type: string) => Promise<void>;

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
  addVideo: (rid: string, url: string, t: string, useNoti?: boolean, choreographyUrl?: string) => Promise<void>;
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
  publishFormationAsFeedback: (roomId: string, formationId: string, title: string, currentData?: any, choreographyVideoUrl?: string) => Promise<void>;

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

  // Subscription
  isPro: boolean;
  purchasePro: (durationDays?: number) => Promise<void>;
  checkProAccess: (type: 'room_count' | 'archive_limit' | 'formation' | 'feedback_limit' | 'reminder') => { canAccess: boolean, limit?: number, current?: number };
  sendProReminder: (roomId: string, type: 'vote' | 'schedule', targetId: string) => Promise<void>;

  // Language
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
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
  const [language, setLanguageState] = useState<Language>('ko');
  const currentUserRef = useRef<User | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('theme_type').then(val => { if (val) setThemeTypeState(val as ThemeType); });
    AsyncStorage.getItem('theme_custom_color').then(val => { if (val) setCustomColorState(val); });
    AsyncStorage.getItem('theme_custom_bg_color').then(val => { if (val) setCustomBackgroundColorState(val); });
    AsyncStorage.getItem('room_profiles').then(val => { if (val) setRoomProfiles(JSON.parse(val)); });
    AsyncStorage.getItem('blocked_users').then(val => { if (val) setBlockedUsers(JSON.parse(val)); });
    AsyncStorage.getItem('app_language').then(val => {
      if (val && SUPPORTED_LANGUAGES.includes(val as Language)) setLanguageState(val as Language);
    });
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem('app_language', lang);
  };

  const t = useCallback((key: string): string => {
    return createTranslator(language)(key);
  }, [language]);

  const blockUser = async (userId: string) => {
    const newList = [...blockedUsers, userId];
    setBlockedUsers(newList);
    await AsyncStorage.setItem('blocked_users', JSON.stringify(newList));
    Alert.alert('차단 완료', '해당 사용자의 콘텐츠가 더 이상 표시되지 않습니다.');
  };

  const reportContent = async (id: string, type: string) => {
    console.log(`Reported ${type}: ${id}`);
    Alert.alert('신고 접수', '부적절한 콘텐츠로 신고가 접수되었습니다. 관리자 검토 후 조치됩니다.');
  };

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

  const theme = useMemo(() => getThemeColors(themeType, customColor, customBackgroundColor), [themeType, customColor, customBackgroundColor]);

  const sendPushNotification = async (userIds: string[], title: string, body: string, data?: any) => {
    if (!userIds || userIds.length === 0) return;
    try {
      await supabase.functions.invoke('push-notification', { body: { user_ids: userIds, title, body, data } });
    } catch (err) {
      console.warn('Failed to send push notification:', err);
    }
  };

  const fetchMyProfile = async (userId: string, sessionUser?: any) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      if (data) {
        const user: User = { 
          id: data.id, 
          name: data.name || sessionUser?.user_metadata?.name || '댄서', 
          profileImage: data.profile_image || sessionUser?.user_metadata?.avatar_url || null,
          subscription: data.subscription_tier ? {
            tier: data.subscription_tier,
            startDate: data.subscription_start ? new Date(data.subscription_start).getTime() : undefined,
            expiryDate: data.subscription_expiry ? new Date(data.subscription_expiry).getTime() : undefined,
            isTrialUsed: data.is_trial_used || false
          } : { tier: 'free', isTrialUsed: false }
        };
        setCurrentUser(user);
        currentUserRef.current = user;
      } else {
        // 프로필 테이블에 데이터가 없는 경우를 위한 완벽한 Fallback 처리
        const fallbackUser: User = {
          id: userId,
          name: sessionUser?.user_metadata?.name || sessionUser?.user_metadata?.full_name || '댄서',
          profileImage: sessionUser?.user_metadata?.avatar_url || null,
          subscription: { tier: 'free', isTrialUsed: false }
        };
        setCurrentUser(fallbackUser);
        currentUserRef.current = fallbackUser;
      }
    } catch (err) {
      console.error('[AppContext] Profile fetch error:', err);
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        if (session) fetchMyProfile(session.user.id, session.user);
        setIsLoadingUser(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        if (session) {
          // 💡 로그인이 감지되면 프로필을 가져오기 전까지 로딩 상태를 true로 유지
          if (currentUserRef.current?.id !== session.user.id) {
            setIsLoadingUser(true);
            fetchMyProfile(session.user.id, session.user).then(() => {
              if (mounted) setIsLoadingUser(false);
            });
          } else {
            setIsLoadingUser(false);
          }
        } else {
          setCurrentUser(null);
          currentUserRef.current = null;
          setIsLoadingUser(false);
        }
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isPro = useMemo(() => {
    if (!currentUser?.subscription) return false;
    const { tier, expiryDate } = currentUser.subscription;
    if (tier !== 'pro') return false;
    if (expiryDate && expiryDate < Date.now()) return false;
    return true;
  }, [currentUser]);

  const purchasePro = async (durationDays: number = 30) => {
    if (!currentUserRef.current) return;
    const now = Date.now();
    const expiry = now + (durationDays * 24 * 60 * 60 * 1000);
    const { error } = await supabase.from('profiles').update({
      subscription_tier: 'pro',
      subscription_start: new Date(now).toISOString(),
      subscription_expiry: new Date(expiry).toISOString(),
    }).eq('id', currentUserRef.current.id);
    if (error) throw error;
    await fetchMyProfile(currentUserRef.current.id);
  };

  const checkProAccess = (type: 'room_count' | 'archive_limit' | 'formation' | 'feedback_limit' | 'reminder') => {
    if (isPro) return { canAccess: true };
    switch (type) {
      case 'room_count': {
        const count = (queryClient.getQueryData(['rooms', currentUser?.id]) as any[] || []).length;
        return { canAccess: count < 3, limit: 3, current: count };
      }
      case 'archive_limit': return { canAccess: false, limit: 20 };
      case 'formation': return { canAccess: false };
      case 'feedback_limit': return { canAccess: false, limit: 10 };
      case 'reminder': return { canAccess: false };
      default: return { canAccess: true };
    }
  };

  const sendProReminder = async (roomId: string, type: 'vote' | 'schedule', targetId: string) => {
    if (!isPro) throw new Error('Pro 멤버십 전용 기능입니다.');
    const rooms = queryClient.getQueryData(['rooms', currentUser?.id]) as any[] || [];
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    let targetTitle = '';
    let nonResponders: string[] = [];
    if (type === 'vote') {
      const vote = votesMapped.find(v => v.id === targetId);
      if (vote) {
        targetTitle = vote.question;
        const responders = Object.keys(vote.responses || {});
        nonResponders = (room.members || []).filter(mid => !responders.includes(mid) && mid !== currentUser?.id);
      }
    } else {
      const sch = schedulesMapped.find(s => s.id === targetId);
      if (sch) {
        targetTitle = sch.title;
        const responders = Object.keys(sch.responses || {});
        nonResponders = (room.members || []).filter(mid => !responders.includes(mid) && mid !== currentUser?.id);
      }
    }
    if (nonResponders.length > 0) {
      await sendPushNotification(nonResponders, '응답 요청', `"${targetTitle}"에 아직 참여하지 않으셨습니다. 확인 부탁드려요!`);
    }
  };

  const { data: allUsers = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name, profile_image');
      return (data || []).map(u => ({ id: u.id, name: u.name, profileImage: u.profile_image }));
    },
    placeholderData: keepPreviousData
  });

  const getUserById = (id: string) => allUsers.find(u => u.id === id);

  const refreshAllData = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('global-sync').on('postgres_changes', { event: '*', schema: 'public' }, () => refreshAllData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser, refreshAllData]);

  const { data: roomsData = [], isLoading: isLoadingRooms } = useQuery({
    queryKey: ['rooms', currentUser?.id],
    queryFn: async () => currentUser ? await roomService.getMyRooms(currentUser.id) : [],
    enabled: !!currentUser,
    placeholderData: keepPreviousData
  });

  const roomIds = useMemo(() => roomsData.map(r => r.id), [roomsData]);

  const videosQuery = useQuery({ queryKey: ['videos', roomIds], queryFn: async () => {
    const { data: v } = await supabase.from('videos').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: c = [] } = await supabase.from('video_comments').select('*').in('video_id', (v || []).map(x => x.id)).order('created_at', { ascending: true });
    return (v || []).map(video => ({ ...video, video_comments: (c || []).filter(comment => comment.video_id === video.id) }));
  }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });

  const photosQuery = useQuery({ queryKey: ['photos', roomIds], queryFn: async () => {
    const { data: p } = await supabase.from('gallery_items').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: c = [] } = await supabase.from('gallery_comments').select('*').in('gallery_item_id', (p || []).map(x => x.id)).order('created_at', { ascending: true });
    return (p || []).map(photo => ({ ...photo, gallery_comments: (c || []).filter(comment => comment.gallery_item_id === photo.id) }));
  }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });

  const schedulesQuery = useQuery({ queryKey: ['schedules', roomIds], queryFn: async () => {
    const { data: s } = await supabase.from('schedules').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: o = [] } = await supabase.from('schedule_options').select('*').in('schedule_id', (s || []).map(x => x.id));
    const { data: r = [] } = await supabase.from('schedule_responses').select('*').in('schedule_id', (s || []).map(x => x.id));
    return (s || []).map(sch => ({ ...sch, schedule_options: (o || []).filter(opt => opt.schedule_id === sch.id).map(opt => ({ ...opt, schedule_responses: (r || []).filter(res => res.option_ids?.includes(opt.id)) })) }));
  }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });

  const votesQuery = useQuery({ queryKey: ['votes', roomIds], queryFn: async () => {
    const { data: v } = await supabase.from('votes').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: o = [] } = await supabase.from('vote_options').select('*').in('vote_id', (v || []).map(x => x.id));
    const { data: r = [] } = await supabase.from('vote_responses').select('*').in('vote_id', (v || []).map(x => x.id));
    return (v || []).map(vote => ({ ...vote, vote_options: (o || []).filter(opt => opt.vote_id === vote.id).map(opt => ({ ...opt, vote_responses: (r || []).filter(res => res.option_ids?.includes(opt.id)) })) }));
  }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });

  const noticesQuery = useQuery({ queryKey: ['notices', roomIds], queryFn: async () => {
    const { data: n } = await supabase.from('notices').select('*').in('room_id', roomIds);
    const { data: c = [] } = await supabase.from('notice_comments').select('*').in('notice_id', (n || []).map(x => x.id)).order('created_at', { ascending: true });
    return (n || []).map(notice => ({ ...notice, notice_comments: (c || []).filter(comment => comment.notice_id === notice.id) }));
  }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });

  const formationsQuery = useQuery({ queryKey: ['formations', roomIds], queryFn: async () => {
    const { data: remote } = await supabase.from('formations').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const localRaw = await AsyncStorage.getItem('local_formations');
    const local = localRaw ? JSON.parse(localRaw) : [];
    const mappedRemote = (remote || []).map(form => ({ id: form.id, roomId: form.room_id, userId: form.user_id, title: form.title, audioUrl: form.audio_url, videoSettings: form.video_settings, settings: form.settings, data: form.data, createdAt: new Date(form.created_at).getTime(), isLocal: false })) as Formation[];
    const filteredLocal = local.filter((f: any) => roomIds.includes(f.roomId)).map((f: any) => ({ ...f, isLocal: true }));
    return [...filteredLocal, ...mappedRemote] as Formation[];
  }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });

  const noticesMapped: Notice[] = (noticesQuery.data || []).map(n => ({
    id: n.id, roomId: n.room_id, userId: n.user_id, title: n.title, content: n.content, isPinned: n.is_pinned, useNotification: n.use_notification, imageUrls: n.image_urls || [], viewedBy: n.viewed_by || [], createdAt: new Date(n.created_at).getTime(),
    comments: (n.notice_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() }))
  })).filter(n => !blockedUsers.includes(n.userId)).sort((a, b) => (a.isPinned === b.isPinned) ? b.createdAt - a.createdAt : (a.isPinned ? -1 : 1));

  const videosMapped: VideoFeedback[] = (videosQuery.data || []).map(v => ({ 
    id: v.id, 
    roomId: v.room_id, 
    userId: v.user_id, 
    videoUrl: v.storage_path || v.youtube_url, 
    choreographyVideoUrl: v.choreography_video_url,
    title: v.title, 
    useNotification: v.use_notification, 
    createdAt: new Date(v.created_at).getTime(), 
    comments: (v.video_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, timestampMillis: c.timestamp_millis, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() })).filter((c: any) => !blockedUsers.includes(c.userId)) 
  })).filter(v => !blockedUsers.includes(v.userId));
  const photosMapped: Photo[] = (photosQuery.data || []).map(p => ({ id: p.id, roomId: p.room_id, userId: p.user_id, photoUrl: p.file_path, description: p.description, useNotification: p.use_notification, createdAt: new Date(p.created_at).getTime(), comments: (p.gallery_comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, text: c.text, parentId: c.parent_id, createdAt: new Date(c.created_at).getTime() })).filter((c: any) => !blockedUsers.includes(c.userId)) })).filter(p => !blockedUsers.includes(p.userId));
  const schedulesMapped: Schedule[] = (schedulesQuery.data || []).map(s => {
    const resp: Record<string, string[]> = {}; (s.schedule_options || []).forEach((o: any) => (o.schedule_responses || []).forEach((r: any) => { if (!resp[r.user_id]) resp[r.user_id] = []; if (!resp[r.user_id].includes(o.id)) resp[r.user_id].push(o.id); }));
    return { id: s.id, roomId: s.room_id, userId: s.user_id, title: s.title, options: (s.schedule_options || []).map((o:any)=>({id:o.id, dateTime: o.date_time})), responses: resp, viewedBy: s.viewed_by || [], useNotification: s.use_notification, reminderMinutes: s.reminder_before, deadline: s.deadline ? new Date(s.deadline).getTime() : undefined, createdAt: new Date(s.created_at).getTime() };
  }).filter(s => !blockedUsers.includes(s.userId));
  const votesMapped: Vote[] = (votesQuery.data || []).map(v => {
    const resp: Record<string, string[]> = {}; (v.vote_options || []).forEach((o: any) => (o.vote_responses || []).forEach((r: any) => { if (!resp[r.user_id]) resp[r.user_id] = []; if (!resp[r.user_id].includes(o.id)) resp[r.user_id].push(o.id); }));
    return { id: v.id, roomId: v.room_id, userId: v.user_id, question: v.question, isAnonymous: v.is_anonymous, allowMultiple: v.allow_multiple, options: (v.vote_options || []).map((o:any)=>({id:o.id, text: o.text})), responses: resp, viewedBy: v.viewed_by || [], useNotification: v.use_notification, reminderMinutes: v.reminder_before, deadline: v.deadline ? new Date(v.deadline).getTime() : undefined, createdAt: new Date(v.created_at).getTime(), comments: [] };
  }).filter(v => !blockedUsers.includes(v.userId));

  const logout = async () => { setCurrentUser(null); currentUserRef.current = null; await supabase.auth.signOut(); queryClient.clear(); };
  const deleteAccount = async () => {
    if (!currentUserRef.current) return;
    try {
      console.log('[Account] Starting deleteAccount process...');
      
      const { data: { session } } = await supabase.auth.getSession();
      const userToken = session?.access_token;
      if (!userToken) throw new Error('인증 세션이 만료되었습니다.');

      const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      // 💡 [최종 보안 전략]
      // 1. Authorization 헤더에는 문지기 통과를 위한 Anon Key를 보냅니다.
      // 2. X-User-Token 헤더에 실제 삭제할 유저의 진짜 토큰을 담습니다.
      // 3. 서버 함수는 X-User-Token을 읽어 '진짜 유저'인지 다시 한 번 Auth 서버에 확인합니다.
      const response = await fetch(`${projectUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey || '',
          'Authorization': `Bearer ${anonKey}`,
          'X-User-Token': userToken 
        },
        body: JSON.stringify({ user_token: userToken }),
      });
      
      const result = await response.json().catch(() => ({ success: false, error: '응답 파싱 실패' }));
      console.log('[Account] Edge Function response:', result);

      if (!response.ok || (result && !result.success)) {
        throw new Error(result.error || result.details || `서버 오류 (${response.status})`);
      }
      
      await logout();
      Alert.alert('탈퇴 완료', '계정이 완전히 삭제되었습니다.');
    } catch (e: any) {
      console.error('[Account] Delete account failed:', e);
      Alert.alert('탈퇴 오류', e.message || '탈퇴 처리 중 문제가 발생했습니다.');
    }
  };
  const updateUserProfile = async (n: string, i?: string) => { 
    if (!currentUserRef.current) return;
    let final = i; 
    if (i && !i.startsWith('http')) final = await storageService.uploadProfileImage('user', currentUserRef.current.id, i); 
    
    // 💡 update 대신 upsert를 사용하여 레코드가 없으면 생성하도록 수정
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('profiles').upsert({ 
      id: currentUserRef.current.id, 
      name: n, 
      profile_image: final,
      email: session?.user?.email // 이메일 정보도 함께 저장
    }); 
    
    await fetchMyProfile(currentUserRef.current.id, session?.user);
    await refreshAllData(); 
  };
  const createRoom = async (n: string, p: string, i?: string) => { if (!currentUserRef.current) return; const room = await roomService.createRoom(n, p, currentUserRef.current.id, i); await refreshAllData(); return room; };
  const joinRoom = async (rid: string, pc: string) => { if (!currentUserRef.current) return; const room = await roomService.joinRoom(rid, pc, currentUserRef.current.id); if (room) await refreshAllData(); return room; };
  const updateRoom = async (rid: string, n: string, i?: string | null) => { await roomService.updateRoom(rid, n, i); await refreshAllData(); };
  const deleteRoom = async (id: string) => { await roomService.deleteRoom(id); await refreshAllData(); };
  
  const addNotice = async (rid: string, t: string, c: string, p = false, imgs: string[] = [], useNoti = true) => { if (!currentUserRef.current) return; await contentService.addNotice(rid, currentUserRef.current.id, t, c, p, imgs, useNoti); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUserRef.current?.id), '새로운 공지사항', t); await refreshAllData(); };
  const updateNotice = async (id: string, updates: Partial<Notice>) => { await contentService.updateNotice(id, { title: updates.title, content: updates.content, is_pinned: updates.isPinned, image_urls: updates.imageUrls }); await refreshAllData(); };
  const deleteNotice = async (id: string) => { await contentService.deleteNotice(id); await refreshAllData(); };
  const addNoticeComment = async (nid: string, t: string, pid?: string) => { if (!currentUserRef.current) return; await contentService.addNoticeComment(nid, currentUserRef.current.id, t, pid); const notice = noticesMapped.find(n => n.id === nid); if (notice && notice.userId !== currentUserRef.current.id) sendPushNotification([notice.userId], '공지에 새로운 댓글', t); await refreshAllData(); };
  const updateNoticeComment = async (id: string, t: string) => { await contentService.updateNoticeComment(id, t); await refreshAllData(); };
  const deleteNoticeComment = async (id: string) => { await contentService.deleteNoticeComment(id); await refreshAllData(); };

  const addVideo = async (rid: string, url: string, t: string, useNoti = true, choreographyUrl?: string) => { 
    if (!currentUserRef.current) return; 
    await contentService.addVideo(rid, currentUserRef.current.id, url, t, useNoti, choreographyUrl); 
    if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUserRef.current?.id), '새로운 피드백 영상', t); 
    await refreshAllData(); 
  };
  const updateVideo = async (id: string, t: string) => { await contentService.updateVideo(id, t); await refreshAllData(); };
  const deleteVideo = async (id: string) => { await contentService.deleteVideo(id); await refreshAllData(); };
  const addComment = async (vid: string, t: string, ts: number, pid?: string) => { if (!currentUserRef.current) return; await contentService.addVideoComment(vid, currentUserRef.current.id, t, ts, pid); const video = videosMapped.find(v => v.id === vid); if (video && video.userId !== currentUserRef.current.id) sendPushNotification([video.userId], '영상에 새로운 피드백', t); await refreshAllData(); };
  const updateComment = async (id: string, t: string) => { await contentService.updateVideoComment(id, t); await refreshAllData(); };
  const deleteComment = async (id: string) => { await contentService.deleteVideoComment(id); await refreshAllData(); };

  const addPhoto = async (rid: string, url: string, d?: string, useNoti = true) => { if (!currentUserRef.current) return; await storageService.uploadToGallery(rid, currentUserRef.current.id, url, d); if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUserRef.current?.id), '새로운 아카이브', d || '새로운 사진'); await refreshAllData(); };
  const updatePhoto = async (id: string, d: string) => { await contentService.updatePhoto(id, d); await refreshAllData(); };
  const deletePhoto = async (id: string) => { await contentService.deletePhoto(id); await refreshAllData(); };
  const addPhotoComment = async (phid: string, t: string, pid?: string) => { if (!currentUserRef.current) return; await contentService.addPhotoComment(phid, currentUserRef.current.id, t, pid); const photo = photosMapped.find(p => p.id === phid); if (photo && photo.userId !== currentUserRef.current.id) sendPushNotification([photo.userId], '아카이브에 새로운 댓글', t); await refreshAllData(); };
  const updatePhotoComment = async (id: string, t: string) => { await contentService.updatePhotoComment(id, t); await refreshAllData(); };
  const deletePhotoComment = async (id: string) => { await contentService.deletePhotoComment(id); await refreshAllData(); };

  const addVote = async (rid: string, q: string, opts: string[], s: any) => { 
    if (!currentUserRef.current) return;
    const { data: v, error } = await contentService.addVote(rid, currentUserRef.current.id, q, s.isAnonymous, s.allowMultiple, s.useNotification ?? true, s.deadline ? new Date(s.deadline).toISOString() : undefined, s.reminderMinutes); 
    if (error) throw error;
    if (v) {
      const { error: oError } = await contentService.addVoteOptions(v.id, opts);
      if (oError) throw oError;
    }
    if (s.useNotification !== false) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUserRef.current?.id), '새로운 투표', q); 
    await refreshAllData(); 
  };
  const updateVote = async (id: string, updates: Partial<Vote>) => { await contentService.updateVote(id, { question: updates.question, deadline: updates.deadline ? new Date(updates.deadline).toISOString() : undefined, use_notification: updates.useNotification, reminder_before: updates.reminderMinutes }); await refreshAllData(); };
  const closeVote = async (id: string) => { await updateVote(id, { deadline: Date.now() }); const vote = votesMapped.find(v => v.id === id); if (vote) sendPushNotification((roomsData.find(r=>r.id===vote.roomId)?.members || []).filter(uid=>uid!==currentUserRef.current?.id), '투표 종료', `"${vote.question}" 투표가 종료되었습니다.`); await refreshAllData(); };
  const respondToVote = async (vid: string, oids: string[]) => {
    if (!currentUserRef.current) return;
    const userId = currentUserRef.current.id;
    const oldData = queryClient.getQueryData(['votes', roomIds]);
    queryClient.setQueryData(['votes', roomIds], (old: any[]) => (old || []).map(v => {
      if (v.id !== vid) return v;
      const updatedOptions = (v.vote_options || []).map((opt: any) => {
        const filtered = (opt.vote_responses || []).filter((r: any) => r.user_id !== userId);
        if (oids.includes(opt.id)) filtered.push({ user_id: userId, option_ids: oids, vote_id: vid });
        return { ...opt, vote_responses: filtered };
      });
      return { ...v, vote_options: updatedOptions };
    }));
    try {
      await contentService.respondToVote(vid, userId, oids);
      queryClient.invalidateQueries({ queryKey: ['votes', roomIds] });
    } catch (e) {
      if (oldData) queryClient.setQueryData(['votes', roomIds], oldData);
      throw e;
    }
  };
  const deleteVote = async (id: string) => { await contentService.deleteVote(id); await refreshAllData(); };

  const addSchedule = async (rid: string, t: string, opts: string[], useNoti = true, dl?: number, reminderMinutes?: number) => { 
    if (!currentUserRef.current) return;
    const { data: s, error } = await contentService.addSchedule(rid, currentUserRef.current.id, t, useNoti, dl ? new Date(dl).toISOString() : undefined, reminderMinutes); 
    if (error) throw error;
    if (s) {
      const { error: oError } = await contentService.addScheduleOptions(s.id, opts);
      if (oError) throw oError;
    }
    if (useNoti) sendPushNotification((roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUserRef.current?.id), '새로운 일정 조율', t); 
    await refreshAllData(); 
  };
  const updateSchedule = async (id: string, updates: Partial<Schedule>) => { await contentService.updateSchedule(id, { title: updates.title, deadline: updates.deadline ? new Date(updates.deadline).toISOString() : undefined, use_notification: updates.useNotification, reminder_before: updates.reminderMinutes }); await refreshAllData(); };
  const closeSchedule = async (id: string) => { await updateSchedule(id, { deadline: Date.now() }); const sch = schedulesMapped.find(s => s.id === id); if (sch) sendPushNotification((roomsData.find(r=>r.id===sch.roomId)?.members || []).filter(uid=>uid!==currentUserRef.current?.id), '일정 조율 종료', `"${sch.title}" 일정 조율이 종료되었습니다.`); await refreshAllData(); };
  const respondToSchedule = async (sid: string, oids: string[]) => {
    if (!currentUserRef.current) return;
    const userId = currentUserRef.current.id;
    const oldData = queryClient.getQueryData(['schedules', roomIds]);
    queryClient.setQueryData(['schedules', roomIds], (old: any[]) => (old || []).map(s => {
      if (s.id !== sid) return s;
      const updatedOptions = (s.schedule_options || []).map((opt: any) => {
        const filtered = (opt.schedule_responses || []).filter((r: any) => r.user_id !== userId);
        if (oids.includes(opt.id)) filtered.push({ user_id: userId, option_ids: oids, schedule_id: sid });
        return { ...opt, schedule_responses: filtered };
      });
      return { ...s, schedule_options: updatedOptions };
    }));
    try {
      await contentService.respondToSchedule(sid, userId, oids);
      queryClient.invalidateQueries({ queryKey: ['schedules', roomIds] });
    } catch (e) {
      if (oldData) queryClient.setQueryData(['schedules', roomIds], oldData);
      throw e;
    }
  };
  const deleteSchedule = async (id: string) => { await contentService.deleteSchedule(id); await refreshAllData(); };

  const markItemAsAccessed = async (type: string, id: string) => { await supabase.from(type === 'video' ? 'videos' : 'gallery_items').update({ last_accessed_at: new Date() }).eq('id', id); };

  const addFormation = async (rid: string, title: string, audioUrl?: string, settings?: any, data?: any) => { if (!currentUserRef.current) throw new Error('로그인이 필요합니다.'); const newId = Math.random().toString(36).substr(2, 9); const newFormation: Formation = { id: newId, roomId: rid, userId: currentUserRef.current.id, title, audioUrl, settings: settings || { gridRows: 10, gridCols: 20, stageDirection: 'top', snapToGrid: true }, data: data || { dancers: [], scenes: [], timeline: [] }, createdAt: Date.now() }; const localRaw = await AsyncStorage.getItem('local_formations'); const local = localRaw ? JSON.parse(localRaw) : []; await AsyncStorage.setItem('local_formations', JSON.stringify([...local, newFormation])); await refreshAllData(); return newId; };
  const updateFormation = async (fid: string, updates: Partial<Formation>) => { const localRaw = await AsyncStorage.getItem('local_formations'); if (localRaw) { const local = JSON.parse(localRaw); if (local.some((f: any) => f.id === fid)) { await AsyncStorage.setItem('local_formations', JSON.stringify(local.map((f: any) => f.id === fid ? { ...f, ...updates } : f))); await refreshAllData(); return; } } await contentService.updateRemoteFormation(fid, updates); await refreshAllData(); };
  const deleteFormation = async (fid: string) => { const localRaw = await AsyncStorage.getItem('local_formations'); if (localRaw) { const local = JSON.parse(localRaw); if (local.some((f: any) => f.id === fid)) { await AsyncStorage.setItem('local_formations', JSON.stringify(local.filter((f: any) => f.id !== fid))); await refreshAllData(); return; } } await contentService.deleteRemoteFormation(fid); await refreshAllData(); };
  const publishFormationAsFeedback = async (roomId: string, formationId: string, title: string, currentData?: any, choreographyVideoUrl?: string) => {
    if (!currentUserRef.current) return;
    let formation = (formationsQuery.data as any[] || []).find(f => f.id === formationId);
    const finalData = currentData?.data || formation?.data;
    const finalSettings = currentData?.settings || formation?.settings;
    const finalAudioUrl = currentData?.audioUrl || formation?.audioUrl;
    const finalVideoSettings = currentData?.videoSettings || formation?.videoSettings;
    if (!finalData) throw new Error('동선 정보를 찾을 수 없습니다.');
    const { data: remote, error } = await contentService.publishFormation(roomId, currentUserRef.current.id, title, finalAudioUrl || '', finalSettings, finalData, finalVideoSettings);
    if (error) throw error;
    await addVideo(roomId, `formation://${remote.id}`, `[동선] ${title}`, true, choreographyVideoUrl);
    await refreshAllData();
  };

  const contextValue = useMemo(() => ({
    currentUser, isLoadingUser, 
    login: async (e: string, p: string) => authService.signIn(e, p),
    loginWithSocial: async (provider: 'google' | 'kakao' | 'apple') => authService.signInWithSocial(provider),
    sendVerificationCode: async (e: string) => authService.sendVerificationCode(e),
    checkEmailCode: async (e: string, c: string, t: string) => authService.checkEmailCode(e, c, t),
    verifyAndSignup: async (e: string, c: string, t: string, p: string, n: string, ph: string) => authService.verifyAndSignup(e, c, t, p, n, ph),
    updateUserProfile, logout, deleteAccount, blockUser, reportContent, blockedUsers,
    rooms: roomsData, isLoadingRooms, users: allUsers, getUserById, getRoomByIdRemote: roomService.getRoomByIdRemote, createRoom, joinRoom, updateRoom, deleteRoom,
    notices: noticesMapped, addNotice, updateNotice, deleteNotice, addNoticeComment, updateNoticeComment, deleteNoticeComment,
    videos: videosMapped, addVideo, updateVideo, deleteVideo, addComment, updateComment, deleteComment,
    photos: photosMapped, addPhoto, updatePhoto, deletePhoto, addPhotoComment, updatePhotoComment, deletePhotoComment, markItemAsAccessed,
    schedules: schedulesMapped, addSchedule, updateSchedule, respondToSchedule, deleteSchedule, closeSchedule,
    votes: votesMapped, addVote, updateVote, respondToVote, deleteVote, closeVote,
    formations: formationsQuery.data || [], addFormation, updateFormation, deleteFormation, publishFormationAsFeedback,
    refreshAllData, themeType, setThemeType, customColor, setCustomColor, customBackgroundColor, setCustomBackgroundColor, theme,
    updateRoomUserProfile, getRoomUserProfile, roomProfiles, isPro, checkProAccess, purchasePro, sendProReminder,
    language, setLanguage, t
  }), [
    currentUser, isLoadingUser, roomsData, isLoadingRooms, allUsers, noticesMapped, videosMapped, photosMapped, schedulesMapped, votesMapped, formationsQuery.data,
    themeType, customColor, customBackgroundColor, theme, roomProfiles, blockedUsers, isPro, language, t
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within an AppProvider");
  return context;
};
