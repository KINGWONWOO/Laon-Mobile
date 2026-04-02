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
  deleteRoom: (roomId: string) => Promise<void>;
  
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

  // 1. 세션 동기화
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

  // 2. 실시간 구독
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('schema-db-changes').on('postgres_changes', { event: '*', schema: 'public' }, () => {
      queryClient.invalidateQueries();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // 3. 데이터 로딩
  const { data: roomsData = [], isLoading: isLoadingRooms } = useQuery({
    queryKey: ['rooms', currentUser?.id],
    queryFn: async () => {
      const { data } = await supabase.from('room_members').select('rooms (*)').eq('user_id', currentUser?.id);
      return (data?.map(item => item.rooms).filter(Boolean) || []) as Room[];
    },
    enabled: !!currentUser,
  });

  const roomIds = roomsData.map(r => r.id);

  const noticesQuery = useQuery({ queryKey: ['notices', roomIds], queryFn: async () => {
    const { data } = await supabase.from('notices').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    return data || [];
  }, enabled: roomIds.length > 0 });

  const videosQuery = useQuery({ queryKey: ['videos', roomIds], queryFn: async () => {
    const { data } = await supabase.from('videos').select('*, video_comments(*)').in('room_id', roomIds).order('created_at', { ascending: false });
    return data || [];
  }, enabled: roomIds.length > 0 });

  const photosQuery = useQuery({ queryKey: ['photos', roomIds], queryFn: async () => {
    const { data } = await supabase.from('gallery_items').select('*').in('room_id', roomIds).order('created_at', { ascending: false });
    return data || [];
  }, enabled: roomIds.length > 0 });

  const schedulesQuery = useQuery({ queryKey: ['schedules', roomIds], queryFn: async () => {
    const { data } = await supabase.from('schedules').select('*, schedule_options(*, schedule_responses(*))').in('room_id', roomIds).order('created_at', { ascending: false });
    return data || [];
  }, enabled: roomIds.length > 0 });

  const votesQuery = useQuery({ queryKey: ['votes', roomIds], queryFn: async () => {
    const { data } = await supabase.from('votes').select('*, vote_options(*, vote_responses(*))').in('room_id', roomIds).order('created_at', { ascending: false });
    return data || [];
  }, enabled: roomIds.length > 0 });

  // 4. 데이터 매핑
  const noticesMapped: Notice[] = (noticesQuery.data || []).map(n => ({
    id: n.id, roomId: n.room_id, userId: n.user_id, title: n.title, content: n.content,
    isPinned: n.is_pinned, images: n.image_urls, viewedBy: n.viewed_by || [], createdAt: new Date(n.created_at).getTime()
  }));

  const videosMapped: VideoFeedback[] = (videosQuery.data || []).map(v => ({
    id: v.id, roomId: v.room_id, userId: v.user_id, videoUrl: v.youtube_url || v.storage_path,
    title: v.title, createdAt: new Date(v.created_at).getTime(), comments: (v.video_comments || []).map((c: any) => ({
      id: c.id, userId: c.user_id, text: c.text, timestampMillis: c.timestamp_millis, createdAt: new Date(c.created_at).getTime()
    }))
  }));

  const photosMapped: Photo[] = (photosQuery.data || []).map(p => ({
    id: p.id, roomId: p.room_id, userId: p.user_id, photoUrl: p.file_path, createdAt: new Date(p.created_at).getTime()
  }));

  const schedulesMapped: Schedule[] = (schedulesQuery.data || []).map(s => {
    const responses: Record<string, string[]> = {};
    (s.schedule_options || []).forEach((opt: any) => {
      (opt.schedule_responses || []).forEach((res: any) => {
        if (!responses[res.user_id]) responses[res.user_id] = [];
        responses[res.user_id].push(opt.id);
      });
    });
    return {
      id: s.id, roomId: s.room_id, userId: s.user_id, title: s.title, 
      viewedBy: s.viewed_by || [], createdAt: new Date(s.created_at).getTime(),
      options: (s.schedule_options || []).map((o: any) => ({ id: o.id, dateTime: o.date_time })),
      responses
    };
  });

  const votesMapped: Vote[] = (votesQuery.data || []).map(v => {
    const responses: Record<string, string[]> = {};
    (v.vote_options || []).forEach((opt: any) => {
      (opt.vote_responses || []).forEach((res: any) => {
        if (!responses[res.user_id]) responses[res.user_id] = [];
        responses[res.user_id].push(opt.id);
      });
    });
    return {
      id: v.id, roomId: v.room_id, userId: v.user_id, question: v.question,
      isAnonymous: v.is_anonymous, allowMultiple: v.allow_multiple,
      createdAt: new Date(v.created_at).getTime(), viewedBy: v.viewed_by || [],
      options: (v.vote_options || []).map((o: any) => ({ id: o.id, text: o.text })),
      responses, comments: []
    };
  });

  // 5. 함수 구현
  const login = async (email: string, password: string) => { await supabase.auth.signInWithPassword({ email, password }); };
  const logout = async () => { setCurrentUser(null); await supabase.auth.signOut(); queryClient.clear(); };

  const createRoom = async (name: string, passcode: string, imageUri?: string) => {
    if (!currentUser) throw new Error("로그인 필요");
    let finalImage = imageUri;
    if (imageUri && !imageUri.startsWith('http')) {
      finalImage = await storageService.uploadProfileImage('room', uuidv4(), imageUri);
    }
    const { data: roomData, error } = await supabase.from('rooms').insert([{ name, passcode, image_uri: finalImage, leader_id: currentUser.id }]).select().single();
    if (error) throw error;
    await supabase.from('room_members').upsert([{ room_id: roomData.id, user_id: currentUser.id }], { onConflict: 'room_id,user_id' });
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    return roomData as Room;
  };

  const deleteRoom = async (roomId: string) => {
    try {
      await supabase.functions.invoke('delete-r2-objects', { body: { prefix: `gallery/${roomId}/` } });
      await supabase.functions.invoke('delete-r2-objects', { body: { prefix: `rooms/${roomId}_` } });
    } catch (e) {}
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
  };

  const addVideo = async (roomId: string, youtubeUrl: string, title: string, youtubeId: string) => {
    const { error } = await supabase.from('videos').insert([{ room_id: roomId, user_id: currentUser?.id, title, youtube_url: youtubeUrl, youtube_id: youtubeId }]);
    if (error) throw error;
    queryClient.invalidateQueries();
  };

  const addPhoto = async (roomId: string, photoUrl: string) => {
    if (!currentUser) return;
    await storageService.uploadToGallery(roomId, currentUser.id, photoUrl);
    queryClient.invalidateQueries();
  };

  const addVote = async (roomId: string, question: string, options: string[], settings: any) => {
    const { data: vote, error } = await supabase.from('votes').insert([{ room_id: roomId, user_id: currentUser?.id, question, is_anonymous: settings.isAnonymous, allow_multiple: settings.allowMultiple }]).select().single();
    if (error) throw error;
    if (vote && options.length > 0) {
      await supabase.from('vote_options').insert(options.map(opt => ({ vote_id: vote.id, text: opt })));
    }
    queryClient.invalidateQueries();
  };

  const respondToVote = async (voteId: string, optionIds: string[]) => {
    await supabase.from('vote_responses').upsert([{ vote_id: voteId, user_id: currentUser?.id, option_ids: optionIds }], { onConflict: 'vote_id,user_id' });
    queryClient.invalidateQueries();
  };

  const addSchedule = async (roomId: string, title: string, options: string[]) => {
    const { data: schedule, error } = await supabase.from('schedules').insert([{ room_id: roomId, user_id: currentUser?.id, title }]).select().single();
    if (error) throw error;
    if (schedule && options.length > 0) {
      await supabase.from('schedule_options').insert(options.map(opt => ({ schedule_id: schedule.id, date_time: opt })));
    }
    queryClient.invalidateQueries();
  };

  const respondToSchedule = async (scheduleId: string, optionIds: string[]) => {
    await supabase.from('schedule_responses').upsert([{ schedule_id: scheduleId, user_id: currentUser?.id, option_ids: optionIds }], { onConflict: 'schedule_id,user_id' });
    queryClient.invalidateQueries();
  };

  const joinRoom = async (roomId: string, passcode: string) => {
    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).eq('passcode', passcode).single();
    if (!room || !currentUser) return null;
    await supabase.from('room_members').upsert([{ room_id: roomId, user_id: currentUser.id }], { onConflict: 'room_id,user_id' });
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    return room as Room;
  };

  // 나머지 빈 함수들
  const addNotice = async () => {};
  const updateNotice = async () => {};
  const deleteNotice = async () => {};
  const togglePinNotice = async () => {};
  const markNoticeAsViewed = async () => {};
  const addComment = async () => {};
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
  const markAlarmAsViewed = async () => {};

  return (
    <AppContext.Provider value={{
      currentUser, isLoadingUser, login, updateUserProfile, logout,
      rooms: roomsData, isLoadingRooms, users, getUserById, getRoomByIdRemote, createRoom, joinRoom, deleteRoom,
      notices: noticesMapped, addNotice, updateNotice, deleteNotice, togglePinNotice, markNoticeAsViewed,
      videos: videosMapped, addVideo, addComment,
      photos: photosMapped, addPhoto,
      schedules: schedulesMapped, addSchedule, updateSchedule, deleteSchedule, respondToSchedule, markScheduleAsViewed,
      votes: votesMapped, addVote, updateVote, deleteVote, respondToVote, markVoteAsViewed,
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
