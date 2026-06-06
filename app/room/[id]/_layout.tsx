import { Tabs, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useEffect, useState, useMemo } from 'react';
import { View, ActivityIndicator, Text, Platform } from 'react-native';
import { Room } from '../../../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

export default function RoomLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rooms, currentUser, getRoomByIdRemote, refreshAllData, theme, t } = useAppContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [room, setRoom] = useState<Room | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const screenOptions = useMemo(() => ({
    headerShown: false,
    tabBarStyle: {
      backgroundColor: theme.card,
      borderTopColor: theme.border,
      height: Platform.OS === 'ios' ? 88 : 65 + (insets.bottom > 0 ? insets.bottom : 10),
      paddingBottom: Platform.OS === 'ios' ? 30 : 15 + (insets.bottom > 0 ? insets.bottom : 0),
      paddingTop: 10,
    },
    tabBarActiveTintColor: theme.primary,
    tabBarInactiveTintColor: theme.textSecondary,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const }
  }), [theme, insets]);

  const prefetchActivity = (roomId: string) =>
    queryClient.prefetchQuery({
      queryKey: ['room_activity', roomId],
      queryFn: async () => {
        const { data } = await supabase
          .from('room_activity')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(5);
        return data || [];
      },
      staleTime: 30000,
    });

  useEffect(() => {
    if (!id || !currentUser) return;

    const local = rooms.find(r => r.id === id);
    if (local) {
      setRoom(local);
      // 탭을 렌더하기 전에 activity 데이터를 먼저 캐시에 채움
      prefetchActivity(id).then(() => setIsChecking(false));
      return;
    }

    // Room not in local list yet - try fetching remotely (sync delay)
    getRoomByIdRemote(id).then(remote => {
      if (remote) {
        refreshAllData();
        setRoom(remote);
        prefetchActivity(id).then(() => setIsChecking(false));
      } else {
        setIsChecking(false);
      }
    }).catch(() => setIsChecking(false));
  }, [id, currentUser, rooms]);

  useEffect(() => {
    if (!isChecking && !room) {
      router.replace('/rooms');
    }
  }, [isChecking, room]);

  if (isChecking) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ marginTop: 10, color: theme.textSecondary }}>{t('checkingInfo')}</Text>
      </View>
    );
  }

  if (!room) return null;

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />
        }}
      />
      <Tabs.Screen name="schedule" options={{ title: t('scheduleTitle'), tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} /> }} />
      <Tabs.Screen name="vote" options={{ title: t('voteTitle'), tabBarIcon: ({ color }) => <Ionicons name="checkbox" size={24} color={color} /> }} />
      <Tabs.Screen name="feedback" options={{ title: t('videoFeedback'), tabBarIcon: ({ color }) => <Ionicons name="videocam" size={24} color={color} /> }} />
      <Tabs.Screen name="archive" options={{ title: t('photos'), tabBarIcon: ({ color }) => <Ionicons name="images" size={24} color={color} /> }} />
      <Tabs.Screen
        name="formation/index"
        options={{
          title: t('formationTitle'),
          tabBarIcon: ({ color }) => <Ionicons name="map" size={24} color={color} />
        }}
      />
      <Tabs.Screen name="members" options={{ href: null }} />
      <Tabs.Screen name="notices" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="notice/[noticeId]" options={{ href: null }} />
      <Tabs.Screen name="formation/[formationId]" options={{ href: null }} />
    </Tabs>
  );
}
