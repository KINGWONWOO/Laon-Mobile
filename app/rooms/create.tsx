import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Dimensions, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../context/AppContext';
import { Colors } from '../../constants/theme';
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
      // imageUri가 없으면 undefined로 전달하여 기본 로직 수행
      const room = await createRoom(name, passcode, imageUri || undefined);
      
      // 생성 후 목록으로 이동 (중복 스택 방지를 위해 replace 사용)
      router.replace('/rooms');
      setTimeout(() => {
        router.push(`/room/${room.id}` as any);
      }, 100);
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
    fontSize: 20,
    fontWeight: '900',
    marginLeft: 15,
    letterSpacing: 1,
  },
  content: {
    paddingHorizontal: 30,
  },
  imagePicker: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    overflow: 'hidden',
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
  infoBox: {
    backgroundColor: 'rgba(33, 243, 163, 0.05)',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(33, 243, 163, 0.2)',
    marginBottom: 40,
  },
  infoText: {
    color: Colors.accent,
    fontSize: 13,
    lineHeight: 20,
  },
  button: {
    width: '100%',
  },
});
