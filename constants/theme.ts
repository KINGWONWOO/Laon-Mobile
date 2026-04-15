import { Platform } from 'react-native';

export const themeColors = {
  light: {
    primary: '#FF8E9E', // 코랄 핑크
    secondary: '#FFB4C2',
    background: '#FFFFFF',
    card: '#F9F9F9',
    text: '#2D2D2D',
    textSecondary: '#8E8E8E',
    border: '#F0F0F0',
    accent: '#A06CD5',
    error: '#FF5A5F',
    success: '#4ECDC4'
  },
  dark: {
    primary: '#FF8E9E',
    secondary: '#3D3D3D',
    background: '#1A1A1B',
    card: '#262626',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    border: '#333333',
    accent: '#B085F5',
    error: '#FF5A5F',
    success: '#4ECDC4'
  }
};

// 하위 호환성을 위해 Colors 객체 정의 (Light 모드 기준)
export const Colors = themeColors.light;

export const Shadows = {
  soft: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 }
    })
  },
  medium: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16 },
      android: { elevation: 6 }
    })
  }
};

export type ThemeType = 'light' | 'dark' | 'pink' | 'shiba';

export const getThemeColors = (type: ThemeType) => {
  if (type === 'dark') return themeColors.dark;
  return themeColors.light;
};
