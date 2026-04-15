import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const formatDateFull = (timestamp: number) => {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${y}.${m}.${d} ${h}:${min}`;
};

export const RoomActionBtn = ({ item, onPress, theme }: any) => (
  <TouchableOpacity 
    activeOpacity={0.8}
    style={[styles.actionBtn, { backgroundColor: theme.card, shadowColor: item.color }]} 
    onPress={onPress}
  >
    <View style={[styles.iconCircle, { backgroundColor: item.color + '15' }]}>
      <Ionicons name={item.icon} size={26} color={item.color} />
    </View>
    <View style={styles.actionInfo}>
      <Text style={[styles.actionTitle, { color: theme.text }]}>{item.title}</Text>
      {item.desc && <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>{item.desc}</Text>}
    </View>
    <View style={[styles.chevronCircle, { backgroundColor: theme.border + '50' }]}>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </View>
  </TouchableOpacity>
);

export const NoticeItem = ({ notice, onPress, theme }: any) => {
  const isPinned = notice.isPinned;
  const isNew = !isPinned && (Date.now() - notice.createdAt < 24 * 60 * 60 * 1000);

  return (
    <TouchableOpacity 
      activeOpacity={0.9}
      style={[styles.noticeCard, { backgroundColor: theme.card, borderColor: isPinned ? theme.primary : 'transparent', borderWidth: isPinned ? 1.5 : 0 }]}
      onPress={onPress}
    >
      <View style={styles.noticeMain}>
        <View style={styles.noticeTitleRow}>
          {isPinned && <Ionicons name="pin" size={16} color={theme.primary} style={{ marginRight: 8 }} />}
          <Text style={[styles.noticeTitle, { color: theme.text }]} numberOfLines={1}>{notice.title}</Text>
          {isNew && (
            <View style={[styles.newBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
        <View style={styles.noticeFooter}>
          <Text style={[styles.noticeDate, { color: theme.textSecondary }]}>
            {formatDateFull(notice.createdAt)}
          </Text>
          {notice.imageUrls && notice.imageUrls.length > 0 && (
            <View style={[styles.imageBadge, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="images-outline" size={12} color={theme.primary} />
              <Text style={[styles.imageBadgeText, { color: theme.primary }]}>{notice.imageUrls.length}</Text>
            </View>
          )}
        </View>
      </View>
      {notice.imageUrls && notice.imageUrls[0] ? (
        <Image source={{ uri: notice.imageUrls[0] }} style={styles.noticeThumb} />
      ) : (
        <View style={[styles.noticeIconPlaceholder, { backgroundColor: theme.primary + '10' }]}>
          <Ionicons name="notifications-outline" size={24} color={theme.primary + '50'} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    borderRadius: 28, 
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
      android: { elevation: 4 }
    })
  },
  iconCircle: { width: 56, height: 56, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 18 },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4, letterSpacing: -0.5 },
  actionDesc: { fontSize: 12, opacity: 0.8 },
  chevronCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  
  noticeCard: { 
    flexDirection: 'row', 
    padding: 18, 
    borderRadius: 24, 
    marginBottom: 14,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 }
    })
  },
  noticeMain: { flex: 1, marginRight: 16 },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  noticeTitle: { fontSize: 16, fontWeight: '600', flexShrink: 1, letterSpacing: -0.3 },
  newBadge: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  newBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  noticeFooter: { flexDirection: 'row', alignItems: 'center' },
  noticeDate: { fontSize: 12, fontWeight: '400' },
  imageBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  imageBadgeText: { fontSize: 11, fontWeight: '700', marginLeft: 4 },
  noticeThumb: { width: 64, height: 64, borderRadius: 18 },
  noticeIconPlaceholder: { width: 64, height: 64, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }
});
