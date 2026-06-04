import { Tabs, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useEffect, useState, useMemo } from 'react';
import { Alert, View, ActivityIndicator, TouchableOpacity, Text, Platform } from 'react-native';
import { Room } from '../../../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RoomLayout() {
  const { id, passcode } = useLocalSearchParams<{ id: string, passcode?: string }>();
  const { rooms, currentUser, joinRoom, getRoomByIdRemote, theme, t } = useAppContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [isCheckingJoin, setIsCheckingJoin] = useState(true);
  const [inviteRoomInfo, setInviteRoomInfo] = useState<Room | null>(null);

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

  useEffect(() => {
    const checkInvitation = async () => {
      if (!id || !currentUser) return;

      const localRoom = rooms.find(r => r.id === id);
      if (localRoom) {
        setRoom(localRoom);
        setIsCheckingJoin(false);
        return;
      }

      const remoteRoom = await getRoomByIdRemote(id);
      
      if (remoteRoom) {
        if (passcode) {
          setInviteRoomInfo(remoteRoom);
          showInviteAlert(remoteRoom);
        } else {
          // 방 멤버인데 로컬 목록에 없는 경우 (동기화 지연)
          // 즉시 캐시 갱신 시도
          refreshAllData();
          setRoom(remoteRoom);
          setIsCheckingJoin(false);
        }
      } else {
        setIsCheckingJoin(false);
      }
    };

    const showInviteAlert = (remoteRoom: Room) => {
      Alert.alert(
        t('teamInvite'),
        `'${remoteRoom.name}' ${t('inviteDesc')}`,
        [
          { text: t('decline'), style: 'cancel', onPress: () => router.replace('/rooms') },
          {
            text: t('join'),
            onPress: async () => {
              try {
                const joined = await joinRoom(id, passcode!);
                if (joined) setRoom(joined);
              } catch (e) {
                Alert.alert(t('error'), t('joinError'));
              } finally {
                setIsCheckingJoin(false);
              }
            },
          },
        ]
      );
    };

    checkInvitation();
  }, [id, passcode, currentUser, rooms]);

  useEffect(() => {
    if (!isCheckingJoin && !room && !inviteRoomInfo) {
      router.replace('/rooms');
    }
  }, [isCheckingJoin, room, inviteRoomInfo]);

  if (isCheckingJoin) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ marginTop: 10, color: theme.textSecondary }}>{t('checkingInfo')}</Text>
      </View>
    );
  }

  if (!room && !inviteRoomInfo) return null;

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
      <Tabs.Screen name="notice/[noticeId]" options={{ href: null }} />
      <Tabs.Screen name="formation/[formationId]" options={{ href: null }} />
    </Tabs>
  );
}

