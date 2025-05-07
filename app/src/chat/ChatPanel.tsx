import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  useContext,
  useMemo,
} from "react";
import {
  Send,
  FileText,
  X,
  BookOpen,
  Plus,
  ChevronDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fileService } from "@/api/fileService";
import { WorkspaceFile } from "@/api/workspace_types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useParams } from "react-router-dom";
import { chatService } from "@/chat/chatService";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChatMessage, ChatSourceCommentGroup, MessagePair } from "./chat_types";
import { useComments } from "@/comments/useComments";
import { CommentGroup } from "@/api/comment_types";
import { getHighestZeroIndexedPageNumber } from "@/comments/comment_util";
import { ChatHistory } from "./ChatHistory";

interface ChatPanelProps {
  onSourceClicked?: (file: WorkspaceFile) => void;
}

// Message type interfaces
interface MessageProps {
  message: ChatMessage;
  isUser: boolean;
}

interface MessagePairProps {
  pair: MessagePair;
  isReading: boolean;
  toggleReadingMessages: (pairId: string) => void;
}

interface ChatSourceProps {
  chatSourceCommentGroups: ChatSourceCommentGroup[];
  onSourceClick: (source: ChatSourceCommentGroup) => void;
}

// Create a separate context for source click handling
const SourceClickContext = React.createContext<{
  onSourceClicked?: (file: WorkspaceFile) => void;
}>({});

// Reading indicator message component
interface ReadingMessageProps {
  message: ChatMessage;
  enoughAnswersToStop: boolean;
}

