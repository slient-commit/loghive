import client from './client';

export const login = (email, password) =>
  client.post('/api/auth/login', { email, password }).then((r) => r.data);

export const register = (data) =>
  client.post('/api/auth/register', data).then((r) => r.data);

export const getMe = () =>
  client.get('/api/auth/me').then((r) => r.data);

export const updateSettings = (data) =>
  client.put('/api/auth/settings', data).then((r) => r.data);

export const forgotPassword = (email) =>
  client.post('/api/auth/forgot-password', { email }).then((r) => r.data);

export const resetPassword = (token, password) =>
  client.post('/api/auth/reset-password', { token, password }).then((r) => r.data);

export const acceptInvite = (token, password) =>
  client.post('/api/auth/accept-invite', { token, password }).then((r) => r.data);

export const verifyEmail = (token) =>
  client.get(`/api/auth/verify-email?token=${token}`).then((r) => r.data);

export const resendVerification = (email) =>
  client.post('/api/auth/resend-verification', { email }).then((r) => r.data);
