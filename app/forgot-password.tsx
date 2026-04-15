import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors, Shadows } from '../constants/theme';
import { StyledBackButton, DanceButton } from '../components/ui/Interactions';
import { authService } from '../services/authService';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('오류', '이메일 주소를 입력해주세요.');
      return;
    }
    setLoading(true);
    const { error } = await authService.resetPassword(email);
    setLoading(false);

    if (error) {
      Alert.alert('오류', error.message);
    } else {
      Alert.alert('메일 전송 완료', '비밀번호 재설정 링크가 이메일로 전송되었습니다.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.navHeader}><StyledBackButton /></View>
      <View style={styles.content}>
        <Text style={styles.title}>비밀번호 찾기</Text>
        <Text style={styles.subtitle}>가입하신 이메일 주소를 입력하시면{'\n'}재설정 링크를 보내드립니다.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>이메일 주소</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <DanceButton 
            title="재설정 이메일 보내기" 
            onPress={handleReset}
            loading={loading}
            style={styles.resetBtn}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navHeader: { paddingTop: 60, paddingHorizontal: 20 },
  content: { padding: 30, justifyContent: 'center', flex: 0.8 },
  title: { fontSize: 32, fontWeight: '900', color: Colors.text, marginBottom: 10 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 40, lineHeight: 24 },
  form: { width: '100%' },
  label: { fontSize: 14, color: Colors.text, marginBottom: 8, fontWeight: '600' },
  input: { 
    backgroundColor: Colors.card, 
    borderRadius: 24, 
    padding: 16, 
    paddingHorizontal: 20,
    color: Colors.text, 
    fontSize: 16, 
    marginBottom: 25, 
    borderWidth: 1, 
    borderColor: Colors.border,
    ...Shadows.soft,
  },
  resetBtn: { borderRadius: 30, height: 60 },
});
