import axios from "axios";
const ip = "http://10.39.87.187:5000/v1";
const local = "http://127.0.0.1:5000/v1";
const cloud = "https://admin-api.labpilotpro.com/v1";
const baseAPI = axios.create({
  baseURL: cloud, // ✅ sends cookies cross-origin (refreshToken, deviceId)
});

export default baseAPI;
