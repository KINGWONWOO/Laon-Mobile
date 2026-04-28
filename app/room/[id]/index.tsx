import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, Alert, RefreshControl, Image, Platform, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storageService } from '../../../services/storageService';
import { RoomActionBtn, NoticeItem, OptionModal } from '../../../components/ui/RoomComponents';
import { Shadows } from '../../../constants/theme';
import AdBanner from '../../../components/ui/AdBanner';
import { LinkingService } from '../../../services/LinkingService';

export default function RoomMainScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { rooms, currentUser, notices, addNotice, deleteRoom, theme, refreshAllData, updateRoomUserProfile, getRoomUserProfile, updateRoom, t } = useAppContext();
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
  const [showRoomEditModal, setShowRoomEditModal] = useState(false); 
  const [showUserProfileModal, setShowUserProfileModal] = useState(false); 
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'], 
      allowsMultipleSelection: true, 
      quality: 0.7,
      selectionLimit: 5 - selectedImages.length 
    });
    
    if (!result.canceled) {
      const newImages = [...selectedImages, ...result.assets.map(a => a.uri)];
      if (newImages.length > 5) {
        Alert.alert(t('notification'), t('maxImages'));
        setSelectedImages(newImages.slice(0, 5));
      } else {
        setSelectedImages(newImages);
      }
    }
  };

  const handleAddNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) return Alert.alert(t('error'), t('titleAndContentRequired'));
    if (selectedImages.length > 5) return Alert.alert(t('error'), t('maxImages'));
    setIsSubmitting(true);
    try {
      await addNotice(id as string, noticeTitle, noticeContent, false, selectedImages);
      setNoticeTitle(''); setNoticeContent(''); setSelectedImages([]); setShowAddAddNotice(false);
    } catch (e: any) { Alert.alert(t('error'), e.message); } finally { setIsSubmitting(false); }
  };

  const handleUpdateRoomInfo = async () => {
    if (!roomName.trim()) return Alert.alert(t('error'), t('roomNameRequired'));
    setIsUpdating(true);
    try {
      await updateRoom(id as string, roomName, roomImage);
      setShowRoomEditModal(false);
      Alert.alert(t('success'), t('roomUpdateSuccess'));
    } catch (e: any) { Alert.alert(t('failure'), e.message); } finally { setIsUpdating(false); }
  };

  const handleUpdateUserProfile = async () => {
    if (!userNickname.trim()) return Alert.alert(t('error'), t('nameRequired'));
    setIsUpdating(true);
    try {
      await updateRoomUserProfile(id as string, userNickname, userImage);
      setShowUserProfileModal(false);
      Alert.alert(t('success'), t('profileUpdateSuccess'));
    } catch (e: any) { Alert.alert(t('failure'), e.message); } finally { setIsUpdating(false); }
  };

  const handleInvite = async () => {
    try { await LinkingService.shareRoomInvite(room.name, room.id, room.passcode); } catch (error) { Alert.alert(t('error'), t('shareError')); }
  };

  const deleteOptions = [
    { label: t('deleteRoom'), destructive: true, bold: true, onPress: () => {
      deleteRoom(id as string);
      router.replace('/rooms');
    }}
  ];

  const coreActions = [
    { title: t('scheduleMenuTitle'), icon: 'calendar', path: `/room/${id}/schedule`, color: '#FF6B6B', desc: t('scheduleMenuDesc') },
    { title: t('voteMenuTitle'), icon: 'checkbox', path: `/room/${id}/vote`, color: '#A06CD5', desc: t('voteMenuDesc') },
    { title: t('formationMenuTitle'), icon: 'layers', path: `/room/${id}/formation`, color: '#FF9F43', desc: t('formationMenuDesc') },
    { title: t('videoFeedbackMenuTitle'), icon: 'videocam', path: `/room/${id}/feedback`, color: '#5E5CE6', desc: t('videoFeedbackMenuDesc') },
  ];

  const manageActions = [
    { title: t('archiveMenuTitle'), icon: 'images', path: `/room/${id}/archive`, color: '#4ECDC4' },
    { title: t('membersMenuTitle'), icon: 'people', path: `/room/${id}/members`, color: '#45B7D1' }
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.headerHero}>
          {room.imageUri ? (
            <Image source={{ uri: room.imageUri }} style={styles.heroBg} blurRadius={Platform.OS === 'ios' ? 40 : 20} />
          ) : (
            <LinearGradient colors={[theme.primary, theme.primary + '66']} style={styles.heroBg} />
          )}
          <LinearGradient colors={['transparent', theme.background]} style={styles.heroOverlay} />
          
          <View style={[styles.heroContent, { paddingTop: insets.top + 20 }]}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity style={styles.backCircle} onPress={() => router.replace('/rooms')}><Ionicons name="chevron-back" size={24} color="#fff" /></TouchableOpacity>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <TouchableOpacity style={[styles.smallMemberBtn, {backgroundColor: theme.primary, marginRight: 8}]} onPress={() => { setUserNickname(myRoomProfile?.name || currentUser?.name || ''); setUserImage(null); setShowUserProfileModal(true); }}>
                  <Ionicons name="person-circle-outline" size={16} color="#fff" />
                  <Text style={styles.smallMemberText}>{t('profileChange')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallMemberBtn, {backgroundColor: theme.primary + 'CC'}]} onPress={() => router.push(`/room/${id}/members`)}>
                  <Ionicons name="people" size={16} color="#fff" />
                  <Text style={styles.smallMemberText}>{t('memberBtn')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.shareCircle, {marginLeft: 8}]} onPress={handleInvite}><Ionicons name="share-social" size={20} color="#fff" /></TouchableOpacity>
              </View>
            </View>

            <View style={styles.roomBrand}>
              <View style={styles.roomImageWrapper}>
                {room.imageUri ? (
                  <Image source={{ uri: room.imageUri }} style={styles.mainRoomImg} />
                ) : (
                  <View style={[styles.mainRoomImg, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: theme.background, fontSize: 48, fontWeight: 'bold' }}>{room.name[0].toUpperCase()}</Text>
                  </View>
                )}
                {isLeader && (
                  <TouchableOpacity style={[styles.roomSettingsBtn, {backgroundColor: theme.card}]} onPress={() => { setRoomName(room.name); setRoomImage(null); setShowRoomEditModal(true); }}>
                    <Ionicons name="settings" size={16} color={theme.text} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.roomHeroName, {color: theme.text}]}>{room.name}</Text>
              <View style={styles.secureInfoRow}>
                <View style={[styles.idBadgeRow, {backgroundColor: theme.textSecondary + '20', marginRight: 8}]}>
                  <Text style={[styles.idBadgeText, {color: theme.textSecondary}]}>ID: {room.id.slice(0, 8)}...</Text>
                  <TouchableOpacity onPress={() => { Clipboard.setStringAsync(room.id); Alert.alert(t('copyDone'), t('roomIdCopied')); }} style={{marginLeft: 8}}><Ionicons name="copy-outline" size={14} color={theme.textSecondary} /></TouchableOpacity>
                </View>

                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={() => setShowPasscode(!showPasscode)}
                  style={[styles.idBadgeRow, {backgroundColor: theme.textSecondary + '20'}]}
                >
                  <Text style={[styles.idBadgeText, {color: theme.textSecondary, letterSpacing: showPasscode ? 0 : 3}]}>
                    CODE: {showPasscode ? room.passcode : '****'}
                  </Text>
                  <Ionicons name={showPasscode ? "eye-off-outline" : "eye-outline"} size={14} color={theme.textSecondary} style={{marginLeft: 8}} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.mainContent}>
          <View style={styles.noticeHeaderRow}>
            <View>
              <Text style={[styles.sectionLabel, { color: theme.primary }]}>NOTICE</Text>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('notice')}</Text>
            </View>
            <TouchableOpacity style={[styles.addNoticeSmallBtn, {backgroundColor: theme.primary}]} onPress={() => setShowAddAddNotice(true)}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {roomNotices.length > 0 ? roomNotices.slice(0, 3).map(notice => (
            <NoticeItem key={notice.id} notice={notice} theme={theme} onPress={() => router.push(`/room/${id}/notice/${notice.id}`)} />
          )) : (
            <View style={[styles.emptyNoticeBox, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.textSecondary }}>등록된 공지사항이 없습니다.</Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>CORE</Text>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>핵심 기능</Text>
          </View>
          
          <View style={styles.coreGrid}>
            {coreActions.map((item, idx) => (
              <TouchableOpacity key={idx} activeOpacity={0.8} style={[styles.coreCard, { backgroundColor: theme.card }]} onPress={() => router.push(item.path as any)}>
                <View style={[styles.coreIconCircle, { backgroundColor: item.color + '15' }]}><Ionicons name={item.icon as any} size={28} color={item.color} /></View>
                <View style={styles.coreInfo}>
                  <Text style={[styles.coreTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.coreDesc, { color: theme.textSecondary }]}>{item.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.border} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: theme.primary }]}>MANAGE</Text>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>팀 관리</Text>
          </View>
          <View style={styles.gridContainer}>
            {manageActions.map((item, idx) => (
              <TouchableOpacity key={idx} activeOpacity={0.8} style={[styles.gridCard, { backgroundColor: theme.card }]} onPress={() => router.push(item.path as any)}>
                <View style={[styles.gridIconCircle, { backgroundColor: item.color + '15' }]}><Ionicons name={item.icon as any} size={24} color={item.color} /></View>
                <Text style={[styles.gridCardTitle, { color: theme.text }]}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLeader && (
            <TouchableOpacity style={styles.roomDeleteLink} onPress={() => setShowDeleteConfirm(true)}>
              <Text style={styles.roomDeleteText}>방 삭제하기</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <OptionModal visible={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} options={deleteOptions} title="방을 삭제하시겠습니까?" theme={theme} />

      <Modal visible={showRoomEditModal} animationType="fade" transparent onRequestClose={() => setShowRoomEditModal(false)}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.polishedModal, { backgroundColor: theme.card }]}>
            <Text style={[styles.polishedModalTitle, { color: theme.text }]}>방 정보 수정</Text>
            <TouchableOpacity style={styles.avatarPicker} onPress={async () => { const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 }); if(!res.canceled) setRoomImage(res.assets[0].uri); }}>
              <Image source={{ uri: roomImage || room.imageUri || 'https://placeholder.com/150' }} style={styles.avatarLarge} />
              <View style={[styles.avatarCamera, { backgroundColor: theme.primary }]}><Ionicons name="camera" size={16} color="#fff" /></View>
            </TouchableOpacity>
            <TextInput style={[styles.polishedInput, { color: theme.text, backgroundColor: theme.background }]} placeholder="방 이름" placeholderTextColor={theme.textSecondary} value={roomName} onChangeText={setRoomName} />
            <View style={styles.polishedModalBtns}>
              <TouchableOpacity style={styles.polishedCancel} onPress={() => setShowRoomEditModal(false)}><Text style={{color: theme.textSecondary, fontWeight: '700'}}>취소</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.polishedSave, {backgroundColor: theme.primary}]} onPress={handleUpdateRoomInfo} disabled={isUpdating}>
                {isUpdating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{color: '#fff', fontWeight: '800'}}>저장</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showUserProfileModal} animationType="fade" transparent onRequestClose={() => setShowUserProfileModal(false)}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.polishedModal, { backgroundColor: theme.card }]}>
            <Text style={[styles.polishedModalTitle, { color: theme.text }]}>나의 방 프로필 설정</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 }}>
              여기서 설정하는 이름과 사진은{"\n"}
              <Text style={{ color: theme.primary, fontWeight: '700' }}>현재 방({room.name})</Text>에서만 사용됩니다.
            </Text>
            <TouchableOpacity style={styles.avatarPicker} onPress={async () => { const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 }); if(!res.canceled) setUserImage(res.assets[0].uri); }}>
              <Image source={{ uri: userImage || myRoomProfile?.profileImage || currentUser?.profileImage || 'https://placeholder.com/150' }} style={styles.avatarLarge} />
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

      <Modal visible={showAddNotice} animationType="slide" transparent onRequestClose={() => setShowAddAddNotice(false)}>
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>사진 첨부</Text>
                    <Text style={{ color: selectedImages.length >= 5 ? theme.error : theme.textSecondary, fontSize: 13, fontWeight: '700' }}>
                      ({selectedImages.length}/5)
                    </Text>
                  </View>
                  <TouchableOpacity 
                    activeOpacity={0.7} 
                    style={[styles.bigImageAddBtn, { backgroundColor: theme.card, opacity: selectedImages.length >= 5 ? 0.5 : 1 }]} 
                    onPress={handlePickImages}
                    disabled={selectedImages.length >= 5}
                  >
                    <Ionicons name="camera" size={32} color={selectedImages.length >= 5 ? theme.textSecondary : theme.primary} />
                    <Text style={{marginTop: 8, color: theme.textSecondary, fontWeight: '700'}}>
                      {selectedImages.length >= 5 ? '최대 개수 도달' : '사진 추가'}
                    </Text>
                  </TouchableOpacity>
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
      <View style={{ paddingHorizontal: 24 }}>
        <AdBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerHero: { height: 380, position: 'relative' },
  heroBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingBottom: 30 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  userProfileBtn: { width: 40, height: 40, borderRadius: 16, overflow: 'hidden', borderWidth: 2 },
  userAvatarSmall: { width: '100%', height: '100%' },
  smallMemberBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, ...Shadows.soft },
  smallMemberText: { color: '#fff', fontSize: 13, fontWeight: '800', marginLeft: 4 },
  shareCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  roomBrand: { alignItems: 'center' },
  roomImageWrapper: { position: 'relative', marginBottom: 16 },
  mainRoomImg: { width: 110, height: 110, borderRadius: 44, borderWidth: 4, borderColor: '#fff' },
  roomSettingsBtn: { position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },
  roomHeroName: { fontSize: 28, fontWeight: '900', letterSpacing: -1, marginTop: 8 },
  secureInfoRow: { flexDirection: 'row', marginTop: 12 },
  idBadgeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  idBadgeText: { fontSize: 11, fontWeight: '800' },
  mainContent: { paddingHorizontal: 24, marginTop: -20 },
  sectionHeader: { marginTop: 32, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  noticeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 16 },
  addNoticeSmallBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },
  emptyNoticeBox: { padding: 30, borderRadius: 28, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#ddd' },
  coreGrid: { gap: 12 },
  coreCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 28, ...Shadows.soft },
  coreIconCircle: { width: 56, height: 56, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  coreInfo: { flex: 1, marginLeft: 16 },
  coreTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  coreDesc: { fontSize: 12, opacity: 0.7 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCard: { width: '48%', padding: 20, borderRadius: 28, marginBottom: 16, alignItems: 'center', ...Shadows.soft },
  gridIconCircle: { width: 48, height: 48, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  gridCardTitle: { fontSize: 14, fontWeight: '800' },
  roomDeleteLink: { marginTop: 40, alignItems: 'center', paddingBottom: 20 },
  roomDeleteText: { color: '#ff4444', fontSize: 13, fontWeight: '600', opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  addModalMain: { flex: 1, borderTopLeftRadius: 40, borderTopRightRadius: 40, marginTop: 60 },
  modalTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  modalTitleHeader: { fontSize: 17, fontWeight: '800' },
  fancyTitleInput: { fontSize: 24, fontWeight: '900', paddingVertical: 20, letterSpacing: -1 },
  fancyContentInput: { fontSize: 17, minHeight: 200, textAlignVertical: 'top', lineHeight: 26 },
  imagePickerArea: { marginTop: 30, paddingBottom: 50 },
  bigImageAddBtn: { width: '100%', height: 120, borderRadius: 32, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  imageThumbWrapper: { marginRight: 12, position: 'relative', paddingTop: 8, paddingRight: 8 },
  imageThumb: { width: 90, height: 90, borderRadius: 20 },
  removeThumbBtn: { position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,59,48,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 1, ...Shadows.soft },
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
