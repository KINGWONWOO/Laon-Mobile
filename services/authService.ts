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
      // 💡 Redirect URI 생성 (scheme 명시)
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'laondancefeedback',
        path: 'auth/callback',
      });
      
      console.log(`[Auth] Starting ${provider} login with redirect: ${redirectTo}`);

      const options: any = {
        redirectTo,
        skipBrowserRedirect: true,
      };

      if (provider === 'kakao') {
        // 카카오 추가 권한 요청
        options.queryParams = {
          scope: 'profile_nickname,account_email',
        };
      }

      if (provider === 'google') {
        // 💡 구글 로그인 시 앱(Gmail 등) 인터셉트 방지 및 계정 선택 강제
        options.queryParams = {
          prompt: 'select_account',
          access_type: 'offline',
        };
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });

      if (error) throw error;
      if (!data?.url) throw new Error('인증 URL 생성 실패');

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success' && res.url) {
        // 💡 PKCE Flow: URL에서 code 추출 후 세션 교환
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(res.url);
        
        if (sessionError) {
          // Fallback: URL 파싱 시도 (Implicit flow 대비)
          const urlObj = new URL(res.url.replace('#', '?'));
          const access_token = urlObj.searchParams.get('access_token');
          const refresh_token = urlObj.searchParams.get('refresh_token');
          
          if (access_token) {
            return await supabase.auth.setSession({ access_token, refresh_token: refresh_token || '' });
          }
          throw sessionError;
        }
        
        return { data: sessionData, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error(`[Auth] ${provider} Detail Error:`, err);
      return { data: null, error: err };
    }
  },

  signInWithGoogle: async () => {
    return await authService.signInWithSocial('google');
  },

  signInWithKakao: async () => {
    return await authService.signInWithSocial('kakao');
  },

  signInWithApple: async () => {
    if (Platform.OS !== 'ios') return { data: null, error: new Error('Apple 로그인은 iOS에서만 지원됩니다.') };
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple 인증 토큰을 받지 못했습니다.');
      return await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return { data: null, error: null };
      return { data: null, error: e };
    }
  },

  signIn: async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  },

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
      if (!response.ok) {
        let msg = result.error || JSON.stringify(result);
        if (msg === 'EMAIL_EXISTS') msg = '이미 가입된 이메일입니다.';
        return { error: new Error(msg) };
      }
      return { sessionToken: result.sessionToken, error: null };
    } catch (err: any) {
      return { error: new Error(`통신 에러: ${err.message}`) };
    }
  },

  checkEmailCode: async (email: string, code: string, sessionToken: string) => {
    try {
      const { data, error } = await supabase.rpc('check_email_code', {
        p_email: email,
        p_code: code,
        p_session_token: sessionToken,
      });
      if (error) throw error;
      return { valid: !!data, error: null };
    } catch (err: any) {
      return { valid: false, error: err };
    }
  },

  verifyAndSignup: async (email: string, code: string, sessionToken: string, password: string, name: string, phone: string) => {
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
        body: JSON.stringify({ email, code, sessionToken, password, name, phone }),
      });
      const result = await response.json();
      if (!response.ok) {
        let msg = result.error || JSON.stringify(result);
        if (msg === 'INVALID_CODE') msg = '인증 코드가 올바르지 않거나 만료되었습니다.';
        else if (msg === 'EMAIL_EXISTS') msg = '이미 가입된 이메일입니다.';
        return { error: new Error(msg) };
      }
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      return { error: loginError };
    } catch (err: any) {
      return { error: err };
    }
  },

  resetPassword: async (email: string) => {
    return await supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/reset-password') });
  },

  checkEmailAvailable: async (email: string) => {
    const { data, error } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    if (error) return { available: false, error };
    return { available: !data, error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },
};
