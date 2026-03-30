import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '../context/AppContext';
import { Colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/authService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
        setErrorMsg(error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 일치하지 않습니다.' : error.message);
      }
      // Success is handled by AppContext session listener
    } catch (e) {
      setErrorMsg('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    setErrorMsg(null);
    try {
      const { error } = await authService.signInWithSocial(provider);
      if (error) Alert.alert('로그인 오류', 'Supabase 대시보드에서 해당 Provider 설정을 확인해주세요.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDemoLogin = () => {
    setLoading(true);
    // Shortcut for testing UI without real backend configured
    setTimeout(() => {
      setLoading(false);
      router.replace('/rooms');
    }, 800);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>LAON DANCE</Text>
          <Text style={styles.subtitle}>팀 피드백 앱에 오신 것을 환영합니다</Text>
        </View>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#FF4B4B" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>이메일 주소</Text>
          <TextInput
            style={[styles.input, errorMsg ? styles.inputError : null]}
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={[styles.input, errorMsg ? styles.inputError : null]}
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />
          
          <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push('/forgot-password')}>
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

        <View style={styles.socialContainer}>
          <TouchableOpacity style={[styles.socialBtn, styles.googleBtn]} onPress={() => handleSocialLogin('google')}>
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.socialBtnText}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.socialBtn, styles.kakaoBtn]} onPress={() => handleSocialLogin('kakao')}>
            <Ionicons name="chatbubble" size={20} color="#3C1E1E" />
            <Text style={styles.kakaoBtnText}>카카오톡</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>처음이신가요? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.registerLink}>회원가입 하기</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.demoBtn} onPress={handleDemoLogin}>
          <Text style={styles.demoText}>테스트용 게스트 입장 (데모 모드)</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 30, paddingTop: 80 },
  header: { marginBottom: 40 },
  title: { fontSize: 36, fontWeight: '900', color: Colors.text, letterSpacing: 2 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginTop: 8 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 75, 75, 0.1)', padding: 12, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255, 75, 75, 0.3)' },
  errorText: { color: '#FF4B4B', fontSize: 14, marginLeft: 8, fontWeight: '500' },
  inputContainer: { marginBottom: 25 },
  label: { fontSize: 14, color: Colors.text, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: Colors.card, borderRadius: 12, padding: 16, color: Colors.text, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: Colors.border },
  inputError: { borderColor: '#FF4B4B' },
  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: { color: Colors.primary, fontSize: 14 },
  loginBtn: { borderRadius: 12, padding: 18, alignItems: 'center', marginBottom: 35, height: 60, justifyContent: 'center' },
  loginBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 15, color: Colors.textSecondary, fontSize: 12 },
  socialContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 35 },
  socialBtn: { flex: 0.48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  googleBtn: { backgroundColor: '#fff' },
  kakaoBtn: { backgroundColor: '#FEE500', borderColor: '#FEE500' },
  socialBtnText: { marginLeft: 10, fontWeight: '600', fontSize: 15, color: '#3C1E1E' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  footerText: { color: Colors.textSecondary },
  registerLink: { color: Colors.primary, fontWeight: 'bold' },
  demoBtn: { marginTop: 40, alignSelf: 'center', padding: 10 },
  demoText: { color: Colors.textSecondary, fontSize: 12, textDecorationLine: 'underline', opacity: 0.5 },
});
