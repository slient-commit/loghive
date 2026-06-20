import axios from 'axios';

const client = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('loghive_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config?.url?.includes('/api/auth/');
    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('loghive_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
