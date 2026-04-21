import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

/**
 * 💡 인증 콜백 처리 화면
 */
export default function AuthCallback() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const processed = useRef(false);

  useEffect(() => {
    const handleAuth = async () => {
      if (processed.current) return;
      
      console.log('[AuthCallback] Start check. Params:', JSON.stringify(params));
      
      try {
        // 1. 이미 세션이 있는지 확인 (다른 로직에서 이미 처리했을 가능성)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('[AuthCallback] Session exists, going to /rooms');
          processed.current = true;
          router.replace('/rooms');
          return;
        }

        // 2. URL 파라미터에서 직접 추출 시도
        const { access_token, refresh_token, code, error, error_description } = params as any;

        if (error) {
          console.error('[AuthCallback] OAuth Error:', error, error_description);
          Alert.alert('로그인 실패', error_description || '인증 중 오류가 발생했습니다.');
          router.replace('/');
          return;
        }

        if (access_token) {
          console.log('[AuthCallback] Found access_token, setting session...');
          const { error: setErr } = await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token || '',
          });
          if (setErr) throw setErr;
          console.log('[AuthCallback] Session set successfully');
          processed.current = true;
          router.replace('/rooms');
          return;
        }

        if (code) {
          console.log('[AuthCallback] Found code, exchanging for session...');
          // PKCE Flow는 보통 authService에서 이미 처리하지만, 여기서도 시도할 수 있습니다.
          // 다만 exchangeCodeForSession은 전체 URL을 필요로 할 때가 많습니다.
          // 여기서는 이미 authService가 작동 중일 것이므로 잠시 기다립니다.
        }

        console.log('[AuthCallback] No immediate tokens. Waiting for background sync or manual input...');
        
        // 3. 백그라운드 체크 (최대 5초)
        let retryCount = 0;
        const interval = setInterval(async () => {
          retryCount++;
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s) {
            console.log('[AuthCallback] Session found in background!');
            clearInterval(interval);
            processed.current = true;
            router.replace('/rooms');
          }
          if (retryCount > 10) {
            console.warn('[AuthCallback] Background check timeout');
            clearInterval(interval);
            // 만약 토큰도 없고 세션도 없으면 결국 홈으로
            if (!processed.current) router.replace('/');
          }
        }, 500);

      } catch (err: any) {
        console.error('[AuthCallback] Unexpected error:', err.message);
        Alert.alert('로그인 오류', '인증 처리 중 예상치 못한 오류가 발생했습니다.');
        router.replace('/');
      }
    };

    handleAuth();
  }, [params]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#21F3A3" />
      <Text style={{ color: '#fff', marginTop: 15, fontWeight: '600' }}>로그인을 완료하고 있습니다...</Text>
    </View>
  );
}
