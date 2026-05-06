import axiosClient from '../axiosClient';

export const projectsApi = {
  list:   (params) =>
    axiosClient.get('/projects', { params }),

  get:    (id) =>
    axiosClient.get(`/projects/${id}`),

  create: (data) =>
    axiosClient.post('/projects', data),

  update: (id, data) =>
    axiosClient.patch(`/projects/${id}`, data),

  delete: (id) =>
    axiosClient.delete(`/projects/${id}`),

  addMilestone: (projectId, data) =>
    axiosClient.post(`/projects/${projectId}/milestones`, data),

  generatePortal: (id, data) =>
    axiosClient.post(`/projects/${id}/portal`, data),

  revokePortal: (id) =>
    axiosClient.delete(`/projects/${id}/portal`),
};

export const milestonesApi = {
  update: (id, data) =>
    axiosClient.patch(`/milestones/${id}`, data),

  delete: (id) =>
    axiosClient.delete(`/milestones/${id}`),
};