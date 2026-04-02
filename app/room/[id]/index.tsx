import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { Colors } from '../../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';

export default function RoomMainScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rooms, currentUser, deleteRoom } = useAppContext();
  const router = useRouter();
  
  const room = rooms.find(r => r.id === id);

  if (!room) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff' }}>방 정보를 불러올 수 없습니다.</Text>
      </View>
    );
  }

  const isLeader = room.leader_id === currentUser?.id;

  const handleDeleteRoom = () => {
    Alert.alert(
      '방 삭제',
      `'${room.name}' 방을 정말 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoom(room.id);
              Alert.alert('삭제 완료', '방이 성공적으로 삭제되었습니다.');
              router.replace('/rooms');
            } catch (error: any) {
              Alert.alert('오류', error.message || '방을 삭제할 수 없습니다.');
            }
          }
        }
      ]
    );
  };

  // 💡 방 ID 복사 함수
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
    { title: '일정 맞추기', icon: 'calendar', path: `/room/${id}/schedule`, color: '#FF6B6B' },
    { title: '연습 투표', icon: 'checkbox', path: `/room/${id}/vote`, color: '#4ECDC4' },
    { title: '영상 피드백', icon: 'videocam', path: `/room/${id}/feedback`, color: '#45B7D1' },
    { title: '팀 아카이브', icon: 'images', path: `/room/${id}/archive`, color: '#F7D794' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <LinearGradient colors={['#1A1A2E', '#0F0F1B']} style={styles.headerCard}>
        <View style={styles.roomInitialCircle}>
          <Text style={styles.roomInitialText}>{room.name[0].toUpperCase()}</Text>
        </View>
        <View style={styles.roomNameRow}>
          <Text style={styles.roomName}>{room.name}</Text>
          {isLeader && (
            <TouchableOpacity onPress={handleDeleteRoom} style={styles.deleteIconBtn}>
              <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* 💡 방 ID 표시 및 복사 버튼 */}
        <TouchableOpacity style={styles.idContainer} onPress={copyRoomId}>
          <Text style={styles.roomIdText} numberOfLines={1}>ID: {room.id}</Text>
          <Ionicons name="copy-outline" size={14} color={Colors.textSecondary} style={{ marginLeft: 5 }} />
        </TouchableOpacity>

        <Text style={styles.roomCode}>비밀번호: {room.passcode}</Text>
        
        <View style={styles.headerActionRow}>
          <TouchableOpacity style={styles.inviteBtn} onPress={handleInvite}>
            <Ionicons name="share-social" size={18} color="#000" />
            <Text style={styles.inviteBtnText}>초대장 보내기</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.grid}>
        {menuItems.map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.gridItem}
            onPress={() => router.push(item.path as any)}
          >
            <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon as any} size={32} color={item.color} />
            </View>
            <Text style={styles.itemTitle}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.noticeSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>팀 공지</Text>
          <TouchableOpacity onPress={() => Alert.alert('준비 중', '공지사항 기능은 곧 업데이트됩니다.')}>
            <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyNotice}>
          <Text style={styles.emptyNoticeText}>등록된 공지사항이 없습니다.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { padding: 20, paddingTop: 40 },
  headerCard: {
    padding: 25,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  roomInitialCircle: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  roomInitialText: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  roomNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  roomName: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  deleteIconBtn: { marginLeft: 10, padding: 5 },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 8,
    maxWidth: '90%',
  },
  roomIdText: { fontSize: 12, color: Colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  roomCode: { fontSize: 14, color: Colors.accent, fontWeight: '600', marginBottom: 20 },
  headerActionRow: { flexDirection: 'row', justifyContent: 'center' },
  inviteBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  inviteBtnText: { color: '#000', fontWeight: 'bold', marginLeft: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: {
    width: '48%',
    backgroundColor: '#161622',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  iconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  itemTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  noticeSection: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptyNotice: {
    backgroundColor: '#161622',
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyNoticeText: { color: Colors.textSecondary, fontSize: 14 },
});
