import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, BookOpen, Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useParams } from "react-router-dom";
import { chatService } from "@/chat/chatService";
import {
  ChatMessage,
  ChatSourceCommentGroup,
  MessagePair,
  ThreadSavedState,
} from "./chat_types";
import { ChatHistory } from "./ChatHistory";
import { useChatThread } from "./ChatThreadContext";
import { MessagePairComponent } from "./Message";
import { LoadingIndicator } from "./LoadingIndicator";
import { getTitleFromMessage, hourMinuteNow } from "./chat_util";
import { useFileViewContext } from "@/files/FileViewContext";
import { FileGroupCount } from "@/components/panels";
import { useAuth } from "@/auth/AuthContext";

// Chat panel component
const ChatPanel: React.FC = () => {
  const { workspaceId } = useParams();
  const { getToken } = useAuth();
  const {
    currentThreadId,
    createEmptyThread,
    getThread,
    renameThread,
    upgradeThreadSavedState,
  } = useChatThread();
  const { openFile } = useFileViewContext();
  const [messagePairs, setMessagePairs] = useState<MessagePair[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEventSourceActive, setIsEventSourceActive] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);

  const updateAndSaveMessages = (
    createNewMessages: (prev: MessagePair[]) => MessagePair[]
  ) => {
    setMessagePairs((prev) => {
      const newMessages = createNewMessages(prev);
      if (currentThreadId && workspaceId) {
        chatService.saveChatHistory(newMessages, currentThreadId, workspaceId);
      }
      return newMessages;
    });
  };

  useEffect(() => {
    const loadChatHistory = async () => {
      if (isLoading) return;
      const history = await chatService.getChatHistory(
        currentThreadId,
        workspaceId
      );
      setMessagePairs(history);
    };
    loadChatHistory();
  }, [currentThreadId]);

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

    const thread = getThread(currentThreadId);
    if (thread.savedState === ThreadSavedState.UI_ONLY) {
      await renameThread(currentThreadId, getTitleFromMessage(input.trim()), {
        newSavedState: ThreadSavedState.SAVED_WITH_MESSAGES,
      });
    } else {
      upgradeThreadSavedState(
        currentThreadId,
        ThreadSavedState.SAVED_WITH_MESSAGES
      );
    }

    const pairId = `${Date.now()}.${Math.floor(Math.random() * 100)}`;
    setCurrentPairId(pairId);

    // create user message
    const userMessage: ChatMessage = {
      id: `${pairId}.user`,
      sender: "user",
      content: input.trim(),
      timestamp: hourMinuteNow(),
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
          timestamp: hourMinuteNow(),
          chatSourceCommentGroups: [],
          messageType: "answer_message",
        },
        readingMessages: [],
        planningMessage: null,
        answerCount: 0,
        showReadingMessages: true,
        readingMessageBuffer: "",
      },
    ]);
    setInput("");
    setIsEventSourceActive(true);

    // handle response from the backend
    try {
      const token = await getToken();
      await chatService.streamChat(
        input.trim(),
        workspaceId,
        currentThreadId,
        token,
        // onMessage handler - for all types of messages
        (newContent, messageType) => {
          updateAndSaveMessages((prev) => {
            const newPairs = [...prev];
            const currentPair = newPairs.find((pair) => pair.id === pairId);

            if (currentPair) {
              if (messageType === "planning_message") {
                // If planning message already exists, append to it, otherwise create a new one
                if (currentPair.planningMessage) {
                  currentPair.planningMessage = {
                    ...currentPair.planningMessage,
                    content: currentPair.planningMessage.content + newContent,
                  };
                } else {
                  currentPair.planningMessage = {
                    id: `${pairId}.planning`,
                    sender: "assistant",
                    content: newContent,
                    timestamp: hourMinuteNow(),
                    chatSourceCommentGroups: [],
                    messageType: "planning_message",
                  };
                }
              } else if (messageType === "reading_message") {
                // Hide planning message when reading messages start
                if (currentPair.planningMessage) {
                  currentPair.planningMessage = null;
                }

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
                        timestamp: hourMinuteNow(),
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
                      timestamp: hourMinuteNow(),
                      chatSourceCommentGroups: [],
                      messageType: "reading_message",
                    });
                  }
                }
              } else if (messageType === "answer_message") {
                // Hide planning message when answer starts
                if (currentPair.planningMessage) {
                  currentPair.planningMessage = null;
                }

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
                    timestamp: hourMinuteNow(),
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
        },
        // onStreamError handler - when an error occurs in the event source
        (error) => {
          console.error("[ChatPanel] Error while streaming:", error);
          setIsLoading(false);
          setIsEventSourceActive(false);
          setCurrentPairId(null);
          updateAndSaveMessages((prev) => {
            const newPairs = [...prev];
            const currentPair = newPairs.find((pair) => pair.id === pairId);
            if (currentPair && currentPair.assistantMessage) {
              currentPair.assistantMessage.hasStreamError = true;
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
  }, [input, isEventSourceActive, workspaceId, currentThreadId, messagePairs]);

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
            <History className="h-4 w-4 mr-1.5" />
            {isHistoryVisible ? "Hide History" : "History"}
          </Button>
          {/* TODO: Conditionally show this button based on whether the user is already in an empty thread */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              createEmptyThread({
                setSelected: true,
                includePlaceholderTitle: true,
              })
            }
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

      <div
        ref={chatContainerRef}
        className="flex-1 px-3.5 pt-3.5 pb-2 overflow-y-auto"
      >
        <div className="space-y-6">
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
                  onSourceClicked={(file) =>
                    openFile(file, {
                      showComments: true,
                      fileGroup: FileGroupCount.ONE,
                    })
                  }
                />
              ))}
              {isLoading && currentPairId === null && <LoadingIndicator />}
            </>
          )}
        </div>
      </div>

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
  );
};

export default ChatPanel;
