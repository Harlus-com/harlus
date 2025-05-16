import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { authClientWrapper } from "./api/auth_client_wrapper";
import ProtectedRoute from "./auth/ProtectedRoute";
import WorkspaceSelect from "./pages/WorkspaceSelect";
import WorkspaceNew from "./pages/WorkspaceNew";
import NotFound from "./pages/NotFound";
import Workspace from "./pages/Workspace";
import Login from "./pages/Login";
import { useEffect } from "react";

const queryClient = new QueryClient();

const AppRoutes = () => {
  // Initialize API client with auth
  const auth = useAuth();

  useEffect(() => {
    const setAuth = async () => {
      await authClientWrapper.setAuth(auth);
    };
    setAuth();
  }, [auth]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <WorkspaceSelect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/:workspaceId"
        element={
          <ProtectedRoute>
            <Workspace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/new"
        element={
          <ProtectedRoute>
            <WorkspaceNew />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
