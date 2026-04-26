import React from 'react';
import { View, Platform, StyleSheet, Text } from 'react-native';
import { AD_UNIT_ID } from '../../constants/Ads';
import { useAppContext } from '../../context/AppContext';

// Native module check
let BannerAd: any = null;
let BannerAdSize: any = null;
let adsLoaded = false;

if (Platform.OS !== 'web') {
  try {
    // 💡 react-native-google-mobile-ads 모듈이 실제로 존재하는지, 
    // 그리고 네이티브 연동이 되어있는지 확인
    const Ads = require('react-native-google-mobile-ads');
    if (Ads && Ads.BannerAd) {
      BannerAd = Ads.BannerAd;
      BannerAdSize = Ads.BannerAdSize;
      adsLoaded = true;
    }
  } catch (e) {
    console.log('[AdBanner] AdMob native module not found');
  }
}

const AdBanner = () => {
  const { isPro } = useAppContext();

  // Pro 이용자이면 광고를 표시하지 않음
  if (isPro) return null;

  // 웹이거나, 네이티브 모듈 로드에 실패했으면 표시하지 않음
  if (Platform.OS === 'web' || !adsLoaded || !BannerAd) {
    if (__DEV__) {
      return (
        <View style={[styles.container, { height: 60, backgroundColor: '#1a1a1a', justifyContent: 'center', marginVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333' }]}>
          <Text style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>
            {Platform.OS === 'web' ? '광고 미지원 (Web)' : '광고 영역 (Native build required)'}
          </Text>
          {!adsLoaded && Platform.OS !== 'web' && (
            <Text style={{ color: '#444', fontSize: 10, textAlign: 'center', marginTop: 4 }}>
              Development build와 npx expo run:android/ios가 필요합니다.
            </Text>
          )}
        </View>
      );
    }
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error: any) => {
          console.warn('[AdBanner] Failed to load:', error);
        }}
        onAdLoaded={() => {
          console.log('[AdBanner] Ad successfully loaded');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 5,
    paddingHorizontal: 24,
  },
});

export default AdBanner;
