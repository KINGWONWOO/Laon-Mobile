import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../context/AppContext';
import { Colors } from '../../constants/theme';
import * as ImagePicker from 'expo-image-picker';

export default function RoomsScreen() {
  const { rooms, currentUser, logout, updateUserProfile, theme } = useAppContext();
  const router = useRouter();
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newName, setNewName] = useState(currentUser?.name || '');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setNewImage(result.assets[0].uri);
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim()) return Alert.alert('오류', '이름을 입력해주세요.');
    setIsUpdating(true);
    try {
      await updateUserProfile(newName, newImage || currentUser?.profileImage);
      setShowProfileModal(false);
      Alert.alert('성공', '프로필이 업데이트되었습니다.');
    } catch (e: any) {
      Alert.alert('실패', e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* 💡 상단 헤더: 프로필 설정 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.profileBtn} onPress={() => {
          setNewName(currentUser?.name || '');
          setShowProfileModal(true);
        }}>
          {currentUser?.profileImage ? (
            <Image source={{ uri: currentUser.profileImage }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: Colors.primary }]}>
              <Text style={styles.avatarText}>{currentUser?.name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.headerTextInfo}>
            <Text style={styles.welcomeText}>반가워요!</Text>
            <Text style={styles.userName}>{currentUser?.name} 님</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={logout}>
          <Ionicons name="log-out-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>내 크루룸</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/rooms/create')}>
          <Ionicons name="add" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.roomCard} 
            onPress={() => router.push(`/room/${item.id}`)}
          >
            {item.image_uri ? (
              <Image source={{ uri: item.image_uri }} style={styles.roomImage} />
            ) : (
              <View style={[styles.roomImage, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: Colors.primary, fontSize: 24, fontWeight: 'bold' }}>{item.name[0]}</Text>
              </View>
            )}
            <View style={styles.roomInfo}>
              <Text style={styles.roomName}>{item.name}</Text>
              <Text style={styles.roomMeta}>ID: {item.id.split('-')[0]}...</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/rooms/join')}>
            <Ionicons name="enter-outline" size={40} color={Colors.primary} />
            <Text style={styles.emptyText}>참여 중인 방이 없습니다. 코드로 입장하기</Text>
          </TouchableOpacity>
        }
      />

      {/* 💡 프로필 설정 모달 */}
      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <Text style={styles.modalTitle}>프로필 설정</Text>
            
            <TouchableOpacity style={styles.avatarPicker} onPress={handlePickImage}>
              {newImage || currentUser?.profileImage ? (
                <Image source={{ uri: newImage || currentUser?.profileImage }} style={styles.largeAvatar} />
              ) : (
                <View style={[styles.largeAvatar, { backgroundColor: Colors.primary }]}>
                  <Ionicons name="camera" size={30} color="#000" />
                </View>
              )}
              <View style={styles.cameraBadge}><Ionicons name="pencil" size={14} color="#fff" /></View>
            </TouchableOpacity>

            <TextInput 
              style={styles.input} 
              value={newName} 
              onChangeText={setNewName} 
              placeholder="이름을 입력하세요" 
              placeholderTextColor="#666" 
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowProfileModal(false)}>
                <Text style={{ color: '#999' }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateProfile} disabled={isUpdating}>
                {isUpdating ? <ActivityIndicator color="#000" /> : <Text style={{ fontWeight: 'bold' }}>저장하기</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  profileBtn: { flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 45, height: 45, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: 'bold', fontSize: 18 },
  headerTextInfo: { marginLeft: 12 },
  welcomeText: { color: '#666', fontSize: 12 },
  userName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  createBtn: { backgroundColor: Colors.primary, width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roomCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161622', padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  roomImage: { width: 50, height: 50, borderRadius: 15 },
  roomInfo: { flex: 1, marginLeft: 15 },
  roomName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  roomMeta: { color: '#666', fontSize: 12, marginTop: 2 },
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#161622', borderRadius: 24, borderStyle: 'dashed', borderWidth: 2, borderColor: '#333', marginTop: 20 },
  emptyText: { color: '#666', marginTop: 15, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1A1A2E', padding: 30, borderRadius: 30, alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 25 },
  avatarPicker: { marginBottom: 25 },
  largeAvatar: { width: 100, height: 100, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#333', padding: 6, borderRadius: 12, borderWidth: 2, borderColor: '#1A1A2E' },
  input: { width: '100%', backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 25, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', width: '100%' },
  cancelBtn: { flex: 1, alignItems: 'center', padding: 15 },
  submitBtn: { flex: 2, backgroundColor: Colors.primary, padding: 15, borderRadius: 12, alignItems: 'center' }
});
