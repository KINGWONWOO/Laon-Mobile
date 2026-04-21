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
  const isProcessing = useRef(false);

  useEffect(() => {
    setIsMounted(true);
    registerForPushNotificationsAsync().catch(err => console.warn('Push error:', err));
  }, []);

  useEffect(() => {
    if (!isMounted || isLoadingUser || isProcessing.current) return;

    const currentSegment = segments[0];
    const isLoggedIn = !!currentUser;
    const isPublicPath = ['register', 'forgot-password', 'reset-password', 'auth', 'register'].includes(currentSegment ?? '');
    const isRoot = segments.length === 0 || (segments.length === 1 && !segments[0]);

    console.log(`[Guard] isLoggedIn: ${isLoggedIn}, Path: /${segments.join('/')}, isPublic: ${isPublicPath}`);

    if (isLoggedIn) {
      if (isRoot || isPublicPath) {
        isProcessing.current = true;
        console.log('[Guard] SUCCESS -> Redirecting to /rooms');
        router.replace('/rooms');
        setTimeout(() => { isProcessing.current = false; }, 1000);
      }
    } else {
      if (!isPublicPath && !isRoot) {
        isProcessing.current = true;
        console.log('[Guard] UNAUTH -> Redirecting to root (login)');
        router.replace('/');
        setTimeout(() => { isProcessing.current = false; }, 1000);
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
