import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAppContext } from '../context/AppContext';
import { Colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/authService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAppContext();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    const { error } = await authService.signIn(email, password);
    setLoading(false);
    
    if (error) {
      Alert.alert('로그인 실패', error.message);
    } else {
      router.replace('/rooms');
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    const debugUrl = Linking.createURL('/');
    console.log(`${provider} Redirect URL:`, debugUrl);

    setLoading(true);
    try {
      const { error } = await authService.signInWithSocial(provider);
      
      if (error) {
        Alert.alert(
          '로그인 실패', 
          `${provider === 'google' ? 'Google' : '카카오'} 로그인 중 오류가 발생했습니다.\n\n오류: ${error.message}\n\n리디렉션 주소(${debugUrl})가 Supabase Dashboard에 등록되어 있는지 확인해주세요.`
        );
      }
    } catch (e: any) {
      Alert.alert('에러 발생', `로그인 중 문제가 발생했습니다: ${e.message}`);
    } finally {
      setLoading(false);
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
          <Text style={styles.subtitle}>다시 춤추러 오셨군요!</Text>
        </View>

        <View style={styles.inputContainer}>
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

          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />
          
          <Link href="/forgot-password" asChild>
            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <TouchableOpacity 
          style={[styles.loginBtn, { backgroundColor: Colors.primary }]} 
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginBtnText}>{loading ? '로그인 중...' : '로그인'}</Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>간편 로그인</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.socialContainer}>
          <TouchableOpacity 
            style={[styles.socialBtn, styles.googleBtn]} 
            onPress={() => handleSocialLogin('google')}
          >
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.socialBtnText}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialBtn, styles.kakaoBtn]}
            onPress={() => handleSocialLogin('kakao')}
          >
            <Ionicons name="chatbubble" size={20} color="#3C1E1E" />
            <Text style={[styles.socialBtnText, { color: '#3C1E1E' }]}>카카오톡</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>처음이신가요? </Text>
          <Link href="/register" asChild>
            <TouchableOpacity>
              <Text style={styles.registerLink}>회원가입 하기</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 30,
    paddingTop: 100,
  },
  header: {
    marginBottom: 50,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  inputContainer: {
    marginBottom: 30,
  },
  label: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    color: Colors.primary,
    fontSize: 14,
  },
  loginBtn: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 40,
  },
  loginBtnText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 15,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  socialBtn: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  googleBtn: {
    backgroundColor: '#fff',
  },
  kakaoBtn: {
    backgroundColor: '#FEE500',
    borderColor: '#FEE500',
  },
  socialBtnText: {
    marginLeft: 10,
    fontWeight: '600',
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: Colors.textSecondary,
  },
  registerLink: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
});
