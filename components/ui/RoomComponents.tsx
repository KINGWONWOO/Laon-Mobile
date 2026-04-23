import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../constants/theme';

export const formatDateFull = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
};

export const OptionModal = ({ visible, onClose, options, title, theme }: any) => (
  <Modal visible={visible} transparent animationType="fade">
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback>
          <View style={[styles.optionContent, { backgroundColor: theme.card }]}>
            {title && <Text style={[styles.optionTitle, { color: theme.textSecondary }]}>{title}</Text>}
            <View style={styles.optionsList}>
              {options.map((opt: any, idx: number) => (
                <TouchableOpacity 
                  key={idx} 
                  style={[styles.optionItem, idx === options.length - 1 && { borderBottomWidth: 0 }]} 
                  onPress={() => { opt.onPress(); onClose(); }}
                >
                  <Text style={[styles.optionText, { color: opt.destructive ? '#FF3B30' : theme.text }, opt.bold && { fontWeight: '800' }]}>{opt.label}</Text>
                  {opt.icon && <Ionicons name={opt.icon} size={20} color={opt.destructive ? '#FF3B30' : theme.text} />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.background }]} onPress={onClose}>
              <Text style={[styles.cancelText, { color: theme.text }]}>취소</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
);

export const RoomActionBtn = ({ item, onPress, theme }: any) => (
  <TouchableOpacity 
    activeOpacity={0.85}
    style={[styles.actionBtn, { backgroundColor: theme.card }]} 
    onPress={onPress}
  >
    <View style={[styles.iconWrapper, { backgroundColor: item.color + '10' }]}>
      <Ionicons name={item.icon} size={26} color={item.color} />
    </View>
    <View style={styles.actionInfo}>
      <Text style={[styles.actionTitle, { color: theme.text }]}>{item.title}</Text>
      <Text style={[styles.actionDesc, { color: theme.textSecondary }]} numberOfLines={1}>{item.desc}</Text>
    </View>
    <View style={styles.actionArrow}>
      <Ionicons name="arrow-forward" size={18} color={theme.textSecondary} />
    </View>
  </TouchableOpacity>
);

export const NoticeItem = ({ notice, onPress, theme }: any) => {
  const isPinned = notice.isPinned;
  
  return (
    <TouchableOpacity 
      activeOpacity={0.9}
      style={[
        styles.noticeCard, 
        { backgroundColor: theme.card },
        isPinned && { borderLeftWidth: 4, borderLeftColor: theme.primary }
      ]}
      onPress={onPress}
    >
      <View style={styles.noticeContentWrapper}>
        <View style={styles.noticeHeader}>
          {isPinned && <Ionicons name="bookmark" size={14} color={theme.primary} style={{ marginRight: 6 }} />}
          <Text style={[styles.noticeTitle, { color: theme.text }]} numberOfLines={1}>{notice.title}</Text>
        </View>
        <Text style={[styles.noticeMeta, { color: theme.textSecondary }]}>
          {formatDateFull(notice.createdAt)}
        </Text>
      </View>
      {notice.imageUrls && notice.imageUrls[0] ? (
        <Image source={{ uri: notice.imageUrls[0] }} style={styles.noticeImage} />
      ) : (
        <View style={[styles.noticeIconBox, { backgroundColor: theme.background }]}>
          <Ionicons name="document-text-outline" size={20} color={theme.textSecondary + '50'} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 18, 
    borderRadius: 30, 
    marginBottom: 14,
    ...Shadows.soft
  },
  iconWrapper: { width: 52, height: 52, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 2, letterSpacing: -0.5 },
  actionDesc: { fontSize: 12, opacity: 0.6, fontWeight: '500' },
  actionArrow: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', opacity: 0.3 },
  
  noticeCard: { 
    flexDirection: 'row', 
    padding: 16, 
    borderRadius: 24, 
    marginBottom: 12,
    alignItems: 'center',
    ...Shadows.soft
  },
  noticeContentWrapper: { flex: 1, marginRight: 12 },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  noticeTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  noticeMeta: { fontSize: 11, fontWeight: '500', opacity: 0.8 },
  noticeImage: { width: 56, height: 56, borderRadius: 16 },
  noticeIconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', padding: 20, paddingBottom: 40 },
  optionContent: { borderRadius: 32, padding: 8, overflow: 'hidden', ...Shadows.medium },
  optionTitle: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 16, marginBottom: 8, opacity: 0.6 },
  optionsList: { marginBottom: 8 },
  optionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  optionText: { fontSize: 17, fontWeight: '600' },
  cancelBtn: { padding: 18, borderRadius: 24, alignItems: 'center', marginTop: 8 },
  cancelText: { fontSize: 17, fontWeight: '800' }
});
