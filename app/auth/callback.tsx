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
      const logPrefix = `[AuthCallback][${new Date().toLocaleTimeString()}]`;
      if (processed.current) return;
      
      console.log(`${logPrefix} Checking for tokens/session...`);
      
      try {
        // 1. 이미 세션이 있는지 확인
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          console.log(`${logPrefix} Session found! Redirecting to /rooms`);
          processed.current = true;
          router.replace('/rooms');
          return;
        }

        // 2. URL 파라미터 직접 추출 (Implicit Flow)
        const initialUrl = await Linking.getInitialURL();
        console.log(`${logPrefix} Initial URL from Linking: ${initialUrl}`);

        const urlToParse = initialUrl || '';
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
              console.log(`${logPrefix} Found access_token in initial URL. Setting session...`);
              const { error: setErr } = await supabase.auth.setSession({
                access_token: tokenParams.access_token,
                refresh_token: tokenParams.refresh_token || '',
              });
              if (!setErr) {
                processed.current = true;
                console.log(`${logPrefix} Session set via manual parse. Redirecting...`);
                router.replace('/rooms');
                return;
              }
              console.error(`${logPrefix} setSession error:`, setErr.message);
            }
          }
        }

        // 3. 백그라운드 폴링 (최대 6초)
        console.log(`${logPrefix} Entering background sync loop...`);
        let retryCount = 0;
        const interval = setInterval(async () => {
          retryCount++;
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s) {
            console.log(`${logPrefix} Session caught!`);
            clearInterval(interval);
            processed.current = true;
            router.replace('/rooms');
          }
          if (retryCount > 12) {
            console.warn(`${logPrefix} TIMEOUT: No session found after 6s.`);
            clearInterval(interval);
            if (!processed.current) router.replace('/');
          }
        }, 500);

      } catch (err: any) {
        console.error(`${logPrefix} FATAL ERROR:`, err.message);
        router.replace('/');
      }
    };

    handleAuth();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#21F3A3" />
      <Text style={{ color: '#fff', marginTop: 15, fontWeight: '600' }}>인증을 확인하고 있습니다...</Text>
    </View>
  );
}
