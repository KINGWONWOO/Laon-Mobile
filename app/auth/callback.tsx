import { useEffect } from 'react';
import { View, ActivityIndicator, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

/**
 * 💡 인증 콜백 처리 화면
 * OAuth(Google, Kakao 등) 인증 후 리디렉션된 URL에서 토큰을 추출하여 세션을 설정합니다.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      console.log('[AuthCallback] URL Params check...');
      
      // 1. 이미 세션이 있는지 확인 (authService.ts에서 이미 처리했을 가능성)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('[AuthCallback] Session already exists, redirecting to /rooms');
        router.replace('/rooms');
        return;
      }

      // 2. URL 파라미터에서 토큰 추출 (Implicit Flow 대비)
      const { access_token, refresh_token } = params as { access_token?: string, refresh_token?: string };

      if (access_token) {
        console.log('[AuthCallback] Tokens found in params, setting session...');
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token || '',
        });

        if (error) {
          console.error('[AuthCallback] setSession error:', error.message);
          Alert.alert('로그인 오류', '인증 세션을 설정하는 중 문제가 발생했습니다.');
          router.replace('/');
        } else {
          console.log('[AuthCallback] Session set successfully from params');
          router.replace('/rooms');
        }
        return;
      }

      // 3. 토큰이 없는 경우 (오류 상황 또는 PKCE flow 대기)
      console.warn('[AuthCallback] No tokens found in URL yet. Waiting for background sync...');
      
      // 잠시 대기 후에도 세션이 안 잡히면 홈으로 이동 (PKCE flow는 authService에서 이미 교환 완료했을 것)
      const checkInterval = setInterval(async () => {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          console.log('[AuthCallback] Session found in background, redirecting...');
          clearInterval(checkInterval);
          router.replace('/rooms');
        }
      }, 500);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        supabase.auth.getSession().then(({ data: { session: finalSession } }) => {
          if (!finalSession) {
            console.log('[AuthCallback] Timeout, no session found. Going to login.');
            router.replace('/');
          }
        });
      }, 5000);

      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    };

    handleAuth();
  }, [params]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#21F3A3" />
      <Text style={{ color: '#fff', marginTop: 15, fontWeight: '600' }}>로그인 완료 중입니다...</Text>
    </View>
  );
}
