import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Colors } from '../constants/theme';
import { StyledBackButton } from '../components/ui/Interactions';
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
    <View style={styles.container}>
      <View style={styles.navHeader}><StyledBackButton /></View>
      <View style={styles.content}>
        <Text style={styles.title}>비밀번호 찾기</Text>
        <Text style={styles.subtitle}>가입하신 이메일 주소를 입력하시면 재설정 링크를 보내드립니다.</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="example@email.com"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity 
          style={[styles.resetBtn, { backgroundColor: Colors.primary }]} 
          onPress={handleReset}
          disabled={loading}
        >
          <Text style={styles.resetBtnText}>{loading ? '전송 중...' : '재설정 이메일 보내기'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navHeader: { paddingTop: 60, paddingHorizontal: 20 },
  content: { padding: 30, justifyContent: 'center', flex: 0.8 },
  title: { fontSize: 28, fontWeight: '900', color: Colors.text, marginBottom: 10 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 40, lineHeight: 22 },
  input: { backgroundColor: Colors.card, borderRadius: 12, padding: 16, color: Colors.text, fontSize: 16, marginBottom: 25, borderWidth: 1, borderColor: Colors.border },
  resetBtn: { borderRadius: 12, padding: 18, alignItems: 'center' },
  resetBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});
