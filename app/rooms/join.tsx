import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '../../context/AppContext';
import { Colors } from '../../constants/theme';
import { DanceButton, StyledBackButton } from '../../components/ui/Interactions';

export default function JoinRoomScreen() {
  const [roomId, setRoomId] = useState('');
  const [passcode, setPasscode] = useState('');
  const { joinRoom } = useAppContext();
  const router = useRouter();

  const handleJoin = async () => {
    if (!roomId.trim() || !passcode.trim()) {
      Alert.alert('오류', '방 ID와 비밀번호를 모두 입력해주세요.');
      return;
    }
    try {
      const room = await joinRoom(roomId.trim(), passcode);
      if (room) {
        router.replace(`/room/${room.id}` as any);
      } else {
        Alert.alert('오류', '방을 찾을 수 없거나 비밀번호가 틀렸습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '방 참여 중 문제가 발생했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StyledBackButton />
        <Text style={styles.headerTitle}>JOIN CREW</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>크루룸 ID</Text>
        <TextInput
          style={styles.input}
          value={roomId}
          onChangeText={setRoomId}
          placeholder="공유받은 ID를 입력하세요"
          placeholderTextColor={Colors.textSecondary}
        />

        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          style={styles.input}
          value={passcode}
          onChangeText={setPasscode}
          placeholder="Passcode"
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry
        />

        <DanceButton 
          title="팀에 합류하기" 
          onPress={handleJoin}
          variant="accent"
          style={styles.button}
          textStyle={{ color: Colors.background }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    marginBottom: 40,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginLeft: 15,
    letterSpacing: 1,
  },
  content: {
    paddingHorizontal: 30,
  },
  label: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 25,
  },
  button: {
    width: '100%',
    marginTop: 20,
  },
});
