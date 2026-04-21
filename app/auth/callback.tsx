import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import * as Linking from 'expo-linking';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const processed = useRef(false);

  useEffect(() => {
    const handleAuth = async () => {
      if (processed.current) return;
      console.log('[AuthCallback] Processing tokens...');

      // 1. URL에서 직접 추출 시도 (해시 fragment 대응)
      const initialUrl = await Linking.getInitialURL();
      const urlToParse = initialUrl || '';
      
      const hash = urlToParse.split('#')[1] || urlToParse.split('?')[1];
      if (hash && hash.includes('access_token=')) {
        const tokenParams: any = {};
        hash.split('&').forEach(p => { const [k, v] = p.split('='); tokenParams[k] = v; });

        if (tokenParams.access_token) {
          const { error } = await supabase.auth.setSession({
            access_token: tokenParams.access_token,
            refresh_token: tokenParams.refresh_token || '',
          });
          if (!error) {
            processed.current = true;
            router.replace('/rooms');
            return;
          }
        }
      }

      // 2. 이미 세션이 있는지 확인 (AuthService가 이미 처리한 경우)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        processed.current = true;
        router.replace('/rooms');
        return;
      }

      // 3. 백그라운드 체크 (최대 4초)
      let count = 0;
      const interval = setInterval(async () => {
        count++;
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s) {
          clearInterval(interval);
          processed.current = true;
          router.replace('/rooms');
        }
        if (count > 8) {
          clearInterval(interval);
          if (!processed.current) router.replace('/');
        }
      }, 500);
    };

    handleAuth();
  }, [params]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#21F3A3" />
      <Text style={{ color: '#fff', marginTop: 15 }}>인증 정보를 확인 중입니다...</Text>
    </View>
  );
}
