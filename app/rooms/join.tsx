import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '../../context/AppContext';
import { Colors, Shadows } from '../../constants/theme';
import { DanceButton, StyledBackButton } from '../../components/ui/Interactions';
import { Ionicons } from '@expo/vector-icons';

export default function JoinRoomScreen() {
  const [roomId, setRoomId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const { joinRoom, t } = useAppContext();
  const router = useRouter();

  const handleJoin = async () => {
    if (!roomId.trim() || !passcode.trim()) {
      Alert.alert(t('error'), t('roomIdRequired'));
      return;
    }

    setLoading(true);
    try {
      const room = await joinRoom(roomId.trim(), passcode.trim());
      if (room) {
        Alert.alert(t('successTitle'), t('joinSuccess').replace('{roomName}', room.name), [
          { text: t('ok'), onPress: () => router.replace(`/room/${room.id}` as any) },
        ]);
      } else {
        Alert.alert(t('failure'), t('joinFailed'));
      }
    } catch (error: any) {
      Alert.alert(t('error'), error.message || t('joinError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StyledBackButton />
        <Text style={styles.headerTitle}>{t('joinRoomTitle')}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          {t('joinRoomDesc')}
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('roomIdLabel')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="finger-print" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={roomId}
              onChangeText={setRoomId}
              placeholder={t('roomIdPlaceholder')}
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('passcodeLabelWithLength')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="key-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={passcode}
              onChangeText={setPasscode}
              placeholder={t('passcodePlaceholder4Digit')}
              placeholderTextColor={Colors.textSecondary}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        </View>

        <DanceButton 
          title={loading ? t('checkingInfo') : t('joinRoomBtn')} 
          onPress={handleJoin}
          disabled={loading}
          style={styles.button}
        >
          {loading && <ActivityIndicator color="#000" style={{ marginRight: 10 }} />}
        </DanceButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, marginBottom: 30 },
  headerTitle: { color: Colors.text, fontSize: 24, fontWeight: '900', marginLeft: 15, letterSpacing: 1 },
  content: { paddingHorizontal: 30 },
  description: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: 35 },
  inputGroup: { marginBottom: 25 },
  label: { fontSize: 14, color: Colors.text, marginBottom: 10, fontWeight: '700' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    paddingHorizontal: 20,
    ...Shadows.soft,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 60, color: Colors.text, fontSize: 16, fontWeight: '500' },
  button: { width: '100%', marginTop: 20, borderRadius: 30, height: 60 },
});
