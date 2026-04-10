import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useAppContext } from '../../../context/AppContext';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function MembersScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { theme, users, getRoomByIdRemote, getRoomUserProfile } = useAppContext();
  const router = useRouter();
  
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMembers() {
      if (!id) return;
      try {
        const room = await getRoomByIdRemote(id);
        if (room) setLeaderId(room.leader_id);

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>참여 멤버 ({roomMembers.length})</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <FlatList
        data={roomMembers}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isLeader = item.id === leaderId;
          const roomProfile = getRoomUserProfile(id as string, item.id);
          const displayName = roomProfile?.name || item.name;
          const displayImage = roomProfile?.profileImage || item.profileImage;

          return (
            <View style={[styles.memberCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.primary + '22' }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>{displayName[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: theme.text }]}>{displayName}</Text>
                  {isLeader && (
                    <View style={[styles.leaderBadge, { backgroundColor: theme.primary }]}>
                      <Text style={styles.leaderText}>방장</Text>
                    </View>
                  )}
                </View>
                {roomProfile?.name && <Text style={{ color: theme.textSecondary, fontSize: 11 }}>원래 이름: {item.name}</Text>}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{color: '#666', textAlign: 'center', marginTop: 50}}>참여 중인 멤버가 없습니다.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 },
  backBtn: { padding: 5 },
  title: { fontSize: 22, fontWeight: 'bold' },
  memberCard: { flexDirection: 'row', padding: 15, borderRadius: 18, marginBottom: 12, borderWidth: 1, alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  info: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: 'bold', marginRight: 8 },
  leaderBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  leaderText: { fontSize: 11, fontWeight: 'bold', color: '#000' }
});
