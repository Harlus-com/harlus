import { ChatMessage } from "./chat_types";
import { Button } from "@/components/ui/button";
import { X, FileText } from "lucide-react";

interface ReadingMessageProps {
  message: ChatMessage;
  enoughAnswersToStop: boolean;
}

export const ReadingMessage: React.FC<ReadingMessageProps> = ({
  message,
  enoughAnswersToStop,
}) => {
  // Make sure spinning circle only stops when there are enough answers
  return (
    <div
      className={`flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-full border reading-message-transition w-full ${
        enoughAnswersToStop
          ? "bg-gray-50/50 text-gray-400/70 border-gray-100/70"
          : "bg-gray-50 text-gray-400 border-gray-100 animate-pulse-soft"
      }`}
    >
      <div className="relative flex items-center justify-center h-3.5 w-3.5 shrink-0">
        {enoughAnswersToStop ? (
          <div className="h-2 w-2 rounded-full bg-green-300/50"></div>
        ) : (
          <svg
            className="h-3.5 w-3.5 animate-spin text-gray-400"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
      </div>
      <span
        className={`text-[11px] italic truncate ${
          enoughAnswersToStop ? "text-gray-500/70" : "text-gray-500"
        }`}
      >
        {message.content}
      </span>
    </div>
  );
};

// Reading messages collapse toggle
interface ReadingMessagesToggleProps {
  count: number;
  isExpanded: boolean;
  onClick: () => void;
}

export const ReadingMessagesToggle: React.FC<ReadingMessagesToggleProps> = ({
  count,
  isExpanded,
  onClick,
}) => (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 px-2.5 text-[10px] text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full flex items-center gap-1 transition-colors"
    onClick={onClick}
  >
    {isExpanded ? (
      <>
        <span className="flex items-center">
          <X size={10} className="mr-1" />
          Hide
        </span>
      </>
    ) : (
      <>
        <span className="flex items-center">
          <FileText size={10} className="mr-1" />
          Show
        </span>
      </>
    )}{" "}
    {count} document{count !== 1 ? "s" : ""} read
  </Button>
);
