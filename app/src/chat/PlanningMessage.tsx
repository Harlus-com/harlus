import React, { useEffect, useState } from "react";
import { BrainCircuit } from "lucide-react";
import { ChatMessage } from "./chat_types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface PlanningMessageProps {
  message: ChatMessage;
}

export const PlanningMessage: React.FC<PlanningMessageProps> = ({ message }) => {
  const [colorPhase, setColorPhase] = useState(0);
  
  // Subtle color animation effect with smoother transition
  useEffect(() => {
    const interval = setInterval(() => {
      setColorPhase((prev) => (prev + 1) % 100);
    }, 50);
    
    return () => clearInterval(interval);
  }, []);
  
  // Calculate opacity based on a sine wave for smooth pulsing
  const getOpacityStyle = () => {
    const opacity = 0.6 + 0.2 * Math.sin(colorPhase / 3);
    return { opacity };
  };
  
  return (
    <div className="w-full flex flex-col mb-3 mt-1.5 pl-1">
      {/* Thinking header with brain icon */}
      <div className="flex items-center gap-1.5 mb-1.5 text-gray-500">
        <BrainCircuit size={14} className="text-gray-400" />
        <span className="text-xs font-medium">Thinking</span>
      </div>
      
      {/* Planning message content with markdown support */}
      <div 
        className="text-xs italic text-gray-500 px-3 py-2 rounded-md bg-gray-50/50 max-w-[90%] transition-opacity duration-300"
        style={getOpacityStyle()}
      >
        <div className={cn(
          "prose prose-sm max-w-none",
          "prose-p:text-gray-500 prose-p:italic prose-p:leading-relaxed prose-p:my-1",
          "prose-code:text-[10px] prose-code:bg-gray-100/50 prose-code:px-1 prose-code:rounded",
          "prose-pre:bg-gray-100/50 prose-pre:p-1.5 prose-pre:rounded",
          "prose-ol:pl-4 prose-ol:my-1 prose-ul:pl-4 prose-ul:my-1",
          "prose-li:my-0.5 prose-li:text-gray-500 prose-li:italic"
        )}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}; 