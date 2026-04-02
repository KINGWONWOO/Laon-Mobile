import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAppContext } from '../../../context/AppContext';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

type Member = {
  id: string;
  name: string;
  profileImage: string | null;
};

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, users, getRoomByIdRemote } = useAppContext();
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMemberIds() {
      try {
        const room = await getRoomByIdRemote(id || '');
        if (room) setLeaderId(room.leader_id);

        // 💡 관계 쿼리 에러를 피하기 위해 ID만 먼저 가져옵니다.
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
    loadMemberIds();
  }, [id]);

  // 💡 캐시된 전체 유저 정보에서 멤버 ID에 해당하는 정보만 필터링
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
      <Text style={[styles.title, { color: theme.text }]}>참여 중인 멤버 ({roomMembers.length})</Text>
      
      <FlatList
        data={roomMembers}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isLeader = item.id === leaderId;
          return (
            <View style={[styles.memberCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {item.profileImage ? (
                <Image source={{ uri: item.profileImage }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                  <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
                  {isLeader && (
                    <View style={[styles.leaderBadge, { backgroundColor: theme.primary }]}>
                      <Ionicons name="star" size={10} color="#000" />
                      <Text style={styles.leaderText}>방장</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{color: '#666', textAlign: 'center', marginTop: 50}}>멤버 정보를 불러오는 중...</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  memberCard: { flexDirection: 'row', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  info: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  leaderBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  leaderText: { fontSize: 10, fontWeight: 'bold', color: '#000', marginLeft: 2 }
});
