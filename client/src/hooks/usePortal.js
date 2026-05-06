import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portalApi } from '../api/endpoints/portal.api';

export const portalKeys = {
  project: (id) => ['portal', 'project', id],
};

export const usePortalProject = (projectId) =>
  useQuery({
    queryKey: portalKeys.project(projectId),
    queryFn:  () => portalApi.getProject(projectId).then(r => r.data.data),
    enabled:  !!projectId,
    retry:    false, 
    staleTime: 60 * 1000,
  });

export const useViewInvoice = (projectId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId) =>
      portalApi.viewInvoice(projectId, invoiceId).then(r => r.data.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: portalKeys.project(projectId) }),
  });
};

export const useApproveMilestone = (projectId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, comment }) =>
      portalApi.approveMilestone(projectId, milestoneId, comment).then(r => r.data.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: portalKeys.project(projectId) }),
  });
};