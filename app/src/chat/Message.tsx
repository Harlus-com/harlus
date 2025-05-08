import { memo, useCallback, useContext } from "react";
import { fileService } from "@/api/fileService";
import { ChatSourceCommentGroup, MessagePair } from "./chat_types";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";
import { ReadingMessage } from "./ReadingMessage";
import { ReadingMessagesToggle } from "./ReadingMessage";
import { CommentGroup } from "@/api/comment_types";
import { useComments } from "@/comments/useComments";
import { SourceClickContext } from "./SourceContext";

interface MessagePairProps {
  pair: MessagePair;
  isReading: boolean;
  toggleReadingMessages: (pairId: string) => void;
}

export const MessagePairComponent: React.FC<MessagePairProps> = ({
  pair,
  toggleReadingMessages,
}) => {
  const { onSourceClicked } = useContext(SourceClickContext);
  const {
    addChatSourceComments,
    addCommentGroup,
    setActiveCommentGroups,
    getAllComments,
    getAllCommentGroups,
  } = useComments();

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

          // Create or reuse existing comment group
          const commentGroupId = `chat-source-${chatSourceCommentGroup.filePath.replace(
            /\//g,
            "-"
          )}`;
          const commentGroup: CommentGroup = {
            id: commentGroupId,
            name: `Source from AI Assistant`,
          };

          // Get existing comments for this file
          const existingComments = getAllComments(file.id);
          const existingCommentIds = new Set(
            existingComments.map((comment) => comment.id)
          );

          // Only add the comment group if it doesn't already exist
          const existingGroups = getAllCommentGroups(file.id);
          const groupExists = existingGroups.some(
            (group) => group.id === commentGroupId
          );

          if (!groupExists) {
            addCommentGroup(commentGroup);
          }

          // Set this as the active comment group for the file
          setActiveCommentGroups(file.id, [commentGroupId]);

          // Filter out comments that already exist
          if (chatSourceCommentGroup.chatSourceComments) {
            const filteredComments =
              chatSourceCommentGroup.chatSourceComments.filter(
                (comment) => !existingCommentIds.has(comment.id)
              );

            console.log(
              `[MessagePair] Adding ${filteredComments.length} new comments out of ${chatSourceCommentGroup.chatSourceComments.length} total`
            );

            if (filteredComments.length > 0) {
              await addChatSourceComments(filteredComments, commentGroup);
            }
          }

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
