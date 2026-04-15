import { Platform } from 'react-native';

export const themeColors = {
  light: {
    primary: '#5E5CE6',     // 세련된 인디고 블루 (전문적인 느낌)
    secondary: '#AFB1FF',
    background: '#FFFFFF',
    card: '#F2F2F7',        // 애플 스타일의 연한 그레이 카드
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#E5E5EA',
    accent: '#FF2D55',      // 대비되는 레드-핑크 포인트
    error: '#FF3B30',
    success: '#34C759'
  },
  dark: {
    primary: '#5E5CE6',
    secondary: '#3A3A3C',
    background: '#000000',
    card: '#1C1C1E',        // 다크모드 카드
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    accent: '#FF2D55',
    error: '#FF453A',
    success: '#32D74B'
  },
  pink: {
    primary: '#FF6B8B',     // 기존 감성 연핑크 테마 유지
    secondary: '#FFDEE4',
    background: '#FFF5F6',
    card: '#FFFFFF',
    text: '#4A2C2C',
    textSecondary: '#A08585',
    border: '#FFE0E5',
    accent: '#FFB4C2',
    error: '#FF5A5F',
    success: '#4ECDC4'
  }
};

export const Colors = themeColors.light;

export const Shadows = {
  soft: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 }
    })
  },
  medium: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20 },
      android: { elevation: 5 }
    })
  },
  card: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.06, shadowRadius: 24 },
      android: { elevation: 3 }
    })
  },
  glow: {
    ...Platform.select({
      ios: { shadowColor: '#5E5CE6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 8 }
    })
  }
};

export type ThemeType = 'light' | 'dark' | 'pink';

export const getThemeColors = (type: ThemeType) => {
  return themeColors[type] || themeColors.light;
};
