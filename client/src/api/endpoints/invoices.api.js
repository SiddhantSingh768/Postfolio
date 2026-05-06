import axiosClient from '../axiosClient';

export const invoicesApi = {
  list:   (params) =>
    axiosClient.get('/invoices', { params }),

  get:    (id) =>
    axiosClient.get(`/invoices/${id}`),

  create: (data) =>
    axiosClient.post('/invoices', data),

  update: (id, data) =>
    axiosClient.patch(`/invoices/${id}`, data),

  send:   (id) =>
    axiosClient.post(`/invoices/${id}/send`),

  generatePDF: (id) =>
    axiosClient.post(`/invoices/${id}/generate-pdf`),

  viewPDF: (id) =>
    `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/invoices/${id}/pdf`,

  cancel: (id) =>
    axiosClient.post(`/invoices/${id}/cancel`),

  markPaid: (id, razorpayPaymentId) =>
    axiosClient.post(`/invoices/${id}/mark-paid`, { razorpayPaymentId }),
};