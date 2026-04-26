import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export const saveMediaToDevice = async (url: string): Promise<void> => {
  const ext = (url.split('?')[0].split('.').pop() || 'mp4').toLowerCase();
  const filename = `laon_${Date.now()}.${ext}`;
  const localUri = `${FileSystem.cacheDirectory}${filename}`;

  const fileInfo = await FileSystem.getInfoAsync(localUri);
  const uri = fileInfo.exists ? localUri : (await FileSystem.downloadAsync(url, localUri)).uri;

  // expo-media-library로 갤러리에 직접 저장 시도 (dev 빌드에 포함된 경우)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ML = require('expo-media-library');
    const { status } = await ML.requestPermissionsAsync();
    if (status === 'granted') {
      await ML.saveToLibraryAsync(uri);
      return;
    }
    if (status === 'denied') {
      Alert.alert('권한 필요', '갤러리 저장 권한이 필요합니다. 설정에서 허용해주세요.');
      throw new Error('PERMISSION_DENIED');
    }
  } catch (e: any) {
    if (e.message === 'PERMISSION_DENIED') throw e;
    // 네이티브 모듈 미포함 빌드 → 공유 시트 fallback
  }

  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('오류', '이 기기에서는 저장 기능을 사용할 수 없습니다.');
    throw new Error('SHARING_UNAVAILABLE');
  }
  await Sharing.shareAsync(uri);
};
