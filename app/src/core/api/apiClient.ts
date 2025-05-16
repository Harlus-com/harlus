import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { useAuth } from "../auth/AuthContext";
import { useState, useEffect } from "react";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

class ApiClient {
  private static instance: ApiClient;
  private client: AxiosInstance | null = null;
  private auth: ReturnType<typeof useAuth> | null = null;

  private constructor() {}

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  setAuth(auth: ReturnType<typeof useAuth>) {
    this.auth = auth;
    this.setupClient();
  }

  private async setupClient() {
    if (!this.auth) return;

    try {
      const token = await this.auth.getToken();
      this.client = axios.create({
        baseURL,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Add response interceptor to handle token refresh
      this.client.interceptors.response.use(
        (response) => response,
        async (error) => {
          if (error.response?.status === 401 && this.auth) {
            try {
              const newToken = await this.auth.getToken();
              error.config.headers.Authorization = `Bearer ${newToken}`;
              return axios(error.config);
            } catch (refreshError) {
              console.error("Token refresh failed:", refreshError);
              throw refreshError;
            }
          }
          throw error;
        }
      );
    } catch (error) {
      console.error("Failed to setup API client:", error);
    }
  }

  async getClient(): Promise<AxiosInstance> {
    if (!this.client) {
      throw new Error(
        "API client not initialized. Make sure to call setAuth first."
      );
    }
    return this.client;
  }
}

export const apiClient = ApiClient.getInstance();

// Hook to initialize the API client with auth
export const useApiClient = () => {
  const auth = useAuth();

  useEffect(() => {
    apiClient.setAuth(auth);
  }, [auth]);

  return apiClient;
};

// Export a function to make authenticated requests
export const makeAuthenticatedRequest = async <T>(
  config: AxiosRequestConfig
): Promise<T> => {
  const { getToken } = useAuth();
  const token = await getToken();

  const response = await axios({
    ...config,
    baseURL,
    headers: {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};
