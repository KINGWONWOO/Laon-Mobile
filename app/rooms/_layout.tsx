import { Stack } from 'expo-router';

export default function RoomsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: '내 방 목록' }} />
      <Stack.Screen name="create" options={{ presentation: 'modal', title: '방 만들기' }} />
      <Stack.Screen name="join" options={{ presentation: 'modal', title: '방 참여하기' }} />
    </Stack>
  );
}
