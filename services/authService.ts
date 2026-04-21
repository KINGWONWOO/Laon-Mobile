import { supabase } from '../lib/supabase';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform, Alert } from 'react-native';

if (typeof window !== 'undefined') {
  WebBrowser.maybeCompleteAuthSession();
}

export const authService = {
  signInWithSocial: async (provider: 'google' | 'kakao') => {
    try {
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'laondancefeedback',
        path: 'auth/callback',
      });
      
      console.log(`[Auth] Starting ${provider} login. Redirect: ${redirectTo}`);

      const options: any = {
        redirectTo,
        skipBrowserRedirect: true,
      };

      if (provider === 'kakao') {
        options.queryParams = { scope: 'profile_nickname,account_email' };
      }

      if (provider === 'google') {
        options.queryParams = { prompt: 'select_account', access_type: 'offline' };
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });

      if (error) throw error;
      if (!data?.url) throw new Error('인증 URL 생성 실패');

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success' && res.url) {
        console.log('[Auth] Browser success, URL:', res.url);
        
        // 💡 PKCE Flow: exchangeCodeForSession
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(res.url);
        
        if (sessionError) {
          console.warn('[Auth] PKCE exchange error, trying manual parse...', sessionError.message);
          
          // Fallback: Manual parse for tokens
          const urlObj = new URL(res.url.replace('#', '?'));
          const access_token = urlObj.searchParams.get('access_token');
          const refresh_token = urlObj.searchParams.get('refresh_token');
          
          if (access_token) {
            const { data: setRes, error: setErr } = await supabase.auth.setSession({ 
              access_token, 
              refresh_token: refresh_token || '' 
            });
            if (setErr) throw setErr;
            return { data: setRes, error: null };
          }
          throw sessionError;
        }
        
        return { data: sessionData, error: null };
      }

      console.log('[Auth] Browser session ended or cancelled:', res.type);
      return { data: null, error: null };
    } catch (err: any) {
      console.error(`[Auth] ${provider} Fatal Error:`, err);
      return { data: null, error: err };
    }
  },

  signInWithGoogle: async () => authService.signInWithSocial('google'),
  signInWithKakao: async () => authService.signInWithSocial('kakao'),

  signInWithApple: async () => {
    if (Platform.OS !== 'ios') return { data: null, error: new Error('Apple 로그인은 iOS만 지원됩니다.') };
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple 토큰 없음');
      return await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return { data: null, error: null };
      return { data: null, error: e };
    }
  },

  signIn: async (email: string, password: string) => supabase.auth.signInWithPassword({ email, password }),

  sendVerificationCode: async (email: string) => {
    try {
      const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(`${projectUrl}/functions/v1/send-verification-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey || '',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) return { error: new Error(result.error || '발송 실패') };
      return { sessionToken: result.sessionToken, error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  checkEmailCode: async (email: string, code: string, sessionToken: string) => {
    try {
      const { data, error } = await supabase.rpc('check_email_code', { p_email: email, p_code: code, p_session_token: sessionToken });
      return { valid: !!data, error: error };
    } catch (err: any) {
      return { valid: false, error: err };
    }
  },

  verifyAndSignup: async (email: string, code: string, sessionToken: string, password: string, name: string, phone: string) => {
    try {
      const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(`${projectUrl}/functions/v1/verify-and-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey || '', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ email, code, sessionToken, password, name, phone }),
      });
      const result = await response.json();
      if (!response.ok) return { error: new Error(result.error || '인증 실패') };
      return await supabase.auth.signInWithPassword({ email, password });
    } catch (err: any) {
      return { error: err };
    }
  },

  resetPassword: async (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/reset-password') }),

  checkEmailAvailable: async (email: string) => {
    const { data, error } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    return { available: !data, error: error };
  },

  signOut: async () => supabase.auth.signOut(),
};
