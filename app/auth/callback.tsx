import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAppContext } from '../../context/AppContext';

export default function AuthCallback() {
  const { isLoadingUser, currentUser } = useAppContext();

  // 💡 이 컴포넌트는 직접 네비게이션을 하지 않습니다.
  // Root Layout의 Guard가 currentUser와 isLoadingUser 상태를 보고 이동시킵니다.
  
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#21F3A3" />
      <Text style={{ color: '#fff', marginTop: 15, fontWeight: 'bold' }}>
        {isLoadingUser ? "프로필 정보를 불러오고 있습니다..." : "로그인을 마무리하고 있습니다..."}
      </Text>
    </View>
  );
}
