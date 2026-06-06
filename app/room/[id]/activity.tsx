import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

const ACTIVITY_COLORS: Record<string, string> = {
  notice: '#FF6B6B',
  video: '#5E5CE6',
  schedule: '#FF9F43',
  vote: '#A06CD5',
  archive: '#4ECDC4',
  member_join: '#45B7D1',
  member_leave: '#888',
};

const ACTIVITY_ICONS: Record<string, string> = {
  notice: 'megaphone',
  video: 'videocam',
  schedule: 'calendar',
  vote: 'checkbox',
  archive: 'images',
  member_join: 'person-add',
  member_leave: 'person-remove',
};

export default function ActivityFullListScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { theme, t, language } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);

  const { data: activities = [], isLoading, refetch } = useQuery({
    queryKey: ['room_activity_all', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('room_activity')
        .select('*')
        .eq('room_id', id)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!id,
    staleTime: 0,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    queryClient.invalidateQueries({ queryKey: ['room_activity', id] });
    setRefreshing(false);
  };

  const getSuffix = (type: string): string => {
    const map: Record<string, string> = {
      notice: t('activityNotice'),
      video: t('activityVideo'),
      schedule: t('activitySchedule'),
      vote: t('activityVote'),
      archive: t('activityArchive'),
      member_join: t('activityMemberJoin'),
      member_leave: t('activityMemberLeave'),
    };
    return map[type] || '';
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (now.toDateString() === d.toDateString()) return hm;
    const yesterday = new Date(now.getTime() - 86400000);
    if (yesterday.toDateString() === d.toDateString()) return `어제 ${hm}`;
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${hm}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomWidth: 0.5, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('allActivity')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20, flexGrow: 1 }}
          renderItem={({ item, index }) => {
            const color = ACTIVITY_COLORS[item.type] || theme.primary;
            const icon = ACTIVITY_ICONS[item.type] || 'ellipse';
            return (
              <View
                style={[
                  styles.activityItem,
                  { backgroundColor: theme.card },
                  index < activities.length - 1 && styles.itemSpacing,
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
                  <Ionicons name={icon as any} size={16} color={color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.activityText, { color: theme.text }]} numberOfLines={2}>
                    <Text style={{ fontWeight: '800' }}>{item.actor_name}</Text>
                    {getSuffix(item.type)}
                    {item.content_title
                      ? <Text style={{ color: theme.textSecondary }}>{` '${item.content_title}'`}</Text>
                      : null}
                  </Text>
                </View>
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>{formatTime(item.created_at)}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={64} color={theme.textSecondary} style={{ opacity: 0.2, marginBottom: 16 }} />
              <Text style={{ color: theme.textSecondary, fontSize: 16, fontWeight: '600' }}>{t('noActivity')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  itemSpacing: { marginBottom: 8 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  activityText: { fontSize: 13, lineHeight: 18 },
  timeText: { fontSize: 11, marginLeft: 8, flexShrink: 0 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
});
