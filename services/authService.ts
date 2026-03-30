import { supabase } from '../lib/supabase';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export const authService = {
  // Email Sign Up
  signUp: async (email: string, password: string, name: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone },
        emailRedirectTo: Linking.createURL('/'),
      },
    });
    return { data, error };
  },

  // Email Login
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  // Social Login (Google, Kakao)
  signInWithSocial: async (provider: 'google' | 'kakao') => {
    // Determine redirect URL based on environment (Expo Go vs Standalone)
    const redirectUrl = Linking.createURL('/');
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false,
      },
    });

    if (data?.url) {
      // Open the browser for authentication
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type === 'success' && result.url) {
        // Handle successful login from URL
        const { params, errorCode } = Linking.parse(result.url);
        if (errorCode) throw new Error(errorCode);
      }
    }

    return { data, error };
  },

  resetPassword: async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL('/reset-password'),
    });
    return { data, error };
  },

  checkEmailAvailable: async (email: string) => {
    const { data } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    return { available: !data };
  },

  signOut: async () => {
    await supabase.auth.signOut();
  }
};
