export const themeColors = {
  light: {
    primary: '#FF8E9E', // 상큼한 코랄 핑크
    secondary: '#FFB4C2',
    background: '#FFFFFF',
    card: '#F9F9F9',
    text: '#2D2D2D',
    textSecondary: '#8E8E8E',
    border: '#F0F0F0',
    accent: '#A06CD5', // 라벤더 포인트
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
  },
  pink: {
    primary: '#FF748D',
    secondary: '#FFDEE4',
    background: '#FFF5F6',
    card: '#FFFFFF',
    text: '#4A2C2C',
    textSecondary: '#A08585',
    border: '#FFE0E5',
    accent: '#FFB4C2',
    error: '#FF5A5F',
    success: '#4ECDC4'
  },
  shiba: {
    primary: '#F4A460', // 시바견 색상
    secondary: '#FFE4B5',
    background: '#FFF8DC',
    card: '#FFFFFF',
    text: '#5D4037',
    textSecondary: '#A1887F',
    border: '#EEDC82',
    accent: '#8B4513',
    error: '#D32F2F',
    success: '#388E3C'
  }
};

export type ThemeType = keyof typeof themeColors;

export const getThemeColors = (type: ThemeType) => themeColors[type] || themeColors.light;
