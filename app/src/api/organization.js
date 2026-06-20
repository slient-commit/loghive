import client from './client';

export const getOrganization = () =>
  client.get('/api/organization').then((r) => r.data);

export const updateOrganization = (data) =>
  client.put('/api/organization', data).then((r) => r.data);

export const getMembers = () =>
  client.get('/api/organization/members').then((r) => r.data);

export const inviteMember = (data) =>
  client.post('/api/organization/members', data).then((r) => r.data);
