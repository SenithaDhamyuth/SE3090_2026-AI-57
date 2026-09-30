import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const baseURL = import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com';
const backendOrigin = new URL(baseURL, window.location.origin).origin;
const originalFetch = window.fetch.bind(window);

window.fetch = async (resource, config = {}) => {
  const requestUrl = resource instanceof Request ? resource.url : resource.toString();
  const url = new URL(requestUrl, window.location.href);
  const headers = new Headers(resource instanceof Request ? resource.headers : undefined);

  new Headers(config.headers).forEach((value, key) => headers.set(key, value));

  const isBackendApiRequest =
    url.origin === backendOrigin && url.pathname.startsWith('/api/');
  const token = localStorage.getItem('admin_token') || localStorage.getItem('token');

  if (isBackendApiRequest && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return originalFetch(resource, {
    ...config,
    headers,
    credentials: config.credentials ?? (url.origin === backendOrigin ? 'include' : 'same-origin'),
  });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
