import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
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
    style={[styles.actionBtn, { backgroundColor: theme.card, borderColor: theme.border }]} 
    onPress={onPress}
  >
    <View style={[styles.iconCircle, { backgroundColor: item.color + '22' }]}>
      <Ionicons name={item.icon} size={24} color={item.color} />
    </View>
    <View style={styles.actionInfo}>
      <Text style={[styles.actionTitle, { color: theme.text }]}>{item.title}</Text>
      {item.desc && <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>{item.desc}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
  </TouchableOpacity>
);

export const NoticeItem = ({ notice, onPress, theme }: any) => {
  const isPinned = notice.isPinned;
  const isNew = !isPinned && (Date.now() - notice.createdAt < 24 * 60 * 60 * 1000);

  return (
    <TouchableOpacity 
      style={[styles.noticeCard, { backgroundColor: theme.card, borderColor: isPinned ? theme.primary : theme.border, borderWidth: isPinned ? 1.5 : 1 }]}
      onPress={onPress}
    >
      <View style={styles.noticeMain}>
        <View style={styles.noticeTitleRow}>
          {isPinned && <Ionicons name="pin" size={14} color={theme.primary} style={{ marginRight: 6 }} />}
          <Text style={[styles.noticeTitle, { color: theme.text }]} numberOfLines={1}>{notice.title}</Text>
          {isNew && (
            <View style={[styles.newBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.newBadgeText}>LATEST</Text>
            </View>
          )}
        </View>
        <Text style={[styles.noticeContent, { color: theme.textSecondary }]} numberOfLines={2}>{notice.content}</Text>
        <View style={styles.noticeFooter}>
          <Text style={[styles.noticeDate, { color: theme.textSecondary }]}>
            {formatDateFull(notice.createdAt)}
          </Text>
          {notice.imageUrls && notice.imageUrls.length > 0 && (
            <View style={styles.imageBadge}>
              <Ionicons name="images" size={12} color={theme.primary} />
              <Text style={[styles.imageBadgeText, { color: theme.primary }]}>{notice.imageUrls.length}</Text>
            </View>
          )}
        </View>
      </View>
      {notice.imageUrls && notice.imageUrls[0] && (
        <Image source={{ uri: notice.imageUrls[0] }} style={styles.noticeThumb} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  actionDesc: { fontSize: 12 },
  noticeCard: { flexDirection: 'row', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1 },
  noticeMain: { flex: 1, marginRight: 12 },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  noticeTitle: { fontSize: 15, fontWeight: 'bold', flexShrink: 1 },
  newBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  newBadgeText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  noticeContent: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  noticeFooter: { flexDirection: 'row', alignItems: 'center' },
  noticeDate: { fontSize: 11 },
  imageBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 10, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  imageBadgeText: { fontSize: 10, fontWeight: 'bold', marginLeft: 3 },
  noticeThumb: { width: 60, height: 60, borderRadius: 12 }
});
