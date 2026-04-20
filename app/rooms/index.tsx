import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AdBanner from '../../components/ui/AdBanner';

export default function RoomsScreen() {
  const { rooms, currentUser, logout, updateUserProfile, theme, themeType, setThemeType, customColor, setCustomColor, customBackgroundColor, setCustomBackgroundColor } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newName, setNewName] = useState(currentUser?.name || '');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const originalTheme = useRef({
    type: themeType,
    primary: customColor,
    bg: customBackgroundColor
  });

  const handleOpenSettings = () => {
    setNewName(currentUser?.name || '');
    setNewImage(null);
    originalTheme.current = {
      type: themeType,
      primary: customColor,
      bg: customBackgroundColor
    };
    setShowProfileModal(true);
  };

  const handleCancel = async () => {
    await setCustomColor(originalTheme.current.primary);
    await setCustomBackgroundColor(originalTheme.current.bg);
    await setThemeType(originalTheme.current.type);
    setShowProfileModal(false);
  };

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
      Alert.alert('성공', '프로필과 테마가 저장되었습니다.');
    } catch (e: any) {
      Alert.alert('실패', e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const primaryPresetColors = ['#AEC6CF', '#FFB7B2', '#B2E2F2', '#B19CD9', '#FFDAC1', '#E2F0CB', '#FF9AA2', '#C5E1A5', '#F48FB1', '#90CAF9', '#CE93D8', '#B39DDB'];
  const bgPresetColors = ['#FFFFFF', '#F8FAFC', '#FFF5F5', '#F0F9FF', '#F5F3FF', '#F0FDF4', '#FEFCE8', '#F0FDFA', '#FDF2F8', '#FAF5FF', '#F9FAFB', '#0F172A'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <View style={styles.profileSection}>
          {currentUser?.profileImage ? (
            <Image source={{ uri: currentUser.profileImage }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: theme.primary }]}>
              <Text style={[styles.avatarText, { color: theme.background }]}>{currentUser?.name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.headerTextInfo}>
            <Text style={[styles.welcomeText, { color: theme.textSecondary }]}>반가워요!</Text>
            <Text style={[styles.userName, { color: theme.text }]}>{currentUser?.name} 님</Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.actionIconButton, { backgroundColor: theme.border + '33' }]} onPress={handleOpenSettings}>
            <Ionicons name="settings-outline" size={20} color={theme.text} />
            <Text style={[styles.actionIconText, { color: theme.text }]}>설정</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionIconButton, { backgroundColor: theme.error + '22', marginLeft: 8 }]} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={theme.error} />
            <Text style={[styles.actionIconText, { color: theme.error }]}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>내 크루룸</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity style={[styles.actionBtn, { marginRight: 10, backgroundColor: theme.primary }]} onPress={() => router.push('/rooms/join')}>
            <Ionicons name="enter-outline" size={24} color={theme.background} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => router.push('/rooms/create')}>
            <Ionicons name="add" size={24} color={theme.background} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.roomCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(`/room/${item.id}`)}>
            {item.imageUri && item.imageUri.trim() !== '' ? (
              <Image source={{ uri: item.imageUri }} style={styles.roomImage} />
            ) : (
              <View style={[styles.roomImage, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.background, fontSize: 24, fontWeight: 'bold' }}>{item.name[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.roomInfo}>
              <Text style={[styles.roomName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.roomMeta, { color: theme.textSecondary }]}>ID: {item.id.split('-')[0]}...</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color={theme.border} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>참여 중인 방이 없습니다.</Text>
          </View>
        }
      />

      <Modal visible={showProfileModal} animationType="slide" transparent onRequestClose={handleCancel}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center', paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderBalance}>
                <Text style={[styles.modalTitleBalance, { color: theme.text }]}>프로필 및 테마 설정</Text>
                <TouchableOpacity onPress={handleCancel}><Ionicons name="close-circle" size={28} color={theme.textSecondary} /></TouchableOpacity>
              </View>
              <View style={styles.profileSectionBalance}>
                <TouchableOpacity style={styles.avatarPickerBalance} onPress={handlePickImage}>
                  {newImage || currentUser?.profileImage ? ( <Image source={{ uri: newImage || currentUser?.profileImage }} style={styles.avatarBalance} /> ) : ( <View style={[styles.avatarBalance, { backgroundColor: theme.primary }]}> <Ionicons name="camera" size={24} color={theme.background} /> </View> )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>사용자 이름</Text>
                  <TextInput style={[styles.inputBalance, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={newName} onChangeText={setNewName} placeholder="이름" placeholderTextColor={theme.textSecondary} />
                </View>
              </View>
              <Text style={[styles.sectionTitleBalance, { color: theme.text }]}>포인트 색상</Text>
              <View style={styles.colorPaletteBalance}>{primaryPresetColors.map((color) => ( <TouchableOpacity key={color} style={[styles.colorOptionBalance, { backgroundColor: color, borderColor: customColor === color ? theme.text : 'transparent' }]} onPress={() => setCustomColor(color)} /> ))}</View>
              <Text style={[styles.sectionTitleBalance, { color: theme.text, marginTop: 10 }]}>배경 색상</Text>
              <View style={styles.colorPaletteBalance}>{bgPresetColors.map((color) => ( <TouchableOpacity key={color} style={[styles.colorOptionBalance, { backgroundColor: color, borderColor: customBackgroundColor === color ? theme.primary : 'transparent' }]} onPress={() => { setCustomBackgroundColor(color); const isDark = color.toLowerCase().includes('0f17') || color.toLowerCase().includes('1e29') || color.toLowerCase().includes('1c1c') || color.toLowerCase().includes('1212'); setThemeType(isDark ? 'dark' : 'light'); }} /> ))}</View>
              <View style={styles.modalBtnsBalance}>
                <TouchableOpacity style={styles.cancelBtnBalance} onPress={handleCancel}><Text style={{ color: theme.textSecondary, fontWeight: 'bold' }}>취소</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtnBalance, { backgroundColor: theme.primary }]} onPress={handleUpdateProfile} disabled={isUpdating}>
                  {isUpdating ? <ActivityIndicator color={theme.background} /> : <Text style={{ fontWeight: 'bold', color: theme.background }}>변경사항 저장</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <View style={{ paddingBottom: Math.max(insets.bottom, 15) }}>
        <AdBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  profileSection: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: { width: 45, height: 45, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: 'bold', fontSize: 18 },
  headerTextInfo: { marginLeft: 12 },
  welcomeText: { fontSize: 12 },
  userName: { fontSize: 16, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionIconButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
  actionIconText: { fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold' },
  actionBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roomCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1 },
  roomImage: { width: 50, height: 50, borderRadius: 15 },
  roomInfo: { flex: 1, marginLeft: 15 },
  roomName: { fontSize: 16, fontWeight: 'bold' },
  roomMeta: { fontSize: 12, marginTop: 2 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 15, textAlign: 'center', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 24, borderRadius: 32, alignItems: 'center', maxHeight: '92%' },
  modalHeaderBalance: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 24 },
  modalTitleBalance: { fontSize: 20, fontWeight: 'bold' },
  profileSectionBalance: { flexDirection: 'row', width: '100%', alignItems: 'center', gap: 20, marginBottom: 24 },
  avatarPickerBalance: { },
  avatarBalance: { width: 72, height: 72, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  inputLabel: { fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 },
  inputBalance: { width: '100%', padding: 14, borderRadius: 14, fontSize: 16 },
  sectionTitleBalance: { fontSize: 15, fontWeight: 'bold', alignSelf: 'flex-start', marginBottom: 12 },
  colorPaletteBalance: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginBottom: 20 },
  colorOptionBalance: { width: 34, height: 34, borderRadius: 17, margin: 5, borderWidth: 2.5 },
  modalBtnsBalance: { flexDirection: 'row', width: '100%', gap: 12, marginTop: 10 },
  cancelBtnBalance: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)' },
  submitBtnBalance: { flex: 2, padding: 16, borderRadius: 14, alignItems: 'center' }
});
