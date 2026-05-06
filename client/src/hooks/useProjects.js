import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, milestonesApi } from '../api/endpoints/projects.api';

export const projectKeys = {
  all:    ['projects'],
  list:   (params) => ['projects', 'list', params],
  detail: (id)     => ['projects', 'detail', id],
};

export const useProjectList = (params) =>
  useQuery({
    queryKey: projectKeys.list(params),
    queryFn:  () => projectsApi.list(params).then(r => r.data.data),
    keepPreviousData: true,
  });

export const useProject = (id) =>
  useQuery({
    queryKey: projectKeys.detail(id),
    queryFn:  () => projectsApi.get(id).then(r => r.data.data.project),
    enabled:  !!id,
  });

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => projectsApi.create(data).then(r => r.data.data.project),
    onSuccess:  () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
};

export const useUpdateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => projectsApi.update(id, data).then(r => r.data.data.project),
    onSuccess:  (_, { id }) => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) });
    },
  });
};

export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => projectsApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
};

export const useAddMilestone = (projectId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => projectsApi.addMilestone(projectId, data).then(r => r.data.data.milestone),
    onSuccess:  () => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
};

export const useUpdateMilestone = (projectId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => milestonesApi.update(id, data).then(r => r.data.data.milestone),
    onSuccess:  () => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
};

export const useDeleteMilestone = (projectId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => milestonesApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
};