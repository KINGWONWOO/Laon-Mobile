import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import * as Linking from 'expo-linking';

export default function AuthCallback() {
  const router = useRouter();
  const processed = useRef(false);

  useEffect(() => {
    const handleAuth = async () => {
      if (processed.current) return;
      console.log('[AuthCallback] 처리 시작...');

      // 1. 이미 세션이 있는지 확인 (AuthService가 이미 성공시킨 경우)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        processed.current = true;
        router.replace('/rooms');
        return;
      }

      // 2. URL에서 직접 추출 (안드로이드 해시 대응)
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && initialUrl.includes('access_token=')) {
        const hash = initialUrl.split('#')[1] || initialUrl.split('?')[1];
        const params: any = {};
        if (hash) hash.split('&').forEach(p => { const [k, v] = p.split('='); params[k] = v; });

        if (params.access_token) {
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token || '',
          });
          if (!error) {
            processed.current = true;
            router.replace('/rooms');
            return;
          }
        }
      }

      // 3. 백그라운드 체크 루프
      let count = 0;
      const interval = setInterval(async () => {
        count++;
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s) {
          clearInterval(interval);
          processed.current = true;
          router.replace('/rooms');
        }
        if (count > 12) {
          clearInterval(interval);
          if (!processed.current) router.replace('/');
        }
      }, 500);
    };

    handleAuth();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#21F3A3" />
      <Text style={{ color: '#fff', marginTop: 15, fontWeight: 'bold' }}>인증 정보를 확인 중입니다...</Text>
    </View>
  );
}
