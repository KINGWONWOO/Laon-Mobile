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
    mobileAds().initialize();
  } catch (e) {}
}

initSentry();
const queryClient = new QueryClient();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { currentUser, isLoadingUser } = useAppContext();
  const segments = useSegments();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const lastNav = useRef('');

  useEffect(() => {
    setIsMounted(true);
    registerForPushNotificationsAsync().catch(err => console.warn('Push error:', err));
  }, []);

  useEffect(() => {
    const logPrefix = `[Guard][${new Date().toLocaleTimeString()}]`;
    
    // 💡 마운트되지 않았거나 유저 정보를 불러오는 중이면 판단을 유보합니다.
    if (!isMounted || isLoadingUser) return;

    const currentSegment = segments[0];
    const isLoggedIn = !!currentUser;
    const isPublicPath = ['register', 'forgot-password', 'reset-password', 'auth'].includes(currentSegment ?? '');
    const isRoot = segments.length === 0 || (segments.length === 1 && !segments[0]);
    
    console.log(`${logPrefix} isLoggedIn:${isLoggedIn}, Path:/${segments.join('/')}, isPublic:${isPublicPath}`);

    if (isLoggedIn) {
      // 💡 로그인 상태인데 루트나 공용 페이지(인증 콜백 포함)에 있다면 메인으로 이동
      if (isRoot || isPublicPath) {
        if (lastNav.current !== '/rooms') {
          console.log(`${logPrefix} Redirecting to /rooms`);
          lastNav.current = '/rooms';
          router.replace('/rooms');
        }
      }
    } else {
      // 💡 로그아웃 상태인데 보호된 페이지에 있다면 로그인으로 이동
      if (!isPublicPath && !isRoot) {
        if (lastNav.current !== '/') {
          console.log(`${logPrefix} Redirecting to LOGIN (root)`);
          lastNav.current = '/';
          router.replace('/');
        }
      }
    }
  }, [currentUser, segments, isMounted, isLoadingUser, router]);

  if (!isMounted || (isLoadingUser && segments[0] !== 'auth')) {
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
