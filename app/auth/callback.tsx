import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const processed = useRef(false);

  useEffect(() => {
    // 💡 1. 세션 변화를 실시간으로 감시 (가장 확실한 방법)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AuthCallback] Event: ${event}`);
      if (session && !processed.current) {
        console.log('[AuthCallback] Session detected via listener! Moving to /rooms');
        processed.current = true;
        router.replace('/rooms');
      }
    });

    const checkInitialSession = async () => {
      // 💡 2. 이미 세션이 있는지 즉시 확인
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !processed.current) {
        console.log('[AuthCallback] Initial session found! Moving to /rooms');
        processed.current = true;
        router.replace('/rooms');
      }
    };

    checkInitialSession();

    // 💡 3. 최후의 보루: 타임아웃 (7초 후에도 안되면 홈으로)
    const timeout = setTimeout(() => {
      if (!processed.current) {
        console.log('[AuthCallback] Timeout. Forcing redirect to root.');
        router.replace('/');
      }
    }, 7000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#21F3A3" />
      <Text style={{ color: '#fff', marginTop: 15, fontWeight: 'bold' }}>로그인을 마무리하고 있습니다...</Text>
    </View>
  );
}
