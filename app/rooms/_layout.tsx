import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../context/AppContext';
import { Colors } from '../../constants/theme';

export default function RoomsLayout() {
  const { logout } = useAppContext();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const LogoutButton = () => (
    <TouchableOpacity
      onPress={handleLogout}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ marginRight: 16 }}
    >
      <Ionicons name="log-out-outline" size={24} color={Colors.primary} />
    </TouchableOpacity>
  );

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { 
          backgroundColor: Colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 18,
          color: Colors.text,
        },
        headerTintColor: Colors.primary,
        headerRight: () => <LogoutButton />,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: '내 방 목록', headerLeft: () => null }} />
      <Stack.Screen name="create" options={{ presentation: 'modal', title: '방 만들기' }} />
      <Stack.Screen name="join" options={{ presentation: 'modal', title: '방 참여하기' }} />
    </Stack>
  );
}
