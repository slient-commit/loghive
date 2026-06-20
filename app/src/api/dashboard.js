import client from './client';

export const getOverview = () =>
  client.get('/api/dashboard/overview').then((r) => r.data);

export const getLogsOverTime = (period = '7d') =>
  client.get('/api/dashboard/logs-over-time', { params: { period } }).then((r) => r.data);

export const getAppHealth = () =>
  client.get('/api/dashboard/app-health').then((r) => r.data);

export const getTopErrors = () =>
  client.get('/api/dashboard/top-errors').then((r) => r.data);

export const getErrorSpike = () =>
  client.get('/api/dashboard/error-spike').then((r) => r.data);

export const getHeatmap = () =>
  client.get('/api/dashboard/heatmap').then((r) => r.data);

export const getRecentFatals = () =>
  client.get('/api/dashboard/recent-fatals').then((r) => r.data);

export const getTodayVsYesterday = () =>
  client.get('/api/dashboard/today-vs-yesterday').then((r) => r.data);

export const getAppBreakdown = () =>
  client.get('/api/dashboard/app-breakdown').then((r) => r.data);
