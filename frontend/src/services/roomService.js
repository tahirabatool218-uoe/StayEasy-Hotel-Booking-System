import api from './api';

// Wraps src/routes/roomRoute.js on the backend:
//   GET  /rooms                -> Room[] (each populated with hotel: {name city country})
//   GET  /rooms/:id            -> Room
//   GET  /rooms/availability   -> Room[] filtered by { hotel, checkInDate, checkOutDate, guests }
// Optional filters are dropped rather than sent as `hotel=`/`status=` empty
// strings, matching adminService.
const omitEmpty = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

const getRooms = async (params = {}) => {
  const { data } = await api.get('/rooms', { params: omitEmpty(params) });
  return data;
};

const getRoomById = async (id) => {
  const { data } = await api.get(`/rooms/${id}`);
  return data;
};

// params: { hotel, checkInDate, checkOutDate, guests }
const getAvailability = async (params) => {
  const { data } = await api.get('/rooms/availability', { params });
  return data;
};

// Admin-only. The backend whitelists the room fields it accepts and re-checks
// that the target hotel exists when a room is moved.
const createRoom = async (payload) => {
  const { data } = await api.post('/rooms', payload);
  return data;
};

const updateRoom = async (id, payload) => {
  const { data } = await api.put(`/rooms/${id}`, payload);
  return data;
};

const deleteRoom = async (id) => {
  const { data } = await api.delete(`/rooms/${id}`);
  return data;
};

export default {
  getRooms,
  getRoomById,
  getAvailability,
  createRoom,
  updateRoom,
  deleteRoom,
};
