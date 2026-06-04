import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Shadows } from '../constants/theme';
import { StyledBackButton, DanceButton } from '../components/ui/Interactions';
import { useAppContext } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

function PwRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={ok ? Colors.success : Colors.textSecondary}
      />
      <Text style={{ marginLeft: 6, fontSize: 12, color: ok ? Colors.success : Colors.textSecondary }}>
        {label}
      </Text>
    </View>
  );
}

type CodeStep = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // 이메일 인증 코드 관련
  const [codeStep, setCodeStep] = useState<CodeStep>('idle');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { sendVerificationCode, checkEmailCode, verifyAndSignup, t } = useAppContext();
  const router = useRouter();

  const isCodeVerified = codeStep === 'verified';
  const isCodeSent = codeStep === 'sent' || codeStep === 'verifying' || codeStep === 'verified';

  // 타이머 로직
  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timer]);

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert(t('notification'), t('validEmailRequired'));
      return;
    }
    
    setCodeStep('sending');
    const { sessionToken: token, error } = await sendVerificationCode(email);
    
    if (error) {
      setCodeStep('idle');
      Alert.alert(t('errorTitle'), error.message);
      return;
    }

    setSessionToken(token);
    setInputCode('');
    setCodeStep('sent');
    setTimer(180);
    Alert.alert(t('codeSentTitle'), t('codeSentMsg'));
  };

  const handleVerifyCode = async () => {
    if (timer === 0) {
      Alert.alert(t('codeExpiredTitle'), t('codeExpiredMsg'));
      return;
    }
    if (inputCode.length !== 6) {
      Alert.alert(t('notification'), t('enterSixDigitCode'));
      return;
    }
    if (!sessionToken) return;

    setCodeStep('verifying');
    const { valid, error } = await checkEmailCode(email, inputCode, sessionToken);
    
    if (error || !valid) {
      setCodeStep('sent');
      Alert.alert(t('errorTitle'), t('invalidCodeMsg'));
      return;
    }

    setCodeStep('verified');
    setTimer(0); // 인증 성공 시 타이머 정지
  };

  const handleResendCode = () => {
    handleSendCode();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const pwValid =
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password);

  const isValidPhone = (p: string) => /^\d{11}$/.test(p.replace(/\s/g, ''));

  const handleSignUp = async () => {
    if (!email || !password || !name || !phone) {
      Alert.alert(t('errorTitle'), t('fillAllFields'));
      return;
    }
    if (!isCodeVerified) {
      Alert.alert(t('errorTitle'), t('verifyEmailFirst'));
      return;
    }
    if (!isValidPhone(phone)) {
      Alert.alert(t('errorTitle'), t('invalidPhone'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('errorTitle'), t('passwordMismatch'));
      return;
    }
    if (!pwValid) {
      Alert.alert(t('errorTitle'), t('passwordConditions'));
      return;
    }

    setLoading(true);
    const { error } = await verifyAndSignup(
      email, inputCode, sessionToken!, password, name, phone,
    );
    setLoading(false);

    if (error) {
      Alert.alert(t('registerFailed'), error.message);
    } else {
      Alert.alert(t('registerComplete'), t('signupCompleteMsg'), [
        { text: t('login'), onPress: () => router.replace('/') },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.navHeader}><StyledBackButton /></View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>JOIN US</Text>
        <Text style={styles.subtitle}>{t('registerSubtitle')}</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('emailAddress')}</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (codeStep !== 'idle') {
                  setCodeStep('idle');
                  setSessionToken(null);
                  setInputCode('');
                  setTimer(0);
                }
              }}
              placeholder="dancer@example.com"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isCodeVerified}
            />
            <TouchableOpacity
              style={[
                styles.codeBtn,
                isCodeVerified && styles.codeBtnVerified,
                (codeStep === 'sending' || (isCodeSent && timer > 0 && !isCodeVerified)) && styles.codeBtnDisabled,
              ]}
              onPress={handleSendCode}
              disabled={codeStep === 'sending' || isCodeVerified}
            >
              {codeStep === 'sending' ? (
                <ActivityIndicator size="small" color="#000" />
              ) : isCodeVerified ? (
                <Ionicons name="checkmark-circle" size={18} color="#000" />
              ) : isCodeSent ? (
                <Text style={styles.codeBtnText}>{t('resendCode')}</Text>
              ) : (
                <Text style={styles.codeBtnText}>{t('sendCode')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {isCodeSent && !isCodeVerified && (
            <View style={styles.codeInputSection}>
              <View style={styles.codeLabelRow}>
                <Text style={styles.codeHint}>{t('sixDigitCodeHint')}</Text>
                <Text style={[styles.timerText, timer < 30 && { color: '#FF4B4B' }]}>
                  {timer > 0 ? formatTime(timer) : t('expired')}
                </Text>
              </View>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, letterSpacing: 6, textAlign: 'center' }]}
                  value={inputCode}
                  onChangeText={(text) => setInputCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="000000"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={timer > 0}
                />
                <TouchableOpacity
                  style={[styles.codeBtn, { backgroundColor: Colors.primary }, timer === 0 && styles.codeBtnDisabled]}
                  onPress={handleVerifyCode}
                  disabled={codeStep === 'verifying' || timer === 0}
                >
                  {codeStep === 'verifying' ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.codeBtnText}>{t('ok')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 20 }]}>{t('name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('nameExample')}
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={styles.label}>{t('phone')}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={t => setPhone(t.replace(/[^0-9]/g, '').slice(0, 11))}
            placeholder={t('phonePlaceholder')}
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            maxLength={11}
          />

          <Text style={styles.label}>{t('password')}</Text>
          <TextInput
            style={[styles.input, { marginBottom: 10 }]}
            value={password}
            onChangeText={setPassword}
            placeholder={t('passwordHint')}
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />
          {password.length > 0 && (
            <View style={styles.pwRules}>
              <PwRule ok={password.length >= 8} label={t('passwordTooShort')} />
              <PwRule ok={/[a-z]/.test(password)} label={t('passwordNeedsLower')} />
              <PwRule ok={/[A-Z]/.test(password)} label={t('passwordNeedsUpper')} />
              <PwRule ok={/[0-9]/.test(password)} label={t('passwordNeedsNumber')} />
            </View>
          )}

          <Text style={[styles.label, { marginTop: 10 }]}>{t('confirmPassword')}</Text>
          <TextInput
            style={[styles.input, confirmPassword.length > 0 && password !== confirmPassword && styles.inputError]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('confirmPasswordPlaceholder')}
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />
        </View>

        <DanceButton
          title={t('registerComplete')}
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
  scrollContent: { padding: 30, paddingBottom: 60 },
  title: { fontSize: 32, fontWeight: '900', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 35 },
  inputContainer: { marginBottom: 30 },
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
  inputError: { borderColor: Colors.error },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 0, gap: 10 },
  codeBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
    ...Shadows.soft,
  },
  codeBtnVerified: { backgroundColor: Colors.success },
  codeBtnDisabled: { opacity: 0.5 },
  codeBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  codeInputSection: {
    marginTop: 12,
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    ...Shadows.soft,
  },
  codeLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  codeHint: { color: Colors.textSecondary, fontSize: 12 },
  timerText: { color: Colors.primary, fontSize: 13, fontWeight: 'bold' },
  registerBtn: { width: '100%', height: 60, borderRadius: 30 },
  pwRules: { marginBottom: 16, paddingLeft: 4 },
});
