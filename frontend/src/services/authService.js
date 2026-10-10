import api from './api';

// Wraps the actual backend auth endpoints (src/routes/authRoutes.js):
//   POST /api/auth/register  -> { _id, name, email, role, token }
//   POST /api/auth/login     -> { _id, name, email, role, token }
//   GET  /api/auth/me        -> { _id, name, email, role, createdAt } (protected)
const register = async ({ name, email, password }) => {
  const { data } = await api.post('/auth/register', { name, email, password });
  return data;
};

const login = async ({ email, password }) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
};

const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

export default { register, login, getMe };
