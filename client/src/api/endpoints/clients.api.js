import axiosClient from '../axiosClient';

export const clientsApi = {
  list:   (params) =>
    axiosClient.get('/clients', { params }),

  get:    (id) =>
    axiosClient.get(`/clients/${id}`),

  create: (data) =>
    axiosClient.post('/clients', data),

  update: (id, data) =>
    axiosClient.patch(`/clients/${id}`, data),

  archive: (id) =>
    axiosClient.delete(`/clients/${id}`),

  generatePortalToken: (id, data) =>
    axiosClient.post(`/clients/${id}/portal-token`, data),

  revokePortalToken: (id) =>
    axiosClient.delete(`/clients/${id}/portal-token`),
};