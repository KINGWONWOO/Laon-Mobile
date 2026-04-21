import 'expo-dev-client';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useLocalSearchParams } from 'expo-router';
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
  const params = useLocalSearchParams();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const lastNav = useRef<string>('');

  useEffect(() => {
    setIsMounted(true);
    registerForPushNotificationsAsync().catch(err => console.warn('Push error:', err));
  }, []);

  useEffect(() => {
    if (!isMounted || isLoadingUser) return;

    const currentSegment = segments[0];
    const isLoggedIn = !!currentUser;
    const isPublicPath = ['register', 'forgot-password', 'reset-password', 'auth'].includes(currentSegment ?? '');
    const isRoot = segments.length === 0 || (segments.length === 1 && !segments[0]);
    
    // 💡 OAuth 콜백 파라미터가 있는 경우 리디렉션을 잠시 유보합니다.
    const hasAuthParams = params.access_token || params.refresh_token || params.code;

    console.log(`[Guard] isLoggedIn: ${isLoggedIn}, Path: /${segments.join('/')}, isPublic: ${isPublicPath}, hasParams: ${!!hasAuthParams}`);

    if (isLoggedIn) {
      if ((isRoot || isPublicPath) && !hasAuthParams) {
        if (lastNav.current !== '/rooms') {
          console.log('[Guard] Redirect -> /rooms');
          lastNav.current = '/rooms';
          router.replace('/rooms');
        }
      }
    } else {
      if (!isPublicPath && !isRoot) {
        if (lastNav.current !== '/') {
          console.log('[Guard] Redirect -> login');
          lastNav.current = '/';
          router.replace('/');
        }
      }
    }
  }, [currentUser, segments, isMounted, isLoadingUser, params]);

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
EOF
