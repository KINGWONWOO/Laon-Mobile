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
  
  videos: VideoFeedback[];
  addVideo: (roomId: string, videoUrl: string, title: string) => Promise<void>;
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

  const theme = getThemeColors(themeType);

  const fetchMyProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setCurrentUser({ id: data.id, name: data.name || '댄서', profileImage: data.profile_image });
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
    console.log('[AppContext] All data invalidated');
  };

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('global-updates').on('postgres_changes', { event: '*', schema: 'public' }, () => refreshAllData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const { data: roomsData = [], isLoading: isLoadingRooms } = useQuery({
    queryKey: ['rooms', currentUser?.id],
    queryFn: async () => {
      const { data } = await supabase.from('room_members').select('rooms (*)').eq('user_id', currentUser?.id);
      return (data?.map(item => item.rooms).filter(Boolean) || []) as Room[];
    },
    enabled: !!currentUser,
  });

  const roomIds = roomsData.map(r => r.id);

  const videosQuery = useQuery({ queryKey: ['videos', roomIds], queryFn: async () => {
    const { data } = await supabase.from('videos').select('*, video_comments(*)').in('room_id', roomIds).order('created_at', { ascending: false });
    return data || [];
  }, enabled: roomIds.length > 0 });

  const photosQuery = useQuery({ queryKey: ['photos', roomIds], queryFn: async () => {
    const { data } = await supabase.from('gallery_items').select('*, gallery_comments(*)').in('room_id', roomIds).order('created_at', { ascending: false });
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

  // 매핑 로직
  const videosMapped: VideoFeedback[] = (videosQuery.data || []).map(v => ({
    id: v.id, roomId: v.room_id, userId: v.user_id, videoUrl: v.storage_path || v.youtube_url,
    title: v.title, createdAt: new Date(v.created_at).getTime(), 
    comments: (v.video_comments || []).map((c: any) => ({
      id: c.id, userId: c.user_id, text: c.text, timestampMillis: c.timestamp_millis, createdAt: new Date(c.created_at).getTime(), parentId: c.parent_id
    }))
  }));

  const photosMapped: Photo[] = (photosQuery.data || []).map(p => ({
    id: p.id, roomId: p.room_id, userId: p.user_id, photoUrl: p.file_path, description: p.description,
    createdAt: new Date(p.created_at).getTime(),
    comments: (p.gallery_comments || []).map((c: any) => ({
      id: c.id, userId: c.user_id, text: c.text, createdAt: new Date(c.created_at).getTime(), parentId: c.parent_id
    }))
  }));

  const schedulesMapped: Schedule[] = (schedulesQuery.data || []).map(s => {
    const resp: Record<string, string[]> = {};
    (s.schedule_options || []).forEach((o: any) => (o.schedule_responses || []).forEach((r: any) => {
      if (!resp[r.user_id]) resp[r.user_id] = [];
      resp[r.user_id].push(o.id);
    }));
    return {
      id: s.id, roomId: s.room_id, userId: s.user_id, title: s.title, options: (s.schedule_options || []).map((o:any)=>({id:o.id, dateTime: o.date_time})),
      responses: resp, viewedBy: s.viewed_by || [], createdAt: new Date(s.created_at).getTime()
    };
  });

  const votesMapped: Vote[] = (votesQuery.data || []).map(v => {
    const resp: Record<string, string[]> = {};
    (v.vote_options || []).forEach((o: any) => (o.vote_responses || []).forEach((r: any) => {
      if (!resp[r.user_id]) resp[r.user_id] = [];
      resp[r.user_id].push(o.id);
    }));
    return {
      id: v.id, roomId: v.room_id, userId: v.user_id, question: v.question, isAnonymous: v.is_anonymous, allowMultiple: v.allow_multiple,
      options: (v.vote_options || []).map((o:any)=>({id:o.id, text: o.text})), responses: resp, viewedBy: v.viewed_by || [], createdAt: new Date(v.created_at).getTime(), comments: []
    };
  });

  // 비즈니스 로직
  const login = async (e: string, p: string) => { await supabase.auth.signInWithPassword({ email: e, password: p }); };
  const logout = async () => { setCurrentUser(null); await supabase.auth.signOut(); queryClient.clear(); };
  const updateUserProfile = async (n: string, i?: string) => {
    let final = i;
    if (i && !i.startsWith('http')) final = await storageService.uploadProfileImage('user', currentUser!.id, i);
    await supabase.from('profiles').update({ name: n, profile_image: final }).eq('id', currentUser!.id);
    await fetchMyProfile(currentUser!.id);
    refreshAllData();
  };
  const createRoom = async (n: string, p: string, i?: string) => {
    const final = (i && !i.startsWith('http')) ? await storageService.uploadProfileImage('room', uuidv4(), i) : i;
    const { data, error } = await supabase.from('rooms').insert([{ name: n, passcode: p, image_uri: final, leader_id: currentUser?.id }]).select().single();
    if (error) throw error;
    await supabase.from('room_members').upsert([{ room_id: data.id, user_id: currentUser?.id }], { onConflict: 'room_id,user_id' });
    refreshAllData();
    return data as Room;
  };
  const joinRoom = async (rid: string, pc: string) => {
    const { data: room } = await supabase.from('rooms').select('*').eq('id', rid).eq('passcode', pc).single();
    if (room && currentUser) {
      await supabase.from('room_members').upsert([{ room_id: rid, user_id: currentUser.id }], { onConflict: 'room_id,user_id' });
      refreshAllData();
      return room as Room;
    }
    return null;
  };
  const deleteRoom = async (id: string) => { await supabase.from('rooms').delete().eq('id', id); refreshAllData(); };
  const addVideo = async (rid: string, url: string, t: string) => { await supabase.from('videos').insert([{ room_id: rid, user_id: currentUser?.id, title: t, storage_path: url }]); refreshAllData(); };
  const addComment = async (vid: string, t: string, ts: number, pid?: string) => { await supabase.from('video_comments').insert([{ video_id: vid, user_id: currentUser?.id, text: t, timestamp_millis: ts, parent_id: pid }]); refreshAllData(); };
  const addPhoto = async (rid: string, url: string, d?: string) => { await storageService.uploadToGallery(rid, currentUser!.id, url, d); refreshAllData(); };
  const deletePhoto = async (id: string) => { await supabase.from('gallery_items').delete().eq('id', id); refreshAllData(); };
  const addPhotoComment = async (phid: string, t: string, pid?: string) => { await supabase.from('gallery_comments').insert([{ gallery_item_id: phid, user_id: currentUser?.id, text: t, parent_id: pid }]); refreshAllData(); };
  const markItemAsAccessed = async (type: string, id: string) => { await supabase.from(type === 'video' ? 'videos' : 'gallery_items').update({ last_accessed_at: new Date() }).eq('id', id); };
  const addVote = async (rid: string, q: string, opts: string[], s: any) => {
    const { data: v } = await supabase.from('votes').insert([{ room_id: rid, user_id: currentUser?.id, question: q, is_anonymous: s.isAnonymous, allow_multiple: s.allowMultiple }]).select().single();
    if (v) await supabase.from('vote_options').insert(opts.map(o => ({ vote_id: v.id, text: o })));
    refreshAllData();
  };
  const respondToVote = async (vid: string, ids: string[]) => { await supabase.from('vote_responses').upsert([{ vote_id: vid, user_id: currentUser?.id, option_ids: ids }], { onConflict: 'vote_id,user_id' }); refreshAllData(); };
  const addSchedule = async (rid: string, t: string, opts: string[]) => {
    const { data: s } = await supabase.from('schedules').insert([{ room_id: rid, user_id: currentUser?.id, title: t }]).select().single();
    if (s) await supabase.from('schedule_options').insert(opts.map(o => ({ schedule_id: s.id, date_time: o })));
    refreshAllData();
  };
  const respondToSchedule = async (sid: string, ids: string[]) => { await supabase.from('schedule_responses').upsert([{ schedule_id: sid, user_id: currentUser?.id, option_ids: ids }], { onConflict: 'schedule_id,user_id' }); refreshAllData(); };

  return (
    <AppContext.Provider value={{
      currentUser, isLoadingUser, login, updateUserProfile, logout,
      rooms: roomsData, isLoadingRooms, users: allUsers, getUserById, getRoomByIdRemote: async (id) => (await supabase.from('rooms').select('*').eq('id', id).single()).data as Room,
      createRoom, joinRoom, deleteRoom,
      notices: [], addNotice: async () => {},
      videos: videosMapped, addVideo, addComment,
      photos: photosMapped, addPhoto, deletePhoto, addPhotoComment, markItemAsAccessed,
      schedules: schedulesMapped, addSchedule, respondToSchedule,
      votes: votesMapped, addVote, respondToVote,
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
