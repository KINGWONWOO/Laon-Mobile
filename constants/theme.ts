import { ColorSchemeName } from 'react-native';

export const Shadows = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  glow: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  }
};

export const Colors = {
  primary: '#6366F1',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  error: '#EF4444',
  success: '#10B981',
};

export const getThemeColors = (type: string, primary?: string, background?: string) => {
  // Use custom colors if provided, otherwise fallback to defaults
  const finalPrimary = primary || '#6366F1';
  const finalBackground = background || (type === 'dark' ? '#0F172A' : '#F8FAFC');
  
  // Simple heuristic to determine if background is dark
  const isDark = type === 'dark' || (finalBackground.startsWith('#') && parseInt(finalBackground.slice(1, 3), 16) < 100);

  return {
    primary: finalPrimary,
    background: finalBackground,
    card: isDark ? '#1E293B' : '#FFFFFF',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? '#334155' : '#E2E8F0',
    error: '#EF4444',
    success: '#10B981',
    isDark
  };
};
