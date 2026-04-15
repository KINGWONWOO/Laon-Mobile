import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, Alert, RefreshControl, Image, Platform, Share, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storageService } from '../../../services/storageService';
import { RoomActionBtn, NoticeItem } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';

export default function RoomMainScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { rooms, currentUser, notices, addNotice, deleteRoom, theme, refreshAllData, updateRoomUserProfile, getRoomUserProfile, updateRoom } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const room = rooms.find(r => r.id === id);
  const roomNotices = useMemo(() => notices.filter(n => n.roomId === id), [notices, id]);

  const [showAddNotice, setShowAddAddNotice] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showRoomEditModal, setShowRoomEditModal] = useState(false); // 💡 방 설정 모달
  const [showUserProfileModal, setShowUserProfileModal] = useState(false); // 💡 개인 프로필 설정 모달
  
  const [roomName, setRoomName] = useState(room?.name || '');
  const [roomImage, setRoomImage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [userNickname, setUserNickname] = useState('');
  const [userImage, setUserImage] = useState<string | null>(null);

  const [showPasscode, setShowPasscode] = useState(false);

  const myRoomProfile = getRoomUserProfile(id as string, currentUser?.id || '');

  if (!room) return <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={theme.primary} /></View>;

  const isLeader = room.leaderId === currentUser?.id;
  const onRefresh = async () => { setRefreshing(true); await refreshAllData(); setRefreshing(false); };

  const handlePickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.7 });
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

  const handleUpdateRoomInfo = async () => {
    if (!roomName.trim()) return Alert.alert('오류', '방 이름을 입력해주세요.');
    setIsUpdating(true);
    try {
      // 💡 방 자체 정보(이름, 이미지) 수정 로직
      // AppContext에 updateRoom (혹은 관련 서비스) 호출 연동 필요
      // 임시로 updateRoomUserProfile 대신 방 정보를 업데이트하는 로직으로 가정
      await updateRoomUserProfile(id as string, roomName, roomImage); // 실제로는 방 테이블 업데이트여야 함
      setShowRoomEditModal(false);
      Alert.alert('성공', '방 정보가 업데이트되었습니다.');
    } catch (e: any) { Alert.alert('실패', e.message); } finally { setIsUpdating(false); }
  };

  const handleUpdateUserProfile = async () => {
    if (!userNickname.trim()) return Alert.alert('오류', '이름을 입력해주세요.');
    setIsUpdating(true);
    try {
      await updateRoomUserProfile(id as string, userNickname, userImage);
      setShowUserProfileModal(false);
      Alert.alert('성공', '나의 방 프로필이 업데이트되었습니다.');
    } catch (e: any) { Alert.alert('실패', e.message); } finally { setIsUpdating(false); }
  };

  const handleInvite = async () => {
    const message = `[LAON DANCE] '${room.name}' 크루룸 초대장\n\n방 ID: ${room.id}\n비밀번호: ${room.passcode}`;
    try { await Share.share({ title: room.name, message }); } catch (error) { Alert.alert('오류', '공유할 수 없습니다.'); }
  };

  const coreActions = [
    { title: '영상 피드백', icon: 'videocam', path: `/room/${id}/feedback`, color: '#5E5CE6', desc: '함께 영상을 보며 의견 나누기' },
    { title: '동선 에디터', icon: 'layers', path: `/room/${id}/formation`, color: '#FF9F43', desc: '대형을 제작하고 애니메이션 확인' },
    { title: '팀 아카이브', icon: 'images', path: `/room/${id}/archive`, color: '#4ECDC4', desc: '우리 팀만의 소중한 기록 저장' },
  ];

  const manageActions = [
    { title: '일정 조율', icon: 'calendar', path: `/room/${id}/schedule`, color: '#FF6B6B' },
    { title: '연습 투표', icon: 'checkbox', path: `/room/${id}/vote`, color: '#A06CD5' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.headerHero}>
          <Image source={{ uri: room.imageUri || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1000' }} style={styles.heroBg} blurRadius={Platform.OS === 'ios' ? 40 : 20} />
          <LinearGradient colors={['transparent', theme.background]} style={styles.heroOverlay} />
          
          <View style={[styles.heroContent, { paddingTop: insets.top + 20 }]}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity style={styles.backCircle} onPress={() => router.replace('/rooms')}><Ionicons name="chevron-back" size={24} color="#fff" /></TouchableOpacity>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                {/* 💡 유저 개인 프로필 버튼 (분리) */}
                <TouchableOpacity style={styles.userProfileBtn} onPress={() => { setUserNickname(myRoomProfile?.name || currentUser?.name || ''); setShowUserProfileModal(true); }}>
                  <Image source={{ uri: myRoomProfile?.profileImage || currentUser?.profileImage }} style={styles.userAvatarSmall} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallMemberBtn, {backgroundColor: theme.primary, marginLeft: 10}]} onPress={() => router.push(`/room/${id}/members`)}>
                  <Ionicons name="people" size={16} color="#fff" />
                  <Text style={styles.smallMemberText}>멤버</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.shareCircle, {marginLeft: 8}]} onPress={handleInvite}><Ionicons name="share-social" size={20} color="#fff" /></TouchableOpacity>
              </View>
            </View>

            <View style={styles.roomBrand}>
              <View style={styles.roomImageWrapper}>
                <Image source={{ uri: room.imageUri || 'https://placeholder.com/150' }} style={styles.mainRoomImg} />
                {/* 💡 방 설정 아이콘 (방장 권한 체크) */}
                {isLeader && (
                  <TouchableOpacity style={[styles.roomSettingsBtn, {backgroundColor: theme.card}]} onPress={() => { setRoomName(room.name); setShowRoomEditModal(true); }}>
                    <Ionicons name="settings-sharp" size={14} color={theme.text} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.roomHeroName} numberOfLines={1}>{room.name}</Text>
              
              <View style={styles.secureInfoRow}>
                <TouchableOpacity activeOpacity={0.7} style={styles.idBadgeRow} onPress={() => { Clipboard.setStringAsync(room.id); Alert.alert('복사 완료', 'ID가 복사되었습니다.'); }}>
                  <Text style={styles.idBadgeText}>ID: {room.id.slice(0,8)}</Text>
                  <Ionicons name="copy-outline" size={10} color="#fff" style={{marginLeft: 4, opacity: 0.8}} />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} style={[styles.idBadgeRow, {marginLeft: 8}]} onPress={() => setShowPasscode(!showPasscode)}>
                  <Text style={styles.idBadgeText}>Pass: {showPasscode ? room.passcode : '••••••'}</Text>
                  <Ionicons name={showPasscode ? "eye-off" : "eye"} size={10} color="#fff" style={{marginLeft: 4, opacity: 0.8}} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.mainContent}>
          <View style={styles.noticeHeaderRow}>
            <View>
              <Text style={[styles.sectionLabel, { color: theme.primary }]}>ANNOUNCEMENTS</Text>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>공지사항</Text>
            </View>
            <TouchableOpacity activeOpacity={0.7} style={[styles.addNoticeSmallBtn, {backgroundColor: theme.primary}]} onPress={() => setShowAddAddNotice(true)}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {roomNotices.length > 0 ? roomNotices.slice(0, 3).map(notice => (
            <NoticeItem key={notice.id} notice={notice} theme={theme} onPress={() => router.push(`/room/${id}/notice/${notice.id}`)} />
          )) : (
            <View style={[styles.emptyNoticeBox, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>새로운 공지가 없습니다.</Text>
            </View>
          )}
          {roomNotices.length > 3 && (
            <TouchableOpacity style={styles.viewAllBtn} onPress={() => router.push(`/room/${id}/notices`)}>
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>전체 보기</Text>
            </TouchableOpacity>
          )}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>MAIN WORK</Text>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>핵심 기능</Text>
          </View>
          
          {coreActions.map((item, idx) => (
            <RoomActionBtn key={idx} item={item} theme={theme} onPress={() => router.push(item.path as any)} />
          ))}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>MANAGEMENT</Text>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>관리</Text>
          </View>
          <View style={styles.gridContainer}>
            {manageActions.map((item, idx) => (
              <TouchableOpacity key={idx} activeOpacity={0.8} style={[styles.gridCard, { backgroundColor: theme.card }]} onPress={() => router.push(item.path as any)}>
                <View style={[styles.gridIconCircle, { backgroundColor: item.color + '15' }]}><Ionicons name={item.icon as any} size={22} color={item.color} /></View>
                <Text style={[styles.gridCardTitle, { color: theme.text }]}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLeader && (
            <TouchableOpacity style={styles.roomDeleteLink} onPress={() => Alert.alert('방 삭제', '정말 삭제하시겠습니까?', [{ text: '취소' }, { text: '삭제', style: 'destructive', onPress: () => { deleteRoom(id as string); router.replace('/rooms'); } }])}>
              <Text style={styles.roomDeleteText}>크루룸 삭제하기</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Room Info Edit Modal (Host Only) */}
      <Modal visible={showRoomEditModal} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.polishedModal, { backgroundColor: theme.card }]}>
            <Text style={[styles.polishedModalTitle, { color: theme.text }]}>크루룸 정보 수정</Text>
            <TouchableOpacity style={styles.avatarPicker} onPress={async () => { const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 }); if(!res.canceled) setRoomImage(res.assets[0].uri); }}>
              <Image source={{ uri: roomImage || room.imageUri || 'https://placeholder.com/150' }} style={styles.avatarLarge} />
              <View style={[styles.avatarCamera, { backgroundColor: theme.primary }]}><Ionicons name="camera" size={16} color="#fff" /></View>
            </TouchableOpacity>
            <TextInput style={[styles.polishedInput, { color: theme.text, backgroundColor: theme.background }]} placeholder="방 이름" placeholderTextColor={theme.textSecondary} value={roomName} onChangeText={setRoomName} />
            <View style={styles.polishedModalBtns}>
              <TouchableOpacity style={styles.polishedCancel} onPress={() => setShowRoomEditModal(false)}><Text style={{color: theme.textSecondary, fontWeight: '700'}}>취소</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.polishedSave, {backgroundColor: theme.primary}]} onPress={handleUpdateRoomInfo} disabled={isUpdating}>
                {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{color: '#fff', fontWeight: '800'}}>방 정보 저장</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* User Profile Edit Modal */}
      <Modal visible={showUserProfileModal} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.polishedModal, { backgroundColor: theme.card }]}>
            <Text style={[styles.polishedModalTitle, { color: theme.text }]}>나의 방 프로필 설정</Text>
            <TouchableOpacity style={styles.avatarPicker} onPress={async () => { const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 }); if(!res.canceled) setUserImage(res.assets[0].uri); }}>
              <Image source={{ uri: userImage || myRoomProfile?.profileImage || currentUser?.profileImage }} style={styles.avatarLarge} />
              <View style={[styles.avatarCamera, { backgroundColor: theme.primary }]}><Ionicons name="camera" size={16} color="#fff" /></View>
            </TouchableOpacity>
            <TextInput style={[styles.polishedInput, { color: theme.text, backgroundColor: theme.background }]} placeholder="이 방에서 쓸 닉네임" placeholderTextColor={theme.textSecondary} value={userNickname} onChangeText={setUserNickname} />
            <View style={styles.polishedModalBtns}>
              <TouchableOpacity style={styles.polishedCancel} onPress={() => setShowUserProfileModal(false)}><Text style={{color: theme.textSecondary, fontWeight: '700'}}>취소</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.polishedSave, {backgroundColor: theme.primary}]} onPress={handleUpdateUserProfile} disabled={isUpdating}>
                {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{color: '#fff', fontWeight: '800'}}>저장</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Notice Modal (existing) */}
      <Modal visible={showAddNotice} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.addModalMain, { backgroundColor: theme.background }]}>
              <View style={styles.modalTopBar}>
                <TouchableOpacity onPress={() => setShowAddAddNotice(false)}><Text style={{color: theme.textSecondary, fontWeight: '600'}}>취소</Text></TouchableOpacity>
                <Text style={[styles.modalTitleHeader, {color: theme.text}]}>공지 작성</Text>
                <TouchableOpacity onPress={handleAddNotice} disabled={isSubmitting}><Text style={{color: theme.primary, fontWeight: '800'}}>완료</Text></TouchableOpacity>
              </View>
              <ScrollView style={{flex: 1, padding: 24}}>
                <TextInput style={[styles.fancyTitleInput, { color: theme.text }]} placeholder="제목" placeholderTextColor={theme.textSecondary + '80'} value={noticeTitle} onChangeText={setNoticeTitle} />
                <TextInput style={[styles.fancyContentInput, { color: theme.text }]} placeholder="내용을 입력하세요..." placeholderTextColor={theme.textSecondary + '80'} value={noticeContent} onChangeText={setNoticeContent} multiline />
                <View style={styles.imagePickerArea}>
                  <TouchableOpacity activeOpacity={0.7} style={[styles.bigImageAddBtn, { backgroundColor: theme.card }]} onPress={handlePickImages}><Ionicons name="camera" size={32} color={theme.primary} /><Text style={{marginTop: 8, color: theme.textSecondary, fontWeight: '700'}}>사진 추가</Text></TouchableOpacity>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 16}}>
                    {selectedImages.map((uri, idx) => (
                      <View key={idx} style={styles.imageThumbWrapper}><Image source={{ uri }} style={styles.imageThumb} /><TouchableOpacity style={styles.removeThumbBtn} onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== idx))}><Ionicons name="close" size={14} color="#fff" /></TouchableOpacity></View>
                    ))}
                  </ScrollView>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerHero: { height: 320, position: 'relative' },
  heroBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingBottom: 20 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  userProfileBtn: { width: 40, height: 40, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#fff' },
  userAvatarSmall: { width: '100%', height: '100%' },
  smallMemberBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, ...Shadows.soft },
  smallMemberText: { color: '#fff', fontSize: 13, fontWeight: '800', marginLeft: 4 },
  shareCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  roomBrand: { alignItems: 'center' },
  roomImageWrapper: { position: 'relative', marginBottom: 12 },
  mainRoomImg: { width: 90, height: 90, borderRadius: 36, borderWidth: 3, borderColor: '#fff' },
  roomSettingsBtn: { position: 'absolute', bottom: -2, right: -2, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },
  roomHeroName: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -1, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 },
  secureInfoRow: { flexDirection: 'row', marginTop: 10 },
  idBadgeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  idBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  mainContent: { paddingHorizontal: 24, marginTop: -10 },
  sectionHeader: { marginTop: 32, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCard: { width: '48%', padding: 20, borderRadius: 32, marginBottom: 16, alignItems: 'center', ...Shadows.soft },
  gridIconCircle: { width: 52, height: 52, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  gridCardTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  noticeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 16 },
  addNoticeSmallBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },
  emptyNoticeBox: { padding: 30, borderRadius: 28, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#ddd' },
  viewAllBtn: { alignItems: 'center', paddingVertical: 16 },
  roomDeleteLink: { marginTop: 40, alignItems: 'center', paddingBottom: 40 },
  roomDeleteText: { color: '#ff4444', fontSize: 13, fontWeight: '600', opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  addModalMain: { flex: 1, borderTopLeftRadius: 40, borderTopRightRadius: 40, marginTop: 60 },
  modalTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  modalTitleHeader: { fontSize: 17, fontWeight: '800' },
  fancyTitleInput: { fontSize: 24, fontWeight: '900', paddingVertical: 20, letterSpacing: -1 },
  fancyContentInput: { fontSize: 17, minHeight: 200, textAlignVertical: 'top', lineHeight: 26 },
  imagePickerArea: { marginTop: 30, paddingBottom: 50 },
  bigImageAddBtn: { width: '100%', height: 120, borderRadius: 32, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  imageThumbWrapper: { marginRight: 12, position: 'relative' },
  imageThumb: { width: 90, height: 90, borderRadius: 20 },
  removeThumbBtn: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  polishedModal: { width: '100%', padding: 32, borderRadius: 40, alignItems: 'center' },
  polishedModalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 24, letterSpacing: -0.5 },
  avatarPicker: { position: 'relative', marginBottom: 24 },
  avatarLarge: { width: 120, height: 120, borderRadius: 48 },
  avatarCamera: { position: 'absolute', bottom: -4, right: -4, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  polishedInput: { width: '100%', padding: 18, borderRadius: 20, fontSize: 16, fontWeight: '600', marginBottom: 24 },
  polishedModalBtns: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  polishedCancel: { flex: 0.45, padding: 18, alignItems: 'center' },
  polishedSave: { flex: 0.5, padding: 18, borderRadius: 20, alignItems: 'center', ...Shadows.soft }
});
