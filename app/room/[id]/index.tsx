import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Share, Alert, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppContext } from '../../../context/AppContext';
import { LinkingService } from '../../../services/LinkingService';

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rooms, notices, currentUser, updateUserProfile, addNotice, updateNotice, deleteNotice, getUserById, theme } = useAppContext();
  const router = useRouter();
  const room = rooms.find(r => r.id === id);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);

  const [newName, setNewName] = useState(currentUser?.name || '');
  const [newImage, setNewImage] = useState<string | undefined>(currentUser?.profileImage);

  const handleShareInvite = () => {
    if (room) LinkingService.shareRoomInvite(room.name, room.id, room.passcode);
  };

  const handleProfileSave = async () => {
    if (!newName.trim()) return;
    await updateUserProfile(newName, newImage);
    setShowProfileModal(false);
  };

  const handleAddNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim() || !id) return;
    if (editingNoticeId) {
      await updateNotice(editingNoticeId, noticeTitle, noticeContent, isPinned);
    } else {
      await addNotice(id, noticeTitle, noticeContent, isPinned);
    }
    resetNoticeForm();
  };

  const resetNoticeForm = () => {
    setNoticeTitle(''); setNoticeContent(''); setIsPinned(false); setEditingNoticeId(null); setShowNoticeModal(false);
  };

  if (!room) return null;

  const roomNotices = notices.filter(n => n.roomId === id);
  const pinnedNotice = roomNotices.find(n => n.isPinned);
  const recentNotice = roomNotices.filter(n => !n.isPinned)[0];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.roomHeader}>
          <Image source={room.imageUri ? { uri: room.imageUri } : require('../../../assets/images/icon.png')} style={styles.roomImage} />
          <View style={styles.roomInfo}>
            <Text style={[styles.roomName, { color: theme.text }]}>{room.name}</Text>
            <TouchableOpacity style={styles.idBadge} onPress={handleShareInvite}>
              <Text style={[styles.idText, { color: theme.primary }]}>팀원 초대하기</Text>
              <Ionicons name="share-social" size={14} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setShowProfileModal(true)}>
            <Ionicons name="person-circle-outline" size={32} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>공지사항</Text>
            <TouchableOpacity onPress={() => setShowNoticeModal(true)} style={[styles.addNoticeBtn, { backgroundColor: theme.primary }]}>
              <Text style={[styles.addNoticeBtnText, { color: theme.background }]}>공지 추가</Text>
            </TouchableOpacity>
          </View>
          {(pinnedNotice || recentNotice) ? (
            <View>
              {pinnedNotice && <NoticeCard notice={pinnedNotice} getUserById={getUserById} theme={theme} isPinned />}
              {recentNotice && <NoticeCard notice={recentNotice} getUserById={getUserById} theme={theme} />}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={{ color: theme.textSecondary }}>등록된 공지가 없습니다.</Text></View>
          )}
        </View>

        <View style={styles.menuGrid}>
          <MenuButton theme={theme} title="피드백 영상" icon="videocam" color="#FF3B30" onPress={() => router.push(`/room/${id}/feedback`)} />
          <MenuButton theme={theme} title="연습 일정" icon="calendar" color="#007AFF" onPress={() => router.push(`/room/${id}/schedule`)} />
          <MenuButton theme={theme} title="투표/의사결정" icon="checkbox" color="#34C759" onPress={() => router.push(`/room/${id}/vote`)} />
          <MenuButton theme={theme} title="아카이브" icon="images" color="#5856D6" onPress={() => router.push(`/room/${id}/archive`)} />
        </View>
      </ScrollView>

      {/* Profile Edit Modal */}
      <Modal visible={showProfileModal} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>프로필 수정</Text>
          <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} value={newName} onChangeText={setNewName} placeholder="이름" />
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleProfileSave}><Text>저장</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setShowProfileModal(false)}><Text style={{ color: theme.textSecondary, marginTop: 20 }}>취소</Text></TouchableOpacity>
        </View>
      </Modal>

      {/* Notice Add Modal */}
      <Modal visible={showNoticeModal} animationType="fade">
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>공지사항 작성</Text>
          <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border }]} value={noticeTitle} onChangeText={setNoticeTitle} placeholder="제목" />
          <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border, height: 100 }]} value={noticeContent} onChangeText={setNoticeContent} placeholder="내용" multiline />
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleAddNotice}><Text>등록</Text></TouchableOpacity>
          <TouchableOpacity onPress={resetNoticeForm}><Text style={{ color: theme.textSecondary, marginTop: 20 }}>취소</Text></TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function NoticeCard({ notice, getUserById, theme, isPinned }: any) {
  return (
    <View style={[styles.noticeCard, { backgroundColor: theme.card, borderColor: isPinned ? theme.primary : theme.border }]}>
      <Text style={[styles.noticeTitleText, { color: theme.text }]}>{notice.title}</Text>
      <Text style={[styles.noticeText, { color: theme.textSecondary }]} numberOfLines={2}>{notice.content}</Text>
    </View>
  );
}

function MenuButton({ title, icon, color, onPress, theme }: any) {
  return (
    <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: color }]}><Ionicons name={icon} size={28} color="#fff" /></View>
      <Text style={[styles.menuTitle, { color: theme.text }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 60 },
  roomHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  roomImage: { width: 60, height: 60, borderRadius: 30, marginRight: 15 },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 22, fontWeight: 'bold' },
  idBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  idText: { fontSize: 13, marginRight: 5, fontWeight: '600' },
  section: { marginBottom: 25 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  addNoticeBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  addNoticeBtnText: { fontSize: 12, fontWeight: 'bold' },
  noticeCard: { borderRadius: 12, padding: 15, borderWidth: 1, marginBottom: 10 },
  noticeTitleText: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  noticeText: { fontSize: 14 },
  emptyCard: { borderRadius: 12, padding: 20, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuButton: { width: '48%', borderRadius: 16, padding: 20, marginBottom: 15, alignItems: 'center', borderWidth: 1 },
  iconContainer: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  menuTitle: { fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 15 },
  saveBtn: { width: '100%', padding: 15, borderRadius: 12, alignItems: 'center' }
});
