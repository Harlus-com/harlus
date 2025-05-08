import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceFile } from "@/api/workspace_types";
import { useParams } from "react-router-dom";
import { chatService } from "@/chat/chatService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage, ChatSourceCommentGroup, MessagePair } from "./chat_types";
import { ChatHistory } from "./ChatHistory";
import { useChatThread } from "./ChatThreadContext";
import { SourceClickContext } from "./SourceContext";
import { MessagePairComponent } from "./Message";
import { LoadingIndicator } from "./LoadingIndicator";

interface ChatPanelProps {
  onSourceClicked?: (file: WorkspaceFile) => void;
}

// Chat panel component
const ChatPanel: React.FC<ChatPanelProps> = ({ onSourceClicked }) => {
  const { workspaceId } = useParams();
  const { currentThreadId, createThread, renameThread } = useChatThread();
  const [messagePairs, setMessagePairs] = useState<MessagePair[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEventSourceActive, setIsEventSourceActive] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);

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
    if (!currentThreadId || !workspaceId || isLoading) return;
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
    if (!input.trim() || isEventSourceActive || !workspaceId) return;
    setIsLoading(true);

    const pairId = `${Date.now()}.${Math.floor(Math.random() * 100)}`;
    setCurrentPairId(pairId);

    let threadId = currentThreadId;
    console.log("Message panels.length", messagePairs.length);
    // TODO: This just doesn't seem right.
    // It would be cleaner to create the thread id ahead of time (e.g the moment the user opened to an empty chat)
    if (!threadId) {
      const title =
        input.trim().slice(0, 50) + (input.trim().length > 50 ? "..." : "");
      const newThread = await createThread(title);
      threadId = newThread.id;
    } else if (messagePairs.length === 0) {
      const threads = await chatService.getThreads(workspaceId);
      const currentThread = threads.find((t) => t.id === threadId);
      if (currentThread?.title.match(/^New Chat \d+$/)) {
        const newTitle =
          input.trim().slice(0, 50) + (input.trim().length > 50 ? "..." : "");
        renameThread(threadId, newTitle);
      }
    }

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
    setIsEventSourceActive(true);

    // handle response from the backend
    try {
      await chatService.streamChat(
        input.trim(),
        workspaceId,
        threadId,
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
  }, [
    input,
    isEventSourceActive,
    workspaceId,
    currentThreadId,
    createThread,
    messagePairs,
  ]);

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
            <span className="text-sm text-gray-800">Chat</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsHistoryVisible(!isHistoryVisible)}
              className="h-8 px-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              <BookOpen className="h-4 w-4 mr-1.5" />
              {isHistoryVisible ? "Hide History" : "History"}
            </Button>
            {/* TODO: Conditionally show this button based on whether the user is already in an empty thread */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => createThread()}
              className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-50 group relative"
            >
              <Plus className="h-4 w-4" />
              <div className="absolute top-full right-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                New chat
              </div>
            </Button>
          </div>
        </div>

        {isHistoryVisible && workspaceId && (
          <div className="border-b border-gray-100 bg-white">
            <div className="max-h-[50vh] overflow-y-auto">
              <ChatHistory workspaceId={workspaceId} />
            </div>
          </div>
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

export default ChatPanel;
