import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  useContext,
} from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fileService } from "@/api/fileService";
import { ChatMessage, WorkspaceFile } from "@/api/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useParams } from "react-router-dom";
import { BASE_URL } from "@/api/client";
import { FileGroupCount } from "./panels";

// move to types.ts?
interface ChatPanelProps {
  onSourceClicked?: (file: WorkspaceFile) => void;
}

// move to types.ts?
interface MessageProps {
  message: ChatMessage;
  isUser: boolean;
}

// move to types.ts?
interface MessagePair {
  id: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage | null;
}

const ChatPanelContext = React.createContext<{
  onSourceClicked?: (file: WorkspaceFile) => void;
}>({});

const Message: React.FC<MessageProps> = memo(({ message, isUser }) => {
  const [showSources, setShowSources] = useState(true);
  const { onSourceClicked } = useContext(ChatPanelContext);

  // open source file
  const handleSourceClick = (source: {
    file_id: string;
    file_path: string;
    file_name: string;
    bboxes?: any[];
  }) => {
    console.log("handleSourceClick", source);
    if (onSourceClicked) {
      console.log("onSourceClicked", onSourceClicked);
      console.log("file_path", source.file_path);
      const workspaceFile = {
        // TODO: Pass back the actual file id in sources, rather than the file path
        // Alternatively we can update the PDF viewer to accept a file path
        // And allow opening files by file id OR file path.
        // Also this should not return a full workspace file (given we can't accurately populate the other fields)
        // We should either accurately populate the other fields or just return an "Annotation object"
        // which would include a file id or file path and the annotation data.
        id: source.file_id,
        name: "",
        absolutePath: "",
        workspaceId: "",
        annotations: {
          show: true,
          data: source.bboxes,
        },
        appDir: null,
      };
      onSourceClicked(workspaceFile);
      return;
      const file: WorkspaceFile = {
        id: source.file_path,
        name: source.file_name,
        absolutePath: source.file_path,
        workspaceId: "",
        appDir: null,
      };
      console.log("file", file);
      onSourceClicked(file);
    }
  };

  // render message content
  const messageContent = (
    // define how to render markdown
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
      {!isUser && message.sources && message.sources.length > 0 && (
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
              {message.sources.map((source, index) => (
                <li key={index}>
                  <button
                    className="text-blue-600 hover:text-blue-800 hover:underline text-[12px]"
                    onClick={() => handleSourceClick(source)}
                  >
                    {source.file_name}, page(s) {source.pages.join(", ")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
                  sources: assistantMessage.sources || [],
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
          sources: [],
        },
      },
    ]);
    setInput("");
    setIsLoading(true);
    setIsEventSourceActive(true);

    // close existing event source
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // create event source
      const query = encodeURIComponent(input.trim());
      const url = `${BASE_URL}/chat/stream?workspaceId=${workspaceId}&query=${query}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // listen to normal messages (assistant response)
      eventSource.addEventListener("message", (event) => {
        const newContent = JSON.parse(event.data);
        setMessagePairs((prev) => {
          const newPairs = [...prev];
          const currentPair = newPairs.find((pair) => pair.id === pairId);
          if (currentPair) {
            currentPair.assistantMessage = {
              ...currentPair.assistantMessage!,
              content:
                (currentPair.assistantMessage?.content || "") + newContent,
            };
          }
          return newPairs;
        });
      });

      // listen to sources (assistant response)
      eventSource.addEventListener("sources", (event) => {
        console.log("Received sources event:", event.data);
        const sources = JSON.parse(event.data);
        console.log("Parsed sources:", sources);
        const concatenatedSources = [];

        // structure the sources (nodes)
        for (let i = 0; i < sources.length; i++) {
          const metadata = sources[i].metadata;

          if (!metadata) {
            console.log("Error: metadata is undefined for source", sources[i]);
            continue;
          }

          // add page number to the bboxes
          if (metadata.bBoxes && metadata.page_nb) {
            metadata.bBoxes = metadata.bBoxes.map((bbox) => ({
              ...bbox,
              p: metadata.page_nb,
            }));
          }

          if (!metadata.file_name) {
            console.log("Error: Friendly name not present in nodes");
            continue;
          }

          // group by page number
          const existingSource = concatenatedSources.find(
            (source) => source.file_name === metadata.file_name
          );

          if (existingSource) {
            if (
              metadata.page_nb &&
              !existingSource.pages.includes(metadata.page_nb)
            ) {
              existingSource.pages.push(metadata.page_nb);
              if (metadata.bBoxes) {
                existingSource.bboxes.push(...metadata.bBoxes);
              }
            }
          } else {
            concatenatedSources.push({
              file_name: metadata.file_name,
              pages: metadata.page_nb ? [metadata.page_nb] : [],
              file_path: metadata.file_path,
              bboxes: metadata.bBoxes || [],
              file_id: metadata.file_id,
            });
          }
        }

        // add sources to the last message pair
        setMessagePairs((prev) => {
          const newPairs = [...prev];
          const lastPair = newPairs[newPairs.length - 1];
          if (lastPair && lastPair.assistantMessage) {
            lastPair.assistantMessage = {
              ...lastPair.assistantMessage,
              sources: concatenatedSources,
            };
          } else {
          }
          return newPairs;
        });
      });

      // close event source if source is complete
      eventSource.addEventListener("complete", () => {
        eventSource.close();
        setIsLoading(false);
        setIsEventSourceActive(false);
        setCurrentPairId(null);
      });

      // handle error
      eventSource.addEventListener("error", (error) => {
        console.error("EventSource error:", error);
        eventSource.close();
        setIsLoading(false);
        setIsEventSourceActive(false);
        return;
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
      });
    } catch (error) {
      console.error("Error setting up stream:", error);
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
  }, [input, isEventSourceActive]);

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
    <ChatPanelContext.Provider value={{ onSourceClicked }}>
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
    </ChatPanelContext.Provider>
  );
};

export default memo(ChatPanel);
