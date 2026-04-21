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
    const logPrefix = `[AuthService][${new Date().toLocaleTimeString()}]`;
    try {
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'laondancefeedback',
        path: 'auth/callback',
      });
      
      console.log(`${logPrefix} ${provider} 로그인 시작. Redirect: ${redirectTo}`);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: provider === 'google' ? { prompt: 'select_account' } : { scope: 'profile_nickname,account_email' }
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('인증 URL 생성 실패');

      // 💡 안드로이드에서 브라우저가 앱으로 돌아오지 않는 문제를 위해 openAuthSessionAsync 사용
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success' && res.url) {
        console.log(`${logPrefix} 브라우저 인증 성공. URL 수신 완료.`);
        
        // 1. PKCE 방식 시도 (URL에 code가 있는 경우)
        if (res.url.includes('code=')) {
          const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(res.url);
          if (!sessionError) return { data: sessionData, error: null };
        }
        
        // 2. Implicit 방식 시ed도 (URL에 access_token이 있는 경우)
        const hash = res.url.split('#')[1] || res.url.split('?')[1];
        if (hash && hash.includes('access_token=')) {
          const params: any = {};
          hash.split('&').forEach(p => { const [k, v] = p.split('='); params[k] = v; });
          const { data: setRes, error: setErr } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token || '',
          });
          if (!setErr) return { data: setRes, error: null };
        }
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error(`${logPrefix} 오류 발생:`, err);
      return { data: null, error: err };
    }
  },

  signInWithGoogle: async () => authService.signInWithSocial('google'),
  signInWithKakao: async () => authService.signInWithSocial('kakao'),

  signIn: async (email: string, password: string) => supabase.auth.signInWithPassword({ email, password }),

  signOut: async () => {
    await supabase.auth.signOut();
  },

  deleteAccount: async () => {
    // 💡 RPC 함수 호출 (Supabase에 생성되어 있어야 함)
    const { error } = await supabase.rpc('delete_user');
    if (error) console.warn('RPC deletion error:', error.message);
    await supabase.auth.signOut();
  },

  resetPassword: async (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/reset-password') }),

  checkEmailAvailable: async (email: string) => {
    const { data, error } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    return { available: !data, error };
  },
};
