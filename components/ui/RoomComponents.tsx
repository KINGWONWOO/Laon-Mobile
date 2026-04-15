import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../constants/theme';

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
    style={[styles.actionBtn, { backgroundColor: theme.card }, Shadows.card]} 
    onPress={onPress}
  >
    <View style={[styles.iconCircle, { backgroundColor: item.color + '15' }]}>
      <Ionicons name={item.icon} size={28} color={item.color} />
    </View>
    <View style={styles.actionInfo}>
      <Text style={[styles.actionTitle, { color: theme.text }]}>{item.title}</Text>
      {item.desc && <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>{item.desc}</Text>}
    </View>
    <View style={[styles.chevronCircle, { backgroundColor: theme.background }]}>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} style={{ opacity: 0.5 }} />
    </View>
  </TouchableOpacity>
);

export const NoticeItem = ({ notice, onPress, theme }: any) => {
  const isPinned = notice.isPinned;
  const isNew = !isPinned && (Date.now() - notice.createdAt < 24 * 60 * 60 * 1000);

  return (
    <TouchableOpacity 
      activeOpacity={0.9}
      style={[
        styles.noticeCard, 
        { backgroundColor: theme.card },
        isPinned ? Shadows.glow : Shadows.card,
        isPinned && { borderWidth: 1, borderColor: theme.primary + '30' }
      ]}
      onPress={onPress}
    >
      <View style={styles.noticeMain}>
        <View style={styles.noticeTitleRow}>
          {isPinned && <View style={[styles.pinBadge, { backgroundColor: theme.primary }]}><Ionicons name="pin" size={10} color="#fff" /></View>}
          <Text style={[styles.noticeTitle, { color: theme.text, opacity: isPinned ? 1 : 0.9 }]} numberOfLines={1}>{notice.title}</Text>
          {isNew && (
            <View style={[styles.newBadge, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.newBadgeText, { color: theme.primary }]}>NEW</Text>
            </View>
          )}
        </View>
        <View style={styles.noticeFooter}>
          <Text style={[styles.noticeDate, { color: theme.textSecondary }]}>
            {formatDateFull(notice.createdAt)}
          </Text>
          {notice.imageUrls && notice.imageUrls.length > 0 && (
            <View style={[styles.imageBadge, { backgroundColor: theme.background }]}>
              <Ionicons name="images" size={12} color={theme.textSecondary} />
              <Text style={[styles.imageBadgeText, { color: theme.textSecondary }]}>{notice.imageUrls.length}</Text>
            </View>
          )}
        </View>
      </View>
      {notice.imageUrls && notice.imageUrls[0] ? (
        <Image source={{ uri: notice.imageUrls[0] }} style={styles.noticeThumb} />
      ) : (
        <View style={[styles.noticeIconPlaceholder, { backgroundColor: theme.background }]}>
          <Ionicons name="notifications-outline" size={24} color={theme.textSecondary} style={{ opacity: 0.3 }} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 28, 
    marginBottom: 16,
  },
  iconCircle: { width: 56, height: 56, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 18 },
  actionInfo: { flex: 1, paddingRight: 10 },
  actionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 2, letterSpacing: -0.6 },
  actionDesc: { fontSize: 13, fontWeight: '500', opacity: 0.8 },
  chevronCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  
  noticeCard: { 
    flexDirection: 'row', 
    padding: 16, 
    borderRadius: 28, 
    marginBottom: 14,
    alignItems: 'center'
  },
  noticeMain: { flex: 1, marginRight: 16 },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  pinBadge: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 8, elevation: 2 },
  noticeTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1, letterSpacing: -0.5 },
  newBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  newBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: -0.2 },
  noticeFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  noticeDate: { fontSize: 12, fontWeight: '500', opacity: 0.7 },
  imageBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  imageBadgeText: { fontSize: 11, fontWeight: '700', marginLeft: 4, opacity: 0.8 },
  noticeThumb: { width: 68, height: 68, borderRadius: 22 },
  noticeIconPlaceholder: { width: 68, height: 68, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }
});
