import axios from 'axios';

const axiosClient = axios.create({
  baseURL:         import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
});

// Attach access token to every request
axiosClient.interceptors.request.use((config) => {
  const token = window.__postfolioAccessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing  = false;
let pendingQueue  = [];

const processQueue = (error, token = null) => {
  pendingQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  pendingQueue = [];
};

// Silent token refresh on 401
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return axiosClient(original);
        });
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        const { data }  = await axiosClient.post('/auth/refresh');
        const newToken  = data.data.accessToken;
        window.__postfolioAccessToken        = newToken;
        original.headers.Authorization      = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return axiosClient(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        window.__postfolioAccessToken = null;
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;