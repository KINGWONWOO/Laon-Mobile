import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_GALLERY_COUNT = 20;
const DEFAULT_BUCKET = 'laon-dance';

export const storageService = {
  /**
   * 이미지 파일을 압축합니다.
   */
  compressImage: async (uri: string) => {
    try {
      console.log('[Storage] Compressing image:', uri);
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }], 
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (e) {
      console.warn('[Storage] Compression failed:', e);
      return uri;
    }
  },

  /**
   * Cloudflare R2에 파일을 업로드합니다.
   */
  uploadToR2: async (bucketPath: string, filePath: string, fileName: string) => {
    try {
      let targetPath = filePath;
      const lowerName = fileName.toLowerCase();
      if (lowerName.match(/\.(jpg|jpeg|png)$/)) {
        targetPath = await storageService.compressImage(filePath);
      }

      console.log(`[Storage] Uploading to R2: ${bucketPath}/${fileName}`);
      
      const fileInfo: any = await FileSystem.getInfoAsync(targetPath, { size: true });
      if (!fileInfo.exists) throw new Error('파일이 존재하지 않습니다.');

      const contentType = lowerName.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
      const key = `${bucketPath}/${fileName}`;

      // 💡 401 Unauthorized 에러 방지를 위해 세션 토큰 확인
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const { data, error: funcError } = await supabase.functions.invoke('get-r2-upload-url', {
        body: { bucket: DEFAULT_BUCKET, key, contentType },
        headers
      });

      if (funcError) {
        console.error('[Storage] Edge Function Error:', funcError.message);
        throw new Error(`서버 인증 실패: ${funcError.message}`);
      }

      if (!data?.signedUrl) throw new Error('서버로부터 업로드 URL을 받지 못했습니다.');

      const { signedUrl, publicUrl } = data;
      console.log('[Storage] PUT to R2 started');

      const uploadResult = await FileSystem.uploadAsync(signedUrl, targetPath, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': contentType },
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`R2 업로드 실패 (${uploadResult.status})`);
      }

      console.log('[Storage] Upload Complete:', publicUrl);
      return publicUrl;
    } catch (err: any) {
      console.error('[Storage] Final Error:', err.message);
      throw err;
    }
  },

  /**
   * 갤러리 아이템 등록
   */
  uploadToGallery: async (roomId: string, userId: string, filePath: string) => {
    const { count } = await supabase.from('gallery_items').select('*', { count: 'exact', head: true }).eq('room_id', roomId);
    if (count !== null && count >= MAX_GALLERY_COUNT) throw new Error(`갤러리 최대 개수를 초과했습니다.`);

    const ext = filePath.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const publicUrl = await storageService.uploadToR2(`gallery/${roomId}`, filePath, fileName);

    const fileInfo: any = await FileSystem.getInfoAsync(filePath);
    await supabase.from('gallery_items').insert({
      room_id: roomId, user_id: userId, file_path: publicUrl,
      file_type: filePath.toLowerCase().endsWith('.mp4') ? 'video' : 'image',
      file_size: fileInfo.size || 0
    });

    return publicUrl;
  },

  /**
   * 프로필 이미지 업데이트
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
