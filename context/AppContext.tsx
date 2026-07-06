import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Room, Notice, VideoFeedback, Photo, Schedule, Vote, ThemeType, Formation, UserSubscription, InAppNotification, RoomActivity } from '../types';
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
import { registerForPushNotificationsAsync } from '../services/NotificationService';
import { initRevenueCat, getCustomerInfo, purchasePackage as rcPurchasePackage, restorePurchases as rcRestorePurchases, isProActive, getProExpiryMs } from '../services/revenueCat';
import { PurchasesPackage } from 'react-native-purchases';

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
  getRoomDisplayUser: (roomId: string, userId: string) => { name: string; profileImage: string | null } | undefined;
  getRoomByIdRemote: (id: string) => Promise<any>;
  createRoom: (name: string, passcode: string, image?: string) => Promise<any>;
  joinRoom: (roomId: string, passcode: string) => Promise<any>;
  updateRoom: (roomId: string, name: string, image?: string | null) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  leaveRoom: (id: string) => Promise<void>;
  kickMember: (roomId: string, userId: string) => Promise<void>;
  submitFeedback: (type: 'bug' | 'feature' | 'other', content: string) => Promise<void>;

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
  markScheduleViewed: (sid: string) => Promise<void>;

  votes: Vote[];
  addVote: (rid: string, q: string, opts: string[], settings: any) => Promise<void>;
  updateVote: (id: string, updates: Partial<Vote>) => Promise<void>;
  respondToVote: (vid: string, oids: string[]) => Promise<void>;
  deleteVote: (id: string) => Promise<void>;
  closeVote: (id: string) => Promise<void>;
  markVoteViewed: (vid: string) => Promise<void>;

  formations: Formation[];
  addFormation: (rid: string, title: string, audioUrl?: string, settings?: any, data?: any) => Promise<string>;
  updateFormation: (fid: string, updates: Partial<Formation>) => Promise<void>;
  deleteFormation: (fid: string) => Promise<void>;
  publishFormationAsFeedback: (roomId: string, formationId: string, title: string, currentData?: any, choreographyVideoUrl?: string) => Promise<void>;

  sendPushNotification: (userIds: string[], title: string, body: string, data?: any) => Promise<void>;
  inAppNotifications: InAppNotification[];
  unreadNotificationCount: number;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  refreshAllData: () => Promise<void>;
  themeType: ThemeType;
  setThemeType: (type: ThemeType) => Promise<void>;
  customColor: string;
  setCustomColor: (color: string) => Promise<void>;
  customBackgroundColor: string;
  setCustomBackgroundColor: (color: string) => Promise<void>;
  theme: any;
  updateRoomUserProfile: (roomId: string, name: string, profileImage: string | null, enabled: boolean) => Promise<void>;
  getRoomUserProfile: (roomId: string, userId: string) => { name: string, profileImage: string | null, enabled: boolean } | null;
  roomProfiles: Record<string, { name: string, profileImage: string | null, enabled: boolean }>;

  // Subscription
  isPro: boolean;
  purchasePro: (pkg?: import('react-native-purchases').PurchasesPackage, durationDays?: number) => Promise<void>;
  restoreProPurchases: () => Promise<boolean>;
  checkProAccess: (type: 'room_count' | 'archive_limit' | 'formation' | 'feedback_limit' | 'reminder', roomId?: string) => { canAccess: boolean, limit?: number, current?: number };
  sendProReminder: (roomId: string, type: 'vote' | 'schedule', targetId: string) => Promise<void>;
  sendDirectReminder: (userIds: string[], notificationType: string, vars: Record<string, any>) => Promise<void>;

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
  const [roomProfiles, setRoomProfiles] = useState<Record<string, { name: string, profileImage: string | null, enabled: boolean }>>({});
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
      if (val && SUPPORTED_LANGUAGES.includes(val as Language)) {
        setLanguageState(val as Language);
        // profiles.language 동기화는 currentUser 확정 후 useEffect에서 처리
      }
    });
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem('app_language', lang);
    if (currentUserRef.current) {
      await supabase.from('profiles').update({ language: lang }).eq('id', currentUserRef.current.id);
    }
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
    try {
      const { error } = await supabase.from('content_reports').insert({
        reporter_id: currentUser?.id,
        content_id: id,
        content_type: type,
        reason: 'Reported by user',
      });
      if (error) throw error;
      Alert.alert(t('success'), t('reportSuccess'));
    } catch (e) {
      console.error('[Report] Failed:', e);
      Alert.alert(t('error'), t('reportError'));
    }
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

  const updateRoomUserProfile = async (roomId: string, name: string, profileImage: string | null, enabled: boolean) => {
    if (!currentUser) return;
    let finalImage = profileImage;
    if (profileImage && !profileImage.startsWith('http')) {
      const fileName = `room_profile_${roomId}_${currentUser.id}_${Date.now()}.jpg`;
      finalImage = await storageService.uploadToR2('profiles', profileImage, fileName);
    }
    const { error } = await supabase.from('room_profiles').upsert(
      { room_id: roomId, user_id: currentUser.id, name, profile_image: finalImage, enabled },
      { onConflict: 'room_id,user_id' }
    );
    if (error) throw error;
    const key = `${roomId}_${currentUser.id}`;
    const newProfiles = { ...roomProfiles, [key]: { name, profileImage: finalImage, enabled } };
    setRoomProfiles(newProfiles);
    await AsyncStorage.setItem('room_profiles', JSON.stringify(newProfiles));
    await refreshAllData();
  };

  const theme = useMemo(() => getThemeColors(themeType, customColor, customBackgroundColor), [themeType, customColor, customBackgroundColor]);

  const sendPushNotification = async (userIds: string[], title: string, body: string, data?: any) => {
    if (!userIds || userIds.length === 0) {
      console.log('[Push] sendPushNotification skipped: empty userIds');
      return;
    }
    console.log('[Push] Sending notification →', { title, body, userIds, data });
    try {
      const { data: res, error } = await supabase.functions.invoke('push-notification', {
        body: { user_ids: userIds, title, body, data },
      });
      if (error) {
        console.error('[Push] Edge function error:', error);
        const ctx = (error as any).context;
        if (ctx) {
          console.error('[Push] Edge function status:', ctx.status);
          const body = await ctx.json().catch(() => ctx.text?.());
          console.error('[Push] Edge function response body:', JSON.stringify(body));
        }
      } else {
        console.log('[Push] Edge function response:', res);
      }
    } catch (err) {
      console.error('[Push] sendPushNotification threw:', err);
    }
  };

  const sendTypedPush = async (userIds: string[], notificationType: string, vars: Record<string, any>, data?: any) => {
    if (!userIds || userIds.length === 0) return;
    try {
      const { error } = await supabase.functions.invoke('push-notification', {
        body: { user_ids: userIds, notification_type: notificationType, vars, data },
      });
      if (error) console.error('[Push] sendTypedPush error:', error);
    } catch (err) {
      console.error('[Push] sendTypedPush threw:', err);
    }
  };

  const saveInAppNotifications = async (
    userIds: string[],
    roomId: string,
    type: string,
    title: string,
    body: string,
    targetPath?: string
  ) => {
    if (!userIds.length) return;
    const room = roomsData.find(r => r.id === roomId);
    const roomName = room?.name || '';
    try {
      await supabase.from('notifications').insert(
        userIds.map(uid => ({
          user_id: uid,
          room_id: roomId,
          room_name: roomName,
          type,
          title,
          body,
          target_path: targetPath || null,
          is_read: false,
        }))
      );
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e) {
      console.error('[InAppNotif] Save error:', e);
    }
  };

  const addRoomActivity = async (roomId: string, type: string, contentTitle?: string) => {
    if (!currentUserRef.current) return;
    try {
      await supabase.from('room_activity').insert({
        room_id: roomId,
        type,
        actor_id: currentUserRef.current.id,
        actor_name: currentUserRef.current.name,
        content_title: contentTitle || null,
      });
      queryClient.invalidateQueries({ queryKey: ['room_activity', roomId] });
    } catch (e) {
      console.error('[Activity] Save error:', e);
    }
  };

  const syncRcWithSupabase = async (userId: string) => {
    try {
      const customerInfo = await getCustomerInfo();
      if (!isProActive(customerInfo)) return;
      const expiryMs = getProExpiryMs(customerInfo) ?? (Date.now() + 30 * 24 * 60 * 60 * 1000);
      await supabase.from('profiles').update({
        subscription_tier: 'pro',
        subscription_start: new Date().toISOString(),
        subscription_expiry: new Date(expiryMs).toISOString(),
      }).eq('id', userId);
    } catch (_) {}
  };

  const fetchMyProfile = async (userId: string, sessionUser?: any) => {
    try {
      // RevenueCat 초기화 (userId로 구독 상태 추적)
      try { initRevenueCat(userId); } catch (_) {}

      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

      if (data) {
        // RC가 pro인데 Supabase가 아직 모르는 경우 동기화 (다기기 복원 등)
        const subExpired = !data.subscription_tier || data.subscription_tier !== 'pro' ||
          (data.subscription_expiry && new Date(data.subscription_expiry).getTime() < Date.now());
        if (subExpired) {
          await syncRcWithSupabase(userId);
          // 동기화 후 최신 데이터 재조회
          const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', userId).single();
          if (refreshed) Object.assign(data, refreshed);
        }

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

  useEffect(() => {
    if (currentUser?.id) {
      console.log('[Push] User detected, starting push token registration for userId:', currentUser.id);
      registerForPushNotificationsAsync(currentUser.id).catch(err =>
        console.error('[Push] Registration error:', err)
      );
    }
  }, [currentUser?.id]);

  const isPro = useMemo(() => {
    if (!currentUser?.subscription) return false;
    const { tier, expiryDate } = currentUser.subscription;
    if (tier !== 'pro') return false;
    if (expiryDate && expiryDate < Date.now()) return false;
    return true;
  }, [currentUser]);

  const purchasePro = async (pkg?: PurchasesPackage, durationDays: number = 30) => {
    if (!currentUserRef.current) return;
    const now = Date.now();

    if (pkg) {
      // 실제 RevenueCat 결제
      const customerInfo = await rcPurchasePackage(pkg);
      const expiryMs = getProExpiryMs(customerInfo) ?? (now + 30 * 24 * 60 * 60 * 1000);
      const { error } = await supabase.from('profiles').update({
        subscription_tier: 'pro',
        subscription_start: new Date(now).toISOString(),
        subscription_expiry: new Date(expiryMs).toISOString(),
      }).eq('id', currentUserRef.current.id);
      if (error) throw error;
    } else {
      // 쿠폰 경로
      const expiry = now + (durationDays * 24 * 60 * 60 * 1000);
      const { error } = await supabase.from('profiles').update({
        subscription_tier: 'pro',
        subscription_start: new Date(now).toISOString(),
        subscription_expiry: new Date(expiry).toISOString(),
      }).eq('id', currentUserRef.current.id);
      if (error) throw error;
    }

    await fetchMyProfile(currentUserRef.current.id);
  };

  const restoreProPurchases = async (): Promise<boolean> => {
    if (!currentUserRef.current) return false;
    const customerInfo = await rcRestorePurchases();
    if (isProActive(customerInfo)) {
      await syncRcWithSupabase(currentUserRef.current.id);
      await fetchMyProfile(currentUserRef.current.id);
      return true;
    }
    return false;
  };

  const checkProAccess = (type: 'room_count' | 'archive_limit' | 'formation' | 'feedback_limit' | 'reminder', roomId?: string) => {
    if (isPro) return { canAccess: true };
    const room = roomId ? (queryClient.getQueryData(['rooms', currentUser?.id]) as any[] || []).find((r: any) => r.id === roomId) : null;
    const roomLeaderIsPro = room?.leaderIsPro === true;
    switch (type) {
      case 'room_count': {
        const count = (queryClient.getQueryData(['rooms', currentUser?.id]) as any[] || []).length;
        return { canAccess: count < 3, limit: 3, current: count };
      }
      case 'archive_limit': return roomLeaderIsPro ? { canAccess: true } : { canAccess: false, limit: 20 };
      case 'feedback_limit': return roomLeaderIsPro ? { canAccess: true } : { canAccess: false, limit: 10 };
      case 'formation': return { canAccess: false };
      case 'reminder': return { canAccess: false };
      default: return { canAccess: true };
    }
  };

  const sendProReminder = async (roomId: string, type: 'vote' | 'schedule', targetId: string) => {
    if (!isPro) throw new Error('Pro 멤버십 전용 기능입니다.');
    const rooms = queryClient.getQueryData(['rooms', currentUser?.id]) as any[] || [];
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    let contentTitle = '';
    let nonResponders: string[] = [];
    if (type === 'vote') {
      const vote = votesMapped.find(v => v.id === targetId);
      if (vote) {
        contentTitle = vote.question;
        const responders = Object.keys(vote.responses || {});
        nonResponders = (room.members || []).filter((mid: string) => !responders.includes(mid) && mid !== currentUser?.id);
      }
    } else {
      const sch = schedulesMapped.find(s => s.id === targetId);
      if (sch) {
        contentTitle = sch.title;
        const responders = Object.keys(sch.responses || {});
        nonResponders = (room.members || []).filter((mid: string) => !responders.includes(mid) && mid !== currentUser?.id);
      }
    }
    if (nonResponders.length > 0) {
      const targetPath = type === 'vote' ? `/room/${roomId}/vote` : `/room/${roomId}/schedule`;
      await sendTypedPush(nonResponders, 'response_request', { roomName: room.name, contentTitle, subtype: type }, { targetPath, roomId });
    }
  };

  const sendDirectReminder = async (userIds: string[], notificationType: string, vars: Record<string, any>) => {
    if (!isPro) throw new Error('Pro 멤버십 전용 기능입니다.');
    if (userIds.length > 0) await sendTypedPush(userIds, notificationType, vars);
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

  const getRoomDisplayUser = (roomId: string, userId: string) => {
    const global = allUsers.find(u => u.id === userId);
    const remote = (roomProfilesQuery.data || []).find(
      (p: any) => p.room_id === roomId && p.user_id === userId
    );
    const local = roomProfiles[`${roomId}_${userId}`];
    const isEnabled = remote?.enabled ?? local?.enabled ?? false;
    if (!global && !remote && !local) return undefined;
    if (isEnabled) {
      return {
        name: remote?.name || local?.name || global?.name || '',
        profileImage: (remote?.profile_image ?? local?.profileImage) ?? global?.profileImage ?? null,
      };
    }
    return {
      name: global?.name || '',
      profileImage: global?.profileImage ?? null,
    };
  };

  const getRoomUserProfile = (roomId: string, userId: string) => {
    const remote = (roomProfilesQuery.data || []).find(
      (p: any) => p.room_id === roomId && p.user_id === userId
    );
    if (remote) return { name: remote.name, profileImage: remote.profile_image, enabled: remote.enabled ?? false };
    const local = roomProfiles[`${roomId}_${userId}`];
    if (local) return { ...local, enabled: local.enabled ?? false };
    return null;
  };

  const refreshAllData = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('global-sync').on('postgres_changes', { event: '*', schema: 'public' }, () => refreshAllData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser, refreshAllData]);

  // 로그인 시 앱 언어를 profiles.language에 동기화 (push 알림 언어 적용)
  useEffect(() => {
    if (!currentUser) return;
    AsyncStorage.getItem('app_language').then(val => {
      const lang = (val && SUPPORTED_LANGUAGES.includes(val as Language)) ? val : 'ko';
      supabase.from('profiles').update({ language: lang }).eq('id', currentUser.id);
    });
  }, [currentUser?.id]);

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
    return (s || []).map(sch => ({ ...sch, all_responders: (r || []).filter(res => res.schedule_id === sch.id).map(res => res.user_id), schedule_options: (o || []).filter(opt => opt.schedule_id === sch.id).map(opt => ({ ...opt, schedule_responses: (r || []).filter(res => res.option_ids?.includes(opt.id)) })) }));
  }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });

  const votesQuery = useQuery({ queryKey: ['votes', roomIds], queryFn: async () => {
    const { data: v } = await supabase.from('votes').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const { data: o = [] } = await supabase.from('vote_options').select('*').in('vote_id', (v || []).map(x => x.id));
    const { data: r = [] } = await supabase.from('vote_responses').select('*').in('vote_id', (v || []).map(x => x.id));
    return (v || []).map(vote => ({ ...vote, all_responders: (r || []).filter(res => res.vote_id === vote.id).map(res => res.user_id), vote_options: (o || []).filter(opt => opt.vote_id === vote.id).map(opt => ({ ...opt, vote_responses: (r || []).filter(res => res.option_ids?.includes(opt.id)) })) }));
  }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });

  const noticesQuery = useQuery({ queryKey: ['notices', roomIds], queryFn: async () => {
    const { data: n } = await supabase.from('notices').select('*').in('room_id', roomIds);
    const { data: c = [] } = await supabase.from('notice_comments').select('*').in('notice_id', (n || []).map(x => x.id)).order('created_at', { ascending: true });
    return (n || []).map(notice => ({ ...notice, notice_comments: (c || []).filter(comment => comment.notice_id === notice.id) }));
  }, enabled: roomIds.length > 0, placeholderData: keepPreviousData });

  const roomProfilesQuery = useQuery({
    queryKey: ['room_profiles', roomIds],
    queryFn: async () => {
      const { data } = await supabase
        .from('room_profiles')
        .select('room_id, user_id, name, profile_image, enabled')
        .in('room_id', roomIds);
      return data || [];
    },
    enabled: roomIds.length > 0,
    placeholderData: keepPreviousData
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!currentUser,
    placeholderData: keepPreviousData
  });

  const inAppNotifications: InAppNotification[] = (notificationsQuery.data || []).map((n: any) => ({
    id: n.id,
    userId: n.user_id,
    roomId: n.room_id,
    roomName: n.room_name,
    type: n.type,
    title: n.title,
    body: n.body,
    targetPath: n.target_path,
    isRead: n.is_read,
    createdAt: new Date(n.created_at).getTime(),
  }));

  const unreadNotificationCount = inAppNotifications.filter(n => !n.isRead).length;

  const markNotificationRead = async (id: string) => {
    queryClient.setQueryData(['notifications', currentUser?.id], (old: any[]) =>
      (old || []).map((n: any) => n.id === id ? { ...n, is_read: true } : n)
    );
    supabase.from('notifications').update({ is_read: true }).eq('id', id).then(() => {});
  };

  const markAllNotificationsRead = async () => {
    queryClient.setQueryData(['notifications', currentUser?.id], (old: any[]) =>
      (old || []).map((n: any) => ({ ...n, is_read: true }))
    );
    if (currentUser) {
      supabase.from('notifications').update({ is_read: true })
        .eq('user_id', currentUser.id).eq('is_read', false).then(() => {});
    }
  };

  const formationsQuery = useQuery({ queryKey: ['formations', roomIds], queryFn: async () => {
    const { data: remote } = await supabase.from('formations').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    const localRaw = await AsyncStorage.getItem('local_formations');
    const local = localRaw ? JSON.parse(localRaw) : [];
    const mappedRemote = (remote || []).map(form => ({ id: form.id, roomId: form.room_id, userId: form.user_id, title: form.title, audioUrl: form.audio_url, videoSettings: form.video_settings, settings: form.settings, data: form.data, createdAt: new Date(form.created_at).getTime(), isLocal: false, isPublished: form.is_published ?? false })) as Formation[];
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
    const viewedBy = Array.from(new Set([...(s.viewed_by || []), ...(s.all_responders || [])]));
    return { id: s.id, roomId: s.room_id, userId: s.user_id, title: s.title, options: (s.schedule_options || []).map((o:any)=>({id:o.id, dateTime: o.date_time})), responses: resp, viewedBy, useNotification: s.use_notification, reminderMinutes: s.reminder_before, deadline: s.deadline ? new Date(s.deadline).getTime() : undefined, createdAt: new Date(s.created_at).getTime() };
  }).filter(s => !blockedUsers.includes(s.userId));
  const votesMapped: Vote[] = (votesQuery.data || []).map(v => {
    const resp: Record<string, string[]> = {}; (v.vote_options || []).forEach((o: any) => (o.vote_responses || []).forEach((r: any) => { if (!resp[r.user_id]) resp[r.user_id] = []; if (!resp[r.user_id].includes(o.id)) resp[r.user_id].push(o.id); }));
    const viewedBy = Array.from(new Set([...(v.viewed_by || []), ...(v.all_responders || [])]));
    return { id: v.id, roomId: v.room_id, userId: v.user_id, question: v.question, isAnonymous: v.is_anonymous, allowMultiple: v.allow_multiple, options: (v.vote_options || []).map((o:any)=>({id:o.id, text: o.text})), responses: resp, viewedBy, useNotification: v.use_notification, reminderMinutes: v.reminder_before, deadline: v.deadline ? new Date(v.deadline).getTime() : undefined, createdAt: new Date(v.created_at).getTime(), comments: [] };
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
  const joinRoom = async (rid: string, pc: string) => {
    if (!currentUserRef.current) return;
    const room = await roomService.joinRoom(rid, pc, currentUserRef.current.id);
    if (room) {
      console.log('[AppContext] Join success, updating cache for room:', room.id);
      queryClient.setQueryData(['rooms', currentUserRef.current.id], (old: any[] | undefined) => {
        const list = old || [];
        if (list.find((r: any) => r.id === room.id)) return list;
        return [...list, room];
      });
      addRoomActivity(rid, 'member_join');
      await refreshAllData();
    }
    return room;
  };
  const updateRoom = async (rid: string, n: string, i?: string | null) => { await roomService.updateRoom(rid, n, i); await refreshAllData(); };
  const deleteRoom = async (id: string) => { 
    await roomService.deleteRoom(id); 
    // 즉시 캐시에서 제거
    queryClient.setQueryData(['rooms', currentUserRef.current?.id], (old: any[] | undefined) => {
      return (old || []).filter((r: any) => r.id !== id);
    });
    await refreshAllData(); 
  };
  const leaveRoom = async (id: string) => {
    if (!currentUserRef.current) return;
    await addRoomActivity(id, 'member_leave');
    await roomService.leaveRoom(id, currentUserRef.current.id);
    queryClient.setQueryData(['rooms', currentUserRef.current.id], (old: any[] | undefined) => {
      return (old || []).filter((r: any) => r.id !== id);
    });
    await refreshAllData();
  };
  const kickMember = async (roomId: string, userId: string) => {
    const kickedUser = allUsers.find(u => u.id === userId);
    if (kickedUser) {
      await supabase.from('room_activity').insert({
        room_id: roomId,
        type: 'member_leave',
        actor_id: userId,
        actor_name: kickedUser.name,
        content_title: null,
      }).then(() => queryClient.invalidateQueries({ queryKey: ['room_activity', roomId] }));
    }
    await roomService.kickMember(roomId, userId);
    await refreshAllData();
  };
  const submitFeedback = async (type: 'bug' | 'feature' | 'other', content: string) => { if (!currentUserRef.current) throw new Error(t('loginRequired')); await contentService.submitFeedback(currentUserRef.current.id, type, content); };
  
  const addNotice = async (rid: string, t: string, c: string, p = false, imgs: string[] = [], useNoti = true) => {
    if (!currentUserRef.current) return;
    const { data: notice } = await contentService.addNotice(rid, currentUserRef.current.id, t, c, p, imgs, useNoti);
    // Optimistic update: inject new notice into cache immediately so it appears without waiting for refetch
    if (notice) {
      queryClient.setQueryData(['notices', roomIds], (old: any[] | undefined) => [
        ...(old || []),
        { ...notice, notice_comments: [] },
      ]);
    }
    const memberIds = (roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUserRef.current?.id);
    const targetPath = (notice as any)?.id ? `/room/${rid}/notice/${(notice as any).id}` : `/room/${rid}`;
    if (useNoti) {
      const rName = roomsData.find(r=>r.id===rid)?.name || '';
      sendTypedPush(memberIds, 'notice_new', { roomName: rName, actorName: currentUserRef.current.name, content: t }, { targetPath, roomId: rid });
      saveInAppNotifications(memberIds, rid, 'notice_new', '새로운 공지사항', `${currentUserRef.current.name}: ${t}`, targetPath);
    }
    addRoomActivity(rid, 'notice', t);
    await refreshAllData();
  };
  const updateNotice = async (id: string, updates: Partial<Notice>) => {
    await contentService.updateNotice(id, { title: updates.title, content: updates.content, is_pinned: updates.isPinned, image_urls: updates.imageUrls });
    if (updates.useNotification && currentUserRef.current) {
      const notice = noticesMapped.find(n => n.id === id);
      if (notice) {
        const memberIds = (roomsData.find(r=>r.id===notice.roomId)?.members || []).filter(uid=>uid!==currentUserRef.current?.id);
        const rName = roomsData.find(r=>r.id===notice.roomId)?.name || '';
        const newTitle = updates.title || notice.title;
        sendTypedPush(memberIds, 'notice_edit', { roomName: rName, actorName: currentUserRef.current.name, content: newTitle }, { targetPath: `/room/${notice.roomId}/notice/${notice.id}`, roomId: notice.roomId });
        saveInAppNotifications(memberIds, notice.roomId, 'notice_new', '공지 수정됨', `${currentUserRef.current.name}: ${newTitle}`, `/room/${notice.roomId}/notice/${notice.id}`);
      }
    }
    await refreshAllData();
  };
  const deleteNotice = async (id: string) => { await contentService.deleteNotice(id); await refreshAllData(); };
  const addNoticeComment = async (nid: string, t: string, pid?: string) => {
    if (!currentUserRef.current) return;
    await contentService.addNoticeComment(nid, currentUserRef.current.id, t, pid);
    const notice = noticesMapped.find(n => n.id === nid);
    if (notice && notice.userId !== currentUserRef.current.id) {
      const rName = roomsData.find(r=>r.id===notice.roomId)?.name || '';
      sendTypedPush([notice.userId], 'notice_comment', { roomName: rName, actorName: currentUserRef.current.name, content: t, contentTitle: notice.title }, { targetPath: `/room/${notice.roomId}/notice/${nid}`, roomId: notice.roomId });
      saveInAppNotifications([notice.userId], notice.roomId, 'notice_comment', `[${notice.title}] 새 댓글`, `${currentUserRef.current.name}: ${t}`, `/room/${notice.roomId}/notice/${nid}`);
    }
    await refreshAllData();
  };
  const updateNoticeComment = async (id: string, t: string) => { await contentService.updateNoticeComment(id, t); await refreshAllData(); };
  const deleteNoticeComment = async (id: string) => { await contentService.deleteNoticeComment(id); await refreshAllData(); };

  const addVideo = async (rid: string, url: string, t: string, useNoti = true, choreographyUrl?: string) => {
    if (!currentUserRef.current) return;
    await contentService.addVideo(rid, currentUserRef.current.id, url, t, useNoti, choreographyUrl);
    const memberIds = (roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUserRef.current?.id);
    if (useNoti) {
      const rName = roomsData.find(r=>r.id===rid)?.name || '';
      sendTypedPush(memberIds, 'video_new', { roomName: rName, actorName: currentUserRef.current.name, content: t }, { targetPath: `/room/${rid}/feedback`, roomId: rid });
      saveInAppNotifications(memberIds, rid, 'video_new', '새로운 피드백 영상', `${currentUserRef.current.name}: ${t}`, `/room/${rid}/feedback`);
    }
    addRoomActivity(rid, 'video', t);
    await refreshAllData();
  };
  const updateVideo = async (id: string, t: string) => { await contentService.updateVideo(id, t); await refreshAllData(); };
  const deleteVideo = async (id: string) => { await contentService.deleteVideo(id); await refreshAllData(); };
  const addComment = async (vid: string, t: string, ts: number, pid?: string) => {
    if (!currentUserRef.current) return;
    await contentService.addVideoComment(vid, currentUserRef.current.id, t, ts, pid);
    const video = videosMapped.find(v => v.id === vid);
    if (video && video.userId !== currentUserRef.current.id) {
      const rName = roomsData.find(r=>r.id===video.roomId)?.name || '';
      sendTypedPush([video.userId], 'video_comment', { roomName: rName, actorName: currentUserRef.current.name, content: t, contentTitle: video.title }, { targetPath: `/room/${video.roomId}/feedback`, roomId: video.roomId });
      saveInAppNotifications([video.userId], video.roomId, 'video_comment', `[${video.title}] 새 피드백`, `${currentUserRef.current.name}: ${t}`, `/room/${video.roomId}/feedback`);
    }
    await refreshAllData();
  };
  const updateComment = async (id: string, t: string) => { await contentService.updateVideoComment(id, t); await refreshAllData(); };
  const deleteComment = async (id: string) => { await contentService.deleteVideoComment(id); await refreshAllData(); };

  const addPhoto = async (rid: string, url: string, d?: string, useNoti = true) => {
    if (!currentUserRef.current) return;
    await storageService.uploadToGallery(rid, currentUserRef.current.id, url, d);
    const memberIds = (roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUserRef.current?.id);
    if (useNoti) {
      const rName = roomsData.find(r=>r.id===rid)?.name || '';
      sendTypedPush(memberIds, 'archive_new', { roomName: rName, actorName: currentUserRef.current.name, content: d || '' }, { targetPath: `/room/${rid}/archive`, roomId: rid });
      saveInAppNotifications(memberIds, rid, 'archive_new', '새로운 아카이브', `${currentUserRef.current.name}${d ? `: ${d}` : ''}`, `/room/${rid}/archive`);
    }
    addRoomActivity(rid, 'archive', d);
    await refreshAllData();
  };
  const updatePhoto = async (id: string, d: string) => { await contentService.updatePhoto(id, d); await refreshAllData(); };
  const deletePhoto = async (id: string) => { await contentService.deletePhoto(id); await refreshAllData(); };
  const addPhotoComment = async (phid: string, t: string, pid?: string) => {
    if (!currentUserRef.current) return;
    await contentService.addPhotoComment(phid, currentUserRef.current.id, t, pid);
    const photo = photosMapped.find(p => p.id === phid);
    if (photo && photo.userId !== currentUserRef.current.id) {
      const rName = roomsData.find(r=>r.id===photo.roomId)?.name || '';
      sendTypedPush([photo.userId], 'archive_comment', { roomName: rName, actorName: currentUserRef.current.name, content: t }, { targetPath: `/room/${photo.roomId}/archive`, roomId: photo.roomId });
      saveInAppNotifications([photo.userId], photo.roomId, 'archive_comment', '아카이브 새 댓글', `${currentUserRef.current.name}: ${t}`, `/room/${photo.roomId}/archive`);
    }
    await refreshAllData();
  };
  const updatePhotoComment = async (id: string, t: string) => { await contentService.updatePhotoComment(id, t); await refreshAllData(); };
  const deletePhotoComment = async (id: string) => { await contentService.deletePhotoComment(id); await refreshAllData(); };

  const addVote = async (rid: string, q: string, opts: string[], s: any) => {
    if (!currentUserRef.current) return;
    const useNoti = s.useNotification ?? false;
    const { data: v, error } = await contentService.addVote(rid, currentUserRef.current.id, q, s.isAnonymous, s.allowMultiple, useNoti, s.deadline ? new Date(s.deadline).toISOString() : undefined, s.reminderMinutes);
    if (error) throw error;
    if (v) {
      const { error: oError } = await contentService.addVoteOptions(v.id, opts);
      if (oError) throw oError;
      queryClient.setQueryData(['votes', roomIds], (old: any[] = []) => [
        { ...v, vote_options: [], vote_responses: [], all_responders: [] },
        ...old,
      ]);
    }
    const memberIds = (roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUserRef.current?.id);
    if (useNoti) {
      const rName = roomsData.find(r=>r.id===rid)?.name || '';
      sendTypedPush(memberIds, 'vote_new', { roomName: rName, actorName: currentUserRef.current.name, content: q }, { targetPath: `/room/${rid}/vote`, roomId: rid });
      saveInAppNotifications(memberIds, rid, 'vote_new', '새로운 투표', `${currentUserRef.current.name}: ${q}`, `/room/${rid}/vote`);
    }
    addRoomActivity(rid, 'vote', q);
    await refreshAllData();
  };
  const updateVote = async (id: string, updates: Partial<Vote>) => { await contentService.updateVote(id, { question: updates.question, deadline: updates.deadline ? new Date(updates.deadline).toISOString() : undefined, use_notification: updates.useNotification, reminder_before: updates.reminderMinutes }); await refreshAllData(); };
  const closeVote = async (id: string) => { await updateVote(id, { deadline: Date.now() }); const vote = votesMapped.find(v => v.id === id); if (vote) { const rName = roomsData.find(r=>r.id===vote.roomId)?.name || ''; sendTypedPush((roomsData.find(r=>r.id===vote.roomId)?.members || []).filter(uid=>uid!==currentUserRef.current?.id), 'vote_closed', { roomName: rName, contentTitle: vote.question }, { targetPath: `/room/${vote.roomId}/vote`, roomId: vote.roomId }); } await refreshAllData(); };
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
      const existingResponders: string[] = v.all_responders || [];
      const all_responders = existingResponders.includes(userId) ? existingResponders : [...existingResponders, userId];
      return { ...v, vote_options: updatedOptions, all_responders };
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

  const markVoteViewed = async (vid: string) => {
    if (!currentUserRef.current) return;
    const uid = currentUserRef.current.id;
    queryClient.setQueryData(['votes', roomIds], (old: any[]) => (old || []).map(v => {
      if (v.id !== vid) return v;
      const current: string[] = v.viewed_by || [];
      if (current.includes(uid)) return v;
      return { ...v, viewed_by: [...current, uid] };
    }));
    contentService.markVoteViewed(vid, uid).catch(() => {});
  };

  const markScheduleViewed = async (sid: string) => {
    if (!currentUserRef.current) return;
    const uid = currentUserRef.current.id;
    queryClient.setQueryData(['schedules', roomIds], (old: any[]) => (old || []).map(s => {
      if (s.id !== sid) return s;
      const current: string[] = s.viewed_by || [];
      if (current.includes(uid)) return s;
      return { ...s, viewed_by: [...current, uid] };
    }));
    contentService.markScheduleViewed(sid, uid).catch(() => {});
  };

  const addSchedule = async (rid: string, t: string, opts: string[], useNoti = true, dl?: number, reminderMinutes?: number) => {
    if (!currentUserRef.current) return;
    const { data: s, error } = await contentService.addSchedule(rid, currentUserRef.current.id, t, useNoti, dl ? new Date(dl).toISOString() : undefined, reminderMinutes);
    if (error) throw error;
    if (s) {
      const { error: oError } = await contentService.addScheduleOptions(s.id, opts);
      if (oError) throw oError;
    }
    const memberIds = (roomsData.find(r=>r.id===rid)?.members || []).filter(id=>id!==currentUserRef.current?.id);
    if (useNoti) {
      const rName = roomsData.find(r=>r.id===rid)?.name || '';
      sendTypedPush(memberIds, 'schedule_new', { roomName: rName, actorName: currentUserRef.current.name, content: t }, { targetPath: `/room/${rid}/schedule`, roomId: rid });
      saveInAppNotifications(memberIds, rid, 'schedule_new', '새로운 일정 조율', `${currentUserRef.current.name}: ${t}`, `/room/${rid}/schedule`);
    }
    addRoomActivity(rid, 'schedule', t);
    await refreshAllData();
  };
  const updateSchedule = async (id: string, updates: Partial<Schedule>) => { await contentService.updateSchedule(id, { title: updates.title, deadline: updates.deadline ? new Date(updates.deadline).toISOString() : undefined, use_notification: updates.useNotification, reminder_before: updates.reminderMinutes }); await refreshAllData(); };
  const closeSchedule = async (id: string) => { await updateSchedule(id, { deadline: Date.now() }); const sch = schedulesMapped.find(s => s.id === id); if (sch) { const rName = roomsData.find(r=>r.id===sch.roomId)?.name || ''; sendTypedPush((roomsData.find(r=>r.id===sch.roomId)?.members || []).filter(uid=>uid!==currentUserRef.current?.id), 'schedule_closed', { roomName: rName, contentTitle: sch.title }, { targetPath: `/room/${sch.roomId}/schedule`, roomId: sch.roomId }); } await refreshAllData(); };
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
      const existingResponders: string[] = s.all_responders || [];
      const all_responders = existingResponders.includes(userId) ? existingResponders : [...existingResponders, userId];
      return { ...s, schedule_options: updatedOptions, all_responders };
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

  const addFormation = async (rid: string, title: string, audioUrl?: string, settings?: any, data?: any) => { if (!currentUserRef.current) throw new Error('로그인이 필요합니다.'); const newId = Math.random().toString(36).substr(2, 9); const newFormation: Formation = { id: newId, roomId: rid, userId: currentUserRef.current.id, title, audioUrl, settings: settings || { gridRows: 10, gridCols: 20, stageDirection: 'top', snapToGrid: true, dancerNameSize: 8, sideWingWidth: 2 }, data: data || { dancers: [], scenes: [], timeline: [] }, createdAt: Date.now() }; const localRaw = await AsyncStorage.getItem('local_formations'); const local = localRaw ? JSON.parse(localRaw) : []; await AsyncStorage.setItem('local_formations', JSON.stringify([...local, newFormation])); await refreshAllData(); return newId; };
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
    updateUserProfile, logout, deleteAccount, blockUser, reportContent, blockedUsers, submitFeedback,
    rooms: roomsData, isLoadingRooms, users: allUsers, getUserById, getRoomDisplayUser, getRoomByIdRemote: roomService.getRoomByIdRemote, createRoom, joinRoom, updateRoom, deleteRoom, leaveRoom, kickMember,
    notices: noticesMapped, addNotice, updateNotice, deleteNotice, addNoticeComment, updateNoticeComment, deleteNoticeComment,
    videos: videosMapped, addVideo, updateVideo, deleteVideo, addComment, updateComment, deleteComment,
    photos: photosMapped, addPhoto, updatePhoto, deletePhoto, addPhotoComment, updatePhotoComment, deletePhotoComment, markItemAsAccessed,
    schedules: schedulesMapped, addSchedule, updateSchedule, respondToSchedule, deleteSchedule, closeSchedule, markScheduleViewed,
    votes: votesMapped, addVote, updateVote, respondToVote, deleteVote, closeVote, markVoteViewed,
    formations: formationsQuery.data || [], addFormation, updateFormation, deleteFormation, publishFormationAsFeedback,
    sendPushNotification, inAppNotifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead,
    refreshAllData, themeType, setThemeType, customColor, setCustomColor, customBackgroundColor, setCustomBackgroundColor, theme,
    updateRoomUserProfile, getRoomUserProfile, roomProfiles, isPro, checkProAccess, purchasePro, restoreProPurchases, sendProReminder, sendDirectReminder,
    language, setLanguage, t
  }), [
    currentUser, isLoadingUser, roomsData, isLoadingRooms, allUsers, noticesMapped, videosMapped, photosMapped, schedulesMapped, votesMapped, formationsQuery.data,
    inAppNotifications, unreadNotificationCount,
    themeType, customColor, customBackgroundColor, theme, roomProfiles, roomProfilesQuery.data, blockedUsers, isPro, language, t
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
