import { supabase } from '../lib/supabase';

export const contentService = {
  // --- Notices ---
  addNotice: async (rid: string, uid: string, t: string, c: string, p: boolean, imgs: string[], useNoti: boolean) => {
    return await supabase.from('notices').insert([{ 
      room_id: rid, user_id: uid, title: t, content: c, is_pinned: p, image_urls: imgs, use_notification: useNoti 
    }]);
  },
  updateNotice: async (id: string, updates: { title?: string, content?: string, is_pinned?: boolean, image_urls?: string[] }) => {
    return await supabase.from('notices').update(updates).eq('id', id);
  },
  deleteNotice: async (id: string) => {
    return await supabase.from('notices').delete().eq('id', id);
  },
  addNoticeComment: async (nid: string, uid: string, t: string, pid?: string) => {
    return await supabase.from('notice_comments').insert([{ notice_id: nid, user_id: uid, text: t, parent_id: pid }]);
  },
  updateNoticeComment: async (id: string, text: string) => {
    return await supabase.from('notice_comments').update({ text }).eq('id', id);
  },
  deleteNoticeComment: async (id: string) => {
    return await supabase.from('notice_comments').delete().eq('id', id);
  },

  // --- Videos ---
  addVideo: async (rid: string, uid: string, url: string, t: string, useNoti: boolean) => {
    return await supabase.from('videos').insert([{ room_id: rid, user_id: uid, title: t, storage_path: url, youtube_id: 'R2_UPLOAD', use_notification: useNoti }]);
  },
  updateVideo: async (id: string, title: string) => {
    return await supabase.from('videos').update({ title }).eq('id', id);
  },
  deleteVideo: async (id: string) => {
    return await supabase.from('videos').delete().eq('id', id);
  },
  addVideoComment: async (vid: string, uid: string, t: string, ts: number, pid?: string) => {
    return await supabase.from('video_comments').insert([{ video_id: vid, user_id: uid, text: t, timestamp_millis: ts, parent_id: pid }]);
  },
  updateVideoComment: async (id: string, text: string) => {
    return await supabase.from('video_comments').update({ text }).eq('id', id);
  },
  deleteVideoComment: async (id: string) => {
    return await supabase.from('video_comments').delete().eq('id', id);
  },

  // --- Gallery ---
  updatePhoto: async (id: string, description: string) => {
    return await supabase.from('gallery_items').update({ description }).eq('id', id);
  },
  deletePhoto: async (id: string) => {
    return await supabase.from('gallery_items').delete().eq('id', id);
  },
  addPhotoComment: async (phid: string, uid: string, t: string, pid?: string) => {
    return await supabase.from('gallery_comments').insert([{ gallery_item_id: phid, user_id: uid, text: t, parent_id: pid }]);
  },
  updatePhotoComment: async (id: string, text: string) => {
    return await supabase.from('gallery_comments').update({ text }).eq('id', id);
  },
  deletePhotoComment: async (id: string) => {
    return await supabase.from('gallery_comments').delete().eq('id', id);
  },

  // --- Votes & Schedules ---
  addVote: async (rid: string, uid: string, q: string, isAnon: boolean, isMulti: boolean, useNoti: boolean, deadline?: string) => {
    return await supabase.from('votes').insert([{ room_id: rid, user_id: uid, question: q, is_anonymous: isAnon, allow_multiple: isMulti, use_notification: useNoti, deadline }]).select().single();
  },
  updateVote: async (id: string, updates: { question?: string, deadline?: string }) => {
    return await supabase.from('votes').update(updates).eq('id', id);
  },
  deleteVote: async (id: string) => {
    return await supabase.from('votes').delete().eq('id', id);
  },
  addVoteOptions: async (vid: string, opts: string[]) => {
    return await supabase.from('vote_options').insert(opts.map(o => ({ vote_id: vid, text: o })));
  },
  respondToVote: async (vid: string, uid: string, oids: string[]) => {
    return await supabase.from('vote_responses').upsert({ vote_id: vid, user_id: uid, option_ids: oids }, { onConflict: 'vote_id,user_id' });
  },

  addSchedule: async (rid: string, uid: string, t: string, useNoti: boolean, deadline?: string) => {
    return await supabase.from('schedules').insert([{ room_id: rid, user_id: uid, title: t, use_notification: useNoti, deadline }]).select().single();
  },
  updateSchedule: async (id: string, updates: { title?: string, deadline?: string }) => {
    return await supabase.from('schedules').update(updates).eq('id', id);
  },
  deleteSchedule: async (id: string) => {
    return await supabase.from('schedules').delete().eq('id', id);
  },
  addScheduleOptions: async (sid: string, opts: string[]) => {
    return await supabase.from('schedule_options').insert(opts.map(o => ({ schedule_id: sid, date_time: o })));
  },
  respondToSchedule: async (sid: string, uid: string, oids: string[]) => {
    return await supabase.from('schedule_responses').upsert({ schedule_id: sid, user_id: uid, option_ids: oids }, { onConflict: 'schedule_id,user_id' });
  },
  closeVote: async (id: string) => {
    return await supabase.from('votes').update({ deadline: new Date().toISOString() }).eq('id', id);
  },
  closeSchedule: async (id: string) => {
    return await supabase.from('schedules').update({ deadline: new Date().toISOString() }).eq('id', id);
  }
};
