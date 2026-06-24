import client from './client';

export const getAlertRules = () => client.get('/api/alerts').then((r) => r.data);

export const createAlertRule = (data) => client.post('/api/alerts', data).then((r) => r.data);

export const updateAlertRule = (uuid, data) => client.put(`/api/alerts/${uuid}`, data).then((r) => r.data);

export const deleteAlertRule = (uuid) => client.delete(`/api/alerts/${uuid}`).then((r) => r.data);

export const toggleAlertRule = (uuid) => client.patch(`/api/alerts/${uuid}/toggle`).then((r) => r.data);

export const testAlertRule = (uuid) => client.post(`/api/alerts/${uuid}/test`).then((r) => r.data);

export const getMetaApps = () => client.get('/api/alerts/meta/apps').then((r) => r.data);
