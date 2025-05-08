import { memo } from "react";
import { SourceBadge } from "./SourceBadge";
import { ChatSourceCommentGroup } from "./chat_types";

interface ChatSourceProps {
  chatSourceCommentGroups: ChatSourceCommentGroup[];
  onSourceClick: (source: ChatSourceCommentGroup) => void;
}

export const ChatSources: React.FC<ChatSourceProps> = memo(
  ({ chatSourceCommentGroups, onSourceClick }) => {
    // Don't render if no valid sources
    if (!chatSourceCommentGroups || chatSourceCommentGroups.length === 0)
      return null;

    // Filter out invalid source groups
    const validSources = chatSourceCommentGroups.filter(
      (group) =>
        group?.chatSourceComments && group.chatSourceComments.length > 0
    );

    if (validSources.length === 0) return null;

    return (
      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="flex flex-wrap gap-1.5">
          {validSources.map((source, index) => (
            <SourceBadge
              key={index}
              source={source}
              onClick={() => onSourceClick(source)}
            />
          ))}
        </div>
      </div>
    );
  }
);

ChatSources.displayName = "ChatSources";
