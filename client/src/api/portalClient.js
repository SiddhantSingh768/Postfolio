import axios from 'axios';


const portalClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
});

let portalToken = null;

export const setPortalToken = (token) => {
  portalToken = token;
};

portalClient.interceptors.request.use((config) => {
  if (portalToken) {
    const separator = config.url?.includes('?') ? '&' : '?';
    config.url = `${config.url}${separator}token=${portalToken}`;
  }
  return config;
});

portalClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default portalClient;