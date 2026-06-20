import client from './client';

const BASE = '/api/notifications';

export const getRules         = ()          => client.get(BASE).then((r) => r.data);
export const getRule          = (uuid)      => client.get(`${BASE}/${uuid}`).then((r) => r.data);
export const createRule       = (data)      => client.post(BASE, data).then((r) => r.data);
export const updateRule       = (uuid, data)=> client.put(`${BASE}/${uuid}`, data).then((r) => r.data);
export const deleteRule       = (uuid)      => client.delete(`${BASE}/${uuid}`).then((r) => r.data);
export const toggleRule       = (uuid)      => client.patch(`${BASE}/${uuid}/toggle`).then((r) => r.data);
export const testRule         = (uuid)      => client.post(`${BASE}/${uuid}/test`).then((r) => r.data);
export const getMetaApps      = ()          => client.get(`${BASE}/meta/apps`).then((r) => r.data);
export const getMetaMembers   = ()          => client.get(`${BASE}/meta/members`).then((r) => r.data);
