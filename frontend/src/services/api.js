import axios from 'axios';

// Subscribers notified when the backend rejects a request as unauthorized.
// Cleared localStorage alone is not enough: AuthContext holds the session in
// React state, so without this the UI would keep showing the user as signed
// in while every subsequent request 401s.
const unauthorizedHandlers = new Set();

// Register a callback for session-expiry events. Returns an unsubscribe
// function so it can be used directly as a useEffect cleanup.
export const onUnauthorized = (handler) => {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
};

// Endpoints where a 401 means "wrong credentials", not "session expired".
// Tearing down state for these would be incorrect (and would fight the login
// form's own error handling).
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];

// Centralized Axios instance. Base URL comes from the environment so the
// frontend never hardcodes the backend location (and never touches
// MongoDB credentials or JWT secrets, which stay server-side only).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the JWT (if present) to every outgoing request.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Centralized handling for expired/invalid tokens: if the backend ever
// responds 401, clear stale auth state (localStorage *and* React state) so
// the app stops pretending the session is still valid.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

    if (status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      unauthorizedHandlers.forEach((handler) => handler());
    }
    return Promise.reject(error);
  }
);

export default api;
