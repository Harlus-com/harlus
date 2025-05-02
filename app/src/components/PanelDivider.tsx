import { PanelResizeHandle } from "react-resizable-panels";

export default function PanelDivider() {
  return (
    <PanelResizeHandle className="relative group bg-transparent cursor-ew-resize">
      <div className="absolute inset-y-0 w-px group-hover:w-1 bg-gray-300" />
    </PanelResizeHandle>
  );
}
