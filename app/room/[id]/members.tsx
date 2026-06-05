import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity, Alert, Modal, TouchableWithoutFeedback } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useAppContext } from '../../../context/AppContext';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../../constants/theme';
import { OptionModal } from '../../../components/ui/RoomComponents';
import AdBanner from '../../../components/ui/AdBanner';

export default function MembersScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { theme, users, getRoomByIdRemote, getRoomDisplayUser, kickMember, currentUser, t } = useAppContext();
  const router = useRouter();

  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [kickingId, setKickingId] = useState<string | null>(null);

  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
  const [showMemberOptions, setShowMemberOptions] = useState(false);
  const [showKickConfirm, setShowKickConfirm] = useState(false);

  useEffect(() => {
    async function loadMembers() {
      if (!id) return;
      try {
        const room = await getRoomByIdRemote(id);
        if (room) setLeaderId(room.leaderId || (room as any).leader_id);

        const { data, error } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', id);

        if (error) throw error;
        setMemberIds(data.map(m => m.user_id));
      } catch (e) {
        console.error('Failed to load member IDs:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadMembers();
  }, [id]);

  const roomMembers = users.filter(u => memberIds.includes(u.id));
  const isLeader = currentUser?.id === leaderId;

  const handleKickConfirmed = async () => {
    if (!selectedMember) return;
    setShowKickConfirm(false);
    setKickingId(selectedMember.id);
    try {
      await kickMember(id as string, selectedMember.id);
      setMemberIds(prev => prev.filter(mid => mid !== selectedMember.id));
    } catch (e: any) {
      Alert.alert('오류', e.message || '강퇴에 실패했습니다.');
    } finally {
      setKickingId(null);
      setSelectedMember(null);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>{t('membersTitle')} ({roomMembers.length})</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={roomMembers}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelf = item.id === currentUser?.id;
          const isItemLeader = item.id === leaderId;
          const displayUser = getRoomDisplayUser(id as string, item.id);
          const displayName = displayUser?.name || item.name;
          const realName = item.name;
          const displayImage = displayUser?.profileImage || item.profileImage;
          const isKicking = kickingId === item.id;
          const canManage = isLeader && !isSelf && !isItemLeader;

          return (
            <View style={[styles.memberCard, { backgroundColor: theme.card }, Shadows.soft]}>
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.primary + '15' }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>{displayName[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: theme.text }]}>{displayName}</Text>
                  {isItemLeader && (
                    <View style={[styles.leaderBadge, { backgroundColor: theme.primary + '15' }]}>
                      <Text style={[styles.leaderText, { color: theme.primary }]}>LEADER</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '500', opacity: 0.6 }}>{t('realName')}: {realName}</Text>
              </View>
              {isSelf ? (
                <View style={[styles.meBadge, { backgroundColor: theme.textSecondary + '10' }]}>
                  <Text style={{ fontSize: 10, color: theme.textSecondary, fontWeight: 'bold' }}>{t('me')}</Text>
                </View>
              ) : canManage ? (
                isKicking ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} style={{ marginLeft: 8 }} />
                ) : (
                  <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => {
                      setSelectedMember({ id: item.id, name: displayName });
                      setShowMemberOptions(true);
                    }}
                  >
                    <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                )
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center', marginTop: 50 }}>{t('noMembers')}</Text>}
      />
      <View style={{ paddingHorizontal: 24 }}>
        <AdBanner />
      </View>

      {/* 멤버 옵션 모달 */}
      <OptionModal
        visible={showMemberOptions}
        onClose={() => setShowMemberOptions(false)}
        title={selectedMember?.name}
        options={[
          {
            label: '강퇴하기',
            icon: 'person-remove-outline',
            destructive: true,
            onPress: () => {
              setShowMemberOptions(false);
              setShowKickConfirm(true);
            },
          },
        ]}
        theme={theme}
        cancelLabel={t('cancel')}
      />

      {/* 강퇴 확인 모달 */}
      <Modal visible={showKickConfirm} transparent animationType="fade" onRequestClose={() => setShowKickConfirm(false)}>
        <TouchableWithoutFeedback onPress={() => setShowKickConfirm(false)}>
          <View style={styles.confirmOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.confirmBox, { backgroundColor: theme.card }]}>
                <View style={[styles.confirmIconWrap, { backgroundColor: '#FF3B30' + '15' }]}>
                  <Ionicons name="person-remove" size={28} color="#FF3B30" />
                </View>
                <Text style={[styles.confirmTitle, { color: theme.text }]}>멤버 강퇴</Text>
                <Text style={[styles.confirmDesc, { color: theme.textSecondary }]}>
                  <Text style={{ color: theme.text, fontWeight: '800' }}>{selectedMember?.name}</Text>
                  {'님을 방에서 강퇴하시겠습니까?\n강퇴된 멤버는 방에 다시 참여할 수 있습니다.'}
                </Text>
                <View style={styles.confirmBtns}>
                  <TouchableOpacity
                    style={[styles.confirmCancelBtn, { backgroundColor: theme.background }]}
                    onPress={() => setShowKickConfirm(false)}
                  >
                    <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 15 }}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmKickBtn}
                    onPress={handleKickConfirmed}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>강퇴</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, paddingTop: 60, borderBottomWidth: 0.5 },
  backBtn: { padding: 5 },
  title: { fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  listContent: { padding: 24 },
  memberCard: { flexDirection: 'row', padding: 18, borderRadius: 28, marginBottom: 16, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 18 },
  avatarText: { fontSize: 22, fontWeight: '900' },
  info: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  name: { fontSize: 17, fontWeight: '800', marginRight: 10, letterSpacing: -0.5 },
  leaderBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  leaderText: { fontSize: 9, fontWeight: '900' },
  meBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  moreBtn: { padding: 6 },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  confirmBox: { width: '100%', borderRadius: 24, padding: 28, alignItems: 'center' },
  confirmIconWrap: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  confirmTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 10 },
  confirmDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  confirmBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  confirmKickBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#FF3B30' },
});
