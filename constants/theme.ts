export const Colors = {
  primary: '#5E5CE6', // Default blue
  background: '#000000',
  card: '#1C1C1E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  border: '#38383A',
  error: '#FF453A',
  success: '#32D74B',
};

export type ThemeType = 'dark' | 'light' | 'pink' | 'custom';

const getContrastColor = (hexcolor: string) => {
  if (!hexcolor) return '#FFFFFF';
  const r = parseInt(hexcolor.slice(1, 3), 16);
  const g = parseInt(hexcolor.slice(3, 5), 16);
  const b = parseInt(hexcolor.slice(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#FFFFFF';
};

export const getThemeColors = (type: ThemeType, customColor?: string, customBgColor?: string) => {
  const primary = customColor || Colors.primary;

  switch (type) {
    case 'light':
      return {
        primary,
        background: '#F2F2F7',
        card: '#FFFFFF',
        text: '#000000',
        textSecondary: '#8E8E93',
        border: '#C6C6C8',
        error: '#FF3B30',
        success: '#34C759',
      };
    case 'pink':
      return {
        primary: '#FF2D55',
        background: '#FFF5F8',
        card: '#FFFFFF',
        text: '#1C1C1E',
        textSecondary: '#8E8E93',
        border: '#FFD1DC',
        error: '#FF3B30',
        success: '#34C759',
      };
    case 'custom':
      const bgColor = customBgColor || '#000000';
      const textColor = getContrastColor(bgColor);
      return {
        primary,
        background: bgColor,
        card: textColor === '#FFFFFF' ? '#1C1C1E' : '#FFFFFF',
        text: textColor,
        textSecondary: textColor === '#FFFFFF' ? '#8E8E93' : '#636366',
        border: textColor === '#FFFFFF' ? '#38383A' : '#C6C6C8',
        error: '#FF453A',
        success: '#32D74B',
      };
    case 'dark':
    default:
      return {
        primary,
        background: '#000000',
        card: '#1C1C1E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
        error: '#FF453A',
        success: '#32D74B',
      };
  }
};

export const Shadows = {
  soft: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  }
};
