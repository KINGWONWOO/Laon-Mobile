import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity, Platform } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useAppContext } from '../../../context/AppContext';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../../constants/theme';
import AdBanner from '../../../components/ui/AdBanner';

export default function MembersScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { theme, users, getRoomByIdRemote, getRoomUserProfile, currentUser } = useAppContext();
  const router = useRouter();
  
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

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
        <Text style={[styles.title, { color: theme.text }]}>참여 멤버 ({roomMembers.length})</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <FlatList
        data={roomMembers}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isLeader = item.id === leaderId;
          const roomProfile = getRoomUserProfile(id as string, item.id);
          const displayName = roomProfile?.name || item.name;
          const realName = item.name;
          const displayImage = roomProfile?.profileImage || item.profileImage;

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
                  {isLeader && (
                    <View style={[styles.leaderBadge, { backgroundColor: theme.primary + '15' }]}>
                      <Text style={[styles.leaderText, { color: theme.primary }]}>LEADER</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '500', opacity: 0.6 }}>본명: {realName}</Text>
              </View>
              {item.id === currentUser?.id && (
                <View style={[styles.meBadge, { backgroundColor: theme.textSecondary + '10' }]}>
                  <Text style={{ fontSize: 10, color: theme.textSecondary, fontWeight: 'bold' }}>나</Text>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{color: '#666', textAlign: 'center', marginTop: 50}}>참여 중인 멤버가 없습니다.</Text>}
      />
      <View style={{ paddingHorizontal: 24 }}>
        <AdBanner />
      </View>
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
  meBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }
});
