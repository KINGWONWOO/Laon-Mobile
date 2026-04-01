import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, Room, Notice, VideoFeedback, Photo, Schedule, Vote, Alarm, AlarmType, ThemeType } from '../types';
import * as Crypto from 'expo-crypto';
import { getThemeColors } from '../constants/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { storageService } from '../services/storageService';

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
  
  notices: Notice[];
  addNotice: (roomId: string, title: string, content: string, isPinned?: boolean, images?: string[]) => Promise<void>;
  updateNotice: (noticeId: string, title: string, content: string, isPinned: boolean) => Promise<void>;
  deleteNotice: (noticeId: string) => Promise<void>;
  togglePinNotice: (noticeId: string) => Promise<void>;
  markNoticeAsViewed: (noticeId: string) => Promise<void>;
  
  videos: VideoFeedback[];
  addVideo: (roomId: string, youtubeUrl: string, title: string, youtubeId: string) => Promise<void>;
  addComment: (videoId: string, text: string, timestampMillis: number) => Promise<void>;
  
  photos: Photo[];
  addPhoto: (roomId: string, photoUrl: string) => Promise<void>;

  schedules: Schedule[];
  addSchedule: (roomId: string, title: string, options: string[], startDate?: string, endDate?: string, sendNotification?: boolean) => Promise<void>;
  updateSchedule: (scheduleId: string, title: string) => Promise<void>;
  deleteSchedule: (scheduleId: string) => Promise<void>;
  respondToSchedule: (scheduleId: string, optionIds: string[]) => Promise<void>;
  markScheduleAsViewed: (scheduleId: string) => Promise<void>;

  votes: Vote[];
  addVote: (roomId: string, question: string, options: string[], settings: { 
    isAnonymous?: boolean, 
    allowMultiple?: boolean, 
    sendNotification?: boolean,
    deadline?: number,
    notificationMinutes?: number 
  }) => Promise<void>;
  updateVote: (voteId: string, question: string) => Promise<void>;
  deleteVote: (voteId: string) => Promise<void>;
  respondToVote: (voteId: string, optionIds: string[]) => Promise<void>;
  markVoteAsViewed: (voteId: string) => Promise<void>;

  alarms: Alarm[];
  addAlarm: (roomId: string, title: string, content: string, type: AlarmType, targetId: string) => Promise<void>;
  markAlarmAsViewed: (alarmId: string) => Promise<void>;

  themeType: ThemeType;
  setThemeType: (theme: ThemeType) => void;
  theme: any;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [themeType, setThemeType] = useState<ThemeType>('dark');
  const [users, setUsers] = useState<User[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);

  const theme = getThemeColors(themeType);

  // Auth Sync
  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted && session?.user) setCurrentUser({
        id: session.user.id,
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '댄서',
        profileImage: session.user.user_metadata?.profile_image,
      });
      setIsLoadingUser(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setCurrentUser(session?.user ? {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '댄서',
          profileImage: session.user.user_metadata?.profile_image,
        } : null);
        setIsLoadingUser(false);
      }
    });

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

  // Realtime Subscription Logic
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        console.log('[Realtime] Change received:', payload.table);
        if (payload.table === 'notices') queryClient.invalidateQueries({ queryKey: ['notices'] });
        if (payload.table === 'videos' || payload.table === 'video_comments') queryClient.invalidateQueries({ queryKey: ['videos'] });
        if (payload.table === 'gallery_items') queryClient.invalidateQueries({ queryKey: ['photos'] });
        if (payload.table === 'schedules' || payload.table === 'schedule_options' || payload.table === 'schedule_responses') queryClient.invalidateQueries({ queryKey: ['schedules'] });
        if (payload.table === 'votes' || payload.table === 'vote_options' || payload.table === 'vote_responses') queryClient.invalidateQueries({ queryKey: ['votes'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Data Fetching
  const roomsQuery = useQuery({
    queryKey: ['rooms', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data } = await supabase.from('room_members').select('rooms (*)').eq('user_id', currentUser?.id);
      return (data?.map(item => item.rooms).filter(Boolean) || []) as Room[];
    },
    enabled: !!currentUser,
  });
  
  const rooms = roomsQuery.data || [];
  const isLoadingRooms = roomsQuery.isLoading;

  const fetchRoomData = async (table: string) => {
    if (rooms.length === 0) return [];
    const { data } = await supabase.from(table).select('*').in('room_id', rooms.map(r => r.id)).order('created_at', { ascending: false });
    return data || [];
  };

  const noticesQuery = useQuery({ queryKey: ['notices', rooms.map(r => r.id)], queryFn: () => fetchRoomData('notices'), enabled: rooms.length > 0 });
  const videosQuery = useQuery({ queryKey: ['videos', rooms.map(r => r.id)], queryFn: () => fetchRoomData('videos'), enabled: rooms.length > 0 });
  const photosQuery = useQuery({ queryKey: ['photos', rooms.map(r => r.id)], queryFn: () => fetchRoomData('gallery_items'), enabled: rooms.length > 0 });
  const schedulesQuery = useQuery({ queryKey: ['schedules', rooms.map(r => r.id)], queryFn: () => fetchRoomData('schedules'), enabled: rooms.length > 0 });
  const votesQuery = useQuery({ queryKey: ['votes', rooms.map(r => r.id)], queryFn: () => fetchRoomData('votes'), enabled: rooms.length > 0 });

  // Mapping
  const notices = (noticesQuery.data || []).map(n => ({
    id: n.id, roomId: n.room_id, userId: n.user_id, title: n.title, content: n.content,
    isPinned: n.is_pinned, images: n.image_urls, viewedBy: n.viewed_by, createdAt: new Date(n.created_at).getTime()
  }));

  const videos = (videosQuery.data || []).map(v => ({
    id: v.id, roomId: v.room_id, userId: v.user_id, videoUrl: v.youtube_url || v.storage_path,
    title: v.title, createdAt: new Date(v.created_at).getTime(), comments: []
  }));

  const photos = (photosQuery.data || []).map(p => ({
    id: p.id, roomId: p.room_id, userId: p.user_id, photoUrl: p.file_path, createdAt: new Date(p.created_at).getTime()
  }));

  const schedules = (schedulesQuery.data || []).map(s => ({
    id: s.id, roomId: s.room_id, userId: s.user_id, title: s.title, viewedBy: s.viewed_by,
    startDate: s.start_date, endDate: s.end_date, createdAt: new Date(s.created_at).getTime(),
    options: [], responses: {}
  }));

  const votes = (votesQuery.data || []).map(v => ({
    id: v.id, roomId: v.room_id, userId: v.user_id, question: v.question, 
    isAnonymous: v.is_anonymous, allowMultiple: v.allow_multiple, 
    viewedBy: v.viewed_by, deadline: v.deadline ? new Date(v.deadline).getTime() : undefined,
    createdAt: new Date(v.created_at).getTime(), options: [], responses: {}, comments: []
  }));

  const login = async (email: string, password: string) => { await supabase.auth.signInWithPassword({ email, password }); };
  const logout = async () => { setCurrentUser(null); await supabase.auth.signOut(); queryClient.clear(); };

  const createRoom = async (name: string, passcode: string, imageUri?: string) => {
    if (!currentUser) throw new Error("로그인 필요");
    
    let finalImage = imageUri;
    if (imageUri && !imageUri.startsWith('http')) {
      finalImage = await storageService.uploadProfileImage('room', uuidv4(), imageUri);
    }

    console.log('[AppContext] Attempting to create room:', name);

    // 1. 방 생성 (DB 트리거가 멤버 추가를 자동으로 처리할 것으로 예상)
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .insert([{ 
        name, 
        passcode, 
        image_uri: finalImage, 
        leader_id: currentUser.id 
      }])
      .select()
      .single();

    if (roomError) {
      console.error('[AppContext] Room Insert Error:', roomError.message);
      throw new Error(`방 생성 실패: ${roomError.message}`);
    }

    // 💡 참고: 만약 방 생성 후 목록에 본인이 안 보인다면, 
    // 그때 다시 upsert 로직을 추가해야 합니다. 
    // 현재는 트리거 에러 해결을 위해 생략합니다.

    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    return roomData as Room;
  };

  const joinRoom = async (roomId: string, passcode: string) => {
    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).eq('passcode', passcode).single();
    if (!room || !currentUser) return null;
    await supabase.from('room_members').upsert([{ room_id: roomId, user_id: currentUser.id }], { onConflict: 'room_id,user_id' });
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    return room as Room;
  };

  const addNotice = async (roomId: string, title: string, content: string, isPinned = false, images?: string[]) => {
    await supabase.from('notices').insert([{ room_id: roomId, user_id: currentUser?.id, title, content, is_pinned: isPinned, image_urls: images || [] }]);
  };

  const updateNotice = async (noticeId: string, title: string, content: string, isPinned: boolean) => {
    await supabase.from('notices').update({ title, content, is_pinned: isPinned }).eq('id', noticeId);
  };

  const deleteNotice = async (noticeId: string) => { await supabase.from('notices').delete().eq('id', noticeId); };

  const addVideo = async (roomId: string, youtubeUrl: string, title: string, youtubeId: string) => {
    await supabase.from('videos').insert([{ room_id: roomId, user_id: currentUser?.id, title, youtube_url: youtubeUrl, youtube_id: youtubeId }]);
  };

  const addComment = async (videoId: string, text: string, timestampMillis: number) => {
    await supabase.from('video_comments').insert([{ video_id: videoId, user_id: currentUser?.id, text, timestamp_millis: timestampMillis }]);
  };

  const addPhoto = async (roomId: string, photoUrl: string) => {
    if (currentUser) await storageService.uploadToGallery(roomId, currentUser.id, photoUrl);
  };

  const addSchedule = async (roomId: string, title: string, options: string[], startDate?: string, endDate?: string) => {
    const { data: schedule } = await supabase.from('schedules').insert([{ room_id: roomId, user_id: currentUser?.id, title, start_date: startDate, end_date: endDate }]).select().single();
    if (schedule) await supabase.from('schedule_options').insert(options.map(opt => ({ schedule_id: schedule.id, date_time: opt })));
  };

  const respondToSchedule = async (scheduleId: string, optionIds: string[]) => {
    await supabase.from('schedule_responses').upsert([{ schedule_id: scheduleId, user_id: currentUser?.id, option_ids: optionIds }], { onConflict: 'schedule_id,user_id' });
  };

  const addVote = async (roomId: string, question: string, options: string[], settings: any) => {
    const { data: vote } = await supabase.from('votes').insert([{ 
      room_id: roomId, user_id: currentUser?.id, question, 
      is_anonymous: settings.isAnonymous, allow_multiple: settings.allowMultiple,
      deadline: settings.deadline ? new Date(settings.deadline).toISOString() : null
    }]).select().single();
    if (vote) await supabase.from('vote_options').insert(options.map(opt => ({ vote_id: vote.id, text: opt })));
  };

  const respondToVote = async (voteId: string, optionIds: string[]) => {
    await supabase.from('vote_responses').upsert([{ vote_id: voteId, user_id: currentUser?.id, option_ids: optionIds }], { onConflict: 'vote_id,user_id' });
  };

  const markNoticeAsViewed = async () => {};
  const togglePinNotice = async () => {};
  const getRoomByIdRemote = async (id: string) => {
    const { data } = await supabase.from('rooms').select('*').eq('id', id).single();
    return data as Room;
  };
  const getUserById = (id: string) => users.find(u => u.id === id);
  const updateUserProfile = async (name: string, img?: string) => {
    let final = img;
    if (img && !img.startsWith('http')) final = await storageService.uploadProfileImage('user', currentUser?.id || '', img);
    await supabase.auth.updateUser({ data: { name, profile_image: final } });
  };
  const updateSchedule = async () => {};
  const deleteSchedule = async () => {};
  const markScheduleAsViewed = async () => {};
  const updateVote = async () => {};
  const deleteVote = async () => {};
  const markVoteAsViewed = async () => {};
  const addAlarm = async () => {};
  const markAlarmAsViewed = async (alarmId: string) => {};

  return (
    <AppContext.Provider value={{
      currentUser, isLoadingUser, login, updateUserProfile, logout,
      rooms, isLoadingRooms, users, getUserById, getRoomByIdRemote, createRoom, joinRoom,
      notices, addNotice, updateNotice, deleteNotice, togglePinNotice, markNoticeAsViewed,
      videos, addVideo, addComment,
      photos, addPhoto,
      schedules, addSchedule, updateSchedule, deleteSchedule, respondToSchedule, markScheduleAsViewed,
      votes, addVote, updateVote, deleteVote, respondToVote, markVoteAsViewed,
      alarms, addAlarm, markAlarmAsViewed,
      themeType, setThemeType, theme
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
