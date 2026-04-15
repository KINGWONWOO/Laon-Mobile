import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

const isExpoGo = Constants.appOwnership === 'expo';

let Notifications: any = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');

    if (Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch {
    // Development build이지만 모듈 로드 실패 시 무시
  }
}

/**
 * 푸시 알림을 등록하고 유저의 DB 프로필에 토큰을 저장합니다.
 */
export async function registerForPushNotificationsAsync() {
  if (!Notifications || isExpoGo) return null;
  if (!Device.isDevice) return null;

  // 1. Android 전용 채널 설정
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    } catch {
      // 채널 설정 실패 시 무시
    }
  }

  // 2. 권한 확인 및 요청
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  try {
    // 3. Expo Push Token 가져오기
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    if (!projectId) return null;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // 4. DB에 토큰 저장 (로그인된 상태라면)
    const { data: { user } } = await supabase.auth.getUser();
    if (user && token) {
      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);
        
      if (error) console.error('Error saving push token:', error);
    }

    return token;
  } catch (err) {
    console.warn('Failed to register for push notifications:', err);
    return null;
  }
}
