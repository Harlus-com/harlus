import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  useContext,
  useMemo,
} from "react";
import { Send, Search, FileText, Book, ExternalLink, X, BookOpen } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

// Reading indicator component
interface ReadingIndicatorProps {
  fileName: string;
}

const ReadingIndicator: React.FC<ReadingIndicatorProps> = ({ fileName }) => (
  <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-blue-50 rounded-full px-3 py-1 animate-pulse">
    <Search size={12} className="text-blue-500" />
    <span className="truncate max-w-[200px]">Reading {fileName}...</span>
  </div>
);

// Improved source badge component
interface SourceBadgeProps {
  source: ChatSourceCommentGroup;
  onClick: () => void;
}

const SourceBadge: React.FC<SourceBadgeProps> = ({ source, onClick }) => {
  const fileName = source.workspace_file?.name || source.fileId.split("/").pop() || "Unknown";
  
  // Extract page numbers if available
  const pageNumbers = useMemo(() => {
    if (!source.chatSourceComments) return [];
    
    return [...new Set(
      source.chatSourceComments
        .filter(comment => comment?.highlightArea?.jumpToPageNumber)
        .map(comment => comment.highlightArea.jumpToPageNumber)
    )];
  }, [source.chatSourceComments]);
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="h-auto py-1 px-2.5 text-[11px] gap-1 mr-1.5 mb-1.5 inline-flex items-center bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 rounded-full"
      onClick={onClick}
    >
      <FileText size={10} className="shrink-0" />
      <span className="truncate max-w-[100px]">{fileName}</span>
      {pageNumbers.length > 0 && (
        <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-blue-200 rounded-full ml-0.5">
          p.{pageNumbers.join(",")}
        </Badge>
      )}
    </Button>
  );
};

// Component to display sources with improved UI
const ChatSources: React.FC<ChatSourceProps> = memo(({ chatSourceCommentGroups, onSourceClick }) => {
  const [showSources, setShowSources] = useState(true);

  // Don't render if no valid sources
  if (!chatSourceCommentGroups || chatSourceCommentGroups.length === 0) return null;

  // Filter out invalid source groups
  const validSources = chatSourceCommentGroups.filter(group => 
    group?.chatSourceComments && group.chatSourceComments.length > 0
  );

  if (validSources.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1 text-[10px] font-medium text-gray-600">
          <ExternalLink size={10} />
          Sources ({validSources.length})
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px]"
          onClick={() => setShowSources(!showSources)}
        >
          {showSources ? "Hide" : "Show"}
        </Button>
      </div>
      
      {showSources && (
        <div className="flex flex-wrap">
          {validSources.map((source, index) => (
            <SourceBadge 
              key={index} 
              source={source} 
              onClick={() => onSourceClick(source)} 
            />
          ))}
        </div>
      )}
    </div>
  );
});

ChatSources.displayName = "ChatSources";

