import 'expo-dev-client';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppProvider, useAppContext } from '../context/AppContext';
import { initSentry, withSentry } from '../services/logger';
import { registerForPushNotificationsAsync } from '../services/NotificationService';

// Google Mobile Ads initialization
if (Platform.OS !== 'web') {
  try {
    const mobileAds = require('react-native-google-mobile-ads').default;
    mobileAds()
      .initialize()
      .then((adapterStatuses: any) => {
        console.log('[AdMob] Initialization complete!', adapterStatuses);
      })
      .catch((err: any) => console.warn('[AdMob] Init error:', err));
  } catch (e) {
    console.log('[AdMob] Not available in this environment');
  }
}

initSentry();
const queryClient = new QueryClient();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { currentUser, isLoadingUser } = useAppContext();
  const segments = useSegments();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  
  // 💡 초기 앱 구동 시에만 로딩을 보여주기 위한 상태
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // 💡 현재 리디렉션 중인지 확인하여 중복 실행 방지
  const isProcessing = useRef(false);

  useEffect(() => {
    setIsMounted(true);
    registerForPushNotificationsAsync().catch(err => console.warn('Push error:', err));
  }, []);

  // 초기 로딩 완료 처리
  useEffect(() => {
    if (isMounted && !isLoadingUser) {
      setIsInitialLoading(false);
    }
  }, [isMounted, isLoadingUser]);

  useEffect(() => {
    // 💡 isLoadingUser가 true일 때는 Guard 로직을 실행하지 않고 대기합니다.
    if (!isMounted || isLoadingUser || isProcessing.current) return;

    const currentSegment = segments[0];
    const isLoggedIn = !!currentUser;
    const isPublicPath = ['register', 'forgot-password', 'reset-password', 'auth'].includes(currentSegment ?? '');
    const isRoot = segments.length <= 1 && (!segments[0] || (segments[0] as string) === '(tabs)');

    console.log(`[Guard] User: ${isLoggedIn ? 'Yes' : 'No'}, Path: /${segments.join('/')}`);

    if (isLoggedIn) {
      if (isRoot || isPublicPath) {
        isProcessing.current = true;
        console.log('[Guard] Redirecting to /rooms');
        router.replace('/rooms');
        setTimeout(() => { isProcessing.current = false; }, 500);
      }
    } else {
      if (!isPublicPath && !isRoot) {
        isProcessing.current = true;
        console.log('[Guard] Redirecting to root');
        router.replace('/');
        setTimeout(() => { isProcessing.current = false; }, 500);
      }
    }
  }, [currentUser, segments, isMounted, isLoadingUser]);

  // 💡 앱이 완전히 처음 켜질 때만 로딩 뷰를 보여줍니다.
  if (!isMounted || isInitialLoading) {
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
