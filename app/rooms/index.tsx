import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../context/AppContext';
import { Colors } from '../../constants/theme';
import * as ImagePicker from 'expo-image-picker';

export default function RoomsScreen() {
  const { rooms, currentUser, logout, updateUserProfile, theme, themeType, setThemeType, customColor, setCustomColor, customBackgroundColor, setCustomBackgroundColor } = useAppContext();
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

  const themes = [
    { type: 'dark', label: '다크', icon: 'moon', color: '#1B1927' },
    { type: 'light', label: '라이트', icon: 'sunny', color: '#FFFFFF' },
    { type: 'pink', label: '연핑크', icon: 'heart', color: '#FFF5F8' },
    { type: 'custom', label: '사용자 설정', icon: 'color-palette', color: themeType === 'custom' ? customBackgroundColor : '#333' },
  ];

  const presetColors = [
    '#5E5CE6', '#32D74B', '#64D2FF', '#BF5AF2', 
    '#FF375F', '#AC8E68', '#FF6B6B', '#4ECDC4', 
    '#A06CD5', '#FF9F43', '#00D2FF', '#FDCB6E'
  ];

  const bgPresetColors = [
    '#1C1C1E', '#2C2C2E', '#3A3A3C', '#121212',
    '#FFFFFF', '#F2F2F7', '#E5E5EA', '#D1D1D6',
    '#FEF1F2', '#F0F9FF', '#F5F5F5', '#1A1A1A'
  ];
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 상단 헤더: 프로필 정보 및 액션 버튼 */}
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
          <TouchableOpacity 
            style={[styles.actionIconButton, { backgroundColor: theme.border + '33' }]} 
            onPress={() => {
              setNewName(currentUser?.name || '');
              setShowProfileModal(true);
            }}
          >
            <Ionicons name="settings-outline" size={20} color={theme.text} />
            <Text style={[styles.actionIconText, { color: theme.text }]}>설정</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionIconButton, { backgroundColor: theme.error + '22', marginLeft: 8 }]} 
            onPress={logout}
          >
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
          <TouchableOpacity 
            style={[styles.roomCard, { backgroundColor: theme.card, borderColor: theme.border }]} 
            onPress={() => router.push(`/room/${item.id}`)}
          >
            {item.image_uri ? (
              <Image source={{ uri: item.image_uri }} style={styles.roomImage} />
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
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>참여 중인 방이 없습니다.{"\n"}방을 만들거나 참여해 보세요!</Text>
          </View>
        }
      />

      {/* 프로필 설정 모달 */}
      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center' }}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>프로필 설정</Text>
              
              <TouchableOpacity style={styles.avatarPicker} onPress={handlePickImage}>
                {newImage || currentUser?.profileImage ? (
                  <Image source={{ uri: newImage || currentUser?.profileImage }} style={styles.largeAvatar} />
                ) : (
                  <View style={[styles.largeAvatar, { backgroundColor: theme.primary }]}>
                    <Ionicons name="camera" size={30} color={theme.background} />
                  </View>
                )}
              </TouchableOpacity>
              
              <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={newName} onChangeText={setNewName} placeholder="이름을 입력하세요" placeholderTextColor={theme.textSecondary} />

              <Text style={[styles.sectionTitle, { color: theme.text }]}>테마 선택</Text>
              <View style={styles.themeGrid}>
                {themes.map((t) => (
                  <TouchableOpacity 
                    key={t.type} 
                    style={[
                      styles.themeItem, 
                      { borderColor: themeType === t.type ? theme.primary : theme.border, backgroundColor: t.color }
                    ]}
                    onPress={() => setThemeType(t.type as any)}
                  >
                    <Ionicons name={t.icon as any} size={20} color={themeType === t.type ? (t.type === 'custom' ? theme.text : theme.primary) : theme.textSecondary} />
                    <Text style={[styles.themeLabel, { color: themeType === t.type ? (t.type === 'custom' ? theme.text : theme.primary) : theme.textSecondary }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {themeType === 'custom' && (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>메인 색상 설정</Text>
                  <View style={styles.colorPalette}>
                    {presetColors.map((color) => (
                      <TouchableOpacity 
                        key={color} 
                        style={[
                          styles.colorOption, 
                          { backgroundColor: color, borderColor: customColor === color ? theme.text : 'transparent' }
                        ]} 
                        onPress={() => setCustomColor(color)} 
                      />
                    ))}
                  </View>

                  <Text style={[styles.sectionTitle, { color: theme.text }]}>배경 색상 설정</Text>
                  <View style={styles.colorPalette}>
                    {bgPresetColors.map((color) => (
                      <TouchableOpacity 
                        key={color} 
                        style={[
                          styles.colorOption, 
                          { backgroundColor: color, borderColor: customBackgroundColor === color ? theme.text : 'transparent' }
                        ]} 
                        onPress={() => setCustomBackgroundColor(color)} 
                      />
                    ))}
                  </View>
                </>
              )}

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowProfileModal(false)}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.primary }]} onPress={handleUpdateProfile} disabled={isUpdating}>
                  {isUpdating ? <ActivityIndicator color={theme.background} /> : <Text style={{ fontWeight: 'bold', color: theme.background }}>저장</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
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
  modalContent: { padding: 30, borderRadius: 30, alignItems: 'center', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 25 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', alignSelf: 'flex-start', marginBottom: 15, marginTop: 10 },
  avatarPicker: { marginBottom: 25 },
  largeAvatar: { width: 100, height: 100, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  input: { width: '100%', padding: 15, borderRadius: 12, marginBottom: 25, textAlign: 'center' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', marginBottom: 25 },
  themeItem: { width: '48%', padding: 15, borderRadius: 12, borderWidth: 2, alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center' },
  themeLabel: { marginLeft: 8, fontSize: 14, fontWeight: 'bold' },
  colorPalette: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginBottom: 20 },
  colorOption: { width: 40, height: 40, borderRadius: 20, margin: 8, borderWidth: 3 },
  modalBtns: { flexDirection: 'row', width: '100%', marginTop: 10 },
  cancelBtn: { flex: 1, alignItems: 'center', padding: 15 },
  submitBtn: { flex: 2, padding: 15, borderRadius: 12, alignItems: 'center' }
});
