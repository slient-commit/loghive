import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as appsApi from '../api/apps';

export const useApps = () =>
  useQuery({ queryKey: ['apps'], queryFn: appsApi.getApps });

export const useApp = (id) =>
  useQuery({ queryKey: ['apps', id], queryFn: () => appsApi.getApp(id), enabled: !!id });

export const useCreateApp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: appsApi.createApp,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apps'] }),
  });
};

export const useUpdateApp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => appsApi.updateApp(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      qc.invalidateQueries({ queryKey: ['apps', id] });
    },
  });
};

export const useApiKeys = (appId) =>
  useQuery({ queryKey: ['apiKeys', appId], queryFn: () => appsApi.getApiKeys(appId), enabled: !!appId });

export const useCreateApiKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ appId, name }) => appsApi.createApiKey(appId, name),
    onSuccess: (_, { appId }) => qc.invalidateQueries({ queryKey: ['apiKeys', appId] }),
  });
};

export const useRevokeApiKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ appId, keyId }) => appsApi.revokeApiKey(appId, keyId),
    onSuccess: (_, { appId }) => qc.invalidateQueries({ queryKey: ['apiKeys', appId] }),
  });
};
