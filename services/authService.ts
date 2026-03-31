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
      // 💡 로그에 찍혔던 성공한 리디렉션 주소와 동일하게 맞춤
      const redirectTo = Linking.createURL('/');
      console.log(`[Auth] ${provider} login started. Redirect URI:`, redirectTo);

      // KOE205 에러 방지: 카카오의 경우 콘솔 설정과 일치하는 scope만 요청해야 함
      const options: any = {
        redirectTo,
        skipBrowserRedirect: true,
      };

      if (provider === 'kakao') {
        // 카카오 콘솔의 '동의 항목'에 설정된 내용에 따라 조정 필요
        // 기본적으로 profile_nickname, account_email 등을 사용
        options.queryParams = {
          scope: 'profile_nickname', // 이메일 동의를 안했다면 이메일은 제외해야 함
        };
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });

      if (error) throw error;
      if (!data?.url) throw new Error('인증 서버로부터 URL을 받지 못했습니다.');

      // 💡 PKCE code_verifier가 저장소에 기록될 시간을 줌
      await new Promise(resolve => setTimeout(resolve, 800));

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success' && res.url) {
        console.log(`[Auth] Success URL received:`, res.url);

        // 💡 1. 수동으로 URL에서 토큰(Implicit) 또는 코드(PKCE) 추출 시도
        const parsed = Linking.parse(res.url);
        const code = parsed.queryParams?.code as string;
        
        // 만약 fragment(#) 영역에 access_token이 있다면 직접 추출 (백업)
        const hash = res.url.split('#')[1];
        let accessToken = '';
        let refreshToken = '';
        if (hash) {
          const hashParams = new URLSearchParams(hash);
          accessToken = hashParams.get('access_token') || '';
          refreshToken = hashParams.get('refresh_token') || '';
        }

        // 💡 2. Implicit Flow 방식 시도 (가장 빠르고 verifier 오류 없음)
        if (accessToken) {
          console.log('[Auth] Access token found in hash, setting session manually...');
          const { data: setSessionData, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!setSessionError && setSessionData.session) return { data: setSessionData, error: null };
        }

        // 💡 3. PKCE Flow 방식 시도 (보안 코드 교환)
        if (code || res.url.includes('code=')) {
          console.log(`[Auth] Code detected, attempting exchange...`);
          // 저장소 반영을 위한 추가 대기
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(res.url);
            if (!sessionError) return { data: sessionData, error: null };
            console.warn('[Auth] Exchange failed, checking for auto-login:', sessionError.message);
          } catch (exchangeEx) {
            console.warn('[Auth] Exchange exception:', exchangeEx);
          }
        }

        // 💡 4. 최종 확인: 그래도 세션이 안 잡혔다면 직접 체크
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        if (finalSession) {
          console.log('[Auth] Session found by getSession()');
          return { data: { session: finalSession }, error: null };
        }
        
        throw new Error('로그인 정보를 세션으로 변환하지 못했습니다. 다시 시도해 주세요.');
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error(`[Auth] ${provider} Error:`, err);
      // 마지막 방어
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
