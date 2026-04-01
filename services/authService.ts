import { supabase } from '../lib/supabase';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform, Alert } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export const authService = {
  signInWithSocial: async (provider: 'google' | 'kakao') => {
    try {
      // 💡 1. Redirect URI 생성 (Expo Go와 네이티브 환경 모두 대응)
      const redirectTo = AuthSession.makeRedirectUri({
        path: 'auth/callback',
      });
      
      console.log(`[Auth] Starting ${provider} login...`);
      console.log(`[Auth] Redirect URI: ${redirectTo}`);

      const options: any = {
        redirectTo,
        skipBrowserRedirect: true,
      };

      if (provider === 'kakao') {
        options.queryParams = {
          scope: 'profile_nickname,account_email',
        };
      }

      // 💡 2. Supabase에 로그인 요청
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });

      if (error) {
        console.error(`[Auth] Supabase Error:`, error.status, error.message, error.code);
        throw error;
      }
      
      if (!data?.url) throw new Error('인증 URL을 생성할 수 없습니다.');

      // 💡 3. 브라우저 인증 실행
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success' && res.url) {
        console.log(`[Auth] Browser returned URL:`, res.url);
        
        // URL에서 code 파라미터가 있는지 확인 (PKCE)
        const parsedUrl = new URL(res.url.replace('#', '?')); // fragment 대응
        const code = parsedUrl.searchParams.get('code');
        const error_description = parsedUrl.searchParams.get('error_description');

        if (error_description) {
          throw new Error(`인증 오류: ${error_description}`);
        }

        if (!code) {
          // code가 없는데 access_token이 있다면 Implicit flow로 처리 시도
          const accessToken = parsedUrl.searchParams.get('access_token');
          if (accessToken) {
            console.log('[Auth] Using implicit flow fallback');
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: parsedUrl.searchParams.get('refresh_token') || '',
            });
            
            if (sessionError) throw sessionError;
            
            // 세션 설정 후 앱 메인으로 이동하도록 유도
            return { data: sessionData, error: null };
          }
          throw new Error('인증 코드를 찾을 수 없습니다. (PKCE code missing)');
        }
        
        // 💡 4. 세션 교환
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(res.url);
        
        if (sessionError) {
          console.error('[Auth] Session exchange error:', sessionError.message);
          // 이미 세션이 있는지 마지막 확인
          const { data: { session } } = await supabase.auth.getSession();
          if (session) return { data: { session }, error: null };
          throw sessionError;
        }
        
        return { data: sessionData, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error(`[Auth] ${provider} Error Detail:`, err);
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
