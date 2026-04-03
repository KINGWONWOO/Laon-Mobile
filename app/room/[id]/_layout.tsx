import { Tabs, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useEffect, useState } from 'react';
import { Alert, View, ActivityIndicator, TouchableOpacity, Text, Platform } from 'react-native';
import { Room } from '../../../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RoomLayout() {
  const { id, passcode } = useLocalSearchParams<{ id: string, passcode?: string }>();
  const { rooms, currentUser, joinRoom, getRoomByIdRemote, theme } = useAppContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [isCheckingJoin, setIsCheckingJoin] = useState(true);
  const [inviteRoomInfo, setInviteRoomInfo] = useState<Room | null>(null);

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
          setRoom(remoteRoom);
          setIsCheckingJoin(false);
        }
      } else {
        setIsCheckingJoin(false);
      }
    };

    const showInviteAlert = (remoteRoom: Room) => {
      Alert.alert(
        '팀 초대',
        `'${remoteRoom.name}' 팀에 초대되셨습니다. 참여하시겠습니까?`,
        [
          { text: '거절', style: 'cancel', onPress: () => router.replace('/rooms') },
          {
            text: '참여하기',
            onPress: async () => {
              try {
                const joined = await joinRoom(id, passcode!);
                if (joined) setRoom(joined);
              } catch (e) {
                Alert.alert('오류', '참여 중 문제가 발생했습니다.');
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
        <Text style={{ marginTop: 10, color: theme.textSecondary }}>정보를 확인 중입니다...</Text>
      </View>
    );
  }

  if (!room && !inviteRoomInfo) return null;

  return (
    <Tabs screenOptions={{
      headerTitle: room?.name || '방',
      headerStyle: { backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border },
      headerTintColor: theme.text,
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.replace('/rooms')} style={{ marginLeft: 15 }}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
      ),
      tabBarStyle: { 
        backgroundColor: theme.card, 
        borderTopColor: theme.border, 
        height: Platform.OS === 'ios' ? 88 : 65 + (insets.bottom > 0 ? insets.bottom : 10),
        paddingBottom: Platform.OS === 'ios' ? 30 : 15 + (insets.bottom > 0 ? insets.bottom : 0),
        paddingTop: 10,
      },
      tabBarActiveTintColor: theme.primary,
      tabBarInactiveTintColor: theme.textSecondary,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }
    }}>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: '홈', 
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> 
        }} 
      />
      <Tabs.Screen name="schedule" options={{ title: '일정', tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} /> }} />
      <Tabs.Screen name="vote" options={{ title: '투표', tabBarIcon: ({ color }) => <Ionicons name="checkbox" size={24} color={color} /> }} />
      <Tabs.Screen name="feedback" options={{ title: '피드백', tabBarIcon: ({ color }) => <Ionicons name="videocam" size={24} color={color} /> }} />
      <Tabs.Screen name="archive" options={{ title: '사진', tabBarIcon: ({ color }) => <Ionicons name="images" size={24} color={color} /> }} />
      <Tabs.Screen name="members" options={{ href: null }} />
    </Tabs>
  );
}
