import { PanelResizeHandle } from "react-resizable-panels";

export default function PanelDivider(props: { invisible?: boolean }) {
  const width = props.invisible ? "" : "w-px";
  return (
    <PanelResizeHandle className="relative group bg-transparent cursor-ew-resize">
      <div
        className={`absolute inset-y-0 ${width} group-hover:w-1 bg-gray-300`}
      />
    </PanelResizeHandle>
  );
}
