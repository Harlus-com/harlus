import { ChatMessage } from "./chat_types";

export const UserMessage: React.FC<{ message: ChatMessage }> = ({
  message,
}) => {
  return (
    <div className="flex flex-col">
      <div className="bg-white border border-gray-100 rounded-lg px-3.5 py-2.5 text-[13px] text-gray-800 leading-relaxed shadow-sm">
        {message.content}
      </div>
      {message.timestamp && (
        <div className="text-[9px] text-gray-400 mt-1 ml-1">
          {message.timestamp}
        </div>
      )}
    </div>
  );
};

UserMessage.displayName = "UserMessage";
