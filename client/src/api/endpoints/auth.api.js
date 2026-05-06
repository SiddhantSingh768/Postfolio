import axiosClient from '../axiosClient';

export const authApi = {
  register:       (data)          => axiosClient.post('/auth/register', data),
  verifyEmail:    (data)          => axiosClient.post('/auth/verify-email', data),
  login:          (data)          => axiosClient.post('/auth/login', data),
  logout:         ()              => axiosClient.post('/auth/logout'),
  refresh:        ()              => axiosClient.post('/auth/refresh'),
  forgotPassword: (email)         => axiosClient.post('/auth/forgot-password', { email }),
  resetPassword:  (data)          => axiosClient.post('/auth/reset-password', data),
  googleLogin:    ()              => { window.location.href = `${import.meta.env.VITE_API_URL?.replace('/api/v1', '')}/api/v1/auth/google`; },
getMe:          ()     => axiosClient.get('/auth/me'),
updateProfile:  (data) => axiosClient.patch('/auth/profile', data),
};