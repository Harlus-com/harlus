import axios from "axios";
import { useAuth } from "../auth/AuthContext";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

export const useApiClient = () => {
  const { getToken } = useAuth();

  apiClient.interceptors.request.use(async (config) => {
    try {
      const token = await getToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.error("Failed to get token:", error);
    }
    return config;
  });

  return apiClient;
};

export default apiClient;
