import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Web uses localStorage, Native uses SecureStore
const SECURE_STORE_LIMIT = 2048;

export const setItem = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch {
      // 시크릿 모드 등 localStorage 차단 환경 무시
    }
    return;
  }

  try {
    if (value.length > SECURE_STORE_LIMIT) {
      // SecureStore 용량 초과 시 여러 청크로 나눠서 저장
      const chunks = Math.ceil(value.length / SECURE_STORE_LIMIT);
      await SecureStore.setItemAsync(`${key}_chunks`, String(chunks));
      for (let i = 0; i < chunks; i++) {
        const chunk = value.slice(i * SECURE_STORE_LIMIT, (i + 1) * SECURE_STORE_LIMIT);
        await SecureStore.setItemAsync(`${key}_${i}`, chunk);
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {
    // 저장 실패 시 무시 (세션이 없는 것으로 처리됨)
  }
};

export const getItem = async (key: string) => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  try {
    const chunksStr = await SecureStore.getItemAsync(`${key}_chunks`);
    if (chunksStr) {
      // 청크로 나눠 저장된 값 복원
      const chunks = parseInt(chunksStr, 10);
      let value = '';
      for (let i = 0; i < chunks; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
        value += chunk ?? '';
      }
      return value;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

export const removeItem = async (key: string) => {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch {
      // 무시
    }
    return;
  }

  try {
    const chunksStr = await SecureStore.getItemAsync(`${key}_chunks`);
    if (chunksStr) {
      const chunks = parseInt(chunksStr, 10);
      for (let i = 0; i < chunks; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`);
      }
      await SecureStore.deleteItemAsync(`${key}_chunks`);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // 무시
  }
};
