import axios from 'axios';
import Constants from 'expo-constants';
import { User, Room, Notice, VideoFeedback, Photo, Schedule, Vote, Alarm } from '../types';

// Detect the best API URL for the current environment
const getBaseUrl = () => {
  // 1. If running in web, use the current browser's origin
  if (typeof window !== 'undefined' && window.location) {
    // Check if we are in a cloud IDE environment (Cloud Workstations)
    const host = window.location.hostname;
    if (host.includes('cloudworkstations.dev')) {
      // In cloud IDE, API usually runs on the same host but different port or proxied path
      // If your backend also runs on the cloud workstation, you might need a tunnel for it too
      return `https://3000-${host}/api`; 
    }
    return 'http://localhost:3000/api';
  }

  // 2. For Mobile (Expo Go)
  const debuggerHost = Constants.expoConfig?.hostUri || '';
  const host = debuggerHost.split(':')[0];
  
  if (!host) return 'http://localhost:3000/api';

  // If using tunnel (ngrok), the host will be something like xxxxx.exp.direct
  // We need to decide where the BACKEND is. 
  // If backend is also tunneled, you should put that tunnel URL here.
  // For now, we assume backend is reachable at the same host IP or via a proxy.
  return `http://${host}:3000/api`;
};

const BASE_URL = getBaseUrl();
console.log('🚀 Connecting to API at:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const userApi = {
  login: (name: string) => api.post<User>('/auth/login', { name }),
  updateProfile: (userId: string, data: Partial<User>) => api.patch<User>(`/users/${userId}`, data),
};

export const roomApi = {
  getRooms: (userId: string) => api.get<Room[]>(`/rooms?userId=${userId}`),
  createRoom: (data: Partial<Room>) => api.post<Room>('/rooms', data),
  joinRoom: (roomId: string, passcode: string) => api.post<Room>(`/rooms/${roomId}/join`, { passcode }),
  getRoomDetails: (roomId: string) => api.get<Room>(`/rooms/${roomId}`),
};

export const noticeApi = {
  getNotices: (roomId: string) => api.get<Notice[]>(`/notices?roomId=${roomId}`),
  createNotice: (data: Partial<Notice>) => api.post<Notice>('/notices', data),
  updateNotice: (id: string, data: Partial<Notice>) => api.patch<Notice>(`/notices/${id}`, data),
  deleteNotice: (id: string) => api.delete(`/notices/${id}`),
};

export const videoApi = {
  getVideos: (roomId: string) => api.get<VideoFeedback[]>(`/videos?roomId=${roomId}`),
  uploadVideo: (data: FormData) => api.post<VideoFeedback>('/videos', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  addComment: (videoId: string, data: { text: string; timestampMillis: number }) => 
    api.post(`/videos/${videoId}/comments`, data),
};

export default api;
