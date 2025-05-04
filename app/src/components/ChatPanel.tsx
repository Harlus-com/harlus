import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  useContext,
  useMemo,
} from "react";
import { Send, Search, FileText, Book, ExternalLink, X, BookOpen, User, Loader2 } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

interface ChatPanelProps {
  onSourceClicked?: (file: WorkspaceFile) => void;
}

// Message type interfaces
interface MessageProps {
  message: ChatMessage;
  isUser: boolean;
}

interface MessagePair {
  id: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage | null;
  isActiveReading?: boolean;
}

interface MessagePairProps {
  pair: MessagePair;
  isReading: boolean;
  readingFiles: string[];
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
  <div className="flex items-center gap-2 text-xs text-gray-400 py-1.5 animate-pulse group">
    <div className="relative flex items-center justify-center">
      <div className="w-4 h-4 rounded-full border border-gray-200 flex items-center justify-center">
        <Search size={9} className="text-gray-400" />
      </div>
      <div className="absolute inset-0">
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
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
      </div>
    </div>
    <span className="text-gray-400 text-[11px]">Reading {fileName}...</span>
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

// User message component
const UserMessage: React.FC<{ message: ChatMessage }> = memo(({ message }) => {
  return (
    <div className="flex flex-col">
      <div className="bg-white border border-gray-100 rounded-lg px-3.5 py-2.5 text-[13px] text-gray-800 leading-relaxed shadow-sm">
        {message.content}
      </div>
      {message.timestamp && (
        <div className="text-[9px] text-gray-400 mt-1 ml-1">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </div>
  );
});

UserMessage.displayName = "UserMessage";

// Component to display sources with improved UI
const ChatSources: React.FC<ChatSourceProps> = memo(({ chatSourceCommentGroups, onSourceClick }) => {
  // Don't render if no valid sources
  if (!chatSourceCommentGroups || chatSourceCommentGroups.length === 0) return null;

  // Filter out invalid source groups
  const validSources = chatSourceCommentGroups.filter(group => 
    group?.chatSourceComments && group.chatSourceComments.length > 0
  );

  if (validSources.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      <div className="flex flex-wrap">
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
});

ChatSources.displayName = "ChatSources";

// Assistant message with improved styling
const AssistantMessage: React.FC<{ 
  message: ChatMessage, 
  handleSourceClick: (source: ChatSourceCommentGroup) => void,
  isReading: boolean,
  readingFiles: string[]
}> = memo(({ message, handleSourceClick, isReading, readingFiles }) => {
  const [visibleContent, setVisibleContent] = useState("");
  const [showReadingIndicators, setShowReadingIndicators] = useState(isReading);
  
  // Process the message content - remove reading indicators once regular content appears
  useEffect(() => {
    // Check if there's substantial content beyond reading indicators
    const content = message.content;
    const readingLines = content.match(/Reading\s+.+?\.\.\.\s*\n?/gm) || [];
    const hasSubstantialContent = content.replace(/Reading\s+.+?\.\.\.\s*\n?/gm, '').trim().length > 0;
    
    // If we have real content, hide the reading indicators in the text
    if (hasSubstantialContent) {
      setShowReadingIndicators(false);
      setVisibleContent(content.replace(/Reading\s+.+?\.\.\.\s*\n?/gm, '').trim());
    } else {
      // Otherwise just show the content as is
      setShowReadingIndicators(true);
      setVisibleContent(content);
    }
  }, [message.content, isReading]);
  
  return (
    <div className="flex flex-col mt-4">
      {/* Reading indicators */}
      {isReading && readingFiles.length > 0 && showReadingIndicators && (
        <div className="flex flex-col mb-2 text-gray-400">
          {readingFiles.map((file, index) => (
            <ReadingIndicator key={index} fileName={file} />
          ))}
        </div>
      )}
      
      {/* AI Response */}
      <div className="px-0.5">
        <div className={cn(
          "prose prose-sm max-w-none text-[13px]",
          "prose-headings:font-medium prose-headings:text-gray-800",
          "prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1.5",
          "prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline",
          "prose-strong:font-medium prose-strong:text-gray-800",
          "prose-code:text-xs prose-code:bg-gray-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
          "prose-pre:bg-gray-50 prose-pre:p-2 prose-pre:rounded",
          "prose-ol:pl-5 prose-ol:my-1.5 prose-ul:pl-5 prose-ol:my-1.5",
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
            {visibleContent}
          </ReactMarkdown>
        </div>
      </div>
      
      {/* Sources at bottom of message */}
      {message.chatSourceCommentGroups && message.chatSourceCommentGroups.length > 0 && (
        <ChatSources 
          chatSourceCommentGroups={message.chatSourceCommentGroups} 
          onSourceClick={handleSourceClick} 
        />
      )}
    </div>
  );
});

AssistantMessage.displayName = "AssistantMessage";

// Message pair component
const MessagePairComponent: React.FC<MessagePairProps> = memo(({ pair, isReading, readingFiles }) => {
  const { onSourceClicked } = useContext(SourceClickContext);
  
  // Handle source clicks
  const handleSourceClick = useCallback(async (chatSourceCommentGroup: ChatSourceCommentGroup) => {
    console.log("[MessagePair] Source clicked:", chatSourceCommentGroup);

    if (onSourceClicked) {
      try {
        const file = chatSourceCommentGroup.workspace_file;
        if (!file) {
          console.error("[MessagePair] No workspace file found:", chatSourceCommentGroup);
          return;
        }
        
        const annotations = [];

        if (!chatSourceCommentGroup.chatSourceComments) {
          console.error("[MessagePair] No comments found in source group:", chatSourceCommentGroup);
          return;
        }

        chatSourceCommentGroup.chatSourceComments.forEach((chatSourceComment) => {
          if (!chatSourceComment?.highlightArea?.boundingBoxes) {
            console.warn("[MessagePair] Missing highlight area or bounding boxes:", chatSourceComment);
            return;
          }

          chatSourceComment.highlightArea.boundingBoxes.forEach((bbox) => {
            try {
              if (!bbox?.page) {
                console.warn("[MessagePair] Missing page in bounding box:", bbox);
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
              console.error("[MessagePair] Error processing bounding box:", error);
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
        console.error("[MessagePair] Error opening source:", error);
      }
    }
  }, [onSourceClicked]);

  return (
    <div className="space-y-1">
      {/* User message */}
      <UserMessage message={pair.userMessage} />
      
      {/* AI response */}
      {pair.assistantMessage && (
        <AssistantMessage 
          message={pair.assistantMessage}
          handleSourceClick={handleSourceClick}
          isReading={isReading}
          readingFiles={readingFiles}
        />
      )}
    </div>
  );
});

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
  const [readingFiles, setReadingFiles] = useState<string[]>([]);
  const [readingTimestamps, setReadingTimestamps] = useState<{[fileName: string]: number}>({});

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

  // detect and process reading events with a time window
  const processReadingEvent = useCallback((text: string) => {
    const readingMatch = text.match(/Reading\s+(.+?)\.\.\.$/);
    if (readingMatch) {
      const fileName = readingMatch[1];
      // Add to reading files with timestamp
      setReadingFiles(prev => {
        if (!prev.includes(fileName)) {
          return [...prev, fileName];
        }
        return prev;
      });
      
      // Record the timestamp for this reading event
      setReadingTimestamps(prev => ({
        ...prev,
        [fileName]: Date.now()
      }));
    }
  }, []);
  
  // Clean up reading files that are older than the time window (5 seconds)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeWindow = 5000; // 5 seconds
      
      // Check each reading file's timestamp
      setReadingFiles(prev => {
        return prev.filter(fileName => {
          const timestamp = readingTimestamps[fileName] || 0;
          return now - timestamp < timeWindow;
        });
      });
    }, 1000); // Check every second
    
    return () => clearInterval(cleanupInterval);
  }, [readingTimestamps]);

  // send message
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isEventSourceActive) return;

    const pairId = `${Date.now()}.${Math.floor(Math.random() * 100)}`;
    setCurrentPairId(pairId);
    setReadingFiles([]);
    setReadingTimestamps({});

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
        isActiveReading: true
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
          processReadingEvent(newContent);
          
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
          setReadingTimestamps({});
          
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
              
              // Mark as no longer reading
              lastPair.isActiveReading = false;
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
          setReadingTimestamps({});
          setMessagePairs((prev) => {
            const newPairs = [...prev];
            const currentPair = newPairs.find((pair) => pair.id === pairId);
            if (currentPair && currentPair.assistantMessage) {
              currentPair.assistantMessage.content =
                "Sorry, there was an error processing your request.";
              currentPair.isActiveReading = false;
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
      setReadingTimestamps({});
    }
  }, [input, isEventSourceActive, workspaceId, processReadingEvent]);

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
          <div ref={chatContainerRef} className="space-y-6">
            {messagePairs.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-gray-100 p-6">
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
                  <MessagePairComponent 
                    key={pair.id} 
                    pair={pair} 
                    isReading={isEventSourceActive && pair.id === currentPairId && pair.isActiveReading === true}
                    readingFiles={readingFiles}
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

export default memo(ChatPanel);
