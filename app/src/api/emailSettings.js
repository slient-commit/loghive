import client from './client';

const BASE = '/api/settings/email';

export const getEmailSettings    = ()     => client.get(BASE).then((r) => r.data);
export const updateEmailSettings = (data) => client.put(BASE, data).then((r) => r.data);
export const testEmailSettings   = ()     => client.post(`${BASE}/test`).then((r) => r.data);
