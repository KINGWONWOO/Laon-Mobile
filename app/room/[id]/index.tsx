import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Share, Alert, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppContext } from '../../../context/AppContext';
import { DanceButton } from '../../../components/ui/Interactions';
import { Notice, Alarm, ThemeType } from '../../../types';
import { LinkingService } from '../../../services/LinkingService';

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rooms, notices, currentUser, updateUserProfile, addNotice, updateNotice, deleteNotice, getUserById, markNoticeAsViewed, alarms, markAlarmAsViewed, theme, themeType, setThemeType } = useAppContext();
  const router = useRouter();
  const room = rooms.find(r => r.id === id);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showAlarmsModal, setShowAlarmsModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeImages, setNoticeImages] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);

  const [newName, setNewName] = useState(currentUser?.name || '');
  const [newImage, setNewImage] = useState<string | undefined>(currentUser?.profileImage);
  const [expandedReaders, setExpandedReaders] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.name.startsWith('댄서 #')) {
      setShowProfileModal(true);
    }
  }, []);

  const handleShareInvite = () => {
    if (room) {
      LinkingService.shareRoomInvite(room.name, room.id, room.passcode);
    }
  };

  const handleProfileSave = () => {
    if (!newName.trim()) return;
    updateUserProfile(newName, newImage);
    setShowProfileModal(false);
  };

  const handleAddNotice = () => {
    if (!noticeTitle.trim() || !noticeContent.trim() || !id) return;
    if (editingNoticeId) {
      updateNotice(editingNoticeId, noticeTitle, noticeContent, isPinned);
    } else {
      addNotice(id, noticeTitle, noticeContent, isPinned, noticeImages);
    }
    resetNoticeForm();
  };

  const resetNoticeForm = () => {
    setNoticeTitle('');
    setNoticeContent('');
    setNoticeImages([]);
    setIsPinned(false);
    setEditingNoticeId(null);
    setShowNoticeModal(false);
  };

  if (!room) return null;

  const roomNotices = notices.filter(n => n.roomId === id);
  const pinnedNotice = roomNotices.find(n => n.isPinned);
  const recentNotice = roomNotices.filter(n => !n.isPinned).sort((a, b) => b.createdAt - a.createdAt)[0];
  const roomAlarms = alarms.filter(a => a.roomId === id);
  const unreadAlarmsCount = roomAlarms.filter(a => currentUser && !a.viewedBy.includes(currentUser.id)).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Room Header Info */}
        <View style={styles.roomHeader}>
          <Image 
            source={room.imageUri ? { uri: room.imageUri } : require('../../../assets/images/icon.png')} 
            style={styles.roomImage} 
          />
          <View style={styles.roomInfo}>
            <Text style={[styles.roomName, { color: theme.text }]}>{room.name}</Text>
            <TouchableOpacity style={styles.idBadge} onPress={handleShareInvite}>
              <Text style={[styles.idText, { color: theme.primary }]}>팀원 초대하기</Text>
              <Ionicons name="share-social" size={14} color={theme.primary} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.themeBtn} onPress={() => setShowThemeModal(true)}>
            <Ionicons name="color-palette-outline" size={24} color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.alarmBtn} onPress={() => setShowAlarmsModal(true)}>
            <Ionicons name="notifications-outline" size={24} color={theme.text} />
            {unreadAlarmsCount > 0 && <View style={[styles.alarmBadge, { backgroundColor: theme.primary }]}><Text style={styles.alarmBadgeText}>{unreadAlarmsCount}</Text></View>}
          </TouchableOpacity>
        </View>

        {/* Notice Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>공지사항</Text>
            <TouchableOpacity onPress={() => setShowNoticeModal(true)} style={[styles.addNoticeBtn, { backgroundColor: theme.primary }]}>
              <Ionicons name="add-circle" size={18} color={theme.background} />
              <Text style={[styles.addNoticeBtnText, { color: theme.background }]}>공지 추가</Text>
            </TouchableOpacity>
          </View>
          
          {(pinnedNotice || recentNotice) ? (
            <View>
              {pinnedNotice && <NoticeCard notice={pinnedNotice} getUserById={getUserById} theme={theme} isPinned />}
              {recentNotice && <NoticeCard notice={recentNotice} getUserById={getUserById} theme={theme} />}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>등록된 공지사항이 없습니다.</Text>
            </View>
          )}
        </View>

        {/* Menu Grid */}
        <View style={styles.menuGrid}>
          <MenuButton theme={theme} title="피드백 영상" icon="videocam" color="#FF3B30" onPress={() => router.push(`/room/${id}/feedback`)} />
          <MenuButton theme={theme} title="연습 일정" icon="calendar" color="#007AFF" onPress={() => router.push(`/room/${id}/schedule`)} />
          <MenuButton theme={theme} title="투표/의사결정" icon="checkbox" color="#34C759" onPress={() => router.push(`/room/${id}/vote`)} />
          <MenuButton theme={theme} title="아카이브" icon="images" color="#5856D6" onPress={() => router.push(`/room/${id}/archive`)} />
        </View>
      </ScrollView>

      {/* Modals are kept in logic but UI is simplified for the invite demonstration */}
    </View>
  );
}

function NoticeCard({ notice, getUserById, theme, isPinned }: any) {
  const uploader = getUserById(notice.userId);
  return (
    <View style={[styles.noticeCard, { backgroundColor: theme.card, borderColor: isPinned ? theme.primary : theme.border }]}>
      <Text style={[styles.uploaderName, { color: theme.primary }]}>{uploader?.name || '알 수 없음'}</Text>
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
  themeBtn: { marginRight: 15 },
  alarmBtn: { position: 'relative' },
  alarmBadge: { position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  alarmBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  section: { marginBottom: 25 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  addNoticeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  addNoticeBtnText: { fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  noticeCard: { borderRadius: 12, padding: 15, borderWidth: 1, marginBottom: 10 },
  uploaderName: { fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  noticeTitleText: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  noticeText: { fontSize: 14 },
  emptyCard: { borderRadius: 12, padding: 20, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1 },
  emptyText: { },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuButton: { width: '48%', borderRadius: 16, padding: 20, marginBottom: 15, alignItems: 'center', borderWidth: 1 },
  iconContainer: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  menuTitle: { fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
});
