import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppProvider, useAppContext } from '../context/AppContext';
import { initSentry, withSentry } from '../services/logger';
import { registerForPushNotificationsAsync } from '../services/NotificationService';

// Initialize Sentry safely
initSentry();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { currentUser, isLoadingUser } = useAppContext();
  const segments = useSegments();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [showTimeoutMsg, setShowTimeoutMsg] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // 타임아웃 메시지 타이머
    const timer = setTimeout(() => {
      setShowTimeoutMsg(true);
    }, 7000);

    // Request push notification permissions safely
    registerForPushNotificationsAsync().catch(err => {
      console.warn('Push notification registration failed:', err);
    });

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isMounted || isLoadingUser) return;

    // Public routes that don't require login
    const publicRoutes = ['login', 'register', 'forgot-password', 'reset-password'];
    const currentSegment = segments[0];
    const isIndexRoute = !currentSegment;
    const isPublicRoute = isIndexRoute || publicRoutes.includes(currentSegment ?? '');

    if (currentUser && (isIndexRoute || currentSegment === 'login')) {
      router.replace('/rooms');
    } else if (!currentUser && !isPublicRoute) {
      router.replace('/');
    }
  }, [currentUser, segments, isMounted, isLoadingUser, router]);

  if (!isMounted || isLoadingUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 20 }}>
        <ActivityIndicator size="large" color="#21F3A3" />
        {showTimeoutMsg && (
          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: '#aaa', textAlign: 'center', marginBottom: 10 }}>
              초기화 시간이 길어지고 있습니다.
            </Text>
            <TouchableOpacity 
              onPress={() => router.replace('/')}
              style={{ padding: 10, backgroundColor: '#333', borderRadius: 8 }}
            >
              <Text style={{ color: '#21F3A3' }}>메인 화면으로 강제 이동</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="rooms" options={{ headerShown: false }} />
        <Stack.Screen name="room/[id]" options={{ headerShown: false }} />
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