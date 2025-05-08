import { useCallback } from "react";
import { fileService } from "@/api/fileService";
import {
  ChatSourceCommentGroup,
  MessagePair,
  Thread,
  ThreadSavedState,
} from "./chat_types";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";
import { ReadingMessage } from "./ReadingMessage";
import { ReadingMessagesToggle } from "./ReadingMessage";
import { CommentGroup } from "@/api/comment_types";
import { useComments } from "@/comments/useComments";
import { WorkspaceFile } from "@/api/workspace_types";
import { useChatThread } from "./ChatThreadContext";
interface MessagePairProps {
  pair: MessagePair;
  isReading: boolean;
  toggleReadingMessages: (pairId: string) => void;
  onSourceClicked: (file: WorkspaceFile) => void;
}

export const MessagePairComponent: React.FC<MessagePairProps> = ({
  pair,
  toggleReadingMessages,
  onSourceClicked,
}) => {
  const {
    addChatSourceComments,
    addCommentGroup,
    setActiveCommentGroups,
    getAllComments,
    getAllCommentGroups,
  } = useComments();
  const { currentThreadId, getThread } = useChatThread();
  const thread = getThread(currentThreadId);
  if (thread.savedState !== ThreadSavedState.SAVED_WITH_MESSAGES) {
    throw new Error("Thread is not saved with messages");
  }

  // Handle source clicks
  const handleSourceClick = useCallback(
    async (chatSourceCommentGroup: ChatSourceCommentGroup) => {
      console.log("[MessagePair] Source clicked:", chatSourceCommentGroup);

      if (onSourceClicked) {
        try {
          const file = await fileService.getFileFromPath(
            chatSourceCommentGroup.filePath
          );
          if (!file) {
            console.error(
              "[MessagePair] No workspace file found:",
              chatSourceCommentGroup
            );
            return;
          }

          const commentGroup: CommentGroup = {
            id: thread.id,
            name: `[Chat] ${thread.title}`,
            createdAt: thread.createdAt,
          };
          addCommentGroup(commentGroup, { ignoreIfExists: true });
          setActiveCommentGroups(file.id, [commentGroup.id]);
          await addChatSourceComments(
            chatSourceCommentGroup.chatSourceComments,
            commentGroup,
            { ignoreIfExists: true }
          );
          onSourceClicked(file);
        } catch (error) {
          console.error("[MessagePair] Error opening source:", error);
        }
      }
    },
    [
      onSourceClicked,
      addChatSourceComments,
      addCommentGroup,
      setActiveCommentGroups,
      getAllComments,
      getAllCommentGroups,
    ]
  );

  const handleToggleReadingMessages = useCallback(() => {
    toggleReadingMessages(pair.id);
  }, [toggleReadingMessages, pair.id]);

  return (
    <div className="space-y-1">
      <UserMessage message={pair.userMessage} />

      {/* Reading messages section - show immediately after user message */}
      {pair.readingMessages.length > 0 && (
        <div className="mt-3 mb-3">
          {/* Toggle for reading messages when we have enough answers */}
          <div className="flex flex-col space-y-1.5">
            {pair.answerCount >= 5 && (
              <ReadingMessagesToggle
                count={pair.readingMessages.length}
                isExpanded={pair.showReadingMessages}
                onClick={handleToggleReadingMessages}
              />
            )}

            {/* Show reading messages if expanded or we don't have enough answers yet */}
            {(pair.showReadingMessages || pair.answerCount < 5) && (
              <div className="flex flex-row flex-wrap gap-2 text-gray-400 mt-1">
                {pair.readingMessages.map((readingMsg, index) => (
                  <ReadingMessage
                    key={index}
                    message={readingMsg}
                    enoughAnswersToStop={pair.answerCount >= 12}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {pair.assistantMessage && (
        <AssistantMessage
          message={pair.assistantMessage}
          handleSourceClick={handleSourceClick}
        />
      )}
    </div>
  );
};

MessagePairComponent.displayName = "MessagePairComponent";
