import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { authService } from '../services/authService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'kakao' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const { error } = await authService.signIn(email, password);
      if (error) {
        setErrorMsg(error.message === 'Invalid login credentials' ? '정보가 일치하지 않습니다.' : error.message);
      }
    } catch {
      setErrorMsg('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    setErrorMsg(null);
    setSocialLoading(provider);
    try {
      const { error } = await authService.signInWithSocial(provider);
      if (error) {
        Alert.alert('로그인 오류', `${provider} 로그인에 실패했습니다. (${error.message})`);
      }
    } catch (err: any) {
      Alert.alert('오류', `로그인 중 문제가 발생했습니다: ${err.message}`);
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>LAON DANCE</Text>
          <Text style={styles.subtitle}>춤추는 사람들의 피드백 공간</Text>
        </View>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#FF4B4B" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />

          <TouchableOpacity onPress={() => router.push('/forgot-password')}>
            <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: Colors.primary }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.loginBtnText}>로그인</Text>}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>간편 로그인</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity
          style={[styles.socialBtn, styles.googleBtn]}
          onPress={() => handleSocialLogin('google')}
          disabled={!!socialLoading}
        >
          {socialLoading === 'google' ? <ActivityIndicator size="small" color="#DB4437" /> : <Ionicons name="logo-google" size={20} color="#DB4437" />}
          <Text style={styles.socialBtnText}>Google로 계속하기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.socialBtn, styles.kakaoBtn]}
          onPress={() => handleSocialLogin('kakao')}
          disabled={!!socialLoading}
        >
          {socialLoading === 'kakao' ? <ActivityIndicator size="small" color="#3C1E1E" /> : <Ionicons name="chatbubble" size={20} color="#3C1E1E" />}
          <Text style={[styles.socialBtnText, { color: '#3C1E1E' }]}>카카오로 계속하기</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>처음이신가요? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.registerLink}>회원가입 하기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 30, paddingTop: 100 },
  header: { marginBottom: 40 },
  title: { fontSize: 36, fontWeight: '900', color: Colors.text, letterSpacing: 2 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginTop: 8 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 75, 75, 0.1)', padding: 12, borderRadius: 8, marginBottom: 20 },
  errorText: { color: '#FF4B4B', fontSize: 14, marginLeft: 8 },
  inputContainer: { marginBottom: 25 },
  label: { fontSize: 14, color: Colors.text, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: Colors.card, borderRadius: 12, padding: 16, color: Colors.text, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: Colors.border },
  forgotText: { color: Colors.primary, fontSize: 14, alignSelf: 'flex-end' },
  loginBtn: { borderRadius: 12, padding: 18, alignItems: 'center', marginBottom: 35, height: 60, justifyContent: 'center' },
  loginBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 15, color: Colors.textSecondary, fontSize: 12 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, height: 52 },
  googleBtn: { backgroundColor: '#fff' },
  kakaoBtn: { backgroundColor: '#FEE500', borderColor: '#FEE500' },
  socialBtnText: { marginLeft: 10, fontWeight: '600', fontSize: 15, color: '#000' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 15 },
  footerText: { color: Colors.textSecondary },
  registerLink: { color: Colors.primary, fontWeight: 'bold' },
});
