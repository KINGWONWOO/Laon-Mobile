import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Dimensions, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../context/AppContext';
import { Colors, Shadows } from '../../constants/theme';
import { DanceButton, StyledBackButton } from '../../components/ui/Interactions';

const { width } = Dimensions.get('window');

export default function CreateRoomScreen() {
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const { createRoom } = useAppContext();
  const router = useRouter();

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !passcode.trim()) {
      Alert.alert('오류', '방 이름과 비밀번호를 모두 입력해주세요.');
      return;
    }
    
    // 💡 이미지 업로드 중임을 알리기 위해 로딩 상태 추가 가능 (현재는 createRoom 내부에서 처리)
    try {
      // 1. 방 생성 로직 실행
      const room = await createRoom(name, passcode, imageUri || undefined);
      
      // 2. 생성 성공 시 해당 방으로 즉시 이동 (목록을 거치지 않음)
      console.log('[CreateRoom] Success, navigating to room:', room.id);
      router.replace(`/room/${room.id}` as any);
      
    } catch (error: any) {
      console.error('[CreateRoom] Error:', error.message);
      Alert.alert('오류', `방 생성 중 문제가 발생했습니다.\n${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StyledBackButton />
        <Text style={styles.headerTitle}>NEW CREW</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>크루 이미지</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.selectedImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera" size={40} color={Colors.textSecondary} />
              <Text style={styles.imagePlaceholderText}>팀 로고 선택</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>우리 팀 이름</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="예: LAON B-Boy Crew"
          placeholderTextColor={Colors.textSecondary}
        />

        <Text style={styles.label}>입장 비밀번호</Text>
        <TextInput
          style={styles.input}
          value={passcode}
          onChangeText={setPasscode}
          placeholder="팀원들과 공유할 코드"
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={4}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            팀원들이 이 비밀번호를 통해 안전하게 참여할 수 있습니다.
          </Text>
        </View>

        <DanceButton 
          title="크루룸 생성하기" 
          onPress={handleCreate}
          style={styles.button}
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
    fontSize: 24,
    fontWeight: '900',
    marginLeft: 15,
    letterSpacing: 1,
  },
  content: {
    paddingHorizontal: 30,
  },
  imagePicker: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 35,
    overflow: 'hidden',
    ...Shadows.soft,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 5,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 10,
    fontWeight: '700',
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 25,
    ...Shadows.soft,
  },
  infoBox: {
    backgroundColor: Colors.card,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 40,
    ...Shadows.soft,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  button: {
    width: '100%',
    borderRadius: 30,
    height: 60,
  },
});
