import { Platform } from 'react-native';

// Native version
export const initAds = async () => {
  if (Platform.OS === 'web') return;

  try {
    const mobileAds = require('react-native-google-mobile-ads').default;
    await mobileAds().initialize();
    console.log('[AdMob] Initialization complete!');
  } catch (e) {
    console.log('[AdMob] Not available in this environment');
  }
};
