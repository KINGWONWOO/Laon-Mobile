import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, Alert, RefreshControl, Image, Platform, Share, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
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
  const { rooms, currentUser, notices, addNotice, deleteRoom, theme, refreshAllData, getUserById, updateRoomUserProfile, getRoomUserProfile } = useAppContext();
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

  // 방 전용 프로필 상태
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [roomNickname, setRoomNickname] = useState('');
  const [roomImage, setRoomImage] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // 비밀번호 가리기 상태
  const [showPasscode, setShowPasscode] = useState(false);

  const myRoomProfile = getRoomUserProfile(id as string, currentUser?.id || '');

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
    if (!result.canceled) setSelectedImages(result.assets.map(a => a.uri));
  };

  const handleAddNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) return Alert.alert('오류', '제목과 내용을 입력해주세요.');
    setIsSubmitting(true);
    try {
      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        for (let i = 0; i < selectedImages.length; i++) {
          const url = await storageService.uploadToR2(`notices/${id}`, selectedImages[i], `notice_${Date.now()}_${i}.jpg`);
          imageUrls.push(url);
        }
      }
      await addNotice(id as string, noticeTitle, noticeContent, false, imageUrls);
      setNoticeTitle(''); setNoticeContent(''); setSelectedImages([]); setShowAddAddNotice(false);
    } catch (e: any) { Alert.alert('오류', e.message); } finally { setIsSubmitting(false); }
  };

  const handleUpdateRoomProfile = async () => {
    if (!roomNickname.trim()) return Alert.alert('오류', '이름을 입력해주세요.');
    setIsUpdatingProfile(true);
    try {
      await updateRoomUserProfile(id as string, roomNickname, roomImage);
      setShowProfileModal(false);
      Alert.alert('성공', '방 전용 프로필이 업데이트되었습니다.');
    } catch (e: any) { Alert.alert('실패', e.message); } finally { setIsUpdatingProfile(false); }
  };

  const handleInvite = async () => {
    const inviteUrl = Linking.createURL(`/room/${room.id}`, { queryParams: { passcode: room.passcode } });
    try {
      await Share.share({
        title: `[LAON DANCE] ${room.name} 초대`,
        message: `[LAON DANCE] '${room.name}' 크루룸 초대장\n\n방 ID: ${room.id}\n비밀번호: ${room.passcode}\n\n링크로 바로가기:\n${inviteUrl}`,
      });
    } catch (error) { Alert.alert('오류', '초대장을 공유할 수 없습니다.'); }
  };

  const coreActions = [
    { title: '영상 피드백', icon: 'videocam', path: `/room/${id}/feedback`, color: '#45B7D1', desc: '연습 영상 올리고 피드백' },
    { title: '동선 관리', icon: 'map', path: `/room/${id}/formation`, color: '#FF9F43', desc: '대형 제작 및 애니메이션' },
    { title: '팀 아카이브', icon: 'images', path: `/room/${id}/archive`, color: '#F7D794', desc: '사진과 영상 추억 저장' },
  ];

  const manageActions = [
    { title: '일정 맞추기', icon: 'calendar', path: `/room/${id}/schedule`, color: '#FF6B6B' },
    { title: '연습 투표', icon: 'checkbox', path: `/room/${id}/vote`, color: '#4ECDC4' },
    { title: '멤버 목록', icon: 'people', path: `/room/${id}/members`, color: '#A06CD5' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* 상단 룸 정보 카드 */}
        <LinearGradient colors={[theme.card, theme.card + 'EE']} style={[styles.headerCard, { borderColor: theme.border }]}>
          <View style={styles.roomHeaderRow}>
            {room.image_uri ? (
              <Image source={{ uri: room.image_uri }} style={styles.roomImageLarge} />
            ) : (
              <View style={[styles.roomInitialCircle, { backgroundColor: theme.primary }]}>
                <Text style={[styles.roomInitialText, { color: theme.background }]}>{room.name[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.roomInfoMain}>
              <Text style={[styles.roomName, { color: theme.text }]} numberOfLines={1}>{room.name}</Text>
              <View style={styles.idPassRow}>
                <TouchableOpacity style={styles.roomIdBadge} onPress={() => { Clipboard.setStringAsync(room.id); Alert.alert('복사 완료', 'ID가 복사되었습니다.'); }}>
                  <Text style={[styles.roomIdText, { color: theme.textSecondary }]}>ID: {room.id.slice(0,8)}...</Text>
                  <Ionicons name="copy-outline" size={12} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.roomIdBadge, { marginLeft: 10 }]} onPress={() => setShowPasscode(!showPasscode)}>
                  <Text style={[styles.roomIdText, { color: theme.textSecondary }]}>PW: {showPasscode ? room.passcode : '****'}</Text>
                  <Ionicons name={showPasscode ? "eye-off-outline" : "eye-outline"} size={12} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 내 방 프로필 섹션 */}
          <View style={[styles.myProfileMiniCard, { backgroundColor: theme.background + '88', borderColor: theme.border }]}>
            <View style={styles.myProfileInfo}>
              <Image source={{ uri: myRoomProfile?.profileImage || currentUser?.profileImage }} style={styles.myProfileImg} />
              <View>
                <Text style={[styles.myProfileLabel, { color: theme.textSecondary }]}>이 방에서의 나</Text>
                <Text style={[styles.myProfileName, { color: theme.text }]}>{myRoomProfile?.name || currentUser?.name}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.editProfileBtn, { backgroundColor: theme.primary }]}
              onPress={() => { setRoomNickname(myRoomProfile?.name || currentUser?.name || ''); setRoomImage(myRoomProfile?.profileImage || currentUser?.profileImage || null); setShowProfileModal(true); }}
            >
              <Text style={[styles.editProfileBtnText, { color: theme.background }]}>프로필 설정</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerFooterActions}>
            <TouchableOpacity style={styles.footerAction} onPress={handleInvite}>
              <Ionicons name="share-social-outline" size={18} color={theme.primary} />
              <Text style={[styles.footerActionText, { color: theme.primary }]}>초대하기</Text>
            </TouchableOpacity>
            {isLeader && (
              <TouchableOpacity style={styles.footerAction} onPress={() => {
                Alert.alert('방 삭제', `'${room.name}' 방을 삭제하시겠습니까?`, [
                  { text: '취소' }, { text: '삭제', style: 'destructive', onPress: async () => { await deleteRoom(room.id); router.replace('/rooms'); } }
                ]);
              }}>
                <Ionicons name="trash-outline" size={18} color={theme.error} />
                <Text style={[styles.footerActionText, { color: theme.error }]}>방 삭제</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* 팀 공지 섹션 */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>팀 공지</Text>
            <View style={{ flexDirection: 'row', gap: 15 }}>
              <TouchableOpacity onPress={() => setShowAddAddNotice(true)}><Ionicons name="add-circle-outline" size={22} color={theme.primary} /></TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/room/${id}/notices`)}><Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>전체보기</Text></TouchableOpacity>
            </View>
          </View>
          {roomNotices.length > 0 ? (
            <TouchableOpacity 
              style={[styles.noticeCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(`/room/${id}/notice/${roomNotices[0].id}`)}
            >
              <View style={[styles.noticeTag, { backgroundColor: theme.error }]}><Text style={[styles.noticeTagText, { color: theme.background }]}>LATEST</Text></View>
              <Text style={[styles.noticeTitle, { color: theme.text }]} numberOfLines={1}>{roomNotices[0].title}</Text>
              <Text style={[styles.noticeContent, { color: theme.textSecondary }]} numberOfLines={2}>{roomNotices[0].content}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.emptyNotice, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={{ color: theme.textSecondary }}>등록된 공지가 없습니다.</Text></View>
          )}
        </View>

        {/* 창작 및 피드백 섹션 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 15 }]}>창작 및 피드백</Text>
          <View style={styles.coreGrid}>
            {coreActions.map((item, idx) => (
              <TouchableOpacity key={idx} style={[styles.coreCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(item.path as any)}>
                <View style={[styles.coreIconBox, { backgroundColor: item.color + '20' }]}><Ionicons name={item.icon as any} size={28} color={item.color} /></View>
                <Text style={[styles.coreTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.coreDesc, { color: theme.textSecondary }]}>{item.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 팀 관리 섹션 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 15 }]}>팀 관리 및 소통</Text>
          <View style={styles.manageRow}>
            {manageActions.map((item, idx) => (
              <TouchableOpacity key={idx} style={[styles.manageItem, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(item.path as any)}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
                <Text style={[styles.manageTitle, { color: theme.text }]}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 방 전용 프로필 설정 모달 */}
      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>방 전용 프로필 설정</Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
            </View>
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center' }}>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 25, textAlign: 'center' }}>이 정보는 이 방의 멤버들에게만 공개되는 전용 프로필입니다.</Text>
              <TouchableOpacity style={styles.avatarPicker} onPress={async () => {
                const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5 });
                if (!res.canceled) setRoomImage(res.assets[0].uri);
              }}>
                {roomImage ? <Image source={{ uri: roomImage }} style={styles.largeAvatar} /> : <View style={[styles.largeAvatar, { backgroundColor: theme.primary + '22' }]}><Ionicons name="camera" size={32} color={theme.primary} /></View>}
              </TouchableOpacity>
              <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={roomNickname} onChangeText={setRoomNickname} placeholder="방에서 사용할 이름" placeholderTextColor={theme.textSecondary} />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowProfileModal(false)}><Text style={{ color: theme.textSecondary }}>취소</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.primary }]} onPress={handleUpdateRoomProfile} disabled={isUpdatingProfile}>
                  {isUpdatingProfile ? <ActivityIndicator color={theme.background} /> : <Text style={{ fontWeight: 'bold', color: theme.background }}>변경사항 저장</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showAddNotice} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.text }]}>새 팀 공지</Text><TouchableOpacity onPress={() => setShowAddAddNotice(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border, borderWidth: 1 }]} placeholder="공지 제목" placeholderTextColor={theme.textSecondary} value={noticeTitle} onChangeText={setNoticeTitle} />
              <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top', color: theme.text, borderColor: theme.border, borderWidth: 1 }]} placeholder="공지 내용" placeholderTextColor={theme.textSecondary} multiline numberOfLines={5} value={noticeContent} onChangeText={setNoticeContent} />
              <TouchableOpacity style={[styles.imagePickBtn, { borderColor: theme.border }]} onPress={handlePickImages}><Ionicons name="camera-outline" size={20} color={theme.textSecondary} /><Text style={{ color: theme.textSecondary, marginLeft: 10 }}>사진 첨부 ({selectedImages.length})</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.primary }]} onPress={handleAddNotice} disabled={isSubmitting}>{isSubmitting ? <ActivityIndicator size="small" color={theme.background} /> : <Text style={[styles.submitBtnText, { color: theme.background }]}>공지 등록하기</Text>}</TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16 },
  headerCard: { padding: 20, borderRadius: 24, marginBottom: 25, borderWidth: 1 },
  roomHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  roomImageLarge: { width: 60, height: 60, borderRadius: 20 },
  roomInitialCircle: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  roomInitialText: { fontSize: 24, fontWeight: 'bold' },
  roomInfoMain: { marginLeft: 15, flex: 1 },
  roomName: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  idPassRow: { flexDirection: 'row', alignItems: 'center' },
  roomIdBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  roomIdText: { fontSize: 12 },
  myProfileMiniCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 15 },
  myProfileInfo: { flexDirection: 'row', alignItems: 'center' },
  myProfileImg: { width: 36, height: 36, borderRadius: 12, marginRight: 10 },
  myProfileLabel: { fontSize: 10, fontWeight: 'bold' },
  myProfileName: { fontSize: 14, fontWeight: 'bold' },
  editProfileBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  editProfileBtnText: { fontSize: 11, fontWeight: 'bold' },
  headerFooterActions: { flexDirection: 'row', gap: 20, paddingLeft: 5 },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerActionText: { fontSize: 13, fontWeight: '600' },
  sectionContainer: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  noticeCard: { padding: 16, borderRadius: 20, borderWidth: 1 },
  noticeTag: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FF6B6B', marginBottom: 8 },
  noticeTagText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  noticeContent: { fontSize: 13, lineHeight: 18 },
  emptyNotice: { padding: 20, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
  coreGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  coreCard: { width: '48%', padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 15 },
  coreIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  coreTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  coreDesc: { fontSize: 11, lineHeight: 15 },
  manageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  manageItem: { width: '31%', paddingVertical: 15, alignItems: 'center', borderRadius: 18, borderWidth: 1 },
  manageTitle: { fontSize: 12, fontWeight: 'bold', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  avatarPicker: { marginBottom: 25 },
  largeAvatar: { width: 90, height: 90, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  input: { width: '100%', borderRadius: 12, padding: 15, marginBottom: 15, fontSize: 15 },
  modalBtns: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, alignItems: 'center', padding: 15 },
  submitBtn: { flex: 2, padding: 15, borderRadius: 12, alignItems: 'center' },
  imagePickBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 12, borderStyle: 'dashed', marginBottom: 15 },
});
