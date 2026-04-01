import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

/**
 * 💡 인증 콜백 대기 화면
 * 직접적인 리디렉션은 app/_layout.tsx의 전역 인증 감지 로직에서 처리합니다.
 * 이를 통해 소셜 로그인 시 화면이 중복으로 겹쳐 뜨는 현상을 방지합니다.
 */
export default function AuthCallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#21F3A3" />
      <Text style={{ color: '#fff', marginTop: 15, fontWeight: '600' }}>로그인 처리 중입니다...</Text>
    </View>
  );
}
