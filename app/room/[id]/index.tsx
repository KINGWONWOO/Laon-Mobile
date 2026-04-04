import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, Alert, RefreshControl, Image, Platform, Share, ActivityIndicator } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storageService } from '../../../services/storageService';

export default function RoomMainScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { rooms, currentUser, notices, addNotice, deleteNotice, deleteRoom, theme, themeType, setThemeType, refreshAllData, getUserById } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const room = rooms.find(r => r.id === id);
  const roomNotices = useMemo(() => notices.filter(n => n.roomId === id).sort((a, b) => b.createdAt - a.createdAt), [notices, id]);

  const [showAddNotice, setShowAddAddNotice] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!room) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.text }}>방 정보를 불러올 수 없습니다.</Text>
      </View>
    );
  }

  const isLeader = room.leader_id === currentUser?.id;

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  const handlePickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setSelectedImages(result.assets.map(a => a.uri));
    }
  };

  const handleAddNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) return Alert.alert('오류', '제목과 내용을 입력해주세요.');
    setIsSubmitting(true);
    try {
      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        for (let i = 0; i < selectedImages.length; i++) {
          const uri = selectedImages[i];
          const ext = uri.split('.').pop() || 'jpg';
          const fileName = `notice_${Date.now()}_${i}.${ext}`;
          const url = await storageService.uploadToR2(`notices/${id}`, uri, fileName);
          imageUrls.push(url);
        }
      }

      await addNotice(id as string, noticeTitle, noticeContent, false, imageUrls);
      setNoticeTitle('');
      setNoticeContent('');
      setSelectedImages([]);
      setShowAddAddNotice(false);
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyRoomId = async () => {
    await Clipboard.setStringAsync(room.id);
    Alert.alert('복사 완료', '방 고유 ID가 클립보드에 복사되었습니다.');
  };

  const handleInvite = async () => {
    const inviteUrl = Linking.createURL(`/room/${room.id}`, {
      queryParams: { passcode: room.passcode },
    });

    try {
      await Share.share({
        title: `[LAON DANCE] ${room.name} 초대`,
        message: `[LAON DANCE] '${room.name}' 크루룸 초대장\n\n` +
                 `1. 앱에서 참여하기:\n- 방 ID: ${room.id}\n- 비밀번호: ${room.passcode}\n\n` +
                 `2. 링크로 바로가기:\n${inviteUrl}`,
      });
    } catch (error) {
      Alert.alert('오류', '초대장을 공유할 수 없습니다.');
    }
  };

  const menuItems = [
    { title: '멤버 목록', icon: 'people', path: `/room/${id}/members`, color: '#A06CD5' },
    { title: '일정 맞추기', icon: 'calendar', path: `/room/${id}/schedule`, color: '#FF6B6B' },
    { title: '연습 투표', icon: 'checkbox', path: `/room/${id}/vote`, color: '#4ECDC4' },
    { title: '영상 피드백', icon: 'videocam', path: `/room/${id}/feedback`, color: '#45B7D1' },
    { title: '팀 아카이브', icon: 'images', path: `/room/${id}/archive`, color: '#F7D794' },
  ];

  const themeIcons: Record<string, any> = {
    dark: 'moon',
    light: 'sunny',
    pink: 'heart',
    shiba: 'paw'
  };

  const cycleTheme = () => {
    const types: any[] = ['dark', 'light', 'pink', 'shiba'];
    const next = types[(types.indexOf(themeType) + 1) % types.length];
    setThemeType(next);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <LinearGradient colors={[theme.card, theme.background]} style={[styles.headerCard, { borderColor: theme.border }]}>
          <View style={styles.topActions}>
            <TouchableOpacity style={[styles.actionIcon, { backgroundColor: theme.border + '33' }]} onPress={cycleTheme}>
              <Ionicons name={themeIcons[themeType] || 'color-palette'} size={20} color={theme.primary} />
            </TouchableOpacity>
            {isLeader && (
              <TouchableOpacity onPress={() => {
                Alert.alert('방 삭제', `'${room.name}' 방을 삭제하시겠습니까?`, [
                  { text: '취소' },
                  { text: '삭제', style: 'destructive', onPress: async () => { await deleteRoom(room.id); router.replace('/rooms'); } }
                ]);
              }} style={[styles.actionIcon, { backgroundColor: theme.error + '22' }]}>
                <Ionicons name="trash-outline" size={20} color={theme.error} />
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.roomInitialCircle, { backgroundColor: theme.primary }]}>
            <Text style={[styles.roomInitialText, { color: theme.background }]}>{room.name[0].toUpperCase()}</Text>
          </View>
          
          <Text style={[styles.roomName, { color: theme.text }]}>{room.name}</Text>
          
          <TouchableOpacity style={[styles.idContainer, { backgroundColor: theme.border + '33' }]} onPress={copyRoomId}>
            <Text style={[styles.roomIdText, { color: theme.textSecondary }]} numberOfLines={1}>ID: {room.id}</Text>
            <Ionicons name="copy-outline" size={14} color={theme.textSecondary} style={{ marginLeft: 5 }} />
          </TouchableOpacity>

          <Text style={[styles.roomCode, { color: theme.accent }]}>비밀번호: {room.passcode}</Text>
          
          <TouchableOpacity style={[styles.inviteBtn, { backgroundColor: theme.primary }]} onPress={handleInvite}>
            <Ionicons name="share-social" size={18} color={theme.background} />
            <Text style={[styles.inviteBtnText, { color: theme.background }]}>초대장 보내기</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.noticeSectionOutside}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>팀 공지</Text>
              <TouchableOpacity onPress={() => setShowAddAddNotice(true)} style={{ marginLeft: 12 }}>
                <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/room/${id}/notices`)} style={{ marginLeft: 12 }}>
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>전체보기</Text>
              </TouchableOpacity>
            </View>
          </View>
          {roomNotices.length > 0 ? (
            <View style={styles.noticeVerticalList}>
              {roomNotices.slice(0, 3).map(notice => {
                const author = getUserById(notice.userId);
                return (
                  <TouchableOpacity 
                    key={notice.id} 
                    style={[styles.noticeItemVertical, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => router.push(`/room/${id}/notice/${notice.id}`)}
                  >
                    <View style={styles.noticeItemHeader}>
                      <Text style={[styles.noticeItemTitle, { color: theme.text }]} numberOfLines={1}>{notice.title}</Text>
                      {notice.imageUrls && notice.imageUrls.length > 0 && <Ionicons name="image" size={14} color={theme.primary} />}
                    </View>
                    <Text style={[styles.noticeItemContent, { color: theme.textSecondary }]} numberOfLines={1}>{notice.content}</Text>
                    <View style={styles.noticeItemFooter}>
                      <Text style={[styles.noticeAuthor, { color: theme.textSecondary }]}>{author?.name || '...'}</Text>
                      <Text style={[styles.noticeDate, { color: theme.textSecondary + '88' }]}>{new Date(notice.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={[styles.emptyNoticeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.emptyNoticeText, { color: theme.textSecondary }]}>등록된 공지사항이 없습니다.</Text>
            </View>
          )}
        </View>

        <View style={styles.grid}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={[styles.gridItem, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(item.path as any)}
            >
              <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon as any} size={32} color={item.color} />
              </View>
              <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showAddNotice} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>새 팀 공지</Text>
              <TouchableOpacity onPress={() => setShowAddAddNotice(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput 
                style={[styles.input, { color: theme.text, borderColor: theme.border }]} 
                placeholder="공지 제목" 
                placeholderTextColor="#888" 
                value={noticeTitle} 
                onChangeText={setNoticeTitle} 
              />
              <TextInput 
                style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.border }]} 
                placeholder="공지 내용" 
                placeholderTextColor="#888" 
                multiline 
                numberOfLines={5} 
                value={noticeContent} 
                onChangeText={setNoticeContent} 
              />

              <TouchableOpacity style={[styles.imagePickBtn, { borderColor: theme.border }]} onPress={handlePickImages}>
                <Ionicons name="camera-outline" size={20} color={theme.textSecondary} />
                <Text style={{ color: theme.textSecondary, marginLeft: 10 }}>사진 첨부 ({selectedImages.length})</Text>
              </TouchableOpacity>

              {selectedImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedImagesScroll}>
                  {selectedImages.map((uri, idx) => (
                    <View key={idx} style={styles.selectedImageWrapper}>
                      <Image source={{ uri }} style={styles.selectedImage} />
                      <TouchableOpacity 
                        style={styles.removeImageBtn} 
                        onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== idx))}
                      >
                        <Ionicons name="close-circle" size={20} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: theme.primary }]} 
                onPress={handleAddNotice}
                disabled={isSubmitting}
              >
                {isSubmitting ? <ActivityIndicator size="small" color={theme.background} /> : <Text style={[styles.submitBtnText, { color: theme.background }]}>공지 등록하기</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  headerCard: {
    padding: 20,
    borderRadius: 28,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    position: 'relative',
  },
  topActions: {
    position: 'absolute',
    top: 15,
    right: 15,
    flexDirection: 'row',
  },
  actionIcon: {
    padding: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  roomInitialCircle: {
    width: 54,
    height: 54,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 5,
  },
  roomInitialText: { fontSize: 22, fontWeight: 'bold' },
  roomName: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6,
    maxWidth: '90%',
  },
  roomIdText: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  roomCode: { fontSize: 13, fontWeight: '600', marginBottom: 15 },
  inviteBtn: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  inviteBtnText: { fontWeight: 'bold', marginLeft: 8 },
  
  noticeSectionOutside: {
    width: '100%',
    marginBottom: 25,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  
  noticeVerticalList: { width: '100%' },
  noticeItemVertical: {
    width: '100%',
    padding: 18,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
  },
  noticeItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  noticeItemTitle: { fontSize: 15, fontWeight: 'bold', flex: 1 },
  noticeItemContent: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  noticeItemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noticeAuthor: { fontSize: 11, fontWeight: '600' },
  noticeDate: { fontSize: 10 },

  emptyNoticeCard: {
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyNoticeText: { fontSize: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: {
    width: '48%',
    padding: 18,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
  },
  iconBox: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  itemTitle: { fontSize: 14, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 15, fontSize: 15 },
  textArea: { height: 120, textAlignVertical: 'top' },
  imagePickBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 12, borderStyle: 'dashed', marginBottom: 15 },
  selectedImagesScroll: { flexDirection: 'row', marginBottom: 20 },
  selectedImageWrapper: { position: 'relative', marginRight: 10 },
  selectedImage: { width: 80, height: 80, borderRadius: 10 },
  removeImageBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: '#fff', borderRadius: 10 },
  submitBtn: { padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  submitBtnText: { fontWeight: 'bold', fontSize: 16 },
});
