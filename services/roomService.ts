import { supabase } from '../lib/supabase';
import { Room } from '../types';
import { storageService } from './storageService';
import * as Crypto from 'expo-crypto';

const uuidv4 = () => Crypto.randomUUID();

export const roomService = {
  getMyRooms: async (userId: string): Promise<Room[]> => {
    const { data: membership } = await supabase.from('room_members').select('room_id').eq('user_id', userId);
    const rIds = membership?.map(m => m.room_id) || [];
    if (rIds.length === 0) return [];
    const { data: rooms } = await supabase.from('rooms').select('*, room_members(user_id)').in('id', rIds);
    return (rooms || []).map(r => ({
      ...r,
      leaderId: r.leader_id,
      imageUri: r.image_uri,
      members: (r.room_members || []).map((rm: any) => rm.user_id)
    })) as Room[];
  },

  createRoom: async (name: string, passcode: string, userId: string, imageUri?: string): Promise<Room> => {
    const finalImage = (imageUri && !imageUri.startsWith('http')) ? await storageService.uploadProfileImage('room', uuidv4(), imageUri) : imageUri;
    const { data, error } = await supabase.from('rooms').insert([{ name, passcode, image_uri: finalImage, leader_id: userId }]).select().single();
    if (error) throw error;
    await supabase.from('room_members').upsert([{ room_id: data.id, user_id: userId }], { onConflict: 'room_id,user_id' });
    return { ...data, leaderId: data.leader_id, imageUri: data.image_uri, members: [userId] } as Room;
  },

  joinRoom: async (roomId: string, passcode: string, userId: string): Promise<Room | null> => {
    const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).eq('passcode', passcode).single();
    if (room) {
      await supabase.from('room_members').upsert([{ room_id: roomId, user_id: userId }], { onConflict: 'room_id,user_id' });
      return { ...room, leaderId: room.leader_id, imageUri: room.image_uri } as Room;
    }
    return null;
  },

  deleteRoom: async (roomId: string): Promise<void> => {
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    if (error) throw error;
  },

  getRoomByIdRemote: async (roomId: string): Promise<Room | null> => {
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    return data ? { ...data, leaderId: data.leader_id, imageUri: data.image_uri } as Room : null;
  },

  updateRoom: async (roomId: string, name: string, imageUri?: string | null): Promise<void> => {
    const updates: any = { name };
    if (imageUri && !imageUri.startsWith('http')) {
      const finalImage = await storageService.uploadProfileImage('room', roomId, imageUri);
      updates.image_uri = finalImage;
    } else if (imageUri) {
      updates.image_uri = imageUri;
    }
    const { error } = await supabase.from('rooms').update(updates).eq('id', roomId);
    if (error) throw error;
  }
};
