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
      // 💡 Supabase OAuth 리디렉션은 해시(#) 파라미터나 쿼리 파라미터로 토큰을 전달합니다.
      // Expo Router의 useLocalSearchParams는 이를 파싱해줍니다.
      const { access_token, refresh_token } = params as { access_token?: string, refresh_token?: string };

      if (access_token && refresh_token) {
        console.log('[AuthCallback] Tokens found, setting session...');
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error('[AuthCallback] setSession error:', error.message);
          Alert.alert('로그인 오류', '인증 세션을 설정하는 중 문제가 발생했습니다.');
          router.replace('/');
        } else {
          console.log('[AuthCallback] Session set successfully');
          // 세션 설정 성공 시 app/_layout.tsx의 전역 가드가 /rooms로 리디렉션합니다.
        }
      } else {
        // 토큰이 없는 경우 (오류 상황)
        console.warn('[AuthCallback] No tokens found in URL');
        // 잠시 대기 후에도 세션이 안 잡히면 홈으로 이동
        const timeout = setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) router.replace('/');
          });
        }, 3000);
        return () => clearTimeout(timeout);
      }
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
