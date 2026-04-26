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
  let ML: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ML = require('expo-media-library');
  } catch (e) {
    console.log('expo-media-library not available');
  }

  if (ML) {
    try {
      const { status } = await ML.requestPermissionsAsync();
      if (status === 'granted') {
        await ML.saveToLibraryAsync(uri);
        Alert.alert('저장 완료', '갤러리에 저장되었습니다.');
        return;
      }
      if (status === 'denied') {
        Alert.alert('권한 필요', '갤러리 저장 권한이 필요합니다. 설정에서 허용해주세요.');
        throw new Error('PERMISSION_DENIED');
      }
    } catch (e: any) {
      if (e.message === 'PERMISSION_DENIED') throw e;
      console.log('Failed to save using expo-media-library:', e.message);
      // fallback to sharing
    }
  }

  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('오류', '이 기기에서는 저장 기능을 사용할 수 없습니다.');
    throw new Error('SHARING_UNAVAILABLE');
  }
  
  Alert.alert(
    '다운로드 방식',
    '갤러리에 직접 저장할 수 없어 공유 시트를 엽니다. "파일에 저장" 또는 "비디오 저장"을 선택해주세요.',
    [{ text: '확인', onPress: () => Sharing.shareAsync(uri) }]
  );
};
