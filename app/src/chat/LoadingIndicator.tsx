import { memo } from "react";

export const LoadingIndicator: React.FC = () => (
  <div className="flex items-center gap-2 p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
    <div className="flex space-x-1">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse delay-150"></div>
      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse delay-300"></div>
    </div>
    <span className="text-xs text-gray-500">Thinking...</span>
  </div>
);

LoadingIndicator.displayName = "LoadingIndicator";
