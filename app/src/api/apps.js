import client from './client';

export const getApps = () =>
  client.get('/api/apps').then((r) => r.data);

export const getApp = (uuid) =>
  client.get(`/api/apps/${uuid}`).then((r) => r.data);

export const createApp = (data) =>
  client.post('/api/apps', data).then((r) => r.data);

export const updateApp = (uuid, data) =>
  client.put(`/api/apps/${uuid}`, data).then((r) => r.data);

export const getApiKeys = (appUuid) =>
  client.get(`/api/apps/${appUuid}/keys`).then((r) => r.data);

export const createApiKey = (appUuid, name) =>
  client.post(`/api/apps/${appUuid}/keys`, { name }).then((r) => r.data);

export const revokeApiKey = (appUuid, keyId) =>
  client.delete(`/api/apps/${appUuid}/keys/${keyId}`).then((r) => r.data);
