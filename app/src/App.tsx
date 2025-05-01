import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import WorkspaceSelect from "./pages/WorkspaceSelect";
import WorkspaceNew from "./pages/WorkspaceNew";
import NotFound from "./pages/NotFound";
import AppLayout from "./pages/AppLayout";
import Workspace from "./pages/Workspace";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<WorkspaceSelect />} />
          <Route path="/workspace2" element={<Workspace />} />
          <Route path="/workspace/new" element={<WorkspaceNew />} />
          <Route path="/workspace/:workspaceId" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
