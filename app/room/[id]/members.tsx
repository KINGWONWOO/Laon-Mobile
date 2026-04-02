import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAppContext } from '../../../context/AppContext';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

type Member = {
  id: string;
  name: string;
  email: string;
  profile_image: string | null;
  joined_at: string;
};

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, getRoomByIdRemote } = useAppContext();
  const [members, setMembers] = useState<Member[]>([]);
  const [leaderId, setLeaderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMembers() {
      try {
        const room = await getRoomByIdRemote(id || '');
        if (room) setLeaderId(room.leader_id);

        const { data, error } = await supabase
          .from('room_members')
          .select('joined_at, profiles(id, name, email, profile_image)')
          .eq('room_id', id);

        if (error) throw error;
        
        if (data) {
          const formatted = data.map((item: any) => ({
            id: item.profiles.id,
            name: item.profiles.name || '알 수 없는 유저',
            email: item.profiles.email,
            profile_image: item.profiles.profile_image,
            joined_at: item.joined_at
          }));
          setMembers(formatted);
        }
      } catch (e) {
        console.error('Failed to load members:', e);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadMembers();
  }, [id]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>참여 중인 멤버 ({members.length})</Text>
      
      <FlatList
        data={members}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isLeader = item.id === leaderId;
          return (
            <View style={[styles.memberCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
              </View>
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
                <Text style={[styles.email, { color: theme.textSecondary }]}>{item.email}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, marginTop: 10 },
  memberCard: { flexDirection: 'row', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  info: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  email: { fontSize: 12 },
  leaderBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  leaderText: { fontSize: 10, fontWeight: 'bold', color: '#000', marginLeft: 2 }
});
