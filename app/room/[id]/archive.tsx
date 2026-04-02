import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../../../context/AppContext';
import { Colors } from '../../../constants/theme';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;

export default function ArchiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, addPhoto, theme } = useAppContext();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const roomPhotos = photos.filter(p => p.roomId === id);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setIsUploading(true);
      try {
        await addPhoto(id, result.assets[0].uri);
        Alert.alert('업로드 완료', '추억이 저장되었습니다.');
      } catch (error: any) {
        console.error('[Archive] Upload Error:', error);
        Alert.alert('업로드 실패', error.message || '서버와의 통신에 실패했습니다.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <FlatList
        data={roomPhotos}
        keyExtractor={item => item.id}
        numColumns={COLUMN_COUNT}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.photoItem} 
            onPress={() => setSelectedPhoto(item.photoUrl)}
          >
            <Image source={{ uri: item.photoUrl }} style={styles.photo} />
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <TouchableOpacity 
            style={[styles.uploadBox, { borderColor: Colors.primary + '40' }]} 
            onPress={handlePickImage}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="add" size={40} color={Colors.primary} />
                <Text style={{ color: Colors.primary, marginTop: 8, fontWeight: 'bold' }}>새 추억 올리기</Text>
              </>
            )}
          </TouchableOpacity>
        }
        ListEmptyComponent={
          !isUploading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={60} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>아직 등록된 사진이 없습니다.</Text>
            </View>
          ) : null
        }
      />

      <Modal visible={!!selectedPhoto} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.closeBtn} 
            onPress={() => setSelectedPhoto(null)}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {selectedPhoto && (
            <Image 
              source={{ uri: selectedPhoto }} 
              style={styles.fullImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  uploadBox: {
    height: 150,
    margin: 15,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#161622',
  },
  photoItem: { width: ITEM_SIZE, height: ITEM_SIZE, padding: 1 },
  photo: { width: '100%', height: '100%' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: Colors.textSecondary, marginTop: 15, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: '100%', height: '80%' },
});
