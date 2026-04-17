import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Shadows } from '../constants/theme';
import { StyledBackButton, DanceButton } from '../components/ui/Interactions';
import { supabase } from '../lib/supabase';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();

  // 이메일 링크를 통해 앱에 진입하면 Supabase가 자동으로 세션을 복원함
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        Alert.alert('오류', '유효하지 않거나 만료된 링크입니다.', [
          { text: '확인', onPress: () => router.replace('/') },
        ]);
      }
    });
  }, []);

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (!/[a-z]/.test(pw)) return '소문자(a-z)를 포함해야 합니다.';
    if (!/[A-Z]/.test(pw)) return '대문자(A-Z)를 포함해야 합니다.';
    if (!/[0-9]/.test(pw)) return '숫자(0-9)를 포함해야 합니다.';
    return null;
  };

  const handleReset = async () => {
    const validationError = validatePassword(password);
    if (validationError) {
      Alert.alert('오류', validationError);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert('오류', error.message);
    } else {
      Alert.alert('완료', '비밀번호가 변경되었습니다. 다시 로그인해주세요.', [
        {
          text: '확인',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/');
          },
        },
      ]);
    }
  };

  if (!sessionReady) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.navHeader}>
        <StyledBackButton />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>새 비밀번호 설정</Text>
        <Text style={styles.subtitle}>
          8자 이상, 대문자·소문자·숫자를 포함한{'\n'}새 비밀번호를 입력해주세요.
        </Text>

        <Text style={styles.label}>새 비밀번호</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="8자 이상, 대/소문자 + 숫자 포함"
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry
          autoCapitalize="none"
        />

        <Text style={styles.label}>비밀번호 확인</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="비밀번호 다시 입력"
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry
          autoCapitalize="none"
        />

        <DanceButton
          title="비밀번호 변경"
          onPress={handleReset}
          loading={loading}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  navHeader: { paddingTop: 60, paddingHorizontal: 20 },
  content: { padding: 30, paddingTop: 20 },
  title: { fontSize: 32, fontWeight: '900', color: Colors.text, marginBottom: 10 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 35, lineHeight: 24 },
  label: { fontSize: 14, color: Colors.text, marginBottom: 8, fontWeight: '600' },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 16,
    paddingHorizontal: 20,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.soft,
  },
  button: { borderRadius: 30, height: 60 },
});
