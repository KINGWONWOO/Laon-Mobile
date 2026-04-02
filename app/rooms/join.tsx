import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '../../context/AppContext';
import { Colors } from '../../constants/theme';
import { DanceButton, StyledBackButton } from '../../components/ui/Interactions';
import { Ionicons } from '@expo/vector-icons';

export default function JoinRoomScreen() {
  const [roomId, setRoomId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const { joinRoom } = useAppContext();
  const router = useRouter();

  const handleJoin = async () => {
    if (!roomId.trim() || !passcode.trim()) {
      Alert.alert('오류', '방 ID와 비밀번호를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const room = await joinRoom(roomId.trim(), passcode.trim());
      if (room) {
        Alert.alert('참여 성공', `'${room.name}' 크루룸에 참여되었습니다.`);
        router.replace('/rooms');
        setTimeout(() => {
          router.push(`/room/${room.id}` as any);
        }, 100);
      } else {
        Alert.alert('참여 실패', '방 ID 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (error: any) {
      Alert.alert('오류', error.message || '참여 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StyledBackButton />
        <Text style={styles.headerTitle}>JOIN CREW</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          공유받은 크루룸의 고유 ID와 비밀번호를 입력하여 입장하세요.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>크루룸 고유 ID</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="finger-print" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={roomId}
              onChangeText={setRoomId}
              placeholder="방 ID를 입력하세요"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>입장 비밀번호 (4자리)</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="key-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={passcode}
              onChangeText={setPasscode}
              placeholder="비밀번호 4자리"
              placeholderTextColor={Colors.textSecondary}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        </View>

        <DanceButton 
          title={loading ? "확인 중..." : "크루룸 입장하기"} 
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
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, marginBottom: 30 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginLeft: 15, letterSpacing: 1 },
  content: { paddingHorizontal: 30 },
  description: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 30 },
  inputGroup: { marginBottom: 25 },
  label: { fontSize: 14, color: '#fff', marginBottom: 10, fontWeight: 'bold' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161622',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 15,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 55, color: '#fff', fontSize: 16 },
  button: { width: '100%', marginTop: 20 },
});
