import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';

const numColumns = 3;
const screenWidth = Dimensions.get('window').width;
const itemSize = screenWidth / numColumns - 10;

export default function ArchiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, addPhoto, getUserById, theme } = useAppContext();
  const [uploading, setUploading] = useState(false);
  
  const roomPhotos = photos
    .filter(p => p.roomId === id)
    .sort((a, b) => b.createdAt - a.createdAt);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setUploading(true);
      try {
        await addPhoto(id, result.assets[0].uri);
      } catch (error: any) {
        Alert.alert('업로드 실패', error.message || '파일 업로드 중 오류가 발생했습니다.');
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity 
        style={[styles.uploadButton, { backgroundColor: theme.primary }]} 
        onPress={pickImage}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={theme.background} />
        ) : (
          <>
            <Ionicons name="camera-outline" size={24} color={theme.background} />
            <Text style={[styles.uploadButtonText, { color: theme.background }]}>사진/영상 업로드</Text>
          </>
        )}
      </TouchableOpacity>

      <FlatList
        data={roomPhotos}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        contentContainerStyle={styles.gridContainer}
        renderItem={({ item }) => (
          <View style={[styles.imageWrapper, { backgroundColor: theme.card }]}>
            <Image source={{ uri: item.photoUrl }} style={styles.image} />
            <View style={styles.uploaderOverlay}>
              <Text style={styles.uploaderText} numberOfLines={1}>
                {getUserById(item.userId)?.name || '알 수 없음'}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSecondary }]}>업로드된 파일이 없습니다. (최대 20개)</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, margin: 15, borderRadius: 12, height: 56 },
  uploadButtonText: { fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  gridContainer: { paddingHorizontal: 5 },
  imageWrapper: { margin: 5, width: itemSize, height: itemSize, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%' },
  uploaderOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 2, paddingHorizontal: 4 },
  uploaderText: { color: '#fff', fontSize: 9, textAlign: 'center' },
  emptyText: { textAlign: 'center', marginTop: 30, width: '100%' },
});
