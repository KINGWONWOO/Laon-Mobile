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
  const { rooms, currentUser, notices, addNotice, deleteRoom, theme, refreshAllData, updateRoomUserProfile, getRoomUserProfile } = useAppContext();
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

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [roomNickname, setRoomNickname] = useState('');
  const [roomImage, setRoomImage] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
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
    const inviteUrl = `laon-dance://room/${room.id}?passcode=${room.passcode}`;
    try {
      await Share.share({ title: `[LAON DANCE] ${room.name} 초대`, message: `[LAON DANCE] '${room.name}' 크루룸 초대장\n\n방 ID: ${room.id}\n비밀번호: ${room.passcode}\n\n앱에서 방 가입 시 사용하세요!` });
    } catch (error) { Alert.alert('오류', '초대장을 공유할 수 없습니다.'); }
  };

  const coreActions = [
    { title: '영상 피드백', icon: 'videocam', path: `/room/${id}/feedback`, color: '#45B7D1', desc: '함께 영상을 보며 의견을 나눠요' },
    { title: '동선 관리', icon: 'map', path: `/room/[id]/formation`, color: '#FF9F43', desc: '대형을 만들고 애니메이션으로 확인해요' },
    { title: '팀 아카이브', icon: 'images', path: `/room/${id}/archive`, color: '#F7D794', desc: '우리 팀만의 소중한 기록들' },
  ];

  const manageActions = [
    { title: '일정 조율', icon: 'calendar', path: `/room/${id}/schedule`, color: '#FF6B6B' },
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
        <View style={[styles.headerCard, { backgroundColor: theme.card }]}>
          <View style={styles.roomHeaderRow}>
            {room.imageUri ? (
              <Image source={{ uri: room.imageUri }} style={styles.roomImageLarge} />
            ) : (
              <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.roomInitialCircle}>
                <Text style={[styles.roomInitialText, { color: '#fff' }]}>{room.name[0].toUpperCase()}</Text>
              </LinearGradient>
            )}
            <View style={styles.roomInfoMain}>
              <Text style={[styles.roomName, { color: theme.text }]} numberOfLines={1}>{room.name}</Text>
              <View style={styles.idPassRow}>
                <TouchableOpacity activeOpacity={0.7} style={[styles.idBadge, { backgroundColor: theme.primary + '15' }]} onPress={() => { Clipboard.setStringAsync(room.id); Alert.alert('복사 완료', 'ID가 복사되었습니다.'); }}>
                  <Text style={[styles.idBadgeText, { color: theme.primary }]}>ID: {room.id.slice(0,6)}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} style={[styles.idBadge, { backgroundColor: theme.accent + '15', marginLeft: 8 }]} onPress={() => setShowPasscode(!showPasscode)}>
                  <Text style={[styles.idBadgeText, { color: theme.accent }]}>PW: {showPasscode ? room.passcode : '****'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={handleInvite} style={styles.shareBtn}>
              <Ionicons name="share-social-outline" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* 내 방 프로필 요약 */}
          <TouchableOpacity activeOpacity={0.9} style={[styles.myProfileRow, { backgroundColor: theme.background + '60' }]} onPress={() => { setRoomNickname(myRoomProfile?.name || currentUser?.name || ''); setShowProfileModal(true); }}>
            <Image source={{ uri: myRoomProfile?.profileImage || currentUser?.profileImage }} style={styles.myProfileImg} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.myProfileLabel, { color: theme.textSecondary }]}>나의 방 닉네임</Text>
              <Text style={[styles.myProfileName, { color: theme.text }]}>{myRoomProfile?.name || currentUser?.name}</Text>
            </View>
            <View style={[styles.editIconCircle, { backgroundColor: theme.primary }]}>
              <Ionicons name="pencil" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>핵심 기능</Text>
        </View>
        <View style={styles.actionList}>
          {coreActions.map((item, idx) => (
            <RoomActionBtn key={idx} item={item} theme={theme} onPress={() => router.push(item.path as any)} />
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>관리 & 멤버</Text>
        </View>
        <View style={styles.manageGrid}>
          {manageActions.map((item, idx) => (
            <TouchableOpacity key={idx} activeOpacity={0.8} style={[styles.gridItem, { backgroundColor: theme.card }]} onPress={() => router.push(item.path as any)}>
              <View style={[styles.gridIconCircle, { backgroundColor: item.color + '15' }]}><Ionicons name={item.icon as any} size={24} color={item.color} /></View>
              <Text style={[styles.gridItemTitle, { color: theme.text }]}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.noticeSection}>
          <View style={styles.sectionHeaderWithAction}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>공지사항</Text>
            <TouchableOpacity activeOpacity={0.7} style={styles.writeNoticeBtn} onPress={() => setShowAddAddNotice(true)}>
              <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>작성하기</Text>
            </TouchableOpacity>
          </View>
          {roomNotices.length > 0 ? roomNotices.slice(0, 3).map(notice => (
            <NoticeItem key={notice.id} notice={notice} theme={theme} onPress={() => router.push(`/room/${id}/notice/${notice.id}`)} />
          )) : (
            <View style={[styles.emptyNotice, { backgroundColor: theme.card }]}>
              <Ionicons name="notifications-off-outline" size={32} color={theme.textSecondary + '40'} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>등록된 공지사항이 없어요</Text>
            </View>
          )}
          {roomNotices.length > 3 && (
            <TouchableOpacity activeOpacity={0.7} style={styles.moreBtn} onPress={() => router.push(`/room/${id}/notices`)}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>공지사항 전체보기</Text>
              <Ionicons name="chevron-down" size={16} color={theme.textSecondary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        </View>

        {isLeader && (
          <TouchableOpacity style={styles.deleteRoomBtn} onPress={() => Alert.alert('방 삭제', '이 방을 정말 삭제하시겠습니까? 팀의 모든 기록이 사라집니다.', [{ text: '취소' }, { text: '삭제', style: 'destructive', onPress: () => { deleteRoom(id as string); router.replace('/rooms'); } }])}>
            <Text style={styles.deleteRoomText}>방 삭제하기</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal UI remains functional but with polished styles... */}
      <Modal visible={showProfileModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>방 프로필 수정</Text>
            <TouchableOpacity style={styles.modalImgPicker} onPress={async () => { const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 }); if(!res.canceled) setRoomImage(res.assets[0].uri); }}>
              <Image source={{ uri: roomImage || myRoomProfile?.profileImage || currentUser?.profileImage }} style={styles.modalProfileImg} />
              <View style={[styles.cameraBadge, { backgroundColor: theme.primary }]}><Ionicons name="camera" size={16} color="#fff" /></View>
            </TouchableOpacity>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]} placeholder="이 방에서 사용할 닉네임" placeholderTextColor="#888" value={roomNickname} onChangeText={setRoomNickname} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.border + '80' }]} onPress={() => setShowProfileModal(false)}><Text style={{ color: theme.text, fontWeight: '600' }}>취소</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.primary }]} onPress={handleUpdateRoomProfile} disabled={isUpdatingProfile}>
                {isUpdatingProfile ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>저장</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Notice Modal */}
      <Modal visible={showAddNotice} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.addModalContent, { backgroundColor: theme.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>공지사항 작성</Text>
                <TouchableOpacity onPress={() => setShowAddAddNotice(false)}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <TextInput style={[styles.noticeInputTitle, { color: theme.text, borderColor: theme.border }]} placeholder="제목을 입력하세요" placeholderTextColor="#888" value={noticeTitle} onChangeText={setNoticeTitle} />
                <TextInput style={[styles.noticeInputContent, { color: theme.text, borderColor: theme.border }]} placeholder="내용을 입력하세요" placeholderTextColor="#888" value={noticeContent} onChangeText={setNoticeContent} multiline />
                
                <Text style={[styles.label, { color: theme.textSecondary }]}>사진 첨부</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewRow}>
                  <TouchableOpacity activeOpacity={0.7} style={[styles.imageAddBtn, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={handlePickImages}><Ionicons name="camera-outline" size={28} color={theme.textSecondary} /></TouchableOpacity>
                  {selectedImages.map((uri, idx) => (
                    <View key={idx} style={styles.imagePreviewWrapper}>
                      <Image source={{ uri }} style={styles.imagePreview} />
                      <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== idx))}><Ionicons name="close-circle" size={20} color="#ff4444" /></TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity activeOpacity={0.8} style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleAddNotice} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={[styles.saveBtnText, { color: '#fff' }]}>등록하기</Text>}
                </TouchableOpacity>
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
  scrollContent: { paddingHorizontal: 20 },
  headerCard: { padding: 24, borderRadius: 32, marginTop: 10, ...Shadows.card },
  roomHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  roomImageLarge: { width: 72, height: 72, borderRadius: 28 },
  roomInitialCircle: { width: 72, height: 72, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  roomInitialText: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  roomInfoMain: { flex: 1, marginLeft: 18 },
  roomName: { fontSize: 24, fontWeight: '800', marginBottom: 8, letterSpacing: -1 },
  idPassRow: { flexDirection: 'row' },
  idBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  idBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: -0.2 },
  shareBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  
  myProfileRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 28 },
  myProfileImg: { width: 44, height: 44, borderRadius: 22, marginRight: 14 },
  myProfileLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2, opacity: 0.7 },
  myProfileName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.5 },
  editIconCircle: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },

  sectionHeader: { marginTop: 32, marginBottom: 16, paddingHorizontal: 4 },
  sectionHeaderWithAction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 16, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.8 },
  
  actionList: { marginTop: 4 },
  manageGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: '31%', padding: 20, borderRadius: 28, alignItems: 'center', marginBottom: 14, ...Shadows.card },
  gridIconCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  gridItemTitle: { fontSize: 13, fontWeight: '800', letterSpacing: -0.5 },

  noticeSection: { marginTop: 10 },
  writeNoticeBtn: { backgroundColor: '#FF8E9E15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  emptyNotice: { padding: 40, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...Shadows.soft },
  emptyText: { marginTop: 12, fontSize: 14, fontWeight: '600', opacity: 0.7 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },

  deleteRoomBtn: { marginTop: 40, alignItems: 'center', padding: 20 },
  deleteRoomText: { color: '#ff4444', fontSize: 13, fontWeight: '500', textDecorationLine: 'underline', opacity: 0.7 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', padding: 28, borderRadius: 32, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, letterSpacing: -1 },
  modalImgPicker: { position: 'relative', marginBottom: 24, marginTop: 10 },
  modalProfileImg: { width: 110, height: 110, borderRadius: 32 },
  cameraBadge: { position: 'absolute', bottom: -4, right: -4, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  input: { width: '100%', borderRadius: 20, padding: 16, marginBottom: 20, fontSize: 16, ...Shadows.soft },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  modalBtn: { flex: 0.48, padding: 16, borderRadius: 28, alignItems: 'center' },

  addModalContent: { width: '100%', height: '90%', padding: 28, borderTopLeftRadius: 32, borderTopRightRadius: 32, position: 'absolute', bottom: 0 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  noticeInputTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, paddingVertical: 16, marginBottom: 10 },
  noticeInputContent: { fontSize: 16, minHeight: 150, textAlignVertical: 'top', paddingVertical: 16 },
  label: { fontSize: 14, fontWeight: '800', marginTop: 20, marginBottom: 12, letterSpacing: -0.5 },
  imagePreviewRow: { flexDirection: 'row', marginBottom: 24 },
  imageAddBtn: { width: 88, height: 88, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 12, backgroundColor: '#8E8E9315' },
  imagePreviewWrapper: { position: 'relative', marginRight: 12 },
  imagePreview: { width: 88, height: 88, borderRadius: 28 },
  imageRemoveBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 12, elevation: 2 },
  saveBtn: { padding: 20, borderRadius: 28, alignItems: 'center', marginTop: 10 },
  saveBtnText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 }
});
