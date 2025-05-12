import React, { useState } from "react";
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

const WorkspaceSelect = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(
    null
  );

  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspaceService.getWorkspaces(),
  });

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
              className="p-6 bg-card rounded-lg border hover:border-primary transition-colors"
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
