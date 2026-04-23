import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming 
} from 'react-native-reanimated';
import { Colors, Shadows } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import SoundService from '../../services/SoundService';

interface ButtonProps {
  onPress: () => void;
  title?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'apple';
  icon?: any;
  soundEffect?: 'tap' | 'success' | 'error' | 'pop';
  loading?: boolean;
}

export const DanceButton = ({
  onPress,
  title,
  children,
  style,
  textStyle,
  variant = 'primary',
  icon,
  soundEffect = 'tap',
  loading = false,
}: ButtonProps) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    SoundService.play(soundEffect);
    scale.value = withSpring(0.92);
    opacity.value = withTiming(0.8, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    opacity.value = withTiming(1, { duration: 100 });
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary': return Colors.primary;
      case 'secondary': return Colors.secondary;
      case 'accent': return Colors.primary; // Accent replaced with primary
      case 'ghost': return 'transparent';
      case 'apple': return '#000000';
      default: return Colors.primary;
    }
  };

  const getTextColor = () => {
    if (variant === 'primary' || variant === 'accent' || variant === 'apple') return '#FFFFFF';
    if (variant === 'ghost') return Colors.textSecondary;
    return Colors.text;
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={loading ? undefined : onPress}
        onPressIn={loading ? undefined : handlePressIn}
        onPressOut={loading ? undefined : handlePressOut}
        style={[
          styles.button,
          { backgroundColor: getBackgroundColor() },
          variant !== 'ghost' && Shadows.soft,
          variant === 'ghost' && styles.ghostBorder,
          loading && styles.disabled,
          style
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={getTextColor()} />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={20} color={getTextColor()} style={styles.icon} />}
            {title ? <Text style={[styles.text, { color: getTextColor() }, textStyle]}>{title}</Text> : children}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

export const StyledBackButton = () => {
  const router = useRouter();
  
  if (!router.canGoBack()) return null;

  return (
    <DanceButton 
      variant="ghost" 
      onPress={() => router.back()} 
      style={styles.backButton}
      soundEffect="pop"
    >
      <Ionicons name="chevron-back" size={24} color={Colors.text} />
    </DanceButton>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBorder: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
  icon: {
    marginRight: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  }
});
