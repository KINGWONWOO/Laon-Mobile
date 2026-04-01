import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_GALLERY_COUNT = 20;

export const storageService = {
  /**
   * Cloudflare R2에 파일을 업로드합니다.
   * Supabase Edge Function을 통해 pre-signed URL을 받아와서 업로드합니다.
   */
  uploadToR2: async (bucketPath: string, filePath: string, fileName: string) => {
    try {
      // 1. 용량 체크
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) throw new Error('파일이 존재하지 않습니다.');
      if (fileInfo.size > MAX_FILE_SIZE) throw new Error('파일 용량은 5MB를 초과할 수 없습니다.');

      const contentType = fileName.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
      const key = `${bucketPath}/${fileName}`;

      // 2. Supabase Edge Function을 호출하여 pre-signed URL 획득
      const { data: { signedUrl, publicUrl }, error: funcError } = await supabase.functions.invoke('get-r2-upload-url', {
        body: { key, contentType }
      });

      if (funcError) throw funcError;

      // 3. 획득한 URL로 직접 파일 업로드 (PUT)
      // Expo FileSystem.uploadAsync는 PUT 메소드를 지원합니다.
      const uploadResult = await FileSystem.uploadAsync(signedUrl, filePath, {
        httpMethod: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`R2 업로드 실패 (Status: ${uploadResult.status})`);
      }

      return publicUrl;
    } catch (err: any) {
      console.error('[R2 Storage] Upload Error:', err);
      throw err;
    }
  },

  /**
   * 갤러리 아이템을 DB에 등록하고 R2에 업로드합니다.
   */
  uploadToGallery: async (roomId: string, userId: string, filePath: string) => {
    // 1. 현재 개수 확인
    const { count, error: countError } = await supabase
      .from('gallery_items')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    if (countError) throw countError;
    if (count !== null && count >= MAX_GALLERY_COUNT) {
      throw new Error(`갤러리에는 최대 ${MAX_GALLERY_COUNT}개까지만 올릴 수 있습니다.`);
    }

    // 2. R2 업로드
    const ext = filePath.split('.').pop();
    const fileName = `${Date.now()}.${ext}`;
    const publicUrl = await storageService.uploadToR2(`gallery/${roomId}`, filePath, fileName);

    // 3. DB 등록
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    const { error: dbError } = await supabase.from('gallery_items').insert({
      room_id: roomId,
      user_id: userId,
      file_path: publicUrl,
      file_type: filePath.endsWith('.mp4') ? 'video' : 'image',
      file_size: fileInfo.size
    });

    if (dbError) throw dbError;
    return publicUrl;
  },

  /**
   * 팀 프로필 또는 유저 프로필 사진 업데이트 (R2 사용)
   */
  uploadProfileImage: async (type: 'user' | 'room', id: string, filePath: string) => {
    const bucketPath = type === 'user' ? 'profiles' : 'rooms';
    const fileName = `${id}_${Date.now()}.jpg`;
    const publicUrl = await storageService.uploadToR2(bucketPath, filePath, fileName);
    
    if (type === 'user') {
      await supabase.from('profiles').update({ profile_image: publicUrl }).eq('id', id);
    } else {
      await supabase.from('rooms').update({ image_uri: publicUrl }).eq('id', id);
    }
    
    return publicUrl;
  }
};
