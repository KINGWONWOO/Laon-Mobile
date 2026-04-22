import { supabase } from '../lib/supabase';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

if (typeof window !== 'undefined') {
  WebBrowser.maybeCompleteAuthSession();
}

// 04ec068 당시 사용된 URL 토큰 추출 함수
const extractParams = (url: string) => {
  const params: Record<string, string> = {};
  const query = url.split('#')[1] || url.split('?')[1];
  if (query) {
    query.split('&').forEach(part => {
      const [key, value] = part.split('=');
      params[key] = value;
    });
  }
  return params;
};

export const authService = {
  signInWithSocial: async (provider: 'google' | 'kakao' | 'apple') => {
    try {
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'laondancefeedback',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { 
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined
        }
      });

      if (error) throw error;
      if (!data?.url) throw new Error('인증 URL 생성 실패');

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (res.type === 'success' && res.url) {
        const params = extractParams(res.url);
        
        // 04ec068 방식: access_token이 있으면 즉시 세션 설정 (가장 빠름)
        if (params.access_token) {
          const { data: sData, error: sErr } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token || '',
          });
          return { data: sData, error: sErr };
        }
        
        // PKCE fallback
        if (res.url.includes('code=')) {
          return await supabase.auth.exchangeCodeForSession(res.url);
        }
      }

      return { data: null, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  signIn: async (email: string, password: string) => supabase.auth.signInWithPassword({ email, password }),
  signOut: async () => { await supabase.auth.signOut(); },
  
  resetPassword: async (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/reset-password') }),
  checkEmailAvailable: async (email: string) => {
    const { data, error } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    return { available: !data, error };
  },
};
