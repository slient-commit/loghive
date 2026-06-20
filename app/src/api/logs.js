import client from './client';

export const getLogs = (appId, filters = {}) => {
  const params = {};
  if (filters.level) params.level = filters.level;
  if (filters.tag) params.tag = filters.tag;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.search) params.search = filters.search;
  if (filters.metaKey) params.metaKey = filters.metaKey;
  if (filters.metaValue) params.metaValue = filters.metaValue;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  return client.get(`/api/logs/${appId}`, { params }).then((r) => r.data);
};

export const getLogStats = (appId, filters = {}) => {
  const params = {};
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;

  return client.get(`/api/logs/${appId}/stats`, { params }).then((r) => r.data);
};

export const getLogTags = (appId) =>
  client.get(`/api/logs/${appId}/tags`).then((r) => r.data);

export const getLogGroups = (appId, filters = {}) => {
  const params = {};
  if (filters.by) params.by = filters.by;
  if (filters.metaKey) params.metaKey = filters.metaKey;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.level) params.level = filters.level;
  if (filters.search) params.search = filters.search;
  if (filters.tag) params.tag = filters.tag;
  if (filters.groupSearch) params.groupSearch = filters.groupSearch;

  return client.get(`/api/logs/${appId}/group`, { params }).then((r) => r.data);
};
