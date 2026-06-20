import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as orgApi from '../api/organization';

export const useOrganization = () =>
  useQuery({ queryKey: ['organization'], queryFn: orgApi.getOrganization });

export const useUpdateOrganization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orgApi.updateOrganization,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  });
};

export const useMembers = () =>
  useQuery({ queryKey: ['members'], queryFn: orgApi.getMembers });

export const useInviteMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orgApi.inviteMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
};
