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
        console.log('[Auth] Success URL received:', res.url);
        
        // 💡 PKCE 코드로 세션 교환 시도
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(res.url);
          if (!sessionError && sessionData.session) {
            console.log('[Auth] PKCE exchange success');
            return { data: sessionData, error: null };
          }
        } catch (e) {
          console.warn('[Auth] PKCE exchange exception, trying fallback...');
        }

        // 💡 Fallback: URL 해시(#)에서 access_token 직접 추출 (Implicit Flow 방식)
        // 안드로이드 일부 환경에서는 PKCE verifier 손실 시 이 방식이 가장 확실합니다.
        const hash = res.url.split('#')[1];
        if (hash) {
          console.log('[Auth] Extracting tokens from hash fallback...');
          const params: Record<string, string> = {};
          hash.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            params[key] = value;
          });

          if (params.access_token) {
            const { data: setRes, error: setErr } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token || '',
            });
            if (setErr) throw setErr;
            console.log('[Auth] Session set via hash fallback');
            return { data: setRes, error: null };
          }
        }
        
        // 최후의 수단: 현재 세션이 잡혔는지 확인
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) return { data: { session: currentSession }, error: null };
        
        throw new Error('인증 정보를 가져오지 못했습니다.');
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error(`[Auth] ${provider} Detail Error:`, err);
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
