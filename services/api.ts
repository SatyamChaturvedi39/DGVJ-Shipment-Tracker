import axios from 'axios';
import { Config } from '@/constants/config';
import { getIdToken } from './auth';
import type { User } from '@/types';

const api = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function verifyToken(firebaseToken: string): Promise<User> {
  const { data } = await api.post('/auth/verify-token', { firebase_token: firebaseToken });
  return data.user;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get('/users/me');
  return data;
}

export default api;
