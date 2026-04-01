import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppProvider, useAppContext } from '../context/AppContext';
import { initSentry, withSentry } from '../services/logger';
import { registerForPushNotificationsAsync } from '../services/NotificationService';

initSentry();
const queryClient = new QueryClient();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { currentUser, isLoadingUser } = useAppContext();
  const segments = useSegments();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  
  // 💡 현재 리디렉션 중인지 확인하여 중복 실행 방지
  const isProcessing = useRef(false);

  useEffect(() => {
    setIsMounted(true);
    registerForPushNotificationsAsync().catch(err => console.warn('Push error:', err));
  }, []);

  useEffect(() => {
    if (!isMounted || isLoadingUser || isProcessing.current) return;

    const currentSegment = segments[0];
    const isLoggedIn = !!currentUser;
    const isPublicPath = ['register', 'forgot-password', 'reset-password', 'auth'].includes(currentSegment ?? '');
    const isRoot = segments.length === 0 || (segments.length === 1 && !segments[0]);

    console.log(`[Guard] User: ${isLoggedIn ? 'Yes' : 'No'}, Path: /${segments.join('/')}`);

    if (isLoggedIn) {
      // 💡 로그인 상태인데 '로그인 화면'이나 '루트'에 있다면 /rooms로 이동
      if (isRoot || isPublicPath) {
        isProcessing.current = true;
        console.log('[Guard] Redirecting to /rooms');
        router.replace('/rooms');
        // 내비게이션 완료 후 플래그 해제
        setTimeout(() => { isProcessing.current = false; }, 500);
      }
    } else {
      // 비로그인 상태인데 비공개 경로에 있다면 루트(/) 로그인 화면으로
      if (!isPublicPath && !isRoot) {
        isProcessing.current = true;
        console.log('[Guard] Redirecting to root');
        router.replace('/');
        setTimeout(() => { isProcessing.current = false; }, 500);
      }
    }
  }, [currentUser, segments, isMounted, isLoadingUser]);

  if (!isMounted || isLoadingUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#21F3A3" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="rooms" />
        <Stack.Screen name="room/[id]" />
        <Stack.Screen name="auth/callback" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <RootLayoutNav />
      </AppProvider>
    </QueryClientProvider>
  );
}

export default withSentry(RootLayout);
