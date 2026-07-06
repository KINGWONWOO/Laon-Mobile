import { Platform } from 'react-native';

// AdMob 앱 ID (플랫폼별 상이 — app.json 플러그인 설정과 일치해야 함)
// Android 앱 ID : ca-app-pub-4292623789702109~5725434154
// iOS 앱 ID     : TODO — AdMob 콘솔에서 iOS 앱 별도 등록 후 app.json iosAppId 업데이트

// 광고 단위 ID (플랫폼별)
// Android 배너 ID : ca-app-pub-4292623789702109/3434299429
// iOS 배너 ID     : TODO — AdMob 콘솔에서 iOS 배너 광고 단위 생성 후 아래에 입력
const PROD_BANNER_ANDROID = 'ca-app-pub-4292623789702109/3434299429';
const PROD_BANNER_IOS = 'ca-app-pub-4292623789702109/3434299429'; // iOS 전용 ID로 교체 필요

// Google 공식 테스트 광고 ID (플랫폼별)
const TEST_BANNER_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_BANNER_IOS = 'ca-app-pub-3940256099942544/2934735716';

const TEST_BANNER_ID = Platform.OS === 'ios' ? TEST_BANNER_IOS : TEST_BANNER_ANDROID;
const PROD_BANNER_ID = Platform.OS === 'ios' ? PROD_BANNER_IOS : PROD_BANNER_ANDROID;

export const AD_UNIT_ID = __DEV__ ? TEST_BANNER_ID : PROD_BANNER_ID;
