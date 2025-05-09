import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { CommentsProvider } from "@/comments/CommentsProvider";
import WorkspaceSelect from "./pages/WorkspaceSelect";
import WorkspaceNew from "./pages/WorkspaceNew";
import NotFound from "./pages/NotFound";
import Workspace from "./pages/Workspace";
const queryClient = new QueryClient();

const App = () => (
  <CommentsProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Routes>
            <Route path="/" element={<WorkspaceSelect />} />
            <Route path="/workspace/:workspaceId" element={<Workspace />} />
            <Route path="/workspace/new" element={<WorkspaceNew />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </CommentsProvider>
);

export default App;
