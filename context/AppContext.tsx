import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, Room, Notice, VideoFeedback, Photo, Schedule, Vote, Alarm, AlarmType, ThemeType, PhotoComment } from '../types';
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
  users: User[]; // 모든 유저 정보 캐시
  getUserById: (id: string) => User | undefined;
  getRoomByIdRemote: (roomId: string) => Promise<Room | null>;
  createRoom: (name: string, passcode: string, imageUri?: string) => Promise<Room>;
  joinRoom: (roomId: string, passcode: string) => Promise<Room | null>;
  deleteRoom: (roomId: string) => Promise<void>;
  
  notices: Notice[];
  addNotice: (roomId: string, title: string, content: string, isPinned?: boolean, images?: string[]) => Promise<void>;
  
  videos: VideoFeedback[];
  addVideo: (roomId: string, videoUrl: string, title: string, idStr: string) => Promise<void>;
  addComment: (videoId: string, text: string, timestampMillis: number, parentId?: string) => Promise<void>;
  
  photos: Photo[];
  addPhoto: (roomId: string, photoUrl: string, description?: string) => Promise<void>;
  deletePhoto: (photoId: string, photoUrl: string) => Promise<void>;
  addPhotoComment: (photoId: string, text: string, parentId?: string) => Promise<void>;
  markItemAsAccessed: (type: 'video' | 'photo', id: string) => Promise<void>;

  schedules: Schedule[];
  addSchedule: (roomId: string, title: string, options: string[]) => Promise<void>;
  respondToSchedule: (scheduleId: string, optionIds: string[]) => Promise<void>;

  votes: Vote[];
  addVote: (roomId: string, question: string, options: string[], settings: any) => Promise<void>;
  respondToVote: (voteId: string, optionIds: string[]) => Promise<void>;

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

  const theme = getThemeColors(themeType);

  // 1. 세션 및 프로필 동기화
  const fetchMyProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setCurrentUser({
        id: data.id,
        name: data.name || '댄서',
        profileImage: data.profile_image,
      });
    }
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

  // 2. 유저 전체 정보 로딩 (알 수 없음 방지)
  const { data: allUsers = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name, profile_image');
      const mapped = (data || []).map(u => ({ id: u.id, name: u.name, profileImage: u.profile_image }));
      setUsers(mapped);
      return mapped;
    }
  });

  const getUserById = (id: string) => allUsers.find(u => u.id === id);

  // 전체 데이터 리프레시
  const refreshAllData = async () => {
    await queryClient.invalidateQueries();
  };

  // 실시간 구독
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('global').on('postgres_changes', { event: '*', schema: 'public' }, () => refreshAllData()).subscribe();
    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  // 방 목록 로딩
  const { data: roomsData = [] } = useQuery({
    queryKey: ['rooms', currentUser?.id],
    queryFn: async () => {
      const { data } = await supabase.from('room_members').select('rooms (*)').eq('user_id', currentUser?.id);
      return (data?.map(item => item.rooms).filter(Boolean) || []) as Room[];
    },
    enabled: !!currentUser,
  });

  const roomIds = roomsData.map(r => r.id);

  // 데이터 쿼리들
  const videosQuery = useQuery({ queryKey: ['videos', roomIds], queryFn: async () => {
    const { data } = await supabase.from('videos').select('*, video_comments(*)').in('room_id', roomIds).order('created_at', { ascending: false });
    return data || [];
  }, enabled: roomIds.length > 0 });

  const photosQuery = useQuery({ queryKey: ['photos', roomIds], queryFn: async () => {
    const { data } = await supabase.from('gallery_items').select('*, gallery_comments(*)').in('room_id', roomIds).order('created_at', { ascending: false });
    return data || [];
  }, enabled: roomIds.length > 0 });

  const votesQuery = useQuery({ queryKey: ['votes', roomIds], queryFn: async () => {
    const { data } = await supabase.from('votes').select('*, vote_options(*, vote_responses(*))').in('room_id', roomIds).order('created_at', { ascending: false });
    return data || [];
  }, enabled: roomIds.length > 0 });

  const schedulesQuery = useQuery({ queryKey: ['schedules', roomIds], queryFn: async () => {
    const { data } = await supabase.from('schedules').select('*, schedule_options(*, schedule_responses(*))').in('room_id', roomIds).order('created_at', { ascending: false });
    return data || [];
  }, enabled: roomIds.length > 0 });

  // 매핑 로직 (댓글/답글 포함)
  const photosMapped: Photo[] = (photosQuery.data || []).map(p => ({
    id: p.id, roomId: p.room_id, userId: p.user_id, photoUrl: p.file_path, description: p.description,
    createdAt: new Date(p.created_at).getTime(),
    comments: (p.gallery_comments || []).map((c: any) => ({
      id: c.id, userId: c.user_id, text: c.text, createdAt: new Date(c.created_at).getTime(), parentId: c.parent_id
    }))
  }));

  const videosMapped: VideoFeedback[] = (videosQuery.data || []).map(v => ({
    id: v.id, roomId: v.room_id, userId: v.user_id, videoUrl: v.storage_path || v.youtube_url,
    title: v.title, createdAt: new Date(v.created_at).getTime(), 
    comments: (v.video_comments || []).map((c: any) => ({
      id: c.id, userId: c.user_id, text: c.text, timestampMillis: c.timestamp_millis, createdAt: new Date(c.created_at).getTime(), parentId: c.parent_id
    }))
  }));

  // 비즈니스 함수
  const updateUserProfile = async (name: string, img?: string) => {
    if (!currentUser) return;
    let finalImg = img;
    if (img && !img.startsWith('http')) {
      finalImg = await storageService.uploadProfileImage('user', currentUser.id, img);
    }
    const { error } = await supabase.from('profiles').update({ name, profile_image: finalImg }).eq('id', currentUser.id);
    if (error) throw error;
    await fetchMyProfile(currentUser.id);
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
  };

  const addPhotoComment = async (photoId: string, text: string, parentId?: string) => {
    if (!currentUser) return;
    await supabase.from('gallery_comments').insert([{ gallery_item_id: photoId, user_id: currentUser.id, text, parent_id: parentId }]);
    refreshAllData();
  };

  const addComment = async (videoId: string, text: string, timestampMillis: number, parentId?: string) => {
    if (!currentUser) return;
    await supabase.from('video_comments').insert([{ video_id: videoId, user_id: currentUser.id, text, timestamp_millis: timestampMillis, parent_id: parentId }]);
    refreshAllData();
  };

  const addVideo = async (roomId: string, videoUrl: string, title: string) => {
    if (!currentUser) return;
    const { error } = await supabase.from('videos').insert([{ room_id: roomId, user_id: currentUser.id, title, storage_path: videoUrl }]);
    if (error) throw error;
    refreshAllData();
  };

  // 기존 함수들 유지
  const login = async (email: string, password: string) => { await supabase.auth.signInWithPassword({ email, password }); };
  const logout = async () => { setCurrentUser(null); await supabase.auth.signOut(); queryClient.clear(); };
  const createRoom = async (name: string, passcode: string, imageUri?: string) => {
    const finalImage = (imageUri && !imageUri.startsWith('http')) ? await storageService.uploadProfileImage('room', uuidv4(), imageUri) : imageUri;
    const { data, error } = await supabase.from('rooms').insert([{ name, passcode, image_uri: finalImage, leader_id: currentUser?.id }]).select().single();
    if (error) throw error;
    await supabase.from('room_members').upsert([{ room_id: data.id, user_id: currentUser?.id }], { onConflict: 'room_id,user_id' });
    refreshAllData();
    return data as Room;
  };
  const deleteRoom = async (id: string) => { await supabase.from('rooms').delete().eq('id', id); refreshAllData(); };
  const addPhoto = async (rId: string, url: string, desc?: string) => { await storageService.uploadToGallery(rId, currentUser!.id, url, desc); refreshAllData(); };
  const deletePhoto = async (id: string) => { await supabase.from('gallery_items').delete().eq('id', id); refreshAllData(); };
  const markItemAsAccessed = async (type: string, id: string) => { await supabase.from(type === 'video' ? 'videos' : 'gallery_items').update({ last_accessed_at: new Date() }).eq('id', id); };
  const joinRoom = async (rId: string, pc: string) => {
    const { data: room } = await supabase.from('rooms').select('*').eq('id', rId).eq('passcode', pc).single();
    if (!room || !currentUser) return null;
    await supabase.from('room_members').upsert([{ room_id: rId, user_id: currentUser.id }], { onConflict: 'room_id,user_id' });
    refreshAllData();
    return room as Room;
  };
  const addVote = async (rId: string, q: string, opts: string[], s: any) => {
    const { data: v } = await supabase.from('votes').insert([{ room_id: rId, user_id: currentUser?.id, question: q, is_anonymous: s.isAnonymous, allow_multiple: s.allowMultiple }]).select().single();
    if (v) await supabase.from('vote_options').insert(opts.map(o => ({ vote_id: v.id, text: o })));
    refreshAllData();
  };
  const respondToVote = async (vId: string, ids: string[]) => { await supabase.from('vote_responses').upsert([{ vote_id: vId, user_id: currentUser?.id, option_ids: ids }], { onConflict: 'vote_id,user_id' }); refreshAllData(); };
  const addSchedule = async (rId: string, t: string, opts: string[]) => {
    const { data: s } = await supabase.from('schedules').insert([{ room_id: rId, user_id: currentUser?.id, title: t }]).select().single();
    if (s) await supabase.from('schedule_options').insert(opts.map(o => ({ schedule_id: s.id, date_time: o })));
    refreshAllData();
  };
  const respondToSchedule = async (sId: string, ids: string[]) => { await supabase.from('schedule_responses').upsert([{ schedule_id: sId, user_id: currentUser?.id, option_ids: ids }], { onConflict: 'schedule_id,user_id' }); refreshAllData(); };

  return (
    <AppContext.Provider value={{
      currentUser, isLoadingUser, login, updateUserProfile, logout,
      rooms: roomsData, isLoadingRooms, users: allUsers, getUserById, getRoomByIdRemote: async (id) => (await supabase.from('rooms').select('*').eq('id', id).single()).data as Room,
      createRoom, joinRoom, deleteRoom,
      notices: [], addNotice: async () => {}, updateNotice: async () => {}, deleteNotice: async () => {}, togglePinNotice: async () => {}, markNoticeAsViewed: async () => {},
      videos: videosMapped, addVideo, addComment,
      photos: photosMapped, addPhoto, deletePhoto, addPhotoComment, markItemAsAccessed,
      schedules: (schedulesQuery.data || []).map(s => ({ id: s.id, roomId: s.room_id, userId: s.user_id, title: s.title, options: (s.schedule_options || []).map((o:any)=>({id:o.id, dateTime: o.date_time})), responses: {}, viewedBy: [], createdAt: 0 })), 
      votes: votesMapped, addVote, updateVote: async () => {}, deleteVote: async () => {}, respondToVote, markVoteAsViewed: async () => {},
      alarms: [], addAlarm: async () => {}, markAlarmAsViewed: async () => {},
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
