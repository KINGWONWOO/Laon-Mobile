import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

export async function registerForPushNotificationsAsync(userId: string) {
  console.log('[Push] registerForPushNotificationsAsync called, userId:', userId);

  if (Platform.OS === 'web') {
    console.log('[Push] Skipped: web platform');
    return null;
  }

  if (!Device.isDevice) {
    console.log('[Push] Skipped: not a physical device (simulator/emulator)');
    return null;
  }

  if (!userId) {
    console.error('[Push] ERROR: userId is undefined or empty — token will not be saved');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[Push] Existing permission status:', existingStatus);

    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      console.log('[Push] Requesting permission...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[Push] Permission request result:', status);
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push] Permission not granted — notifications will not work');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    console.log('[Push] Resolved projectId:', projectId);
    if (!projectId) {
      console.error('[Push] ERROR: EAS projectId not found in Constants');
      throw new Error('EAS projectId not found');
    }

    if (Platform.OS === 'android') {
      console.log('[Push] Setting Android notification channel...');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      console.log('[Push] Android channel set');
    }

    console.log('[Push] Fetching Expo push token...');
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log('[Push] Token received:', token);

    console.log('[Push] Saving token to DB for userId:', userId);
    const { data: updateData, error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId)
      .select('id, push_token');

    if (error) {
      console.error('[Push] DB save failed:', JSON.stringify(error));
    } else {
      console.log('[Push] DB save success. Updated row:', updateData);
      if (!updateData || updateData.length === 0) {
        console.warn('[Push] WARNING: update returned 0 rows — userId may not exist in profiles table:', userId);
      }
    }

    return token;
  } catch (err: any) {
    console.error('[Push] Registration threw an error:', err.message, err);
    return null;
  }
}
