import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceService } from "@/api/workspaceService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

const POLLING_INTERVAL = 1000; // 1 second
const TIMEOUT_DURATION = 120000; // 2 minutes

const WorkspaceSelect = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const { data: workspaces = [], status } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspaceService.getWorkspaces(),
    refetchInterval: POLLING_INTERVAL,
    retry: false,
  });

  useEffect(() => {
    if (status === "success") {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setHasTimedOut(true);
        setIsLoading(false);
      }
    }, TIMEOUT_DURATION);

    return () => clearTimeout(timeoutId);
  }, [isLoading]);

  const handleDelete = async (workspaceId: string) => {
    try {
      await workspaceService.deleteWorkspace(workspaceId);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast({
        title: "Workspace deleted",
        description: "The workspace has been successfully deleted.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete workspace",
      });
    } finally {
      setWorkspaceToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary rounded-full animate-spin border-t-transparent"></div>
          </div>
          <div className="flex items-center gap-1 text-2xl font-bold">
            Loading
            <span className="animate-bounce [animation-delay:-0.3s]">.</span>
            <span className="animate-bounce [animation-delay:-0.15s]">.</span>
            <span className="animate-bounce">.</span>
          </div>
        </div>
      </div>
    );
  }

  if (hasTimedOut) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 p-8 rounded-lg border border-destructive/20 bg-destructive/5">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-destructive mb-2">
              Application failed to load
            </h2>
            <p className="text-muted-foreground">
              We couldn't connect to the server. Please try restarting the
              application.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Select Workspace</h1>
          <Button onClick={() => navigate("/workspace/new")}>
            <Plus className="mr-2" />
            New Workspace
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="p-6 bg-card rounded-lg border hover:border-primary transition-colors cursor-pointer"
              onClick={() => navigate(`/workspace/${workspace.id}`)}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-2xl font-bold">{workspace.name}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWorkspaceToDelete(workspace.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-muted-foreground mb-4">Used to be name</p>
              <time className="text-sm text-muted-foreground">
                Created {new Date().toLocaleDateString()}
              </time>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog
        open={!!workspaceToDelete}
        onOpenChange={() => setWorkspaceToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workspace? This will delete
              the data index for each file in the workspace, requiring these
              files to be resynced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                workspaceToDelete && handleDelete(workspaceToDelete)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkspaceSelect;
