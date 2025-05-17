import { createContext, useContext, useEffect, useState } from "react";
import {
  PublicClientApplication,
  AccountInfo,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";

const msalConfig = {
  auth: {
    clientId: "4717f96d-a8cf-4569-835d-92d0cf8ada69",
    authority:
      "https://login.microsoftonline.com/27dfce8d-8b21-4c81-8579-2baedebea216",
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    allowNativeBroker: false,
  },
};

const loginRequest = {
  scopes: [
    "openid",
    "profile",
    "User.Read",
    "api://6acbb67d-3153-4ed6-8041-f2c52a5a68e4/Harlus.All",
  ],
};

const tokenRequest = {
  scopes: ["api://6acbb67d-3153-4ed6-8041-f2c52a5a68e4/Harlus.All"],
};

const msalInstance = new PublicClientApplication(msalConfig);

interface AuthContextType {
  isAuthenticated: boolean;
  user: AccountInfo | null;
  login: () => Promise<void>;
  getToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AccountInfo | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        setUser(accounts[0]);
        setIsAuthenticated(true);
      }
    };
    checkAuth();
  }, []);

  const login = async () => {
    const result = await msalInstance.loginPopup(loginRequest);
    setUser(result.account);
    setIsAuthenticated(true);
  };

  const getToken = async () => {
    const account = msalInstance.getAllAccounts()[0];
    if (!account) throw new Error("No account found");

    try {
      const response = await msalInstance.acquireTokenSilent({
        ...tokenRequest,
        account: account,
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // fallback to interaction when silent call fails
        const response = await msalInstance.acquireTokenPopup(tokenRequest);
        return response.accessToken;
      }
      throw error;
    }
  };

  return (
    <MsalProvider instance={msalInstance}>
      <AuthContext.Provider value={{ isAuthenticated, user, login, getToken }}>
        {children}
      </AuthContext.Provider>
    </MsalProvider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
