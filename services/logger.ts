import React from 'react';

// Web version - No Sentry imports here
export const initSentry = () => {
  console.log('Sentry disabled on Web');
};

export const captureError = (error: Error, context?: any) => {
  console.error('Captured Error (Web):', error, context);
};

export const withSentry = (Component: React.ComponentType<any>) => {
  return Component; // Return as-is on web
};
