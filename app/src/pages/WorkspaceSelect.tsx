import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { workspaceService } from "@/api/workspaceService";

const WorkspaceSelect = () => {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspaceService.getWorkspaces(),
  });

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
              className="p-6 bg-card rounded-lg border hover:border-primary cursor-pointer transition-colors relative"
              onClick={() => navigate(`/workspace/${workspace.id}`)}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold mb-2">{workspace.name}</h3>
                {workspace.name === "AAPL" && (
                  <div className="bg-yellow-100 p-1.5 rounded-full border-[1.5px] border-yellow-500">
                    <Bell className="w-5 h-5 text-yellow-500" />
                  </div>
                )}
              </div>
              <p className="text-muted-foreground mb-4">Used to be name</p>
              <time className="text-sm text-muted-foreground">
                Created {new Date().toLocaleDateString()}
              </time>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSelect;
