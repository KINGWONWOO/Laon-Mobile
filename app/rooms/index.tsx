import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AdBanner from '../../components/ui/AdBanner';
import { Shadows } from '../../constants/theme';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '../../constants/translations';

function formatNotifTime(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (now.toDateString() === d.toDateString()) return hm;
  const yesterday = new Date(now.getTime() - 86400000);
  if (yesterday.toDateString() === d.toDateString()) return `어제 ${hm}`;
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${hm}`;
}

const NOTIF_TYPE_ICON: Record<string, { icon: string; color: string }> = {
  notice_new:     { icon: 'megaphone',           color: '#FF6B6B' },
  notice_comment: { icon: 'chatbubble',          color: '#FF6B6B' },
  video_new:      { icon: 'videocam',            color: '#5E5CE6' },
  video_comment:  { icon: 'chatbubble-ellipses', color: '#5E5CE6' },
  schedule_new:   { icon: 'calendar',            color: '#FF9F43' },
  vote_new:       { icon: 'checkbox',            color: '#A06CD5' },
  archive_new:    { icon: 'images',              color: '#4ECDC4' },
  archive_comment:{ icon: 'chatbubble',          color: '#4ECDC4' },
};


export default function RoomsScreen() {
  const {
    rooms,
    currentUser,
    logout,
    deleteAccount,
    updateUserProfile,
    theme,
    themeType,
    setThemeType,
    customColor,
    setCustomColor,
    customBackgroundColor,
    setCustomBackgroundColor,
    isPro,
    checkProAccess,
    language,
    setLanguage,
    submitFeedback,
    refreshAllData,
    inAppNotifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    t,
  } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newName, setNewName] = useState(currentUser?.name || '');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'other'>('bug');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [bannerHeight, setBannerHeight] = useState(0);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAllData();
    } finally {
      setRefreshing(false);
    }
  };

  const originalTheme = useRef({
    type: themeType,
    primary: customColor,
    bg: customBackgroundColor
  });

  const handleOpenSettings = () => {
    setNewName(currentUser?.name || '');
    setNewImage(null);
    originalTheme.current = {
      type: themeType,
      primary: customColor,
      bg: customBackgroundColor
    };
    setShowProfileModal(true);
  };

  const handleCancel = async () => {
    await setCustomColor(originalTheme.current.primary);
    await setCustomBackgroundColor(originalTheme.current.bg);
    await setThemeType(originalTheme.current.type);
    setShowProfileModal(false);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setNewImage(result.assets[0].uri);
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim()) return Alert.alert(t('error'), t('nameRequired2'));
    setIsUpdating(true);
    try {
      await updateUserProfile(newName, newImage || currentUser?.profileImage);
      setShowProfileModal(false);
      Alert.alert(t('success'), t('profileSaveSuccess'));
    } catch (e: any) {
      Alert.alert(t('failure'), e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('deleteAccount'),
      t('deleteAccountConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('deleteAccountAction'),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUpdating(true);
              await deleteAccount();
            } catch (e: any) {
              Alert.alert(t('error'), t('processingError'));
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackContent.trim()) return Alert.alert(t('notification'), t('feedbackRequired'));
    if (!currentUser?.id) return Alert.alert(t('error'), t('loginRequired'));

    setIsUpdating(true);
    try {
      console.log('[Feedback] Submitting:', { type: feedbackType });
      await submitFeedback(feedbackType, feedbackContent.trim());
      
      setShowFeedbackModal(false);
      setFeedbackContent('');
      setFeedbackType('bug');
      Alert.alert(t('success'), t('feedbackSuccess'));
    } catch (e: any) {
      console.error('[Feedback] Submit error:', e);
      Alert.alert(t('error'), `${t('feedbackError')}\n${e.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateRoom = () => {
    const access = checkProAccess('room_count');
    if (!access.canAccess) {
      return Alert.alert(
        t('roomLimitTitle'),
        `${t('freePlanLimit')} ${access.limit} ${t('roomsLimit')}\n${t('unlimitedRooms')}`,
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('viewMembership'), onPress: () => router.push('/subscription') }
        ]
      );
    }
    router.push('/rooms/create');
  };

  const primaryPresetColors = ['#AEC6CF', '#FFB7B2', '#B2E2F2', '#B19CD9', '#FFDAC1', '#E2F0CB', '#FF9AA2', '#C5E1A5', '#F48FB1', '#90CAF9', '#CE93D8', '#B39DDB'];
  const bgPresetColors = ['#FFFFFF', '#F8FAFC', '#FFF5F5', '#F0F9FF', '#F5F3FF', '#F0FDF4', '#FEFCE8', '#F0FDFA', '#FDF2F8', '#FAF5FF', '#F9FAFB', '#0F172A'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <View style={styles.profileSection}>
          {currentUser?.profileImage ? (
            <Image source={{ uri: currentUser.profileImage }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: theme.primary }]}>
              <Text style={[styles.avatarText, { color: theme.background }]}>{currentUser?.name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.headerTextInfo}>
            <Text style={[styles.welcomeText, { color: theme.textSecondary }]}>{t('welcome')}</Text>
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => router.push('/subscription')}
              style={styles.membershipRow}
            >
              <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>{currentUser?.name}{t('honorific') ? ` ${t('honorific')}` : ''}</Text>
              <View style={[
                styles.tierBadge, 
                { backgroundColor: isPro ? theme.primary : theme.textSecondary + '22' }
              ]}>
                <Text style={[
                  styles.tierText, 
                  { color: isPro ? '#fff' : theme.textSecondary }
                ]}>{isPro ? 'PRO' : 'FREE'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.iconOnlyBtn, { backgroundColor: theme.border + '33', marginRight: 6 }]} onPress={() => setShowNotificationsModal(true)}>
            <Ionicons name="notifications-outline" size={20} color={theme.text} />
            {unreadNotificationCount > 0 && (
              <View style={[styles.notifBadge, { backgroundColor: theme.error }]}>
                <Text style={styles.notifBadgeText}>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconOnlyBtn, { backgroundColor: theme.border + '33', marginRight: 6 }]} onPress={handleOpenSettings}>
            <Ionicons name="settings-outline" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconOnlyBtn, { backgroundColor: theme.error + '22' }]} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={theme.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>{t('myRooms')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={[styles.actionIconButton, { backgroundColor: theme.primary }]} onPress={() => router.push('/rooms/join')}>
            <Ionicons name="enter-outline" size={18} color={theme.background} />
            <Text style={[styles.actionIconText, { color: theme.background }]}>{t('join')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionIconButton, { backgroundColor: theme.primary }]} onPress={handleCreateRoom}>
            <Ionicons name="add" size={20} color={theme.background} />
            <Text style={[styles.actionIconText, { color: theme.background }]}>{t('create')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.roomCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.push(`/room/${item.id}`)}>
            {item.imageUri && item.imageUri.trim() !== '' ? (
              <Image source={{ uri: item.imageUri }} style={styles.roomImage} />
            ) : (
              <View style={[styles.roomImage, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.background, fontSize: 24, fontWeight: 'bold' }}>{item.name[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.roomInfo}>
              <Text style={[styles.roomName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.roomMeta, { color: theme.textSecondary }]}>ID: {item.id.split('-')[0]}...</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color={theme.border} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('noRooms')}</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.feedbackFab, { backgroundColor: theme.primary, bottom: isPro ? 90 : bannerHeight + 12 }]}
        onPress={() => setShowFeedbackModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.background} />
        <Text style={[styles.feedbackFabText, { color: theme.background }]}>{t('feedbackFab')}</Text>
      </TouchableOpacity>

      <Modal visible={showNotificationsModal} animationType="fade" transparent onRequestClose={() => setShowNotificationsModal(false)}>
        <View style={styles.centeredModalOverlay}>
          <View style={[styles.notifDialog, { backgroundColor: theme.card }]}>
            <View style={styles.notifHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.notifTitle, { color: theme.text }]}>{t('notificationsTitle')}</Text>
                {unreadNotificationCount > 0 && (
                  <View style={[styles.notifCountPill, { backgroundColor: theme.error }]}>
                    <Text style={styles.notifCountPillText}>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {unreadNotificationCount > 0 && (
                  <TouchableOpacity onPress={markAllNotificationsRead}>
                    <Text style={[styles.notifMarkAll, { color: theme.primary }]}>{t('markAllRead')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                  <Ionicons name="close" size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            {inAppNotifications.length === 0 ? (
              <View style={styles.notifEmpty}>
                <Ionicons name="notifications-off-outline" size={48} color={theme.border} />
                <Text style={[styles.notifEmptyText, { color: theme.textSecondary }]}>{t('noNotifications')}</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350 }}>
                {inAppNotifications.map(notif => {
                  const meta = NOTIF_TYPE_ICON[notif.type] || { icon: 'notifications', color: theme.primary };
                  return (
                    <TouchableOpacity
                      key={notif.id}
                      style={[styles.notifItem, { opacity: notif.isRead ? 0.55 : 1, borderBottomColor: theme.border }]}
                      activeOpacity={0.75}
                      onPress={() => {
                        markNotificationRead(notif.id);
                        if (notif.targetPath) {
                          setShowNotificationsModal(false);
                          router.push(notif.targetPath as any);
                        }
                      }}
                    >
                      <View style={[styles.notifIconCircle, { backgroundColor: meta.color + '18' }]}>
                        <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[styles.notifRoomName, { color: theme.primary }]} numberOfLines={1}>{notif.roomName}</Text>
                          <Text style={[styles.notifTime, { color: theme.textSecondary }]}>{formatNotifTime(notif.createdAt)}</Text>
                        </View>
                        <Text style={[styles.notifItemTitle, { color: theme.text }]} numberOfLines={1}>{notif.title}</Text>
                        <Text style={[styles.notifItemBody, { color: theme.textSecondary }]} numberOfLines={1}>{notif.body}</Text>
                      </View>
                      {!notif.isRead && <View style={[styles.notifUnreadDot, { backgroundColor: theme.primary }]} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showFeedbackModal} animationType="slide" transparent onRequestClose={() => setShowFeedbackModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.feedbackOverlay}>
          <View style={[styles.feedbackSheet, { backgroundColor: theme.card }]}>
            <View style={styles.feedbackHeader}>
              <Text style={[styles.feedbackTitle, { color: theme.text }]}>{t('feedbackModalTitle')}</Text>
              <TouchableOpacity onPress={() => setShowFeedbackModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.feedbackSubtitle, { color: theme.textSecondary }]}>{t('feedbackTypeLabel')}</Text>
            <View style={styles.feedbackTypeRow}>
              {([
                { key: 'bug', label: t('bugReport') },
                { key: 'feature', label: t('featureRequest') },
                { key: 'other', label: t('otherFeedback') },
              ] as const).map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.feedbackTypeBtn, 
                    { 
                      borderColor: feedbackType === key ? theme.primary : theme.border, 
                      backgroundColor: feedbackType === key ? theme.primary + '18' : 'transparent',
                      minWidth: '30%' 
                    }
                  ]}
                  onPress={() => setFeedbackType(key)}
                >
                  <Text 
                    style={[styles.feedbackTypeBtnText, { color: feedbackType === key ? theme.primary : theme.textSecondary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.feedbackSubtitle, { color: theme.textSecondary, marginTop: 16 }]}>{t('feedbackContentLabel')}</Text>
            <TextInput
              style={[styles.feedbackInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={feedbackContent}
              onChangeText={setFeedbackContent}
              placeholder={t('feedbackPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.feedbackSubmitBtn, { backgroundColor: theme.primary }]}
              onPress={handleSubmitFeedback}
              disabled={isUpdating}
            >
              <Text style={[styles.feedbackSubmitText, { color: theme.background }]}>{t('sendFeedback')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showProfileModal} animationType="slide" transparent onRequestClose={handleCancel}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center', paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderBalance}>
                <Text style={[styles.modalTitleBalance, { color: theme.text }]}>{t('profileAndTheme')}</Text>
                <TouchableOpacity onPress={handleCancel}><Ionicons name="close-circle" size={28} color={theme.textSecondary} /></TouchableOpacity>
              </View>
              <View style={styles.profileSectionBalance}>
                <TouchableOpacity style={styles.avatarPickerBalance} onPress={handlePickImage}>
                  {newImage || currentUser?.profileImage ? (
                    <Image source={{ uri: newImage || currentUser?.profileImage }} style={styles.avatarBalance} />
                  ) : (
                    <View style={[styles.avatarBalance, { backgroundColor: theme.primary }]}><Ionicons name="camera" size={24} color={theme.background} /></View>
                  )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{t('username')}</Text>
                  <TextInput style={[styles.inputBalance, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, borderWidth: 1 }]} value={newName} onChangeText={setNewName} placeholder={t('name')} placeholderTextColor={theme.textSecondary} />
                </View>
              </View>
              <Text style={[styles.sectionTitleBalance, { color: theme.text }]}>{t('primaryColor')}</Text>
              <View style={styles.colorPaletteBalance}>{primaryPresetColors.map((color) => ( <TouchableOpacity key={color} style={[styles.colorOptionBalance, { backgroundColor: color, borderColor: customColor === color ? theme.text : 'transparent' }]} onPress={() => setCustomColor(color)} /> ))}</View>
              <Text style={[styles.sectionTitleBalance, { color: theme.text, marginTop: 10 }]}>{t('bgColor')}</Text>
              <View style={styles.colorPaletteBalance}>{bgPresetColors.map((color) => ( <TouchableOpacity key={color} style={[styles.colorOptionBalance, { backgroundColor: color, borderColor: customBackgroundColor === color ? theme.primary : 'transparent' }]} onPress={() => { setCustomBackgroundColor(color); const isDark = color.toLowerCase().includes('0f17') || color.toLowerCase().includes('1e29') || color.toLowerCase().includes('1c1c') || color.toLowerCase().includes('1212'); setThemeType(isDark ? 'dark' : 'light'); }} /> ))}</View>

              <Text style={[styles.sectionTitleBalance, { color: theme.text, marginTop: 10 }]}>{t('language')}</Text>
              <View style={styles.langPaletteRow}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.langBtn, { borderColor: language === lang ? theme.primary : theme.border, backgroundColor: language === lang ? theme.primary + '18' : 'transparent' }]}
                    onPress={() => setLanguage(lang)}
                  >
                    <Text style={[styles.langBtnText, { color: language === lang ? theme.primary : theme.textSecondary }]}>{LANGUAGE_NAMES[lang]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalBtnsBalance}>
                <TouchableOpacity style={styles.cancelBtnBalance} onPress={handleCancel}><Text style={{ color: theme.textSecondary, fontWeight: 'bold' }}>{t('cancel')}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtnBalance, { backgroundColor: theme.primary }]} onPress={handleUpdateProfile} disabled={isUpdating}>
                  {isUpdating ? <ActivityIndicator color={theme.background} /> : <Text style={{ fontWeight: 'bold', color: theme.background }}>{t('saveChanges')}</Text>}
                </TouchableOpacity>
              </View>

              <View style={styles.policyRow}>
                <TouchableOpacity onPress={() => router.push('/legal/privacy')}>
                  <Text style={[styles.policyText, { color: theme.textSecondary }]}>{t('privacyPolicy')}</Text>
                </TouchableOpacity>
                <Text style={{ color: theme.border, marginHorizontal: 8 }}>|</Text>
                <TouchableOpacity onPress={() => router.push('/legal/terms')}>
                  <Text style={[styles.policyText, { color: theme.textSecondary }]}>{t('termsOfService')}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
                <Text style={styles.deleteAccountText}>{t('deleteAccount')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <View
        style={{ paddingBottom: Math.max(insets.bottom, 15) }}
        onLayout={e => setBannerHeight(e.nativeEvent.layout.height)}
      >
        <AdBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  profileSection: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: { width: 45, height: 45, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: 'bold', fontSize: 18 },
  headerTextInfo: { marginLeft: 12, flex: 1 },
  welcomeText: { fontSize: 12 },
  userName: { fontSize: 16, fontWeight: 'bold', maxWidth: '65%' },
  membershipRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  tierBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
  tierText: { fontSize: 10, fontWeight: '900' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionIconButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
  actionIconText: { fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold' },
  actionBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roomCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1 },
  roomImage: { width: 50, height: 50, borderRadius: 15 },
  roomInfo: { flex: 1, marginLeft: 15 },
  roomName: { fontSize: 16, fontWeight: 'bold' },
  roomMeta: { fontSize: 12, marginTop: 2 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 15, textAlign: 'center', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 24, borderRadius: 32, alignItems: 'center', maxHeight: '92%' },
  modalHeaderBalance: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 24 },
  modalTitleBalance: { fontSize: 20, fontWeight: 'bold' },
  profileSectionBalance: { flexDirection: 'row', width: '100%', alignItems: 'center', gap: 20, marginBottom: 24 },
  avatarPickerBalance: { },
  avatarBalance: { width: 72, height: 72, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  inputLabel: { fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 },
  inputBalance: { width: '100%', padding: 14, borderRadius: 14, fontSize: 16 },
  sectionTitleBalance: { fontSize: 15, fontWeight: 'bold', alignSelf: 'flex-start', marginBottom: 12 },
  colorPaletteBalance: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginBottom: 20 },
  colorOptionBalance: { width: 34, height: 34, borderRadius: 17, margin: 5, borderWidth: 2.5 },
  modalBtnsBalance: { flexDirection: 'row', width: '100%', gap: 12, marginTop: 10 },
  cancelBtnBalance: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)' },
  submitBtnBalance: { flex: 2, padding: 16, borderRadius: 14, alignItems: 'center' },
  policyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  policyText: { fontSize: 13, textDecorationLine: 'underline' },
  deleteAccountBtn: { marginTop: 20, padding: 10 },
  deleteAccountText: { color: '#EF4444', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' },
  langPaletteRow: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginBottom: 20, gap: 8 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5 },
  langBtnText: { fontSize: 12, fontWeight: '700' },
  feedbackFab: { position: 'absolute', right: 24, bottom: 90, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24, gap: 6, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4 },
  feedbackFabText: { fontSize: 13, fontWeight: 'bold' },
  feedbackOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  feedbackSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  feedbackTitle: { fontSize: 18, fontWeight: 'bold' },
  feedbackSubtitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  feedbackTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  feedbackTypeBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', minWidth: '28%' },
  feedbackTypeBtnText: { fontSize: 11, fontWeight: 'bold' },
  feedbackInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 14, height: 120, marginBottom: 16 },
  feedbackSubmitBtn: { padding: 16, borderRadius: 14, alignItems: 'center' },
  feedbackSubmitText: { fontWeight: 'bold', fontSize: 15 },

  iconOnlyBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  centeredModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  notifDialog: { width: '100%', borderRadius: 24, paddingTop: 20, overflow: 'hidden' },
  notifBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  notifCountPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  notifCountPillText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  notifTitle: { fontSize: 18, fontWeight: '800' },
  notifMarkAll: { fontSize: 13, fontWeight: '700' },
  notifEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  notifEmptyText: { marginTop: 12, fontSize: 14 },
  notifItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  notifIconCircle: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  notifRoomName: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  notifItemTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  notifItemBody: { fontSize: 12 },
  notifTime: { fontSize: 11 },
  notifUnreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
});
