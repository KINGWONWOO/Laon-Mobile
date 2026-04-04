import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NoticesFullListScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { notices, theme, refreshAllData, getUserById } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const roomNotices = useMemo(() => 
    notices.filter(n => n.roomId === id).sort((a, b) => b.createdAt - a.createdAt), 
    [notices, id]
  );

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
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
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item: notice }) => {
          const author = getUserById(notice.userId);
          return (
            <TouchableOpacity 
              style={[styles.noticeCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(`/room/${id}/notice/${notice.id}`)}
            >
              <View style={styles.noticeHeader}>
                <Text style={[styles.noticeTitle, { color: theme.text }]} numberOfLines={1}>{notice.title}</Text>
                {notice.imageUrls && notice.imageUrls.length > 0 && (
                  <Ionicons name="image" size={16} color={theme.primary} />
                )}
              </View>
              <Text style={[styles.noticeContent, { color: theme.textSecondary }]} numberOfLines={2}>{notice.content}</Text>
              <View style={styles.noticeFooter}>
                <Text style={[styles.noticeAuthor, { color: theme.textSecondary }]}>{author?.name || '...'}</Text>
                <Text style={[styles.noticeDate, { color: theme.textSecondary + '88' }]}>
                  {new Date(notice.createdAt).toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ color: theme.textSecondary }}>등록된 공지사항이 없습니다.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  noticeCard: { padding: 20, borderRadius: 20, marginBottom: 15, borderWidth: 1 },
  noticeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  noticeContent: { fontSize: 14, lineHeight: 20, marginBottom: 15 },
  noticeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noticeAuthor: { fontSize: 12, fontWeight: '600' },
  noticeDate: { fontSize: 11 },
  emptyContainer: { alignItems: 'center', marginTop: 100 }
});
