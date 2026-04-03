import axios from 'axios';

const multibase = axios.create({
  baseURL: process.env.MULTIBASE_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

multibase.interceptors.request.use((config) => {
  const token = process.env.MULTIBASE_TOKEN;
  if (token) {
    if (token.startsWith('mb_')) {
      // API Key → X-API-Key Header
      config.headers['X-API-Key'] = token;
    } else {
      // Session Token → Bearer
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default multibase;

export function getInstanceName(): string {
  return process.env.INSTANCE_NAME || 'dein-project';
}
