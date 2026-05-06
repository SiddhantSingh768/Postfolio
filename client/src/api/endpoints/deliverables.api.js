import axiosClient from '../axiosClient';
import axios       from 'axios';

export const deliverablesApi = {
  getSignature: (milestoneId) =>
    axiosClient.get(`/milestones/${milestoneId}/deliverables/sign`),

  uploadToCloudinary: async (file, signParams, onProgress) => {
    const formData = new FormData();
    formData.append('file',           file);
    formData.append('api_key',        signParams.apiKey);
    formData.append('timestamp',      signParams.timestamp);
    formData.append('signature',      signParams.signature);
    formData.append('folder',         signParams.folder);
    formData.append('upload_preset',  signParams.uploadPreset);

    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${signParams.cloudName}/auto/upload`,
      formData,
      {
        onUploadProgress: (e) => {
          if (onProgress) {
            onProgress(Math.round((e.loaded * 100) / e.total));
          }
        }
      }
    );
    return res.data;
  },

  create: (milestoneId, data) =>
    axiosClient.post(`/milestones/${milestoneId}/deliverables`, data),

  list: (milestoneId, showAll = false) =>
    axiosClient.get(`/milestones/${milestoneId}/deliverables?showAll=${showAll}`),

  update: (id, data) =>
    axiosClient.patch(`/${id}`, data),

  delete: (id) =>
    axiosClient.delete(`/${id}`),

  downloadZip: (projectId) =>
    axiosClient.get(`/projects/${projectId}/deliverables/zip`, {
      responseType: 'blob'
    }),
};