import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ScrollView, TextInput, Alert, ActivityIndicator, RefreshControl, Dimensions, KeyboardAvoidingView, Platform, ActionSheetIOS } from 'react-native';
import { Image } from 'expo-image';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import * as ImagePicker from 'expo-image-picker';
import { ensureStandardMP4 } from '../../../utils/convertMP4';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateFull, OptionModal } from '../../../components/ui/RoomComponents';
import { PopoverMenu } from '../../../components/ui/PopoverMenu';
import { Shadows } from '../../../constants/theme';
import AdBanner from '../../../components/ui/AdBanner';
import { saveMediaToDevice } from '../../../services/downloadService';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_MARGIN = 8;
const ITEM_SIZE = (width - 32 - (ITEM_MARGIN * (COLUMN_COUNT + 1))) / COLUMN_COUNT;

export default function ArchiveScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const context = useAppContext();
  const { 
    photos, addPhoto, updatePhoto, deletePhoto, 
    addPhotoComment, updatePhotoComment, deletePhotoComment, 
    theme, currentUser, refreshAllData, getRoomDisplayUser,
    markItemAsAccessed, rooms, checkProAccess, blockUser,
    reportContent, t, language
  } = context;
  const getUser = (userId: string) => getRoomDisplayUser(id as string, userId);
  const isPro = context?.isPro || false;
  const insets = useSafeAreaInsets();

  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [description, setDescription] = useState('');
  const [selectedContent, setSelectedContent] = useState<{ uri: string, type: 'image' | 'video' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Video state
  const isVideoItem = useMemo(() => {
    if (!selectedPhoto) return false;
    return selectedPhoto.photoUrl.toLowerCase().match(/\.(mp4|mov|m4v)$/) || selectedPhoto.description?.includes('[VIDEO]');
  }, [selectedPhoto]);

  const player = useVideoPlayer(isVideoItem ? selectedPhoto.photoUrl : '', p => {
    p.loop = true;
    if (selectedPhoto && isVideoItem) p.play();
  });

  useEffect(() => {
    if (selectedPhoto && isVideoItem && player) {
      player.replace(selectedPhoto.photoUrl);
      player.play();
    }
  }, [selectedPhoto, isVideoItem, player]);

  // Edit states
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editingComment, setEditingComment] = useState<any>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const [isDownloading, setIsDownloading] = useState(false);

  // Option Modal states
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showCommentOptions, setShowCommentOptions] = useState(false);
  const [selectedCommentForModal, setSelectedCommentForModal] = useState<any>(null);
  const [commentMenuAnchor, setCommentMenuAnchor] = useState({ x: 0, y: 0 });

  const roomPhotos = useMemo(() => photos.filter(p => p.roomId === id), [photos, id]);
  const currentRoom = useMemo(() => rooms.find(r => r.id === id), [rooms, id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAllData();
    setRefreshing(false);
  };

  const handlePickContent = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.5,
      allowsEditing: true,
      videoMaxDuration: 60,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'image';
      
      let finalUri = asset.uri;
      if (type === 'video') {
        finalUri = await ensureStandardMP4(asset.uri);
      }

      if (type === 'video' && asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        return Alert.alert(t('videoSizeLimitTitle'), t('videoSizeLimit'));
      }
      setSelectedContent({ uri: finalUri, type });
    }
  };

  const handleUpload = async () => {
    if (!selectedContent || !description.trim()) return;

    const access = checkProAccess('archive_limit');
    if (!access.canAccess && roomPhotos.length >= (access.limit || 20)) {
      return Alert.alert(
        t('archiveLimitExceeded'),
        `${t('archiveLimitMsg')} ${access.limit}${t('archiveLimitSuffix')}`,
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('viewMembership'), onPress: () => router.push('/subscription') }
        ]
      );
    }

    setIsLoading(true);
    try {
      await addPhoto(id || '', selectedContent.uri, description.trim());
      setShowAddModal(false);
      setDescription('');
      setSelectedContent(null);
    } catch (error: any) {
      Alert.alert(t('uploadFailed'), error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedPhoto || !newComment.trim()) return;
    const commentText = newComment.trim();
    setNewComment('');
    
    // Optimistic update
    const tempId = Math.random().toString();
    const optimisticComment = { id: tempId, text: commentText, userId: currentUser?.id, createdAt: new Date().toISOString() };
    const updatedPhoto = { ...selectedPhoto, comments: [...(selectedPhoto.comments || []), optimisticComment] };
    setSelectedPhoto(updatedPhoto);

    try {
      await addPhotoComment(selectedPhoto.id, commentText);
    } catch (e) {
      Alert.alert(t('error'), t('commentError'));
      setSelectedPhoto(selectedPhoto); // Rollback
    }
  };

  const handleUpdatePhoto = async () => {
    if (!selectedPhoto || !editDesc.trim()) return;
    const oldDesc = selectedPhoto.description;
    const newDesc = editDesc.trim();
    setIsEditingPhoto(false);
    
    // Optimistic update
    setSelectedPhoto({ ...selectedPhoto, description: newDesc });

    try {
      await updatePhoto(selectedPhoto.id, newDesc);
    } catch (e) {
      Alert.alert(t('error'), t('descriptionEditError'));
      setSelectedPhoto({ ...selectedPhoto, description: oldDesc });
    }
  };

  const handleDeletePhoto = (photo: any) => {
    Alert.alert(t('deletePhotoTitle'), t('deleteConfirm'), [
      { text: t('cancel') },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        try {
          await deletePhoto(photo.id, photo.photoUrl);
          setSelectedPhoto(null);
        } catch (e) {
          Alert.alert(t('error'), t('deletePhotoError'));
        }
      }}
    ]);
  };

  const handleUpdateComment = async () => {
    if (!editingComment || !editCommentText.trim()) return;
    const cid = editingComment.id;
    const newText = editCommentText.trim();
    const oldText = editingComment.text;
    setEditingComment(null);
    
    // Optimistic update
    const updatedComments = selectedPhoto.comments.map((c: any) => c.id === cid ? { ...c, text: newText } : c);
    setSelectedPhoto({ ...selectedPhoto, comments: updatedComments });

    try {
      await updatePhotoComment(cid, newText);
    } catch (e) {
      Alert.alert(t('error'), t('commentEditError'));
      const rollbackComments = selectedPhoto.comments.map((c: any) => c.id === cid ? { ...c, text: oldText } : c);
      setSelectedPhoto({ ...selectedPhoto, comments: rollbackComments });
    }
  };

  const handleDeleteComment = (cid: string) => {
    Alert.alert(t('deleteCommentTitle'), t('deleteConfirm'), [
      { text: t('cancel') },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        const oldComments = [...selectedPhoto.comments];
        // Optimistic update
        const updatedComments = selectedPhoto.comments.filter((c: any) => c.id !== cid);
        setSelectedPhoto({ ...selectedPhoto, comments: updatedComments });

        try {
          await deletePhotoComment(cid);
        } catch (e) {
          Alert.alert(t('error'), t('deleteCommentError'));
          setSelectedPhoto({ ...selectedPhoto, comments: oldComments });
        }
      }}
    ]);
  };

  const handleDownload = async () => {
    if (!selectedPhoto || isDownloading) return;
    setIsDownloading(true);
    try {
      await saveMediaToDevice(selectedPhoto.photoUrl);
      Alert.alert(t('saveSuccessTitle'), t('saveSuccess'));
    } catch (e: any) {
      if (e.message !== 'PERMISSION_DENIED') Alert.alert(t('saveFailed'), e.message || t('saveError'));
    } finally {
      setIsDownloading(false);
    }
  };

  const isPhotoAuthor = selectedPhoto?.userId === currentUser?.id;
  const isRoomLeader = currentRoom?.leaderId === currentUser?.id;

  const photoOptions = [
    ...(isPhotoAuthor ? [{ label: t('descriptionEdit'), icon: 'create-outline', onPress: () => {
      setEditDesc(selectedPhoto.description || '');
      setIsEditingPhoto(true);
    }}] : []),
    { label: t('delete'), icon: 'trash-outline', destructive: true, onPress: () => handleDeletePhoto(selectedPhoto) }
  ];

  const isCommentAuthor = selectedCommentForModal?.userId === currentUser?.id;
  const commentOptions = [
    ...(isCommentAuthor ? [{ label: t('edit'), icon: 'create-outline', onPress: () => {
      if (!selectedCommentForModal) return;
      setEditingComment(selectedCommentForModal);
      setEditCommentText(selectedCommentForModal.text);
    }}] : []),
    { label: t('delete'), icon: 'trash-outline', destructive: true, onPress: () => {
      if (!selectedCommentForModal) return;
      handleDeleteComment(selectedCommentForModal.id);
    }}
  ];

  const renderItem = ({ item }: { item: any }) => {
    const isVideo = item.photoUrl.toLowerCase().match(/\.(mp4|mov|m4v)$/) || item.description?.includes('[VIDEO]');
    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        style={[styles.gridItem, { backgroundColor: '#000' }, Shadows.soft]} 
        onPress={() => { setSelectedPhoto(item); markItemAsAccessed('photo', item.id); }}
      >
        <Image 
          source={{ uri: item.photoUrl }} 
          style={styles.gridImage} 
          contentFit="cover"
        />
        {isVideo && (
          <View style={styles.videoBadge}>
            <Ionicons name="play" size={16} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={28} color={theme.text} /></TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t('archiveTitle')}</Text>
          <Text style={{fontSize: 10, color: theme.textSecondary, fontWeight: '700'}}>{roomPhotos.length} / {isPro ? '∞' : '20'}</Text>
        </View>
        <TouchableOpacity onPress={() => { setShowAddModal(true); setSelectedContent(null); setDescription(''); }}><Ionicons name="add" size={30} color={theme.primary} /></TouchableOpacity>
      </View>

      <FlatList
        data={roomPhotos}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={COLUMN_COUNT}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        contentContainerStyle={styles.listContent}
      />

      <Modal visible={!!selectedPhoto} animationType="slide" transparent onRequestClose={() => setSelectedPhoto(null)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={[styles.container, { backgroundColor: theme.background }]}
        >
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setSelectedPhoto(null)} style={styles.backBtn}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{t('archiveDetailTitle')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={handleDownload} style={[styles.saveIconBtn, { backgroundColor: theme.primary + '18', borderColor: theme.primary + '44' }]} disabled={isDownloading}>
                {isDownloading
                  ? <ActivityIndicator size="small" color={theme.primary} />
                  : <Ionicons name="download-outline" size={22} color={theme.primary} />}
              </TouchableOpacity>
              {(selectedPhoto?.userId === currentUser?.id || currentRoom?.leaderId === currentUser?.id) && (
                <TouchableOpacity onPress={() => setShowPhotoOptions(true)} style={styles.deleteBtn}>
                  <Ionicons name="ellipsis-vertical" size={24} color={theme.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={selectedPhoto?.comments || []}
            keyExtractor={item => item.id}
            ListHeaderComponent={
              <View style={styles.contentSection}>
                <View style={styles.authorRow}>
                  {(() => {
                    const author = getUser(selectedPhoto?.userId);
                    return author?.profileImage ? (
                      <Image source={{ uri: author.profileImage }} style={styles.authorAvatar} />
                    ) : (
                      <View style={[styles.authorAvatar, { backgroundColor: theme.primary + '15' }]}>
                        <Text style={{ color: theme.primary, fontWeight: '800' }}>{author?.name?.[0] || '?'}</Text>
                      </View>
                    );
                  })()}
                  <View>
                    <Text style={[styles.authorName, { color: theme.text, letterSpacing: -0.5, fontWeight: '800' }]}>{getUser(selectedPhoto?.userId)?.name || t('unknownAuthor')}</Text>
                    <Text style={[styles.dateText, { color: theme.textSecondary, fontWeight: '500', opacity: 0.7 }]}>{selectedPhoto && formatDateFull(selectedPhoto.createdAt, language)}</Text>
                  </View>
                </View>

                <View style={{ width: '100%', height: width * 1.1, backgroundColor: '#000', borderRadius: 28, overflow: 'hidden', ...Shadows.soft }}>
                  {isVideoItem ? (
                    <VideoView style={{ width: '100%', height: '100%' }} player={player} contentFit="contain" />
                  ) : (
                    <Image source={{ uri: selectedPhoto?.photoUrl }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                  )}
                </View>
                
                <Text style={[styles.content, { color: theme.text, marginTop: 20 }]}>{selectedPhoto?.description || t('noDescription')}</Text>

                <View style={[styles.divider, { backgroundColor: theme.border, opacity: 0.5, marginTop: 20 }]} />
                <Text style={[styles.commentCount, { color: theme.text, letterSpacing: -0.5, fontWeight: '800' }]}>{t('commentCountLabel')} {selectedPhoto?.comments?.length || 0}</Text>
              </View>
            }
            renderItem={({ item: comment }) => {
              const cAuthor = getUser(comment.userId);
              const isEditing = editingComment?.id === comment.id;

              return (
                <View style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <Text style={[styles.commentAuthor, { color: theme.text, letterSpacing: -0.5, fontWeight: '800' }]}>{cAuthor?.name || '...'}</Text>
                    <Text style={[styles.commentDate, { color: theme.textSecondary, fontWeight: '500', opacity: 0.7 }]}>{formatDateFull(comment.createdAt, language)}</Text>
                    {(comment.userId === currentUser?.id || isRoomLeader) && !isEditing && (
                      <TouchableOpacity onPress={(e) => {
                        setCommentMenuAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
                        setSelectedCommentForModal(comment);
                        setShowCommentOptions(true);
                      }}>
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
                        <TouchableOpacity onPress={() => setEditingComment(null)}><Text style={{ color: theme.textSecondary, marginRight: 15, fontWeight: '500', opacity: 0.7 }}>{t('cancel')}</Text></TouchableOpacity>
                        <TouchableOpacity onPress={handleUpdateComment}>
                          <Text style={{ color: theme.primary, fontWeight: '800' }}>{t('save')}</Text>
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
            visible={showPhotoOptions}
            onClose={() => setShowPhotoOptions(false)}
            options={photoOptions}
            title={t('archiveSettings')}
            theme={theme}
            cancelLabel={t('cancel')}
          />

          <PopoverMenu
            visible={showCommentOptions}
            onClose={() => { setShowCommentOptions(false); setSelectedCommentForModal(null); }}
            options={commentOptions}
            anchor={commentMenuAnchor}
            theme={theme}
          />

          <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 10, backgroundColor: theme.card }]}>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder={t('enterComment')}
              placeholderTextColor="#888"
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendBtn, { backgroundColor: theme.primary }]} 
              onPress={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit & Add Modals */}
      <Modal visible={isEditingPhoto} transparent animationType="fade" onRequestClose={() => setIsEditingPhoto(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }, Shadows.medium]}>
            <Text style={{color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 20}}>{t('editDescription')}</Text>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]} value={editDesc} onChangeText={setEditDesc} multiline />
            <View style={{flexDirection:'row', justifyContent:'flex-end', marginTop: 10}}>
              <TouchableOpacity onPress={() => setIsEditingPhoto(false)} style={{marginRight: 20, padding: 10}}><Text style={{color: theme.textSecondary, fontWeight: '700'}}>{t('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdatePhoto} style={{padding: 10}}><Text style={{color: theme.primary, fontWeight:'900'}}>{t('edit')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlayUpload}>
          <View style={[styles.modalContentUpload, { backgroundColor: theme.card }]}>
            <Text style={{color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 24, letterSpacing: -0.5}}>{t('archiveUploadTitle')}</Text>
            
            <View style={[styles.uploadPreview, { backgroundColor: '#000', height: 200, justifyContent: 'center', alignItems: 'center', borderRadius: 15, overflow: 'hidden' }]}>
              {selectedContent ? (
                <View style={{position:'relative', width: '100%', height: '100%'}}>
                  <Image source={{ uri: selectedContent.uri }} style={{width:'100%', height:'100%'}} contentFit="contain" />
                  <TouchableOpacity style={styles.removePreview} onPress={() => setSelectedContent(null)}>
                    <Ionicons name="close-circle" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={{ height: 100, width: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, borderRadius: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#888' }} onPress={handlePickContent}>
                  <Ionicons name="cloud-upload" size={32} color={theme.primary} />
                  <Text style={{color: theme.text, marginTop: 8, fontSize: 14, fontWeight:'700'}}>{t('selectPhotoOrVideo')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TextInput 
              style={[styles.titleInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1, marginTop: 20 }]} 
              placeholder={t('archiveDescPlaceholder')}
              placeholderTextColor={theme.textSecondary} 
              value={description} 
              onChangeText={setDescription} 
              multiline 
            />
            
            {isLoading ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : (
              <TouchableOpacity 
                onPress={handleUpload} 
                disabled={!selectedContent || !description.trim()}
                style={[
                  styles.pickBtn, 
                  {backgroundColor: (selectedContent && description.trim()) ? theme.primary : theme.border},
                  Shadows.glow
                ]}
              >
                <Text style={{fontWeight: '800', color: '#fff', fontSize: 16}}>{t('uploadCompleteBtn')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowAddModal(false)} style={{marginTop: 24}}><Text style={{color: theme.textSecondary, textAlign: 'center', fontWeight: '700'}}>{t('cancel')}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <View style={{ paddingHorizontal: 24 }}>
        <AdBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 0.5 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  deleteBtn: { padding: 5 },
  saveIconBtn: { padding: 7, borderRadius: 10, borderWidth: 1, marginRight: 4 },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE * 1.1, margin: ITEM_MARGIN / 2, borderRadius: 20, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  contentSection: { padding: 20 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  authorAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  authorName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.5 },
  dateText: { fontSize: 12, marginTop: 2, fontWeight: '500', opacity: 0.7 },
  detailImage: { width: '100%', height: '100%' },
  content: { fontSize: 16, lineHeight: 26, marginBottom: 20 },
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
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', ...Shadows.soft },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 30 },
  modalContent: { padding: 28, borderRadius: 32 },
  modalOverlayUpload: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentUpload: { padding: 32, borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  titleInput: { borderRadius: 20, padding: 18, marginBottom: 24, fontSize: 16, fontWeight: '600', minHeight: 120, textAlignVertical: 'top' },
  pickBtn: { padding: 20, borderRadius: 24, alignItems: 'center' },
  uploadPreview: { width: '100%', marginBottom: 20, borderRadius: 15, overflow: 'hidden' },
  removePreview: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },
  pickButtonsRow: { flexDirection: 'row', gap: 15 },
  pickTypeBtn: { flex: 1, height: 100, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#888' },
  videoBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 4 }
});
