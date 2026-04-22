import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

const isExpoGo = Constants.appOwnership === 'expo';

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'web') return null;

  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    // 💡 Firebase initialization check and safer token fetching
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    token = (await Notifications.getDevicePushTokenAsync()).data;
    console.log('[Push] Device Token:', token);

    // Save to Supabase if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user && token) {
      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);
        
      if (error) console.error('[Push] Error saving token to DB:', error);
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  } catch (err: any) {
    // 💡 Fail silently to avoid breaking the Auth flow
    console.warn('[Push] Registration skipped:', err.message);
    return null;
  }
}