// Component to display a chat message with improved styling
const Message: React.FC<MessageProps> = memo(({ message, isUser }) => {
  const { onSourceClicked } = useContext(SourceClickContext);
  const [readingFile, setReadingFile] = useState<string | null>(null);

  // Extract reading status from message content
  useEffect(() => {
    if (!isUser && message.content) {
      const readingMatch = message.content.match(/Reading\s+(.+?)\.\.\.$/m);
      if (readingMatch) {
        setReadingFile(readingMatch[1]);
      } else {
        setReadingFile(null);
      }
    }
  }, [message.content, isUser]);

  // Open sources associated with a chat message
  const handleSourceClick = useCallback(async (chatSourceCommentGroup: ChatSourceCommentGroup) => {
    console.log("[Message] Source clicked:", chatSourceCommentGroup);

    if (onSourceClicked) {
      try {
        const file = chatSourceCommentGroup.workspace_file;
        if (!file) {
          console.error("[Message] No workspace file found:", chatSourceCommentGroup);
          return;
        }
        
        const annotations = [];

        if (!chatSourceCommentGroup.chatSourceComments) {
          console.error("[Message] No comments found in source group:", chatSourceCommentGroup);
          return;
        }

        chatSourceCommentGroup.chatSourceComments.forEach((chatSourceComment) => {
          if (!chatSourceComment?.highlightArea?.boundingBoxes) {
            console.warn("[Message] Missing highlight area or bounding boxes:", chatSourceComment);
            return;
          }

          chatSourceComment.highlightArea.boundingBoxes.forEach((bbox) => {
            try {
              if (!bbox?.page) {
                console.warn("[Message] Missing page in bounding box:", bbox);
                return;
              }
              
              annotations.push({
                id: "source-" + Math.random().toString(36).substr(2, 9),
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

        onSourceClicked(updatedFile);
      } catch (error) {
        console.error("[Message] Error opening source:", error);
      }
    }
  }, [onSourceClicked]);

  // Process the message content to remove reading indicators
  const processedContent = useMemo(() => {
    if (isUser) return message.content;
    
    // Remove any "Reading..." lines for final display
    return message.content.replace(/Reading\s+.+?\.\.\.\s*$/gm, '').trim();
  }, [message.content, isUser]);
  
  // Render message content
  return (
    <div className={cn(
      "w-full rounded-lg shadow-sm",
      isUser 
        ? "bg-gray-50 border border-gray-100" 
        : "bg-white border border-gray-100"
    )}>
      {/* Main message content */}
      <div className={cn(
        "px-3.5 py-2.5",
        isUser ? "pb-2" : "pb-2.5"
      )}>
        {/* Show reading indicator if detected */}
        {!isUser && readingFile && (
          <div className="mb-2">
            <ReadingIndicator fileName={readingFile} />
          </div>
        )}
        
        {/* Message content */}
        <div className={cn(
          "prose prose-sm max-w-none text-[13px]",
          "prose-headings:font-medium prose-headings:text-gray-800",
          "prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1.5",
          "prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline",
          "prose-strong:font-medium prose-strong:text-gray-800",
          "prose-code:text-xs prose-code:bg-gray-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
          "prose-pre:bg-gray-50 prose-pre:p-2 prose-pre:rounded",
          "prose-ol:pl-5 prose-ol:my-1.5 prose-ul:pl-5 prose-ul:my-1.5",
          "prose-li:my-0.5 prose-li:text-gray-700"
        )}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({node, ...props}) => <h1 className="text-base font-medium mt-5 mb-2" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-[15px] font-medium mt-4 mb-1.5" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-[14px] font-medium mt-3 mb-1.5" {...props} />,
              p: ({node, ...props}) => <p className="text-gray-700 my-1.5 text-[13px] leading-relaxed" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc pl-4 my-1.5 text-[13px]" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal pl-4 my-1.5 text-[13px]" {...props} />,
              li: ({node, ...props}) => <li className="my-0.5 text-[13px]" {...props} />,
              code: ({inline, className, children, ...props}: {inline?: boolean, className?: string, children?: React.ReactNode}) => (
                inline ? 
                  <code className="bg-gray-50 px-1 py-0.5 rounded text-xs font-mono text-gray-800" {...props}>{children}</code> : 
                  <pre className="bg-gray-50 p-2 rounded-md overflow-x-auto my-2 text-xs">
                    <code className="text-xs font-mono text-gray-800" {...props}>{children}</code>
                  </pre>
              ),
              table: ({node, ...props}) => (
                <div className="overflow-x-auto my-3 text-xs">
                  <table className="min-w-full divide-y divide-gray-200 text-xs" {...props} />
                </div>
              ),
              thead: ({node, ...props}) => <thead className="bg-gray-50" {...props} />,
              th: ({node, ...props}) => <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props} />,
              td: ({node, ...props}) => <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-500 border-t border-gray-100" {...props} />,
              blockquote: ({node, ...props}) => (
                <blockquote className="border-l-2 border-gray-200 pl-3 py-1 my-3 text-gray-600 italic text-[12px]" {...props} />
              ),
            }}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      </div>
      
      {/* Timestamp for user messages */}
      {isUser && message.timestamp && (
        <div className="px-3.5 pb-1.5 text-[9px] text-gray-400">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
      
      {/* Sources section */}
      {!isUser && message.chatSourceCommentGroups && message.chatSourceCommentGroups.length > 0 && (
        <div className="px-3.5 pb-2">
          <ChatSources 
            chatSourceCommentGroups={message.chatSourceCommentGroups} 
            onSourceClick={handleSourceClick} 
          />
        </div>
      )}
    </div>
  );
});

Message.displayName = "Message";

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
  const [readingFiles, setReadingFiles] = useState<string[]>([]);

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
      const container = chatContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [messagePairs, readingFiles]);

  // Add a file to the reading list
  const addReadingFile = useCallback((fileName: string) => {
    setReadingFiles(prev => {
      if (!prev.includes(fileName)) {
        return [...prev, fileName];
      }
      return prev;
    });
  }, []);

  // send message
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isEventSourceActive) return;

    const pairId = `${Date.now()}.${Math.floor(Math.random() * 100)}`;
    setCurrentPairId(pairId);
    setReadingFiles([]);

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
        // onMessage handler - for regular message content
        (newContent) => {
          // Check if this is a reading indicator message
          const readingMatch = newContent.match(/Reading\s+(.+?)\.\.\.$/);
          if (readingMatch) {
            addReadingFile(readingMatch[1]);
          }
          
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
        // onSources handler - for document sources
        (chatSourceCommentGroups: ChatSourceCommentGroup[]) => {
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
        // onComplete handler - when the response is complete
        () => {
          setIsLoading(false);
          setIsEventSourceActive(false);
          setCurrentPairId(null);
          setReadingFiles([]);
          
          // Clean up any "Reading..." messages from the final response
          setMessagePairs((prev) => {
            const newPairs = [...prev];
            const lastPair = newPairs[newPairs.length - 1];
            if (lastPair && lastPair.assistantMessage) {
              // Remove any "Reading..." lines for the final display
              const cleanedContent = lastPair.assistantMessage.content
                .replace(/Reading\s+.+?\.\.\.\s*\n?/gm, '')
                .trim();
                
              lastPair.assistantMessage = {
                ...lastPair.assistantMessage,
                content: cleanedContent,
              };
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
          setReadingFiles([]);
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
      setReadingFiles([]);
    }
  }, [input, isEventSourceActive, workspaceId, addReadingFile]);

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
      <div className="h-full flex flex-col border-l border-gray-100 bg-white">
        <div className="py-2.5 px-3.5 font-medium border-b border-gray-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-800">AI Assistant</span>
          </div>
          {isEventSourceActive && readingFiles.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto max-w-[70%] py-1">
              {readingFiles.map((file, index) => (
                <Badge key={index} variant="outline" className="bg-blue-50 border-blue-100 text-blue-600 flex gap-1 items-center text-[10px] py-0 h-5">
                  <Search size={10} className="text-blue-500" />
                  <span className="truncate max-w-[80px]">{file}</span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 px-3.5 pt-3.5 pb-2">
          <div ref={chatContainerRef} className="space-y-4">
            {messagePairs.length === 0 ? (
              <div className="text-center py-10">
                <div className="inline-flex rounded-full bg-blue-50 p-2 mb-3">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                </div>
                <h3 className="text-base font-medium text-gray-800 mb-1">Welcome to Harlus</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Ask questions about your documents. The AI will analyze the content and provide relevant answers.
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
        </ScrollArea>

        <div className="p-3 border-t border-gray-100">
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
                className="min-h-[52px] max-h-[120px] resize-none text-sm border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-300 py-2 px-2.5"
                disabled={isLoading || isEventSourceActive}
              />
              <Button
                variant="default"
                size="icon"
                className="h-[52px] w-[52px] shrink-0 bg-blue-600 hover:bg-blue-700"
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

export default memo(ChatPanel);
