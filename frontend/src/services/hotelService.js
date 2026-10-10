import api from './api';

// Wraps src/routes/hotelRoute.js on the backend. GET /hotels supports:
//   search, city, country, minPrice, maxPrice, minRating, amenity,
//   sort (price_asc | price_desc | rating_desc | newest), page, limit
// and returns { hotels[], page, limit, total, totalPages }.
const getHotels = async (params = {}) => {
  const { data } = await api.get('/hotels', { params });
  return data;
};

const getHotelById = async (id) => {
  const { data } = await api.get(`/hotels/${id}`);
  return data;
};

const createHotel = async (payload) => {
  const { data } = await api.post('/hotels', payload);
  return data;
};

const updateHotel = async (id, payload) => {
  const { data } = await api.put(`/hotels/${id}`, payload);
  return data;
};

const deleteHotel = async (id) => {
  const { data } = await api.delete(`/hotels/${id}`);
  return data;
};

export default { getHotels, getHotelById, createHotel, updateHotel, deleteHotel };
