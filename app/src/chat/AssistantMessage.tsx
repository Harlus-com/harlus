import { ChatSourceCommentGroup } from "./chat_types";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "./chat_types";
import { ChatSources } from "./ChatSources";

export const AssistantMessage: React.FC<{
  message: ChatMessage;
  handleSourceClick: (source: ChatSourceCommentGroup) => void;
}> = ({ message, handleSourceClick }) => {
  return (
    <div className="flex flex-col mt-4">
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
                <ul className="list-disc pl-4 my-1.5 text-[13px]" {...props} />
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
      {message.hasStreamError && (
        <div className="text-red-500 text-xs mt-2">
          Sorry, there was an error while streaming the response.
        </div>
      )}
    </div>
  );
};

AssistantMessage.displayName = "AssistantMessage";
