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
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }], 
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (e) {
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

      console.log(`[Storage] Uploading: ${bucketPath}/${fileName}`);
      
      const fileInfo: any = await FileSystem.getInfoAsync(targetPath, { size: true });
      if (!fileInfo.exists) throw new Error('파일이 존재하지 않습니다.');

      const contentType = lowerName.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
      const key = `${bucketPath}/${fileName}`;

      // 💡 1. 세션 및 환경 변수 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('[Storage] Auth Diagnosis:', {
        hasSession: !!session,
        expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A',
        hasAccessToken: !!session?.access_token,
        sessionError: sessionError?.message
      });

      if (!session) {
        // 세션이 없다면 로그인을 다시 유도해야 합니다.
        throw new Error('인증 세션이 없습니다. 다시 로그인해 주세요.');
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      console.log('[Storage] Project URL:', supabaseUrl);

      // 💡 2. supabase.functions.invoke를 사용하여 Edge Function 호출
      console.log('[Storage] Requesting signed URL via supabase.functions.invoke...');
      
      // invoke는 내부적으로 현재 session.access_token을 Authorization: Bearer <token> 헤더에 담아 보냅니다.
      const { data, error: invokeError } = await supabase.functions.invoke('get-r2-upload-url', {
        body: { bucket: DEFAULT_BUCKET, key, contentType }
      });

      if (invokeError) {
        console.error('[Storage] Edge Function Invoke Error Detail:', JSON.stringify(invokeError, null, 2));
        
        // 💡 Edge Function에서 반환한 상세 에러 메시지 추출 시도
        let detailedMsg = '';
        try {
          if (invokeError instanceof Error && 'context' in invokeError) {
            const context = (invokeError as any).context;
            if (context && typeof context.json === 'function') {
              const body = await context.json();
              detailedMsg = body.error || body.message || JSON.stringify(body);
            }
          }
        } catch (e) {
          console.error('[Storage] Failed to parse error body:', e);
        }

        const errorMsg = detailedMsg || (invokeError instanceof Error ? invokeError.message : JSON.stringify(invokeError));
        throw new Error(`서버 인증 실패: ${errorMsg}`);
      }

      if (!data?.signedUrl) {
        console.error('[Storage] No signedUrl in response:', data);
        throw new Error('업로드 URL을 생성할 수 없습니다.');
      }

      const { signedUrl, publicUrl } = data;

      // 💡 3. R2에 직접 업로드
      const uploadResult = await FileSystem.uploadAsync(signedUrl, targetPath, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': contentType },
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`R2 저장소 업로드 실패 (${uploadResult.status})`);
      }

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
    const { error: dbError } = await supabase.from('gallery_items').insert({
      room_id: roomId, 
      user_id: userId, 
      file_path: publicUrl,
      file_type: filePath.toLowerCase().endsWith('.mp4') ? 'video' : 'image',
      file_size: fileInfo.size || 0
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
