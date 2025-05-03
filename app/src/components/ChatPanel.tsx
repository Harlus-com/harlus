import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  useContext,
  useMemo,
} from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fileService } from "@/api/fileService";
import { ChatMessage, WorkspaceFile, ChatSourceCommentGroup, ChatSourceComment } from "@/api/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useParams } from "react-router-dom";
import { BASE_URL } from "@/api/client";
import { FileGroupCount } from "./panels";
import { chatService } from "@/api/chatService";



interface ChatPanelProps {
  onSourceClicked?: (file: WorkspaceFile) => void;
}


// TODO: align chatmessage type with backend, such that historical chat can be persisted in backend only
interface MessageProps {
  message: ChatMessage;
  isUser: boolean;
}

interface MessagePair {
  id: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage | null;
}

interface ChatSourceProps {
  chatSourceCommentGroups: ChatSourceCommentGroup[];
  onSourceClick: (source: ChatSourceCommentGroup) => void;
}

// Create a separate context for source click handling
const SourceClickContext = React.createContext<{
  onSourceClicked?: (file: WorkspaceFile) => void;
}>({});

// Component to display sources
const ChatSources: React.FC<ChatSourceProps> = memo(({ chatSourceCommentGroups, onSourceClick }) => {
  const [showSources, setShowSources] = useState(true);

  // Memoize the sources list to prevent unnecessary re-renders
  const renderedSources = useMemo(() => {
    console.log("[Sources] Rendering sources:", chatSourceCommentGroups);
    if (!chatSourceCommentGroups || chatSourceCommentGroups.length === 0) return null;

    // Safely get pages with null checks
    const pages = chatSourceCommentGroups
      .filter(group => group?.chatSourceComments) // Filter out groups without comments
      .flatMap(cscommentGroup => 
        cscommentGroup.chatSourceComments
          .filter(comment => comment?.highlightArea?.jumpToPageNumber) // Filter out comments without page numbers
          .map(cscomment => cscomment.highlightArea.jumpToPageNumber)
      );

    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] font-medium text-gray-700">
            Sources:
          </div>
          <button
            onClick={() => setShowSources(!showSources)}
            className="text-[12px] text-blue-600 hover:text-blue-800"
          >
            {showSources ? "Hide" : "Show"} Sources
          </button>
        </div>
        {showSources && (
          <ul className="space-y-1">
            {chatSourceCommentGroups.map((chatSourceCommentGroup, index) => {
              console.log("[Sources] Rendering source:", chatSourceCommentGroup);
              return (
                <li key={index}>
                  <button
                    className="text-blue-600 hover:text-blue-800 hover:underline text-[12px]"
                    onClick={() => onSourceClick(chatSourceCommentGroup)}
                  >
                    {`${chatSourceCommentGroup.workspace_file?.name || chatSourceCommentGroup.fileId.split("/").pop()} - Pages: ${pages.join(", ")}`}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }, [chatSourceCommentGroups, showSources, onSourceClick]);

  return renderedSources;
});

ChatSources.displayName = "ChatSources";

// Component to display a chat message
const Message: React.FC<MessageProps> = memo(({ message, isUser }) => {
  const { onSourceClicked } = useContext(SourceClickContext);

  // Open sources associated with a chat message
  const handleSourceClick = useCallback(async (chatSourceCommentGroup: ChatSourceCommentGroup) => {
    console.log("[Message] Source clicked:", chatSourceCommentGroup);

    if (onSourceClicked) {
      try {
        const file = chatSourceCommentGroup.workspace_file;
        const annotations = [];


        // =================================================================================
        // TODO: replace below once new commant format is implemented
        // =================================================================================
        chatSourceCommentGroup.chatSourceComments.forEach((chatSourceComment) => {
          console.log("[Message] Processing comment:", chatSourceComment);

          if (!chatSourceComment.highlightArea.boundingBoxes) {
            console.error("[Message] No bounding boxes found for comment:", chatSourceComment);
            return;
          }

          chatSourceComment.highlightArea.boundingBoxes.forEach((bbox) => {
            try {
              console.log("[Message] Processing bbox:", bbox);

            annotations.push({
              id: "n.a.",
              page: bbox.page - 1, 
              left: bbox.left,
              top: bbox.top,
              width: bbox.width,
              height: bbox.height
            });
          } catch (error) {
              console.error("[Message] Error processing bounding box:", error);
            }
          });
        });
        

        const claimChecks = [{
          annotations: annotations,
          verdict: "Source", 
          explanation: "Source from chat" 
        }];

        const updatedFile = {
          ...file,
          annotations: {
            show: true,
            data: claimChecks
          }
        };

        // Pass to the parent callback
        onSourceClicked(updatedFile);
        // =================================================================================
        // 
        // =================================================================================

      } catch (error) {
        console.error("[Message] Error opening source:", error);
        // TODO: show an error message to the user here
      }
    }
  }, [onSourceClicked]);

  // render message content
  const messageContent = (
    <div
      className={`w-full ${
        isUser
          ? "bg-white rounded-lg shadow-sm border border-gray-200 p-2"
          : "p-1"
      }`}
    >
      <div
        className="prose prose-[12px] max-w-none dark:prose-invert 
        prose-headings:mb-4 prose-headings:mt-6 prose-headings:text-[14px]
        prose-p:my-2 prose-p:text-[12px] prose-p:leading-relaxed
        prose-ul:my-0 prose-ul:text-[12px] prose-ul:list-disc prose-ul:pl-2
        prose-ol:my-0 prose-ol:text-[12px] prose-ol:list-decimal prose-ol:pl-2
        prose-li:my-0 prose-li:text-[12px] prose-li:marker:text-gray-500
        prose-table:my-4 prose-table:text-[12px]
        prose-tr:border-b prose-th:border-b prose-td:border-b
        prose-th:p-2 prose-td:p-2
        prose-p:text-justify
        prose-table:border prose-table:border-gray-300
        prose-th:bg-gray-50 prose-th:font-medium
        prose-code:text-[12px] prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-gray-100 prose-pre:p-3 prose-pre:rounded prose-pre:text-[12px] prose-pre:my-3
        prose-blockquote:border-l-2 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-4
        prose-hr:my-6 prose-hr:border-gray-300
        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
        prose-img:rounded-lg prose-img:shadow-sm prose-img:my-4
        prose-strong:font-semibold
        prose-em:italic
        prose-h1:text-[16px] prose-h2:text-[14px] prose-h3:text-[12px]
        prose-h1:font-bold prose-h2:font-semibold prose-h3:font-medium"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => (
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed my-2">
                {children}
              </p>
            ),
            li: ({ children }) => (
              <li className="whitespace-pre-wrap text-[12px] leading-relaxed my-0.5">
                {children}
              </li>
            ),
            ul: ({ children }) => (
              <ul className="list-disc pl-4 my-2">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-4 my-2">{children}</ol>
            ),
            code: ({
              inline,
              className,
              children,
              ...props
            }: {
              inline?: boolean;
              className?: string;
              children: React.ReactNode;
            }) => (
              <code
                className={`${
                  inline
                    ? "bg-gray-100 px-1.5 py-0.5 rounded"
                    : "block bg-gray-100 p-3 rounded my-3"
                } ${className || ""} text-[12px]`}
                {...props}
              >
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="whitespace-pre-wrap text-[12px] bg-gray-100 p-3 rounded my-3">
                {children}
              </pre>
            ),
            table: ({ children }) => (
              <table className="border border-gray-300 text-[12px] w-full my-4">
                {children}
              </table>
            ),
            th: ({ children }) => (
              <th className="border border-gray-300 p-2 text-[12px] bg-gray-50 font-medium">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-300 p-2 text-[12px]">
                {children}
              </td>
            ),
            br: () => <br className="block h-2" />,
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {isUser && message.timestamp && (
        <div className="text-[10px] text-gray-500 mt-2">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
      {!isUser && message.chatSourceCommentGroups && message.chatSourceCommentGroups.length > 0 && (
        <ChatSources chatSourceCommentGroups={message.chatSourceCommentGroups} onSourceClick={handleSourceClick} />
      )}
    </div>
  );

  return <div className="w-full">{messageContent}</div>;
});

Message.displayName = "Message";

const LoadingIndicator: React.FC = memo(() => (
  <div className="w-full p-2">
    <div className="flex space-x-1">
      <div className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse"></div>
      <div className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse delay-75"></div>
      <div className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse delay-150"></div>
    </div>
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

  // load previous chat messages
  const loadChatHistory = useCallback(async () => {
    try {
      const history = await fileService.getChatHistory();
      const pairs: MessagePair[] = [];
      for (let i = 0; i < history.length; i += 2) {
        const userMessage = history[i];
        const assistantMessage = history[i + 1] || null;
        if (userMessage.sender === "user") {
          pairs.push({
            id: userMessage.id,
            userMessage,
            assistantMessage: assistantMessage
              ? {
                  ...assistantMessage,
                  chatSourceCommentGroups: assistantMessage.chatSourceCommentGroups || [],
                }
              : null,
          });
        }
      }
      setMessagePairs(pairs);
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  }, []);

  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // scroll to bottom of chat container
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messagePairs]);

  // send message
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isEventSourceActive) return;

    const pairId = `${Date.now()}.${Math.floor(Math.random() * 100)}`;
    setCurrentPairId(pairId);

    // create user message
    const userMessage: ChatMessage = {
      id: `${pairId}.user`,
      sender: "user",
      content: input.trim(),
      timestamp: new Date(),
      chatSourceCommentGroups: [],
    };

    // add message pair to the list
    setMessagePairs((prev) => [
      ...prev,
      {
        id: pairId,
        userMessage,
        assistantMessage: {
          id: `${pairId}.assistant`,
          sender: "assistant",
          content: "",
          timestamp: new Date(),
          chatSourceCommentGroups: [],
        },
      },
    ]);
    setInput("");
    setIsLoading(true);
    setIsEventSourceActive(true);

    // handle response from the backend
    try {
      await chatService.streamChat(
        input.trim(),
        workspaceId!,
        // onMessage
        (newContent) => {
          setMessagePairs((prev) => {
            const newPairs = [...prev];
            const currentPair = newPairs.find((pair) => pair.id === pairId);
            if (currentPair) {
              currentPair.assistantMessage = {
                ...currentPair.assistantMessage!,
                content: (currentPair.assistantMessage?.content || "") + newContent,
              };
            }
            return newPairs;
          });
        },
        // onSources
        (chatSourceCommentGroups: ChatSourceCommentGroup[]) => {
          console.log("[ChatPanel] Received sources:", chatSourceCommentGroups);
          setMessagePairs((prev) => {
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
        // onComplete
        () => {
          console.log("[ChatPanel] Chat stream completed");
          setIsLoading(false);
          setIsEventSourceActive(false);
          setCurrentPairId(null);
        },
        // onError
        (error) => {
          console.error("[ChatPanel] Error in chat stream:", error);
          setIsLoading(false);
          setIsEventSourceActive(false);
          setCurrentPairId(null);
          setMessagePairs((prev) => {
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
  }, [input, isEventSourceActive, workspaceId]);

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
      <div className="h-full flex flex-col border-l border-border bg-card">
        <div className="p-4 font-medium text-lg border-b border-border">
          Assistant
        </div>

        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300"
        >
          {messagePairs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Ask questions about your documents.</p>
              <p className="text-sm mt-2">
                The AI will analyze the content and provide relevant answers.
              </p>
            </div>
          ) : (
            <>
              {messagePairs.map((pair) => (
                <div key={pair.id} className="space-y-4">
                  <Message message={pair.userMessage} isUser={true} />
                  {pair.assistantMessage && (
                    <Message message={pair.assistantMessage} isUser={false} />
                  )}
                </div>
              ))}
              {isLoading && <LoadingIndicator />}
            </>
          )}
        </div>

        <div className="p-3 border-t border-border">
          <div className="flex flex-col space-y-2">
            {isEventSourceActive && (
              <div className="text-sm text-muted-foreground text-center">
                Assistant occupied...
              </div>
            )}
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
                className="min-h-[60px] resize-none"
                disabled={isLoading || isEventSourceActive}
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
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
          </div>
        </div>
      </div>
    </SourceClickContext.Provider>
  );
};

export default memo(ChatPanel);