const ReadingMessage: React.FC<ReadingMessageProps> = ({
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

const ReadingMessagesToggle: React.FC<ReadingMessagesToggleProps> = ({
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

// Improved source badge component
interface SourceBadgeProps {
  source: ChatSourceCommentGroup;
  onClick: () => void;
}

const SourceBadge: React.FC<SourceBadgeProps> = ({ source, onClick }) => {
  // TODO: Get the Actual File Name
  const fileName = source.filePath.split("/").slice(-2, -1)[0] || "Unknown";

  // Extract page numbers if available
  const pageNumbers = useMemo(() => {
    if (!source.chatSourceComments) return [];

    return [
      ...new Set(
        source.chatSourceComments
          .map((comment) =>
            getHighestZeroIndexedPageNumber(
              comment?.highlightArea?.boundingBoxes
            )
          )
          .filter((pageNumber) => pageNumber !== null)
          .map((pageNumber) => pageNumber + 1)
      ),
    ];
  }, [source.chatSourceComments]);

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-auto py-1 px-2.5 text-[11px] gap-1 mr-0 mb-1.5 inline-flex items-center bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 rounded-full grow basis-full sm:basis-[48%] sm:mr-0 sm:max-w-[49%]"
      onClick={onClick}
    >
      <FileText size={10} className="shrink-0" />
      <span className="truncate">{fileName}</span>
      {pageNumbers.length > 0 && (
        <Badge
          variant="secondary"
          className="h-4 px-1 text-[9px] bg-blue-200 rounded-full ml-0.5 shrink-0"
        >
          p.{pageNumbers.join(",")}
        </Badge>
      )}
    </Button>
  );
};

// User message component
const UserMessage: React.FC<{ message: ChatMessage }> = memo(({ message }) => {
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
});

UserMessage.displayName = "UserMessage";

// Component to display sources with improved UI
const ChatSources: React.FC<ChatSourceProps> = memo(
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

// Assistant message with improved styling
const AssistantMessage: React.FC<{
  message: ChatMessage;
  readingMessages: ChatMessage[];
  showReadingMessages: boolean;
  answerCount: number;
  handleSourceClick: (source: ChatSourceCommentGroup) => void;
  toggleReadingMessages: () => void;
  isReading: boolean;
}> = memo(
  ({
    message,
    readingMessages,
    showReadingMessages,
    answerCount,
    handleSourceClick,
    toggleReadingMessages,
    isReading,
  }) => {
    return (
      <div className="flex flex-col mt-4">
        {/* AI Response */}
        <div className="px-0.5">
          <div
            className={cn(
              "prose prose-sm max-w-none text-[13px]",
              "prose-headings:font-medium prose-headings:text-gray-800",
              "prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1.5",
              "prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline",
              "prose-strong:font-medium prose-strong:text-gray-800",
              "prose-code:text-xs prose-code:bg-gray-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
              "prose-pre:bg-gray-50 prose-pre:p-2 prose-pre:rounded",
              "prose-ol:pl-5 prose-ol:my-1.5 prose-ul:pl-5 prose-ol:my-1.5",
              "prose-li:my-0.5 prose-li:text-gray-700"
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => (
                  <h1 className="text-base font-medium mt-5 mb-2" {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2
                    className="text-[15px] font-medium mt-4 mb-1.5"
                    {...props}
                  />
                ),
                h3: ({ node, ...props }) => (
                  <h3
                    className="text-[14px] font-medium mt-3 mb-1.5"
                    {...props}
                  />
                ),
                p: ({ node, ...props }) => (
                  <p
                    className="text-gray-700 my-1.5 text-[13px] leading-relaxed"
                    {...props}
                  />
                ),
                ul: ({ node, ...props }) => (
                  <ul
                    className="list-disc pl-4 my-1.5 text-[13px]"
                    {...props}
                  />
                ),
                ol: ({ node, ...props }) => (
                  <ol
                    className="list-decimal pl-4 my-1.5 text-[13px]"
                    {...props}
                  />
                ),
                li: ({ node, ...props }) => (
                  <li className="my-0.5 text-[13px]" {...props} />
                ),
                code: ({
                  inline,
                  className,
                  children,
                  ...props
                }: {
                  inline?: boolean;
                  className?: string;
                  children?: React.ReactNode;
                }) =>
                  inline ? (
                    <code
                      className="bg-gray-50 px-1 py-0.5 rounded text-xs font-mono text-gray-800"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <pre className="bg-gray-50 p-2 rounded-md overflow-x-auto my-2 text-xs">
                      <code
                        className="text-xs font-mono text-gray-800"
                        {...props}
                      >
                        {children}
                      </code>
                    </pre>
                  ),
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-3 text-xs">
                    <table
                      className="min-w-full divide-y divide-gray-200 text-xs"
                      {...props}
                    />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-gray-50" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th
                    className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    {...props}
                  />
                ),
                td: ({ node, ...props }) => (
                  <td
                    className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-500 border-t border-gray-100"
                    {...props}
                  />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote
                    className="border-l-2 border-gray-200 pl-3 py-1 my-3 text-gray-600 italic text-[12px]"
                    {...props}
                  />
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Sources at bottom of message */}
        {message.chatSourceCommentGroups &&
          message.chatSourceCommentGroups.length > 0 && (
            <ChatSources
              chatSourceCommentGroups={message.chatSourceCommentGroups}
              onSourceClick={handleSourceClick}
            />
          )}
      </div>
    );
  }
);

AssistantMessage.displayName = "AssistantMessage";

// Message pair component
const MessagePairComponent: React.FC<MessagePairProps> = memo(
  ({ pair, isReading, toggleReadingMessages }) => {
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
        {/* User message */}
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

        {/* AI response */}
        {pair.assistantMessage && (
          <AssistantMessage
            message={pair.assistantMessage}
            readingMessages={[]} // Don't pass reading messages to AssistantMessage since we're showing them above
            showReadingMessages={pair.showReadingMessages}
            answerCount={pair.answerCount}
            handleSourceClick={handleSourceClick}
            toggleReadingMessages={handleToggleReadingMessages}
            isReading={isReading}
          />
        )}
      </div>
    );
  }
);

MessagePairComponent.displayName = "MessagePairComponent";

// Modern loading indicator
const LoadingIndicator: React.FC = memo(() => (
  <div className="flex items-center gap-2 p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
    <div className="flex space-x-1">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse delay-150"></div>
      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse delay-300"></div>
    </div>
    <span className="text-xs text-gray-500">Thinking...</span>
  </div>
));

LoadingIndicator.displayName = "LoadingIndicator";

// Chat panel component
const ChatPanel: React.FC<ChatPanelProps> = ({ onSourceClicked }) => {
  const { workspaceId } = useParams();
  const [messagePairs, setMessagePairs] = useState<MessagePair[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEventSourceActive, setIsEventSourceActive] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);

  const updateAndSaveMessages = (
    fn: (prev: MessagePair[]) => MessagePair[]
  ) => {
    setMessagePairs((prev) => {
      const newMessages = fn(prev);
      if (currentThreadId && workspaceId) {
        chatService.saveChatHistory(newMessages, currentThreadId, workspaceId);
      }
      return newMessages;
    });
  };

  // Load chat history for current thread
  const loadChatHistory = useCallback(async () => {
    if (!currentThreadId || !workspaceId) return;
    const history = await chatService.getChatHistory(
      currentThreadId,
      workspaceId
    );
    setMessagePairs(history.messagePairs);
    console.log("[ChatPanel] Chat history:", history.messagePairs);
  }, [currentThreadId, workspaceId]);

  // Load chat history when thread changes
  useEffect(() => {
    if (currentThreadId) {
      loadChatHistory();
    }
  }, [currentThreadId, loadChatHistory]);

  // scroll to bottom of chat container
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [messagePairs]);

  // Toggle reading messages visibility for a specific pair
  const toggleReadingMessages = useCallback((pairId: string) => {
    updateAndSaveMessages((prev) =>
      prev.map((pair) =>
        pair.id === pairId
          ? { ...pair, showReadingMessages: !pair.showReadingMessages }
          : pair
      )
    );
  }, []);

  // send message
  const handleSendMessage = useCallback(async () => {
    if (
      !input.trim() ||
      isEventSourceActive ||
      !currentThreadId ||
      !workspaceId
    )
      return;

    const pairId = `${Date.now()}.${Math.floor(Math.random() * 100)}`;
    setCurrentPairId(pairId);

    // create user message
    const userMessage: ChatMessage = {
      id: `${pairId}.user`,
      sender: "user",
      content: input.trim(),
      timestamp: now(),
      chatSourceCommentGroups: [],
    };

    // add message pair to the list
    updateAndSaveMessages((prev) => [
      ...prev,
      {
        id: pairId,
        userMessage,
        assistantMessage: {
          id: `${pairId}.assistant`,
          sender: "assistant",
          content: "",
          timestamp: now(),
          chatSourceCommentGroups: [],
          messageType: "answer_message",
        },
        readingMessages: [],
        answerCount: 0,
        showReadingMessages: true,
        readingMessageBuffer: "",
      },
    ]);
    setInput("");
    setIsLoading(true);
    setIsEventSourceActive(true);

    // handle response from the backend
    try {
      await chatService.streamChat(
        input.trim(),
        workspaceId,
        currentThreadId,
        // onMessage handler - for all types of messages
        (newContent, messageType) => {
          updateAndSaveMessages((prev) => {
            const newPairs = [...prev];
            const currentPair = newPairs.find((pair) => pair.id === pairId);

            if (currentPair) {
              if (messageType === "reading_message") {
                // Add to the buffer and process the updated content
                currentPair.readingMessageBuffer += newContent;

                // Split by newlines and process
                if (currentPair.readingMessageBuffer.includes("\n")) {
                  const lines = currentPair.readingMessageBuffer.split("\n");

                  // Last item might be incomplete (no newline yet)
                  const incompleteLine = lines.pop() || "";

                  // Process all complete lines (with newlines)
                  const existingReadingIds = new Set(
                    currentPair.readingMessages.map((m) => m.content.trim())
                  );

                  // Add new complete reading messages
                  lines.forEach((line) => {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !existingReadingIds.has(trimmedLine)) {
                      currentPair.readingMessages.push({
                        id: `${pairId}.reading.${Date.now()}.${Math.random()
                          .toString(36)
                          .substring(2, 8)}`,
                        sender: "assistant",
                        content: trimmedLine,
                        timestamp: now(),
                        chatSourceCommentGroups: [],
                        messageType: "reading_message",
                      });
                    }
                  });

                  // Update buffer with incomplete line
                  currentPair.readingMessageBuffer = incompleteLine;
                }

                // Always ensure the current buffer content is visible if it's not empty
                // and doesn't duplicate an existing reading message
                const bufferContent = currentPair.readingMessageBuffer.trim();
                if (
                  bufferContent &&
                  !currentPair.readingMessages.some(
                    (m) => m.content === bufferContent
                  )
                ) {
                  const tempId = `${pairId}.reading.buffer`;

                  // Check if we already have a buffer message
                  const bufferMsgIndex = currentPair.readingMessages.findIndex(
                    (m) => m.id.includes(".buffer")
                  );

                  if (bufferMsgIndex >= 0) {
                    // Update existing buffer message
                    currentPair.readingMessages[bufferMsgIndex].content =
                      bufferContent;
                  } else {
                    // Add a new buffer message
                    currentPair.readingMessages.push({
                      id: tempId,
                      sender: "assistant",
                      content: bufferContent,
                      timestamp: now(),
                      chatSourceCommentGroups: [],
                      messageType: "reading_message",
                    });
                  }
                }
              } else if (messageType === "answer_message") {
                // Add to main answer
                currentPair.assistantMessage = {
                  ...currentPair.assistantMessage!,
                  content: currentPair.assistantMessage!.content + newContent,
                  messageType: "answer_message",
                };

                // Only increment answer count when content is meaningful (length > 2)
                if (newContent.trim().length > 2) {
                  currentPair.answerCount += 1;

                  // If we just reached 5 answers, change reading message appearance
                  if (currentPair.answerCount === 5) {
                    setTimeout(() => {
                      updateAndSaveMessages((prev) => [...prev]);
                    }, 0);
                  }
                }
              }
            }
            return newPairs;
          });
        },
        // onSources handler - for document sources
        (chatSourceCommentGroups: ChatSourceCommentGroup[]) => {
          updateAndSaveMessages((prev) => {
            const newPairs = [...prev];
            const lastPair = newPairs[newPairs.length - 1];
            if (lastPair && lastPair.assistantMessage) {
              lastPair.assistantMessage = {
                ...lastPair.assistantMessage,
                chatSourceCommentGroups: chatSourceCommentGroups,
              };
            }
            return newPairs;
          });
        },
        // onComplete handler - when the response is complete
        () => {
          setIsLoading(false);
          setIsEventSourceActive(false);
          setCurrentPairId(null);

          // Process any remaining content in the reading message buffer
          updateAndSaveMessages((prev) => {
            const newPairs = [...prev];
            const lastPair = newPairs[newPairs.length - 1];

            if (lastPair) {
              // Process any remaining content in the buffer as a final reading message
              if (lastPair.readingMessageBuffer.trim()) {
                const bufferContent = lastPair.readingMessageBuffer.trim();

                // Check if this content is already in our reading messages
                const existingMatch = lastPair.readingMessages.find(
                  (m) => m.content === bufferContent || m.id.includes(".buffer")
                );

                if (existingMatch) {
                  // Update the existing buffer message to be a permanent message
                  existingMatch.id = `${lastPair.id}.reading.${lastPair.readingMessages.length}`;
                } else if (bufferContent) {
                  // Add a new final reading message
                  lastPair.readingMessages.push({
                    id: `${lastPair.id}.reading.${lastPair.readingMessages.length}`,
                    sender: "assistant",
                    content: bufferContent,
                    timestamp: now(),
                    chatSourceCommentGroups: [],
                    messageType: "reading_message",
                  });
                }

                // Clear the buffer
                lastPair.readingMessageBuffer = "";
              }

              // Remove any duplicate reading messages
              const uniqueContents = new Set<string>();
              lastPair.readingMessages = lastPair.readingMessages.filter(
                (msg) => {
                  if (uniqueContents.has(msg.content)) {
                    return false;
                  }
                  uniqueContents.add(msg.content);
                  return true;
                }
              );

              // Automatically collapse reading messages if we have enough answer content
              if (lastPair.answerCount >= 12) {
                lastPair.showReadingMessages = false;
              }
            }

            return newPairs;
          });
        },
        // onError handler - when an error occurs
        (error) => {
          console.error("[ChatPanel] Error in chat stream:", error);
          setIsLoading(false);
          setIsEventSourceActive(false);
          setCurrentPairId(null);
          updateAndSaveMessages((prev) => {
            const newPairs = [...prev];
            const currentPair = newPairs.find((pair) => pair.id === pairId);
            if (currentPair && currentPair.assistantMessage) {
              currentPair.assistantMessage.content =
                "Sorry, there was an error processing your request.";
            }
            return newPairs;
          });
        }
      );
    } catch (error) {
      console.error("[ChatPanel] Error setting up stream:", error);
      setIsLoading(false);
      setIsEventSourceActive(false);
      setCurrentPairId(null);
    }
  }, [input, isEventSourceActive, workspaceId, currentThreadId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      chatService.close();
    };
  }, []);

  // send message on enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // render chat panel
  return (
    <SourceClickContext.Provider value={{ onSourceClicked }}>
      <div className="h-full flex flex-col border-l border-gray-100 bg-gray-50">
        <div className="py-2.5 px-3.5 font-medium border-b border-gray-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-800">AI Assistant</span>
          </div>
        </div>

        {workspaceId && (
          <ChatHistory
            workspaceId={workspaceId}
            currentThreadId={currentThreadId}
            onThreadSelect={setCurrentThreadId}
            onThreadCreate={setCurrentThreadId}
            onThreadDelete={(threadId) => {
              if (currentThreadId === threadId) {
                setCurrentThreadId(null);
                setMessagePairs([]);
              }
            }}
          />
        )}

        <ScrollArea className="flex-1 px-3.5 pt-3.5 pb-2">
          <div ref={chatContainerRef} className="space-y-6">
            {messagePairs.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <div className="inline-flex rounded-full bg-blue-50 p-2 mb-3">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                </div>
                <h3 className="text-base font-medium text-gray-800 mb-1">
                  {currentThreadId
                    ? "Start a new conversation"
                    : "Welcome to Harlus"}
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  {currentThreadId
                    ? "Ask questions about your documents in this chat thread."
                    : "Ask questions about your documents. The AI will analyze the content and provide relevant answers."}
                </p>
              </div>
            ) : (
              <>
                {messagePairs.map((pair) => (
                  <MessagePairComponent
                    key={pair.id}
                    pair={pair}
                    isReading={isEventSourceActive && pair.id === currentPairId}
                    toggleReadingMessages={toggleReadingMessages}
                  />
                ))}
                {isLoading && currentPairId === null && <LoadingIndicator />}
              </>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-gray-100 bg-white">
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-end space-x-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (!isLoading && !isEventSourceActive) {
                    handleKeyDown(e);
                  }
                }}
                placeholder="Ask questions about your documents..."
                className="min-h-[52px] max-h-[120px] resize-none text-sm border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-300 py-2 px-2.5 rounded-md"
                disabled={isLoading || isEventSourceActive}
              />
              <Button
                variant="default"
                size="icon"
                className="h-[52px] w-[52px] shrink-0 bg-blue-600 hover:bg-blue-700 rounded-md"
                onClick={() => {
                  if (!isLoading && !isEventSourceActive) {
                    handleSendMessage();
                  }
                }}
                disabled={!input.trim() || isLoading || isEventSourceActive}
              >
                <Send size={18} />
              </Button>
            </div>

            {isEventSourceActive && (
              <div className="text-[10px] text-gray-400 text-center">
                Processing your request...
              </div>
            )}
          </div>
        </div>
      </div>
    </SourceClickContext.Provider>
  );
};

function now(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default memo(ChatPanel);
