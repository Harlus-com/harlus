import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { useAuth } from "../auth/AuthContext";

class AuthClientWrapper {
  private static instance: AuthClientWrapper;
  private client: AxiosInstance | null = null;
  private auth: ReturnType<typeof useAuth> | null = null;

  private constructor() {}

  static getInstance(): AuthClientWrapper {
    if (!AuthClientWrapper.instance) {
      AuthClientWrapper.instance = new AuthClientWrapper();
    }
    return AuthClientWrapper.instance;
  }

  async setAuth(auth: ReturnType<typeof useAuth>) {
    this.auth = auth;
    await this.setupClient();
  }

  private async setupClient() {
    try {
      const token = await this.auth.getToken();
      this.client = axios.create({
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

  getClient(): AxiosInstance {
    if (!this.client) {
      throw new Error(
        "API client not initialized. Make sure to call setAuth first."
      );
    }
    return this.client;
  }
}

export const authClientWrapper = AuthClientWrapper.getInstance();
