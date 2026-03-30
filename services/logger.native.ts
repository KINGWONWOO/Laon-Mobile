import * as Sentry from '@sentry/react-native';

// Native version - Full Sentry support
export const initSentry = () => {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  
  if (!dsn || dsn.includes('YOUR_SENTRY_DSN_HERE')) {
    console.log('⚠️ Sentry DSN not configured or still using placeholder.');
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    enableNative: true,
  });
};

export const captureError = (error: Error, context?: any) => {
  console.error('Captured Error (Native):', error, context);
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
};

export const withSentry = (Component: React.ComponentType<any>) => {
  return Sentry.wrap(Component);
};
