import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '../api/endpoints/clients.api';

export const clientKeys = {
  all:    ['clients'],
  list:   (params) => ['clients', 'list', params],
  detail: (id)     => ['clients', 'detail', id],
};

export const useClientList = (params) =>
  useQuery({
    queryKey: clientKeys.list(params),
    queryFn:  () => clientsApi.list(params).then(r => r.data.data),
    keepPreviousData: true, 
  });

export const useClient = (id) =>
  useQuery({
    queryKey: clientKeys.detail(id),
    queryFn:  () => clientsApi.get(id).then(r => r.data.data.client),
    enabled:  !!id,
  });

export const useCreateClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => clientsApi.create(data).then(r => r.data.data.client),
    onSuccess:  () => qc.invalidateQueries({ queryKey: clientKeys.all }),
  });
};

export const useUpdateClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => clientsApi.update(id, data).then(r => r.data.data.client),
    onSuccess:  (_, { id }) => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
      qc.invalidateQueries({ queryKey: clientKeys.detail(id) });
    },
  });
};

export const useArchiveClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => clientsApi.archive(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: clientKeys.all }),
  });
};