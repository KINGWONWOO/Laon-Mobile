import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';
import { StyledBackButton, DanceButton } from '../components/ui/Interactions';
import { authService } from '../services/authService';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  
  const router = useRouter();

  const checkEmail = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('알림', '유효한 이메일 주소를 입력해주세요.');
      return;
    }
    setCheckingEmail(true);
    const { available } = await authService.checkEmailAvailable(email);
    setEmailAvailable(available);
    setCheckingEmail(false);
    if (available) {
      Alert.alert('성공', '사용 가능한 이메일입니다.');
    } else {
      Alert.alert('오류', '이미 가입된 이메일입니다.');
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !name || !phone) {
      Alert.alert('오류', '모든 정보를 입력해주세요.');
      return;
    }
    if (emailAvailable === false) {
      Alert.alert('오류', '이메 중복 확인이 필요합니다.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('오류', '비밀번호는 6자리 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    const { error } = await authService.signUp(email, password, name, phone);
    setLoading(false);

    if (error) {
      Alert.alert('회원가입 실패', error.message);
    } else {
      Alert.alert('가입 완료', '이메일 인증 링크를 확인해주세요!', [
        { text: '확인', onPress: () => router.replace('/') }
      ]);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.navHeader}><StyledBackButton /></View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>JOIN US</Text>
        <Text style={styles.subtitle}>새로운 댄서로 등록하세요</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>이메일 주소</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={email}
              onChangeText={(text) => { setEmail(text); setEmailAvailable(null); }}
              placeholder="dancer@example.com"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity 
              style={[styles.checkBtn, { backgroundColor: emailAvailable ? '#34C759' : Colors.primary }]} 
              onPress={checkEmail}
              disabled={checkingEmail}
            >
              {checkingEmail ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.checkBtnText}>{emailAvailable ? '확인됨' : '중복확인'}</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>이름</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="홍길동"
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={styles.label}>휴대폰 번호</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="010-1234-5678"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="6자리 이상 입력"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />

          <Text style={styles.label}>비밀번호 확인</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setPasswordConfirm}
            placeholder="비밀번호 다시 입력"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />
        </View>

        <DanceButton 
          title="회원가입 완료" 
          onPress={handleSignUp}
          style={styles.registerBtn}
          loading={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navHeader: { paddingTop: 60, paddingHorizontal: 20 },
  scrollContent: { padding: 30, paddingBottom: 50 },
  title: { fontSize: 32, fontWeight: '900', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 35 },
  inputContainer: { marginBottom: 30 },
  label: { fontSize: 14, color: Colors.text, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: Colors.card, borderRadius: 12, padding: 16, color: Colors.text, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  checkBtn: { paddingVertical: 16, paddingHorizontal: 15, borderRadius: 12, justifyContent: 'center' },
  checkBtnText: { color: '#000', fontWeight: 'bold', fontSize: 13 },
  registerBtn: { width: '100%', height: 60 },
});
