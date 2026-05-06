import axios from 'axios';

// Separate axios instance for portal requests.
// Never sends Authorization header.
// Always appends the portal token as a query param.
// Token is extracted from the URL when the portal page loads.

const portalClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
});

// Token is set once when the portal page mounts
let portalToken = null;

export const setPortalToken = (token) => {
  portalToken = token;
};

portalClient.interceptors.request.use((config) => {
  if (portalToken) {
    // Append token as query param to every request
    const separator = config.url?.includes('?') ? '&' : '?';
    config.url = `${config.url}${separator}token=${portalToken}`;
  }
  return config;
});

// Portal errors are handled by the component
// No redirect logic here — portal has no login page
portalClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default portalClient;