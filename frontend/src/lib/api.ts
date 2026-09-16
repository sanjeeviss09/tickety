import axios from 'axios';
import { supabase } from './supabase';

function getApiBaseUrl(): string {
  let url = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api/v1').trim();
  url = url.replace(/\/+$/, ''); // remove trailing slashes
  if (!url.endsWith('/api/v1')) {
    if (url.endsWith('/api')) {
      url = `${url}/v1`;
    } else {
      url = `${url}/api/v1`;
    }
  }
  return url;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
