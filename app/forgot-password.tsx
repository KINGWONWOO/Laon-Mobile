import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Shadows } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyledBackButton, DanceButton } from '../components/ui/Interactions';
import { useAppContext } from '../context/AppContext';
import { authService } from '../services/authService';

type Step = 'email' | 'code' | 'password';

export default function ForgotPasswordScreen() {
  const { theme, t, language } = useAppContext();
  const router = useRouter();
  const currentColors = theme || Colors;

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setInterval(() => setTimer(v => v - 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timer]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${s % 60 < 10 ? '0' : ''}${s % 60}`;

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert(t('errorTitle'), t('validEmailRequired'));
      return;
    }
    setLoading(true);
    const { sessionToken: token, error } = await authService.sendResetCode(email, language);
    setLoading(false);

    if (error) {
      Alert.alert(t('errorTitle'), error.message);
      return;
    }

    setSessionToken(token ?? null);
    setCode('');
    setTimer(180);
    if (step !== 'code') setStep('code');
    Alert.alert(t('codeSentTitle'), t('codeSentMsg'));
  };

  const handleVerifyCode = async () => {
    if (timer === 0) {
      Alert.alert(t('codeExpiredTitle'), t('codeExpiredMsg'));
      return;
    }
    if (code.length !== 6) {
      Alert.alert(t('notification'), t('enterSixDigitCode'));
      return;
    }
    if (!sessionToken) return;

    setLoading(true);
    const { valid, error } = await authService.checkEmailCode(email, code, sessionToken);
    setLoading(false);

    if (error || !valid) {
      Alert.alert(t('errorTitle'), t('invalidCodeMsg'));
      return;
    }

    setStep('password');
  };

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return t('passwordTooShort');
    if (!/[a-z]/.test(pw)) return t('passwordNeedsLower');
    if (!/[A-Z]/.test(pw)) return t('passwordNeedsUpper');
    if (!/[0-9]/.test(pw)) return t('passwordNeedsNumber');
    return null;
  };

  const handleResetPassword = async () => {
    const pwError = validatePassword(password);
    if (pwError) {
      Alert.alert(t('errorTitle'), pwError);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('errorTitle'), t('passwordMismatch'));
      return;
    }
    if (!sessionToken) return;

    setLoading(true);
    const { error } = await authService.resetPasswordWithCode(email, code, sessionToken, password);
    setLoading(false);

    if (error) {
      Alert.alert(t('errorTitle'), error.message);
      return;
    }

    Alert.alert(t('success'), t('resetPasswordComplete'), [
      { text: t('ok'), onPress: () => router.replace('/') },
    ]);
  };

  // ── Step 1: 이메일 입력 ──────────────────────────────────────
  if (step === 'email') {
    return (
      <View style={[styles.container, { backgroundColor: currentColors.background }]}>
        <View style={styles.absBackBtn}><StyledBackButton /></View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: currentColors.text }]}>{t('forgotPasswordTitle')}</Text>
          <Text style={[styles.subtitle, { color: currentColors.textSecondary }]}>{t('forgotPasswordSubtitle')}</Text>

          <Text style={[styles.label, { color: currentColors.text }]}>{t('emailAddress')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: currentColors.card, color: currentColors.text, borderColor: currentColors.border }]}
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            placeholderTextColor={currentColors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <DanceButton title={t('sendCode')} onPress={handleSendCode} loading={loading} style={styles.btn} />
        </View>
      </View>
    );
  }

  // ── Step 2: 인증번호 입력 ────────────────────────────────────
  if (step === 'code') {
    return (
      <View style={[styles.container, { backgroundColor: currentColors.background }]}>
        <View style={styles.absBackBtn}>
          <TouchableOpacity onPress={() => setStep('email')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={currentColors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: currentColors.text }]}>{t('verificationCode')}</Text>
          <Text style={[styles.subtitle, { color: currentColors.textSecondary }]}>
            {email}{'\n'}{t('sixDigitCodeHint')}
          </Text>

          <Text style={[styles.label, { color: currentColors.text }]}>{t('verificationCode')}</Text>
          <View style={styles.codeInputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: currentColors.card, color: currentColors.text, borderColor: currentColors.border, flex: 1, marginBottom: 0 }]}
              value={code}
              onChangeText={txt => setCode(txt.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={currentColors.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              editable={timer > 0}
              autoFocus
            />
            <Text style={[styles.timerBadge, { color: timer < 30 ? '#FF4B4B' : currentColors.primary }]}>
              {timer > 0 ? formatTime(timer) : t('expired')}
            </Text>
          </View>

          <View style={styles.codeButtons}>
            <DanceButton title={t('ok')} onPress={handleVerifyCode} loading={loading} style={styles.btn} />
            <TouchableOpacity style={styles.resendRow} onPress={handleSendCode} disabled={loading}>
              <Text style={[styles.resendText, { color: currentColors.textSecondary }]}>{t('resendCode')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Step 3: 비밀번호 설정 ────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: currentColors.background }]}
    >
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => setStep('code')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={currentColors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.stepIconWrap}>
          <Ionicons name="lock-open-outline" size={40} color={currentColors.primary} />
        </View>
        <Text style={[styles.title, { color: currentColors.text }]}>{t('resetPasswordTitle')}</Text>
        <Text style={[styles.subtitle, { color: currentColors.textSecondary }]}>{t('resetPasswordSubtitle')}</Text>

        <Text style={[styles.label, { color: currentColors.text }]}>{t('newPassword')}</Text>
        <View style={[styles.inputWrapper, { backgroundColor: currentColors.card, borderColor: currentColors.border }]}>
          <TextInput
            style={[styles.inputInner, { color: currentColors.text }]}
            value={password}
            onChangeText={setPassword}
            placeholder={t('passwordHint')}
            placeholderTextColor={currentColors.textSecondary}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoFocus
          />
          <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeButton}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={currentColors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: currentColors.text }]}>{t('confirmPassword')}</Text>
        <View style={[styles.inputWrapper, {
          backgroundColor: currentColors.card,
          borderColor: confirmPassword.length > 0 && password !== confirmPassword ? '#FF4B4B' : currentColors.border,
        }]}>
          <TextInput
            style={[styles.inputInner, { color: currentColors.text }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('confirmPasswordPlaceholder')}
            placeholderTextColor={currentColors.textSecondary}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} style={styles.eyeButton}>
            <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={currentColors.textSecondary} />
          </TouchableOpacity>
        </View>

        <DanceButton title={t('changePasswordBtn')} onPress={handleResetPassword} loading={loading} style={styles.btn} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navHeader: { paddingTop: 60, paddingHorizontal: 20 },
  backBtn: { padding: 4, alignSelf: 'flex-start' },
  content: { padding: 30, flex: 1, justifyContent: 'center' },
  scrollContent: { padding: 30, paddingTop: 20, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: '900', marginBottom: 10 },
  subtitle: { fontSize: 14, marginBottom: 32, lineHeight: 22, opacity: 0.7 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    borderRadius: 24,
    padding: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    marginBottom: 25,
    borderWidth: 1,
    ...Shadows.soft,
  },
  btn: { borderRadius: 30, height: 60 },
  stepIconWrap: { alignItems: 'center', marginBottom: 20 },
  codeButtons: {
    marginTop: 24,
  },
  codeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 0,
  },
  timerBadge: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  absBackBtn: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  resendRow: { alignItems: 'center', marginTop: 16 },
  resendText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    height: 56,
    ...Shadows.soft,
  },
  inputInner: { flex: 1, fontSize: 16, paddingVertical: 0 },
  eyeButton: { padding: 4 },
});
