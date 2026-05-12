import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors, Shadows } from '../constants/theme';
import { StyledBackButton, DanceButton } from '../components/ui/Interactions';
import { authService } from '../services/authService';
import { useAppContext } from '../context/AppContext';

export default function ForgotPasswordScreen() {
  const { theme, t } = useAppContext();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert(t('errorTitle'), t('enterEmailMsg'));
      return;
    }
    setLoading(true);
    const { error } = await authService.resetPassword(email);
    setLoading(false);

    if (error) {
      Alert.alert(t('errorTitle'), error.message);
    } else {
      Alert.alert(t('resetEmailSentTitle'), t('resetEmailSentMsg'));
    }
  };

  const currentColors = theme || Colors;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: currentColors.background }]}
    >
      <View style={styles.navHeader}><StyledBackButton /></View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: currentColors.text }]}>{t('forgotPasswordTitle')}</Text>
        <Text style={[styles.subtitle, { color: currentColors.textSecondary }]}>{t('forgotPasswordSubtitle')}</Text>

        <View style={styles.form}>
          <Text style={[styles.label, { color: currentColors.text }]}>{t('emailAddress')}</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: currentColors.card, 
              color: currentColors.text,
              borderColor: currentColors.border 
            }]}
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            placeholderTextColor={currentColors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <DanceButton 
            title={t('sendResetEmail')} 
            onPress={handleReset}
            loading={loading}
            style={styles.resetBtn}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navHeader: { paddingTop: 60, paddingHorizontal: 20 },
  content: { padding: 30, justifyContent: 'center', flex: 0.8 },
  title: { fontSize: 32, fontWeight: '900', color: Colors.text, marginBottom: 10 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 40, lineHeight: 24 },
  form: { width: '100%' },
  label: { fontSize: 14, color: Colors.text, marginBottom: 8, fontWeight: '600' },
  input: { 
    backgroundColor: Colors.card, 
    borderRadius: 24, 
    padding: 16, 
    paddingHorizontal: 20,
    color: Colors.text, 
    fontSize: 16, 
    marginBottom: 25, 
    borderWidth: 1, 
    borderColor: Colors.border,
    ...Shadows.soft,
  },
  resetBtn: { borderRadius: 30, height: 60 },
});
