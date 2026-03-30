import { Tabs, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useEffect, useState } from 'react';
import { Alert, View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { Room } from '../../../types';

export default function RoomLayout() {
  const { id, passcode } = useLocalSearchParams<{ id: string, passcode?: string }>();
  const { rooms, currentUser, joinRoom, getRoomByIdRemote, theme } = useAppContext();
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

      // If not a member, fetch room info from server
      if (passcode) {
        const remoteRoom = await getRoomByIdRemote(id);
        if (remoteRoom) {
          setInviteRoomInfo(remoteRoom);
          
          Alert.alert(
            '팀 초대',
            `'${remoteRoom.name}' 팀에 초대되셨습니다. 참여하시겠습니까?`,
            [
              {
                text: '거절',
                style: 'cancel',
                onPress: () => {
                  setIsCheckingJoin(false);
                  router.replace('/rooms');
                },
              },
              {
                text: '참여하기',
                onPress: async () => {
                  try {
                    const joined = await joinRoom(id, passcode);
                    if (joined) {
                      setRoom(joined);
                      Alert.alert('참여 완료', `'${joined.name}' 팀에 참여되었습니다.`);
                    }
                  } catch (e) {
                    Alert.alert('오류', '참여 중 문제가 발생했습니다.');
                  } finally {
                    setIsCheckingJoin(false);
                  }
                },
              },
            ]
          );
        } else {
          Alert.alert('오류', '방 정보를 찾을 수 없습니다.');
          router.replace('/rooms');
        }
      } else {
        setIsCheckingJoin(false);
      }
    };

    checkInvitation();
  }, [id, passcode, currentUser, rooms]);

  if (isCheckingJoin) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ marginTop: 10, color: theme.textSecondary }}>초대 정보를 확인 중입니다...</Text>
      </View>
    );
  }

  if (!room && !inviteRoomInfo) {
    router.replace('/rooms');
    return null;
  }

  return (
    <Tabs screenOptions={{
      headerTitle: room?.name || '방',
      headerStyle: { backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border },
      headerTintColor: theme.text,
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => router.replace('/rooms')}
          style={{ marginLeft: 15 }}
        >
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
      ),
      tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
      tabBarActiveTintColor: theme.primary,
      tabBarInactiveTintColor: theme.textSecondary,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '메인메뉴',
          tabBarIcon: ({ color }) => <Ionicons name="apps-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '일정 맞추기',
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vote"
        options={{
          title: '투표',
          tabBarIcon: ({ color }) => <Ionicons name="checkbox-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: '영상 피드백',
          tabBarIcon: ({ color }) => <Ionicons name="videocam-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: '아카이브',
          tabBarIcon: ({ color }) => <Ionicons name="images-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
