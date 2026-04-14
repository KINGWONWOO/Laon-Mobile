import { ThemeType } from "../types";

export const getThemeColors = (theme: ThemeType = 'dark') => {
  switch (theme) {
    case 'light':
      return {
        primary: '#45B7D1', // Sky Blue
        secondary: '#FF007A',
        accent: '#21F3A3',
        background: '#FFFFFF',
        card: '#F5F5F7',
        text: '#1D1D1F',
        textSecondary: '#6E6E73',
        border: '#D2D2D7',
        error: '#FF3B30',
        success: '#34C759',
      };
    case 'pink':
      return {
        primary: '#FF85A1',    // Pastel Pink
        secondary: '#FFB7C5',  // Lighter Pink
        accent: '#A0E7E5',     // Minty Blue
        background: '#FFF5F8', // Very light pink
        card: '#FFFFFF',       // White cards
        text: '#5D4157',       // Dark mauve text
        textSecondary: '#A899A7',
        border: '#FFD1DC',
        error: '#FF6B6B',
        success: '#B2F2BB',
      };
    case 'shiba':
      return {
        primary: '#E69138',    // Shiba Brown
        secondary: '#F1C232',  // Yellowish
        accent: '#8E7CC3',     // Purple accent
        background: '#FDF7F2', // Very light beige
        card: '#FFFFFF',       // White cards
        text: '#44372A',       // Dark brown text
        textSecondary: '#8C735B',
        border: '#EAD1DC',
        error: '#E06666',
        success: '#93C47D',
      };
    case 'dark':
    default:
      return {
        primary: '#7B2CBF',
        secondary: '#FF007A',
        accent: '#21F3A3',
        background: '#0F0E17',
        card: '#1B1927',
        text: '#FFFFFF',
        textSecondary: '#A7A6B4',
        border: '#2D2B3D',
        error: '#FF4D4D',
        success: '#00FA9A',
      };
  }
};

export const Colors = getThemeColors('dark');

export const Shadows = {
  primary: {
    shadowColor: '#7B2CBF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  secondary: {
    shadowColor: '#FF007A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  }
};
