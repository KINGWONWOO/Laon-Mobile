import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';
import { StyledBackButton, DanceButton } from '../components/ui/Interactions';
import { authService } from '../services/authService';
import { Ionicons } from '@expo/vector-icons';

function PwRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={ok ? '#34C759' : Colors.textSecondary}
      />
      <Text style={{ marginLeft: 6, fontSize: 12, color: ok ? '#34C759' : Colors.textSecondary }}>
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      Alert.alert('알림', '유효한 이메일 주소를 입력해주세요.');
      return;
    }
    
    setCodeStep('sending');
    const { sessionToken: token, error } = await authService.sendVerificationCode(email);
    
    if (error) {
      setCodeStep('idle');
      Alert.alert('오류', error.message);
      return;
    }

    setSessionToken(token);
    setInputCode('');
    setCodeStep('sent');
    setTimer(60); // 60초 타이머 시작
    Alert.alert('전송 완료', '이메일로 6자리 인증 코드를 발송했습니다.\n유효 시간은 60초입니다.');
  };

  const handleVerifyCode = async () => {
    if (timer === 0) {
      Alert.alert('만료됨', '인증 시간이 만료되었습니다. 코드를 재전송해주세요.');
      return;
    }
    if (inputCode.length !== 6) {
      Alert.alert('알림', '6자리 코드를 입력해주세요.');
      return;
    }
    if (!sessionToken) return;

    setCodeStep('verifying');
    const { valid, error } = await authService.checkEmailCode(email, inputCode, sessionToken);
    
    if (error || !valid) {
      setCodeStep('sent');
      Alert.alert('오류', '인증 코드가 올바르지 않거나 이미 만료되었습니다.\n최신 코드를 입력해주세요.');
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

  const handleSignUp = async () => {
    if (!email || !password || !name || !phone) {
      Alert.alert('오류', '모든 정보를 입력해주세요.');
      return;
    }
    if (!isCodeVerified) {
      Alert.alert('오류', '이메일 인증을 완료해주세요.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!pwValid) {
      Alert.alert('오류', '비밀번호 조건을 모두 충족해야 합니다.');
      return;
    }

    setLoading(true);
    const { error } = await authService.verifyAndSignup(
      email, inputCode, sessionToken!, password, name, phone,
    );
    setLoading(false);

    if (error) {
      Alert.alert('회원가입 실패', error.message);
    } else {
      Alert.alert('가입 완료', 'LAON DANCE에 오신 것을 환영합니다! 🎉', [
        { text: '로그인하기', onPress: () => router.replace('/') },
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
        <Text style={styles.subtitle}>새로운 댄서로 등록하세요</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>이메일 주소</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
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
                <Text style={styles.codeBtnText}>재전송</Text>
              ) : (
                <Text style={styles.codeBtnText}>코드 전송</Text>
              )}
            </TouchableOpacity>
          </View>

          {isCodeSent && !isCodeVerified && (
            <View style={styles.codeInputSection}>
              <View style={styles.codeLabelRow}>
                <Text style={styles.codeHint}>6자리 코드 입력</Text>
                <Text style={[styles.timerText, timer < 10 && { color: '#FF4B4B' }]}>
                  {timer > 0 ? formatTime(timer) : '만료됨'}
                </Text>
              </View>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, letterSpacing: 6, textAlign: 'center' }]}
                  value={inputCode}
                  onChangeText={(t) => setInputCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="000000"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={timer > 0}
                />
                <TouchableOpacity
                  style={[styles.codeBtn, { backgroundColor: Colors.accent }, timer === 0 && styles.codeBtnDisabled]}
                  onPress={handleVerifyCode}
                  disabled={codeStep === 'verifying' || timer === 0}
                >
                  {codeStep === 'verifying' ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.codeBtnText}>확인</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 20 }]}>이름</Text>
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
            placeholder="8자 이상, 대/소문자 + 숫자 포함"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />

          <Text style={styles.label}>비밀번호 확인</Text>
          <TextInput
            style={[styles.input, confirmPassword.length > 0 && password !== confirmPassword && styles.inputError]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
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
  scrollContent: { padding: 30, paddingBottom: 60 },
  title: { fontSize: 32, fontWeight: '900', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 35 },
  inputContainer: { marginBottom: 30 },
  label: { fontSize: 14, color: Colors.text, marginBottom: 8, fontWeight: '600' },
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
  inputError: { borderColor: '#FF4B4B' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 0, gap: 10 },
  codeBtn: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  codeBtnVerified: { backgroundColor: '#34C759' },
  codeBtnDisabled: { opacity: 0.5 },
  codeBtnText: { color: '#000', fontWeight: 'bold', fontSize: 13 },
  codeInputSection: {
    marginTop: 12,
    backgroundColor: 'rgba(33,243,163,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(33,243,163,0.2)',
    padding: 14,
  },
  codeLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  codeHint: { color: Colors.textSecondary, fontSize: 12 },
  timerText: { color: Colors.primary, fontSize: 13, fontWeight: 'bold' },
  registerBtn: { width: '100%', height: 60 },
});
