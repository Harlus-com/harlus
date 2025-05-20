import { Workspace as WorkspaceType } from "@/api/workspace_types";
import { workspaceService } from "@/api/workspaceService";
import { CommentsProvider } from "@/comments/CommentsProvider";
import ChatPanel from "@/chat/ChatPanel";
import FileExplorer from "@/components/FileExplorer";
import FileView from "@/components/FileView";
import PanelDivider from "@/components/PanelDivider";
import { TopLevelPanel, TopLevelPanelId } from "@/components/panels";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import { useEffect, useState } from "react";
import { Panel, PanelGroup } from "react-resizable-panels";
import { useNavigate, useParams } from "react-router-dom";
import { ChatThreadProvider } from "@/chat/ChatThreadContext";
import { FileContextProvider } from "@/files/FileContext";
import { FileViewContextProvider } from "@/files/FileViewContext";

// The default sizes scale relative to each other.
// They work best when the sum of all the default sizes is 100.
// If one of the panels is not visible, they will be "resacled" to add up to 100.
const FILE_EXPLORER = new TopLevelPanel(TopLevelPanelId.FILE_EXPLORER, 15);
const FILE_VIEWER = new TopLevelPanel(TopLevelPanelId.FILE_VIEWER, 65);
const CHAT = new TopLevelPanel(TopLevelPanelId.CHAT, 20);

export default function Workspace() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<WorkspaceType | null>(null);

  const loadWorkspace = async () => {
    if (!workspaceId) {
      navigate("/");
      return;
    }

    const workspace = await workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      navigate("/");
      return;
    }

    setWorkspace(workspace);
  };

  useEffect(() => {
    loadWorkspace();
  }, [workspaceId, navigate]);

  const [visiblePanels, setVisiblePanels] = useState<TopLevelPanelId[]>([
    TopLevelPanelId.FILE_EXPLORER,
    TopLevelPanelId.FILE_VIEWER,
  ]);

  const togglePanelVisibility = (panelId: TopLevelPanelId) => {
    setVisiblePanels((prev) =>
      prev.includes(panelId)
        ? prev.filter((id) => id !== panelId)
        : [...prev, panelId]
    );
  };

  const reloadWorkspace = async () => {
    if (!workspaceId) return;
    window.location.reload();
  };

  return (
    <FileContextProvider workspaceId={workspaceId!}>
      <FileViewContextProvider>
        <ChatThreadProvider workspaceId={workspaceId!}>
          <CommentsProvider workspaceId={workspaceId!}>
            <div className="flex flex-col h-screen">
              <WorkspaceHeader
                workspace={workspace}
                togglePanelVisibility={togglePanelVisibility}
                setVisiblePanels={setVisiblePanels}
                reloadWorkspace={reloadWorkspace}
              />
              <PanelGroup
                id="workspace"
                direction="horizontal"
                className="flex-1"
              >
                {visiblePanels.includes(TopLevelPanelId.FILE_EXPLORER) && (
                  <Panel
                    id={FILE_EXPLORER.id}
                    order={1}
                    defaultSize={FILE_EXPLORER.defaultSize}
                    minSize={FILE_EXPLORER.minSize}
                    className="bg-blue-50 h-full w-auto"
                  >
                    <FileExplorer workspaceId={workspaceId!} />
                  </Panel>
                )}
                <PanelDivider />
                <Panel
                  id={FILE_VIEWER.id}
                  order={2}
                  defaultSize={FILE_VIEWER.defaultSize}
                  minSize={FILE_VIEWER.minSize}
                >
                  <FileView />
                </Panel>
                {visiblePanels.includes(TopLevelPanelId.CHAT) && (
                  <PanelDivider />
                )}
                {visiblePanels.includes(TopLevelPanelId.CHAT) && (
                  <Panel
                    id={CHAT.id}
                    order={4}
                    defaultSize={CHAT.defaultSize}
                    minSize={CHAT.minSize}
                  >
                    <ChatPanel />
                  </Panel>
                )}
              </PanelGroup>
            </div>
          </CommentsProvider>
        </ChatThreadProvider>
      </FileViewContextProvider>
    </FileContextProvider>
  );
}
