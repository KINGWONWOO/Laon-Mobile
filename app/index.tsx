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
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await authService.login(email, password);
      router.replace('/rooms');
    } catch (err: any) {
      setErrorMsg(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    setSocialLoading(provider);
    try {
      const { data, error } = await authService.signInWithSocial(provider);
      if (error) throw error;
      if (data?.session) router.replace('/rooms');
    } catch (err: any) {
      console.error(`[SocialAuth] Error:`, err);
      Alert.alert('알림', `${provider} 로그인 중 오류가 발생했습니다.\n${err.message || ''}`);
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: Colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors.primary }]}>LAON</Text>
          <Text style={[styles.subtitle, { color: Colors.text }]}>DANCE FEEDBACK</Text>
          <Text style={[styles.description, { color: Colors.textSecondary }]}>
            더 나은 춤을 위한 크루들의 공간
          </Text>
        </View>

        <View style={styles.form}>
          <View style={[styles.inputContainer, { borderColor: Colors.border }]}>
            <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: Colors.text }]}
              placeholder="이메일 주소"
              placeholderTextColor={Colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={[styles.inputContainer, { borderColor: Colors.border, marginTop: 12 }]}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: Colors.text }]}
              placeholder="비밀번호"
              placeholderTextColor={Colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          <TouchableOpacity 
            style={[styles.forgotPassword, { marginTop: 12 }]}
            onPress={() => router.push('/forgot-password')}
          >
            <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>비밀번호를 잊으셨나요?</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.loginButton, { backgroundColor: Colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>로그인</Text>}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: Colors.border }]} />
            <Text style={[styles.dividerText, { color: Colors.textSecondary }]}>간편 로그인</Text>
            <View style={[styles.divider, { backgroundColor: Colors.border }]} />
          </View>

          <View style={styles.socialButtons}>
            <TouchableOpacity 
              style={[styles.socialBtn, { borderColor: Colors.border }]}
              onPress={() => handleSocialLogin('google')}
              disabled={!!socialLoading}
            >
              {socialLoading === 'google' ? <ActivityIndicator size="small" /> : <Ionicons name="logo-google" size={22} color="#EA4335" />}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.socialBtn, { borderColor: Colors.border, marginLeft: 20 }]}
              onPress={() => handleSocialLogin('kakao')}
              disabled={!!socialLoading}
            >
              {socialLoading === 'kakao' ? <ActivityIndicator size="small" /> : <Ionicons name="chatbubble" size={22} color="#FEE500" />}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={{ color: Colors.textSecondary }}>계정이 없으신가요? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>회원가입</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 30, paddingTop: 100 },
  header: { marginBottom: 40 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: 2 },
  subtitle: { fontSize: 24, fontWeight: '800', marginTop: -5 },
  description: { fontSize: 14, marginTop: 10, fontWeight: '500' },
  form: { width: '100%' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
  errorText: { color: '#FF5A5F', fontSize: 12, marginTop: 8, marginLeft: 5 },
  forgotPassword: { alignSelf: 'flex-end' },
  loginButton: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 30, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  divider: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 15, fontSize: 12, fontWeight: '600' },
  socialButtons: { flexDirection: 'row', justifyContent: 'center' },
  socialBtn: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 }
});
