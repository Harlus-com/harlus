import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./core/auth/AuthContext";
import ProtectedRoute from "./core/auth/ProtectedRoute";
import WorkspaceSelect from "./pages/WorkspaceSelect";
import WorkspaceNew from "./pages/WorkspaceNew";
import NotFound from "./pages/NotFound";
import Workspace from "./pages/Workspace";
import Login from "./pages/Login";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
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
        </HashRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
