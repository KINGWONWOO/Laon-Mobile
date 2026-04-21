import { supabase } from '../lib/supabase';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

if (typeof window !== 'undefined') {
  WebBrowser.maybeCompleteAuthSession();
}

// URL에서 토큰을 정교하게 추출하는 함수
const parseSupabaseUrl = (url: string) => {
  const params: Record<string, string> = {};
  const regex = /[#?&]([^=#&]+)=([^&#]*)/g;
  let match;
  while ((match = regex.exec(url)) !== null) {
    params[match[1]] = match[2];
  }
  return {
    access_token: params.access_token,
    refresh_token: params.refresh_token,
    code: params.code,
    error: params.error,
    error_description: params.error_description?.replace(/\+/g, ' ')
  };
};

export const authService = {
  signInWithSocial: async (provider: 'google' | 'kakao') => {
    const logPrefix = `[AuthService][${new Date().toLocaleTimeString()}]`;
    try {
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'laondancefeedback',
        path: 'auth/callback',
      });
      
      console.log(`${logPrefix} ${provider} 로그인 시도. 리디렉션 주소: ${redirectTo}`);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true }
      });

      if (error) throw error;
      if (!data?.url) throw new Error('인증 URL 생성 실패');

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success' && res.url) {
        console.log(`${logPrefix} 브라우저 응답 수신: ${res.url}`);
        
        const { access_token, refresh_token, code } = parseSupabaseUrl(res.url);

        // 1. Implicit 방식 우선 시도 (안드로이드에서 가장 확실함)
        if (access_token) {
          console.log(`${logPrefix} access_token 발견. 세션 수동 설정 중...`);
          const { data: sData, error: sErr } = await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token || '',
          });
          if (!sErr) return { data: sData, error: null };
        }

        // 2. PKCE 방식 시도
        if (code || res.url.includes('code=')) {
          console.log(`${logPrefix} code 발견. 세션 교환 중...`);
          const { data: pData, error: pErr } = await supabase.auth.exchangeCodeForSession(res.url);
          if (!pErr) return { data: pData, error: null };
          console.warn(`${logPrefix} 세션 교환 실패, 백업 확인...`);
        }
        
        // 3. 최종 확인
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return { data: { session }, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      console.error(`${logPrefix} 소셜 로그인 에러:`, err);
      return { data: null, error: err };
    }
  },

  signInWithGoogle: async () => authService.signInWithSocial('google'),
  signInWithKakao: async () => authService.signInWithSocial('kakao'),

  signIn: async (email: string, password: string) => supabase.auth.signInWithPassword({ email, password }),
  signOut: async () => { await supabase.auth.signOut(); },
  
  deleteAccount: async () => {
    try {
      const { error } = await supabase.rpc('delete_user');
      if (error) console.error('Account deletion RPC error:', error.message);
    } finally {
      await supabase.auth.signOut();
    }
  },

  resetPassword: async (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/reset-password') }),
  checkEmailAvailable: async (email: string) => {
    const { data, error } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    return { available: !data, error };
  },
};
