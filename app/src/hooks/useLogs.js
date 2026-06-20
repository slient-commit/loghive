import { useQuery } from '@tanstack/react-query';
import * as logsApi from '../api/logs';

export const useLogs = (appId, filters = {}, options = {}) =>
  useQuery({
    queryKey: ['logs', appId, filters],
    queryFn: () => logsApi.getLogs(appId, filters),
    enabled: !!appId,
    placeholderData: (prev) => prev,
    ...options,
  });

export const useLogStats = (appId, filters = {}) =>
  useQuery({
    queryKey: ['logStats', appId, filters],
    queryFn: () => logsApi.getLogStats(appId, filters),
    enabled: !!appId,
  });
