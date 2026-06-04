import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Shadows } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { authService } from '../services/authService';
import { useAppContext } from '../context/AppContext';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '../constants/translations';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'kakao' | 'apple' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();
  
  const { theme, loginWithSocial, language, setLanguage, t } = useAppContext();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('notification'), t('emailPasswordRequired'));
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    console.log('[LoginScreen] Attempting email login:', email);
    try {
      const { data, error } = await authService.signIn(email, password);
      if (error) throw error;
      console.log('[LoginScreen] Login success, navigating to rooms');
      router.replace('/rooms');
    } catch (err: any) {
      console.error('[LoginScreen] Login error:', err);
      setErrorMsg(err.message || t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao' | 'apple') => {
    setSocialLoading(provider as any);
    try {
      const { data, error } = await loginWithSocial(provider);
      if (error) throw error;
      if (data?.session) router.replace('/rooms');
    } catch (err: any) {
      console.error(`[SocialAuth] Error:`, err);
      Alert.alert(t('notification'), `${provider} ${t('loginFailed')}\n${err.message || ''}`);
    } finally {
      setSocialLoading(null);
    }
  };

  const currentColors = theme || Colors;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: currentColors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: currentColors.primary }]}>LAON</Text>
            <Text style={[styles.subtitle, { color: currentColors.text }]}>DANCE FEEDBACK</Text>
            <Text style={[styles.description, { color: currentColors.textSecondary }]}>
              {t('tagline')}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={[styles.inputContainer, { backgroundColor: currentColors.card, borderColor: 'transparent' }, Shadows.soft]}>
              <Ionicons name="mail-outline" size={20} color={currentColors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: currentColors.text }]}
                placeholder={t('emailAddress')}
                placeholderTextColor={currentColors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: currentColors.card, borderColor: 'transparent', marginTop: 16 }, Shadows.soft]}>
              <Ionicons name="lock-closed-outline" size={20} color={currentColors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: currentColors.text }]}
                placeholder={t('password')}
                placeholderTextColor={currentColors.textSecondary}
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
              <Text style={{ color: currentColors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('forgotPassword')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.8}
              style={[styles.loginButton, { backgroundColor: currentColors.primary }, Shadows.glow]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>{t('login')}</Text>}
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={[styles.divider, { backgroundColor: currentColors.border }]} />
              <Text style={[styles.dividerText, { color: currentColors.textSecondary }]}>{t('socialLogin')}</Text>
              <View style={[styles.divider, { backgroundColor: currentColors.border }]} />
            </View>

            <View style={styles.socialButtons}>
              <TouchableOpacity 
                style={[styles.socialBtn, { backgroundColor: currentColors.card, borderColor: '#EA433533', borderWidth: 1 }, Shadows.soft]}
                onPress={() => handleSocialLogin('google')}
                disabled={!!socialLoading || loading}
              >
                {socialLoading === 'google' ? <ActivityIndicator size="small" color="#EA4335" /> : <Ionicons name="logo-google" size={26} color="#EA4335" />}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.socialBtn, { backgroundColor: currentColors.card, marginLeft: 16, borderColor: '#FEE50033', borderWidth: 1 }, Shadows.soft]}
                onPress={() => handleSocialLogin('kakao')}
                disabled={!!socialLoading || loading}
              >
                {socialLoading === 'kakao' ? <ActivityIndicator size="small" color="#FEE500" /> : <Ionicons name="chatbubble" size={26} color="#FEE500" />}
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity 
                  style={[styles.socialBtn, { backgroundColor: currentColors.card, marginLeft: 16, borderColor: currentColors.text + '33', borderWidth: 1 }, Shadows.soft]}
                  onPress={() => handleSocialLogin('apple')}
                  disabled={!!socialLoading || loading}
                >
                  {socialLoading === 'apple' ? <ActivityIndicator size="small" color={currentColors.text} /> : <Ionicons name="logo-apple" size={26} color={currentColors.text} />}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.footer}>
              <Text style={{ color: currentColors.textSecondary, fontWeight: '500' }}>{t('noAccount')} </Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={{ color: currentColors.primary, fontWeight: '800' }}>{t('signup')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.langRow}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langChip, { borderColor: language === lang ? currentColors.primary : currentColors.border, backgroundColor: language === lang ? currentColors.primary + '18' : 'transparent' }]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text style={[styles.langChipText, { color: language === lang ? currentColors.primary : currentColors.textSecondary }]}>{LANGUAGE_NAMES[lang]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: Platform.OS === 'ios' ? 80 : 60, flexGrow: 1 },
  header: { marginBottom: 60 },
  title: { fontSize: 38, fontWeight: '900', letterSpacing: -1.5 },
  subtitle: { fontSize: 24, fontWeight: '800', marginTop: -6, letterSpacing: -0.5 },
  description: { fontSize: 14, marginTop: 10, fontWeight: '600', opacity: 0.8 },
  form: { width: '100%' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 16, height: 58 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, fontWeight: '700' },
  errorText: { color: '#FF3B30', fontSize: 13, marginTop: 8, marginLeft: 5, fontWeight: '600' },
  forgotPassword: { alignSelf: 'flex-end' },
  loginButton: { height: 58, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  loginButtonText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 32 },
  divider: { flex: 1, height: 1, opacity: 0.5 },
  dividerText: { marginHorizontal: 16, fontSize: 12, fontWeight: '700', opacity: 0.6 },
  socialButtons: { flexDirection: 'row', justifyContent: 'center' },
  socialBtn: { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 20, gap: 8 },
  langChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  langChipText: { fontSize: 11, fontWeight: '700' }
});
