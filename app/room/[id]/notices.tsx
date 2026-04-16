import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NoticeItem } from '../../../components/ui/RoomComponents';

export default function NoticesFullListScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { notices, theme, refreshAllData } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);

  const roomNotices = useMemo(() => 
    notices.filter(n => n.roomId === id).sort((a, b) => {
      // Pinned notices first, then by date
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.createdAt - a.createdAt;
    }), 
    [notices, id]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomWidth: 0.5, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>전체 공지사항</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={roomNotices}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}
        renderItem={({ item: notice }) => (
          <NoticeItem 
            notice={notice} 
            theme={theme} 
            onPress={() => router.push(`/room/${id}/notice/${notice.id}`)} 
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={theme.textSecondary} style={{ opacity: 0.2, marginBottom: 16 }} />
            <Text style={{ color: theme.textSecondary, fontSize: 16, fontWeight: '600' }}>등록된 공지사항이 없습니다.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 15, 
    paddingBottom: 15,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  emptyContainer: { alignItems: 'center', marginTop: 140 }
});
