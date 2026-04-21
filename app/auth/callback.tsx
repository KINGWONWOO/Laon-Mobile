import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import * as Linking from 'expo-linking';

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
      
      console.log('[AuthCallback] Start check.');
      
      try {
        // 1. 이미 세션이 있는지 확인
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          console.log('[AuthCallback] Session already active');
          processed.current = true;
          router.replace('/rooms');
          return;
        }

        // 2. 딥링크 URL에서 직접 토큰 추출 시도 (안드로이드/iOS 브라우저 리디렉션 대응)
        const initialUrl = await Linking.getInitialURL();
        const urlToParse = initialUrl || '';
        console.log('[AuthCallback] Initial URL:', urlToParse);

        if (urlToParse.includes('access_token=')) {
          const hash = urlToParse.split('#')[1] || urlToParse.split('?')[1];
          if (hash) {
            const parts = hash.split('&');
            const tokenParams: Record<string, string> = {};
            parts.forEach(p => {
              const [k, v] = p.split('=');
              tokenParams[k] = v;
            });

            if (tokenParams.access_token) {
              console.log('[AuthCallback] Found token in URL, setting session...');
              const { error: setErr } = await supabase.auth.setSession({
                access_token: tokenParams.access_token,
                refresh_token: tokenParams.refresh_token || '',
              });
              if (!setErr) {
                processed.current = true;
                router.replace('/rooms');
                return;
              }
            }
          }
        }

        // 3. 백그라운드 체크 (최대 5초)
        let retryCount = 0;
        const interval = setInterval(async () => {
          retryCount++;
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s) {
            console.log('[AuthCallback] Session caught in interval!');
            clearInterval(interval);
            processed.current = true;
            router.replace('/rooms');
          }
          if (retryCount > 10) {
            clearInterval(interval);
            if (!processed.current) {
              console.log('[AuthCallback] Timeout - no session found');
              router.replace('/');
            }
          }
        }, 500);

      } catch (err: any) {
        console.error('[AuthCallback] Error:', err.message);
        router.replace('/');
      }
    };

    handleAuth();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#21F3A3" />
      <Text style={{ color: '#fff', marginTop: 15, fontWeight: '600' }}>로그인을 완료하고 있습니다...</Text>
    </View>
  );
}
