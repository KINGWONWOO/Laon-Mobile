import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_GALLERY_COUNT = 20;

export const storageService = {
  /**
   * Cloudflare R2에 파일을 업로드합니다.
   */
  uploadToR2: async (bucketPath: string, filePath: string, fileName: string) => {
    try {
      console.log('[Storage] Starting upload for:', fileName, 'Path:', filePath);
      
      // 1. 파일 정보 확인 (SDK 52+ 에 맞춰 getFileInfoAsync 사용)
      // FileSystem.getInfoAsync 는 최신 버전에서 getFileInfoAsync 로 대체되었습니다.
      const fileInfo = await FileSystem.getFileInfoAsync(filePath, { size: true });
      
      if (!fileInfo.exists) {
        throw new Error('파일이 존재하지 않습니다.');
      }
      
      const fileSize = fileInfo.size || 0;
      console.log('[Storage] File size:', fileSize);

      if (fileSize > MAX_FILE_SIZE) {
        throw new Error('파일 용량은 5MB를 초과할 수 없습니다.');
      }

      const contentType = fileName.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
      const key = `${bucketPath}/${fileName}`;

      // 2. Supabase Edge Function을 호출하여 pre-signed URL 획득
      const { data, error: funcError } = await supabase.functions.invoke('get-r2-upload-url', {
        body: { key, contentType }
      });

      if (funcError || !data) {
        console.error('[Storage] Edge Function Error:', funcError);
        throw new Error('업로드 URL을 가져오지 못했습니다. (Edge Function 확인 필요)');
      }

      const { signedUrl, publicUrl } = data;
      console.log('[Storage] Pre-signed URL received');

      // 3. R2에 직접 업로드 (PUT)
      // uploadAsync 를 사용하여 바이너리 데이터 전송
      const uploadResult = await FileSystem.uploadAsync(signedUrl, filePath, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': contentType,
        },
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        console.error('[Storage] R2 Upload Error Body:', uploadResult.body);
        throw new Error(`R2 업로드 실패 (HTTP ${uploadResult.status})`);
      }

      console.log('[Storage] Upload Success! Public URL:', publicUrl);
      return publicUrl;
    } catch (err: any) {
      console.error('[R2 Storage] Final Error:', err.message);
      throw err;
    }
  },

  /**
   * 갤러리 아이템 등록
   */
  uploadToGallery: async (roomId: string, userId: string, filePath: string) => {
    const { count, error: countError } = await supabase
      .from('gallery_items')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    if (countError) throw countError;
    if (count !== null && count >= MAX_GALLERY_COUNT) {
      throw new Error(`갤러리에는 최대 ${MAX_GALLERY_COUNT}개까지만 올릴 수 있습니다.`);
    }

    const ext = filePath.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const publicUrl = await storageService.uploadToR2(`gallery/${roomId}`, filePath, fileName);

    const fileInfo = await FileSystem.getFileInfoAsync(filePath);
    const fileSize = fileInfo.size || 0;

    const { error: dbError } = await supabase.from('gallery_items').insert({
      room_id: roomId,
      user_id: userId,
      file_path: publicUrl,
      file_type: filePath.toLowerCase().endsWith('.mp4') ? 'video' : 'image',
      file_size: fileSize
    });

    if (dbError) throw dbError;
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
