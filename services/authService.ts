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
      // 💡 AuthSession을 사용하여 Expo Go와 빌드 환경 모두 대응하는 정확한 주소 생성
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'laondancefeedback',
        path: 'auth/callback',
      });
      
      console.log(`[Auth] ${provider} login started. Redirect URI:`, redirectTo);

      const options: any = {
        redirectTo,
        skipBrowserRedirect: true,
      };

      if (provider === 'kakao') {
        // 카카오 콘솔에서 '이메일' 항목을 '선택 동의'로 설정해야 정상 작동합니다.
        options.queryParams = {
          scope: 'profile_nickname,account_email',
        };
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });

      if (error) throw error;
      if (!data?.url) throw new Error('인증 서버로부터 URL을 받지 못했습니다.');

      // PKCE 보안을 위해 verifier가 저장될 시간을 확보
      await new Promise(resolve => setTimeout(resolve, 500));

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success' && res.url) {
        console.log(`[Auth] Success URL received:`, res.url);
        
        // 세션 처리 시도
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(res.url);
        
        if (sessionError) {
          console.warn('[Auth] Exchange failed, checking backup session:', sessionError.message);
          // 백업: 직접 세션 확인
          const { data: { session: backupSession } } = await supabase.auth.getSession();
          if (backupSession) return { data: { session: backupSession }, error: null };
          throw sessionError;
        }
        
        return { data: sessionData, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error(`[Auth] ${provider} Error:`, err);
      // 최종 방어막: 이미 세션이 있는지 확인
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return { data: { session }, error: null };

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
      const response = await fetch(`${projectUrl}/functions/v1/verify-and-signup`, {
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
