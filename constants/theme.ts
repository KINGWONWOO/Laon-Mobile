import { Platform } from 'react-native';

export const themeColors = {
  light: {
    primary: '#FF6B8B',     // 세련된 포인트 코랄-핑크
    secondary: '#FFC4D0',
    background: '#F8F9FA',  // 차가운 흰색이 아닌 아주 미세한 웜톤 밝은 회색
    card: '#FFFFFF',        // 순백색 카드 (배경과 대비되어 떠보이게)
    text: '#1C1C1E',        // 완전한 검은색이 아닌 세련된 다크 그레이
    textSecondary: '#8E8E93', // 애플 스타일의 세컨더리 텍스트
    border: '#E5E5EA',      // 아주 연한 구분선
    accent: '#8A2BE2',      // 고급스러운 딥 라벤더
    error: '#FF3B30',
    success: '#34C759'
  },
  dark: {
    primary: '#FF6B8B',
    secondary: '#5C5C5E',
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#EBEBF5',
    border: '#38383A',
    accent: '#BF5AF2',
    error: '#FF453A',
    success: '#32D74B'
  }
};

export const Colors = themeColors.light;

export const Shadows = {
  soft: {
    ...Platform.select({
      ios: { shadowColor: '#8E8E93', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 3 }
    })
  },
  glow: {
    ...Platform.select({
      ios: { shadowColor: '#FF6B8B', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24 },
      android: { elevation: 8 }
    })
  },
  card: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.04, shadowRadius: 24 },
      android: { elevation: 2 }
    })
  }
};

export type ThemeType = 'light' | 'dark';

export const getThemeColors = (type: ThemeType) => {
  if (type === 'dark') return themeColors.dark;
  return themeColors.light;
};
