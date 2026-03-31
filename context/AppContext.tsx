import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, Room, Notice, VideoFeedback, Photo, Schedule, Vote, Alarm, AlarmType, ThemeType } from '../types';
import * as Crypto from 'expo-crypto';
import * as Storage from '../services/storage';
import { getThemeColors } from '../constants/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { roomApi, userApi, noticeApi, videoApi } from '../services/api';
import { supabase } from '../lib/supabase';

// Helper function to generate UUID
const uuidv4 = () => Crypto.randomUUID();
const USER_SESSION_KEY = 'LAON_DANCE_USER_SESSION';

type AppContextType = {
  currentUser: User | null;
  isLoadingUser: boolean;
  login: (email: string, password: string) => Promise<void>;
  updateUserProfile: (name: string, profileImage?: string) => void;
  logout: () => Promise<void>;
  
  rooms: Room[];
  isLoadingRooms: boolean;
  users: User[];
  getUserById: (id: string) => User | undefined;
  getRoomByIdRemote: (roomId: string) => Promise<Room | null>;
  createRoom: (name: string, passcode: string, imageUri?: string) => Promise<Room>;
  joinRoom: (roomId: string, passcode: string) => Promise<Room | null>;
  
  notices: Notice[];
  addNotice: (roomId: string, title: string, content: string, isPinned?: boolean, images?: string[]) => void;
  updateNotice: (noticeId: string, title: string, content: string, isPinned: boolean) => void;
  deleteNotice: (noticeId: string) => void;
  togglePinNotice: (noticeId: string) => void;
  markNoticeAsViewed: (noticeId: string) => void;
  
  videos: VideoFeedback[];
  addVideo: (roomId: string, videoUrl: string, title: string) => Promise<void>;
  addComment: (videoId: string, text: string, timestampMillis: number) => void;
  
  photos: Photo[];
  addPhoto: (roomId: string, photoUrl: string) => Promise<void>;

  schedules: Schedule[];
  addSchedule: (roomId: string, title: string, options: string[], startDate?: string, endDate?: string, sendNotification?: boolean) => void;
  updateSchedule: (scheduleId: string, title: string) => void;
  deleteSchedule: (scheduleId: string) => void;
  respondToSchedule: (scheduleId: string, optionIds: string[]) => void;
  markScheduleAsViewed: (scheduleId: string) => void;

  votes: Vote[];
  addVote: (roomId: string, question: string, options: string[], settings: { 
    isAnonymous?: boolean, 
    allowMultiple?: boolean, 
    sendNotification?: boolean,
    deadline?: number,
    notificationMinutes?: number 
  }) => void;
  updateVote: (voteId: string, question: string) => void;
  deleteVote: (voteId: string) => void;
  respondToVote: (voteId: string, optionIds: string[]) => void;
  markVoteAsViewed: (voteId: string) => void;
  addVoteComment: (voteId: string, text: string) => void;

  alarms: Alarm[];
  addAlarm: (roomId: string, title: string, content: string, type: AlarmType, targetId: string) => void;
  markAlarmAsViewed: (alarmId: string) => void;

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
  
  // Real-time states
  const [users, setUsers] = useState<User[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [videos, setVideos] = useState<VideoFeedback[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);

  const theme = getThemeColors(themeType);

  // Sync with Supabase Auth
  useEffect(() => {
    let isMounted = true;

    // 5초 안에 응답 없으면 강제로 로딩 해제 (보험용)
    const timeout = setTimeout(() => {
      if (isMounted) {
        console.warn('Auth session check timed out');
        setIsLoadingUser(false);
      }
    }, 5000);

    const buildUser = (session: any) => ({
      id: session.user.id,
      name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '댄서',
      profileImage: session.user.user_metadata?.profile_image,
    });

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (isMounted) {
          if (session?.user) {
            setCurrentUser(buildUser(session));
          }
        }
      } catch (err) {
        console.error('Error getting auth session:', err);
      } finally {
        if (isMounted) {
          clearTimeout(timeout);
          setIsLoadingUser(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        if (session?.user) {
          setCurrentUser(buildUser(session));
        } else {
          setCurrentUser(null);
        }
        setIsLoadingUser(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Fetch Rooms via React Query (Filtered by currentUser)
  const { data: serverRooms, isLoading: isLoadingRooms } = useQuery({
    queryKey: ['rooms', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      // Fetch rooms where user is a member from Supabase
      const { data, error } = await supabase
        .from('room_members')
        .select('rooms (*)')
        .eq('user_id', currentUser.id);
      
      if (error) return [];
      return data.map(item => item.rooms).filter(Boolean) as unknown as Room[];
    },
    enabled: !!currentUser,
    refetchInterval: 5000,
  });

  const rooms = serverRooms || [];

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const logout = async () => {
    setCurrentUser(null);
    await supabase.auth.signOut();
    queryClient.clear();
  };

  const createRoom = async (name: string, passcode: string, imageUri?: string) => {
    if (!currentUser) throw new Error("로그인이 필요합니다.");
    
    // 1. Create room
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .insert([{ name, passcode, image_uri: imageUri, leader_id: currentUser.id }])
      .select()
      .single();
    
    if (roomError) throw roomError;

    // 2. Add creator as member
    const { error: memberError } = await supabase
      .from('room_members')
      .insert([{ room_id: roomData.id, user_id: currentUser.id }]);
    
    if (memberError) throw memberError;

    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    return roomData as Room;
  };

  const joinRoom = async (roomId: string, passcode: string) => {
    if (!currentUser) throw new Error("로그인이 필요합니다.");
    
    // 1. Verify passcode
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .eq('passcode', passcode)
      .single();
    
    if (roomError || !room) return null;

    // 2. Add as member
    const { error: memberError } = await supabase
      .from('room_members')
      .insert([{ room_id: roomId, user_id: currentUser.id }]);
    
    // Ignore error if already a member
    
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    return room as Room;
  };

  const getRoomByIdRemote = async (roomId: string) => {
    const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    return error ? null : data as Room;
  };

  const updateUserProfile = async (name: string, profileImage?: string) => {
    if (!currentUser) return;
    const { error } = await supabase.auth.updateUser({
      data: { name, profile_image: profileImage }
    });
    if (error) console.error(error);
  };

  const getUserById = (id: string) => users.find(u => u.id === id);

  // Mock notice/video/etc logic (should be moved to Supabase eventually)
  const addNotice = (roomId: string, title: string, content: string, isPinned = false, images?: string[]) => {
    if (!currentUser) return;
    const newNotice: Notice = { id: uuidv4(), roomId, userId: currentUser.id, title, content, isPinned, images, viewedBy: [currentUser.id], createdAt: Date.now() };
    setNotices(prev => [...prev, newNotice]);
  };

  const updateNotice = (noticeId: string, title: string, content: string, isPinned: boolean) => {
    setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, title, content, isPinned } : n));
  };

  const deleteNotice = (noticeId: string) => {
    setNotices(prev => prev.filter(n => n.id !== noticeId));
  };

  const togglePinNotice = (noticeId: string) => {
    setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, isPinned: !n.isPinned } : n));
  };

  const markNoticeAsViewed = (noticeId: string) => {
    if (!currentUser) return;
    setNotices(prev => prev.map(n => (n.id === noticeId && !n.viewedBy.includes(currentUser.id)) ? { ...n, viewedBy: [...n.viewedBy, currentUser.id] } : n));
  };

  const addVideo = async (roomId: string, videoUrl: string, title: string) => {
    if (!currentUser) return;
    const newVideo: VideoFeedback = { id: uuidv4(), roomId, userId: currentUser.id, videoUrl, title, comments: [], createdAt: Date.now() };
    setVideos(prev => [...prev, newVideo]);
  };

  const addComment = (videoId: string, text: string, timestampMillis: number) => {
    if (!currentUser) return;
    setVideos(prev => prev.map(v => v.id === videoId ? { ...v, comments: [...v.comments, { id: uuidv4(), userId: currentUser.id, text, timestampMillis, createdAt: Date.now() }] } : v));
  };

  const addPhoto = async (roomId: string, photoUrl: string) => {
    if (!currentUser) return;
    setPhotos(prev => [...prev, { id: uuidv4(), roomId, userId: currentUser.id, photoUrl, createdAt: Date.now() }]);
  };

  const addSchedule = (roomId: string, title: string, options: string[], startDate?: string, endDate?: string, sendNotification?: boolean) => {
    if (!currentUser) return;
    setSchedules(prev => [...prev, { id: uuidv4(), roomId, userId: currentUser.id, title, options: options.map(opt => ({ id: uuidv4(), dateTime: opt })), responses: {}, viewedBy: [currentUser.id], startDate, endDate, sendNotification, createdAt: Date.now() }]);
  };

  const updateSchedule = (scheduleId: string, title: string) => {
    setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, title } : s));
  };

  const deleteSchedule = (scheduleId: string) => {
    setSchedules(prev => prev.filter(s => s.id !== scheduleId));
  };

  const respondToSchedule = (scheduleId: string, optionIds: string[]) => {
    if (!currentUser) return;
    setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, responses: { ...s.responses, [currentUser.id]: optionIds } } : s));
  };

  const markScheduleAsViewed = (scheduleId: string) => {
    if (!currentUser) return;
    setSchedules(prev => prev.map(s => (s.id === scheduleId && !s.viewedBy.includes(currentUser.id)) ? { ...s, viewedBy: [...s.viewedBy, currentUser.id] } : s));
  };

  const addVote = (roomId: string, question: string, options: string[], settings: any) => {
    if (!currentUser) return;
    setVotes(prev => [...prev, { id: uuidv4(), roomId, userId: currentUser.id, question, options: options.map(opt => ({ id: uuidv4(), text: opt })), responses: {}, ...settings, viewedBy: [currentUser.id], comments: [], createdAt: Date.now() }]);
  };

  const updateVote = (voteId: string, question: string) => {
    setVotes(prev => prev.map(v => v.id === voteId ? { ...v, question } : v));
  };

  const deleteVote = (voteId: string) => {
    setVotes(prev => prev.filter(v => v.id !== voteId));
  };

  const respondToVote = (voteId: string, optionIds: string[]) => {
    if (!currentUser) return;
    setVotes(prev => prev.map(v => v.id === voteId ? { ...v, responses: { ...v.responses, [currentUser.id]: optionIds } } : v));
  };

  const markVoteAsViewed = (voteId: string) => {
    if (!currentUser) return;
    setVotes(prev => prev.map(v => (v.id === voteId && !v.viewedBy.includes(currentUser.id)) ? { ...v, viewedBy: [...v.viewedBy, currentUser.id] } : v));
  };

  const addVoteComment = (voteId: string, text: string) => {
    if (!currentUser) return;
    setVotes(prev => prev.map(v => v.id === voteId ? { ...v, comments: [...v.comments, { id: uuidv4(), userId: currentUser.id, text, timestampMillis: 0, createdAt: Date.now() }] } : v));
  };

  const addAlarm = (roomId: string, title: string, content: string, type: AlarmType, targetId: string) => {
    setAlarms(prev => [{ id: uuidv4(), roomId, title, content, type, targetId, createdAt: Date.now(), viewedBy: currentUser ? [currentUser.id] : [] }, ...prev]);
  };

  const markAlarmAsViewed = (alarmId: string) => {
    if (!currentUser) return;
    setAlarms(prev => prev.map(a => (a.id === alarmId && !a.viewedBy.includes(currentUser.id)) ? { ...a, viewedBy: [...a.viewedBy, currentUser.id] } : a));
  };

  return (
    <AppContext.Provider value={{
      currentUser, isLoadingUser, login, updateUserProfile, logout,
      rooms, isLoadingRooms, users, getUserById, getRoomByIdRemote, createRoom, joinRoom,
      notices, addNotice, updateNotice, deleteNotice, togglePinNotice, markNoticeAsViewed,
      videos, addVideo, addComment,
      photos, addPhoto,
      schedules, addSchedule, updateSchedule, deleteSchedule, respondToSchedule, markScheduleAsViewed,
      votes, addVote, updateVote, deleteVote, respondToVote, markVoteAsViewed, addVoteComment,
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
