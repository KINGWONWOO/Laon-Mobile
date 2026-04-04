import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ScrollView, Image, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../../context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NoticeDetailScreen() {
  const { id, noticeId } = useLocalSearchParams<{ id: string, noticeId: string }>();
  const { notices, addNoticeComment, deleteNoticeComment, getUserById, currentUser, theme, deleteNotice } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notice = useMemo(() => notices.find(n => n.id === noticeId), [notices, noticeId]);
  const author = useMemo(() => notice ? getUserById(notice.userId) : null, [notice]);

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

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={[styles.container, { backgroundColor: theme.background }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>공지 상세</Text>
        {(notice.userId === currentUser?.id) ? (
          <TouchableOpacity onPress={handleDeleteNotice} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={24} color={theme.error} />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
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
                <View style={[styles.authorAvatar, { backgroundColor: theme.primary + '22' }]}>
                  <Text style={{ color: theme.primary, fontWeight: 'bold' }}>{author?.name?.[0]}</Text>
                </View>
              )}
              <View>
                <Text style={[styles.authorName, { color: theme.text }]}>{author?.name || '알 수 없음'}</Text>
                <Text style={[styles.dateText, { color: theme.textSecondary }]}>{new Date(notice.createdAt).toLocaleString()}</Text>
              </View>
            </View>

            <Text style={[styles.title, { color: theme.text }]}>{notice.title}</Text>
            <Text style={[styles.content, { color: theme.text }]}>{notice.content}</Text>

            {notice.imageUrls && notice.imageUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                {notice.imageUrls.map((url, idx) => (
                  <Image key={idx} source={{ uri: url }} style={styles.noticeImage} />
                ))}
              </ScrollView>
            )}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Text style={[styles.commentCount, { color: theme.textSecondary }]}>댓글 {notice.comments?.length || 0}</Text>
          </View>
        }
        renderItem={({ item: comment }) => {
          const cAuthor = getUserById(comment.userId);
          return (
            <View style={[styles.commentItem, { borderBottomColor: theme.border + '44' }]}>
              <View style={styles.commentHeader}>
                <Text style={[styles.commentAuthor, { color: theme.text }]}>{cAuthor?.name || '...'}</Text>
                <Text style={[styles.commentDate, { color: theme.textSecondary }]}>{new Date(comment.createdAt).toLocaleDateString()}</Text>
                {comment.userId === currentUser?.id && (
                  <TouchableOpacity onPress={() => deleteNoticeComment(comment.id)}>
                    <Ionicons name="close-outline" size={16} color={theme.error} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.commentText, { color: theme.text }]}>{comment.text}</Text>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 10, backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          placeholder="댓글을 입력하세요..."
          placeholderTextColor="#888"
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendBtn, { backgroundColor: theme.primary }]} 
          onPress={handleAddComment}
          disabled={isSubmitting || !commentText.trim()}
        >
          {isSubmitting ? <ActivityIndicator size="small" color={theme.background} /> : <Ionicons name="send" size={20} color={theme.background} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, borderBottomWidth: 1 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  deleteBtn: { padding: 5 },
  contentSection: { padding: 20 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  authorAvatar: { width: 40, height: 40, borderRadius: 15, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  authorName: { fontSize: 15, fontWeight: 'bold' },
  dateText: { fontSize: 12, marginTop: 2 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15 },
  content: { fontSize: 16, lineHeight: 26, marginBottom: 20 },
  imageScroll: { marginBottom: 20 },
  noticeImage: { width: 200, height: 200, borderRadius: 15, marginRight: 10 },
  divider: { height: 1, width: '100%', marginBottom: 15 },
  commentCount: { fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  commentItem: { paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  commentAuthor: { fontSize: 14, fontWeight: 'bold', marginRight: 10 },
  commentDate: { fontSize: 11, flex: 1 },
  commentText: { fontSize: 14, lineHeight: 20 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 15, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100, marginRight: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }
});
