import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ScrollView, Image, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull, OptionModal } from '../../../../components/ui/RoomComponents';
import { Modal } from 'react-native';
import { Shadows } from '../../../../constants/theme';

export default function NoticeDetailScreen() {
  const { id, noticeId } = useLocalSearchParams<{ id: string, noticeId: string }>();
  const { notices, addNoticeComment, deleteNoticeComment, updateNoticeComment, updateNotice, getUserById, currentUser, theme, deleteNotice, rooms, blockUser, reportContent, isPro } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit states
  const [showEditNotice, setShowEditNotice] = useState(false);
  const [editNoticeTitle, setEditNoticeTitle] = useState('');
  const [editNoticeContent, setEditNoticeContent] = useState('');
  const [useNotification, setUseNotification] = useState(true);
  const [isUpdatingNotice, setIsUpdatingNotice] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);

  // Option Modal states
  const [showNoticeOptions, setShowNoticeOptions] = useState(false);
  const [showCommentOptions, setShowCommentOptions] = useState(false);
  const [selectedComment, setSelectedComment] = useState<any>(null);

  const notice = useMemo(() => notices.find(n => n.id === noticeId), [notices, noticeId]);
  const author = useMemo(() => notice ? getUserById(notice.userId) : null, [notice]);
  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);

  if (!notice) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.text }}>공지사항을 찾을 수 없습니다.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: theme.primary }}>뒤로 가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setIsSubmitting(true);
    try {
      await addNoticeComment(notice.id, commentText.trim());
      setCommentText('');
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNotice = () => {
    Alert.alert('공지 삭제', '정말 삭제하시겠습니까?', [
      { text: '취소' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await deleteNotice(notice.id);
        router.back();
      }}
    ]);
  };

  const handleUpdateNotice = async () => {
    if (!editNoticeTitle.trim() || !editNoticeContent.trim()) return;
    setIsUpdatingNotice(true);
    try {
      await updateNotice(notice.id, { title: editNoticeTitle.trim(), content: editNoticeContent.trim(), useNotification } as any);
      setShowEditNotice(false);
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setIsUpdatingNotice(false);
    }
  };

  const handleUpdateComment = async () => {
    if (!editCommentText.trim() || !editingCommentId) return;
    setIsUpdatingComment(true);
    try {
      await updateNoticeComment(editingCommentId, editCommentText.trim());
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setIsUpdatingComment(false);
    }
  };

  const noticeOptions = notice?.userId === currentUser?.id || currentRoom?.leaderId === currentUser?.id ? [
    { label: notice.isPinned ? '고정 해제' : '상단 고정', icon: 'pin-outline', onPress: async () => {
      try { await updateNotice(notice.id, { isPinned: !notice.isPinned }); } catch (e: any) { Alert.alert('오류', e.message); }
    }},
    { label: '제목/내용 수정', icon: 'create-outline', onPress: () => {
      setEditNoticeTitle(notice.title);
      setEditNoticeContent(notice.content);
      setUseNotification(notice.useNotification !== false);
      setShowEditNotice(true);
    }},
    { label: '삭제', icon: 'trash-outline', destructive: true, onPress: handleDeleteNotice }
  ] : [
    { label: '신고하기', icon: 'warning-outline', destructive: true, onPress: () => reportContent(notice.id, 'notice') },
    { label: '작성자 차단', icon: 'ban-outline', destructive: true, onPress: () => blockUser(notice.userId) }
  ];

  const commentOptions = selectedComment?.userId === currentUser?.id || currentRoom?.leaderId === currentUser?.id ? [
    { label: '수정', icon: 'create-outline', onPress: () => {
      if (!selectedComment) return;
      setEditingCommentId(selectedComment.id);
      setEditCommentText(selectedComment.text);
    }},
    { label: '삭제', icon: 'trash-outline', destructive: true, onPress: () => {
      if (!selectedComment) return;
      Alert.alert('댓글 삭제', '정말 삭제하시겠습니까?', [
        { text: '취소' },
        { text: '삭제', style: 'destructive', onPress: () => deleteNoticeComment(selectedComment.id) }
      ]);
    }}
  ] : [
    { label: '신고하기', icon: 'warning-outline', destructive: true, onPress: () => { if(selectedComment) reportContent(selectedComment.id, 'notice_comment'); } },
    { label: '작성자 차단', icon: 'ban-outline', destructive: true, onPress: () => { if(selectedComment) blockUser(selectedComment.userId); } }
  ];

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={[styles.container, { backgroundColor: theme.background }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>공지 상세</Text>
        <TouchableOpacity onPress={() => setShowNoticeOptions(true)} style={styles.deleteBtn}>
          <Ionicons name="ellipsis-vertical" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={notice.comments || []}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <View style={styles.contentSection}>
            <View style={styles.authorRow}>
              {author?.profileImage ? (
                <Image source={{ uri: author.profileImage }} style={styles.authorAvatar} />
              ) : (
                <View style={[styles.authorAvatar, { backgroundColor: theme.primary + '15' }]}>
                  <Text style={{ color: theme.primary, fontWeight: '800' }}>{author?.name?.[0]}</Text>
                </View>
              )}
              <View>
                <Text style={[styles.authorName, { color: theme.text, letterSpacing: -0.5, fontWeight: '800' }]}>{author?.name || '알 수 없음'}</Text>
                <Text style={[styles.dateText, { color: theme.textSecondary, fontWeight: '500', opacity: 0.7 }]}>{formatDateFull(notice.createdAt)}</Text>
              </View>
            </View>

            <View style={styles.titleRow}>
              {notice.isPinned && <Ionicons name="pin" size={16} color={theme.primary} style={{ marginRight: 6 }} />}
              <Text style={[styles.title, { color: theme.text, flex: 1, letterSpacing: -0.5, fontWeight: '800' }]}>{notice.title}</Text>
            </View>
            <Text style={[styles.content, { color: theme.text }]}>{notice.content}</Text>

            {notice.imageUrls && notice.imageUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                {notice.imageUrls.map((url, idx) => (
                  <Image key={idx} source={{ uri: url }} style={styles.noticeImage} />
                ))}
              </ScrollView>
            )}

            <View style={[styles.divider, { backgroundColor: theme.border, opacity: 0.5 }]} />
            <Text style={[styles.commentCount, { color: theme.text, letterSpacing: -0.5, fontWeight: '800' }]}>댓글 {notice.comments?.length || 0}</Text>
          </View>
        }
        renderItem={({ item: comment }) => {
          const cAuthor = getUserById(comment.userId);
          const isEditing = editingCommentId === comment.id;

          return (
            <View style={styles.commentItem}>
              <View style={styles.commentHeader}>
                <Text style={[styles.commentAuthor, { color: theme.text, letterSpacing: -0.5, fontWeight: '800' }]}>{cAuthor?.name || '...'}</Text>
                <Text style={[styles.commentDate, { color: theme.textSecondary, fontWeight: '500', opacity: 0.7 }]}>{formatDateFull(comment.createdAt)}</Text>
                {!isEditing && (
                  <TouchableOpacity onPress={() => { setSelectedComment(comment); setShowCommentOptions(true); }}>
                    <Ionicons name="ellipsis-horizontal" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {isEditing ? (
                <View style={styles.commentEditBox}>
                  <TextInput
                    style={[styles.commentEditInput, { color: theme.text, backgroundColor: theme.background }]}
                    value={editCommentText}
                    onChangeText={setEditCommentText}
                    multiline
                    autoFocus
                  />
                  <View style={styles.commentEditBtns}>
                    <TouchableOpacity onPress={() => setEditingCommentId(null)}><Text style={{ color: theme.textSecondary, marginRight: 15, fontWeight: '500', opacity: 0.7 }}>취소</Text></TouchableOpacity>
                    <TouchableOpacity onPress={handleUpdateComment} disabled={isUpdatingComment}>
                      {isUpdatingComment ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={{ color: theme.primary, fontWeight: '800' }}>저장</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={[styles.commentText, { color: theme.text }]}>{comment.text}</Text>
              )}
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <OptionModal 
        visible={showNoticeOptions} 
        onClose={() => setShowNoticeOptions(false)} 
        options={noticeOptions} 
        title="공지 설정" 
        theme={theme} 
      />

      <OptionModal 
        visible={showCommentOptions} 
        onClose={() => { setShowCommentOptions(false); setSelectedComment(null); }} 
        options={commentOptions} 
        title="댓글 설정" 
        theme={theme} 
      />

      <Modal visible={showEditNotice} transparent animationType="slide" onRequestClose={() => setShowEditNotice(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text, letterSpacing: -0.5, fontWeight: '800' }]}>공지 수정</Text>
              <TouchableOpacity onPress={() => setShowEditNotice(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background, marginBottom: 15 }]} placeholder="공지 제목" placeholderTextColor={theme.textSecondary} value={editNoticeTitle} onChangeText={setEditNoticeTitle} />
              <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top', color: theme.text, backgroundColor: theme.background, marginBottom: 20 }]} placeholder="공지 내용" placeholderTextColor={theme.textSecondary} multiline numberOfLines={5} value={editNoticeContent} onChangeText={setEditNoticeContent} />
              <View style={[styles.settingItem, {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}]}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>푸시 알림 전송</Text>
                <Switch value={useNotification} onValueChange={setUseNotification} trackColor={{ true: theme.primary }} thumbColor="#fff" />
              </View>
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.primary }]} onPress={handleUpdateNotice} disabled={isUpdatingNotice}>
                {isUpdatingNotice ? <ActivityIndicator size="small" color={theme.background} /> : <Text style={[styles.submitBtnText, { color: theme.background }]}>수정 완료</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 10, backgroundColor: theme.card }]}>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
          placeholder="댓글을 입력하세요..."
          placeholderTextColor="#888"
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendBtn, { backgroundColor: theme.primary }]} 
          onPress={handleAddComment}
          disabled={!commentText.trim()}
        >
          <Ionicons name="send" size={20} color={theme.background} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center', letterSpacing: -0.5 },
  deleteBtn: { padding: 5 },
  contentSection: { padding: 20 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  authorAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  authorName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.5 },
  dateText: { fontSize: 12, marginTop: 2, fontWeight: '500', opacity: 0.7 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  content: { fontSize: 16, lineHeight: 26, marginBottom: 20 },
  imageScroll: { marginBottom: 20 },
  noticeImage: { width: 200, height: 200, borderRadius: 28, marginRight: 12, ...Shadows.soft },
  divider: { height: 1, width: '100%', marginBottom: 15 },
  commentCount: { fontSize: 14, fontWeight: '800', marginBottom: 15, letterSpacing: -0.5 },
  commentItem: { paddingVertical: 15, paddingHorizontal: 20 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  commentAuthor: { fontSize: 14, fontWeight: '800', marginRight: 10, letterSpacing: -0.5 },
  commentDate: { fontSize: 11, flex: 1, fontWeight: '500', opacity: 0.7 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentEditBox: { marginTop: 5 },
  commentEditInput: { borderRadius: 20, padding: 12, fontSize: 14, minHeight: 60, textAlignVertical: 'top', ...Shadows.soft },
  commentEditBtns: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, alignItems: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, maxHeight: 100, marginRight: 10, ...Shadows.soft },
  sendBtn: { width: 44, height: 44, borderRadius: 999, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '90%', ...Shadows.card },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  submitBtn: { padding: 15, borderRadius: 28, alignItems: 'center', marginTop: 10, ...Shadows.soft },
  submitBtnText: { fontWeight: '800', letterSpacing: -0.5 },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});
