import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useComments } from "./useComments";
import { CommentLink, ReadonlyComment, CommentColor } from "./comment_ui_types";
import { cn } from "@/lib/utils";
import { FileText, History } from "lucide-react";
import { FileGroupCount } from "@/components/panels";
import CommentTagChip from "./ComentTagChip";
import { getHighestZeroIndexedPageNumberFromHighlightArea } from "./comment_util";
import { CommentHistory } from "./CommentHistory";
import { PanelGroup, Panel } from "react-resizable-panels";
import PanelDivider from "@/components/PanelDivider";

interface CommentsThreadProps {
  fileId: string;
  openFile: (
    fileId: string,
    options: {
      showComments: boolean;
      fileGroup: FileGroupCount;
    }
  ) => void;
}

const CommentsThread: React.FC<CommentsThreadProps> = ({
  fileId,
  openFile,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const { getActiveComments, setSelectedComment, getSelectedComment } =
    useComments();
  const selectedComment = getSelectedComment(fileId);

  const comments: ReadonlyComment[] = getActiveComments(fileId).filter(
    (c) => !c.isHidden
  );

  const handleAddComment = () => {
    // your existing add-comment logic…
  };

  const handleCommentClick = (comment: ReadonlyComment) => {
    setSelectedComment(comment.id);
  };

  const handleLinkClick = (link: CommentLink) => {
    setSelectedComment(link.linkToCommentId);
    openFile(link.likeToFileId, {
      showComments: true,
      fileGroup: FileGroupCount.ONE, // TODO: Maybe have this open a new file group?
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-gray-100 pt-8">
        <h2 className="text-sm font-medium text-gray-900">Comments</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className={cn(
            "h-6 w-6 p-0",
            showHistory ? "bg-gray-100" : "hover:bg-gray-100"
          )}
        >
          <History className="h-4 w-4" />
        </Button>
      </div>

      <PanelGroup direction="vertical" className="flex-1">
        {showHistory && (
          <>
            <Panel defaultSize={25} minSize={20}>
              <CommentHistory fileId={fileId} />
            </Panel>
            <PanelDivider />
          </>
        )}
        <Panel defaultSize={showHistory ? 75 : 100}>
          <ScrollArea className="h-full p-4">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <div className="inline-flex rounded-full bg-blue-50 p-2 mb-3">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <h3 className="text-base font-medium text-gray-800 mb-1">
                  No comments yet
                </h3>
              </div>
            ) : (
              <div className="space-y-4 pl-4">
                {comments.map((comment) => {
                  const zeroIndexPageNumber =
                    getHighestZeroIndexedPageNumberFromHighlightArea(
                      comment.annotations
                    );
                  return (
                    <div
                      key={comment.id}
                      className={cn(
                        "transition-all duration-200",
                        selectedComment?.id === comment.id
                          ? "-translate-x-4"
                          : "cursor-pointer"
                      )}
                    >
                      <Card
                        onClick={() => handleCommentClick(comment)}
                        className={cn(
                          "w-full",
                          selectedComment?.id === comment.id
                            ? "bg-white shadow-lg"
                            : "hover:bg-gray-100 bg-gray-50",
                          "border-l-4 border-gray-200"
                        )}
                        style={{
                          borderLeftColor:
                            comment.color === CommentColor.GREEN
                              ? "#10B981"
                              : comment.color === CommentColor.RED
                              ? "#EF4444"
                              : "#E5E7EB",
                        }}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start space-x-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-blue-100 text-blue-600">
                                {comment.author[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-sm font-medium text-gray-800">
                                    {comment.author}
                                  </CardTitle>
                                </div>
                                {comment.tag && (
                                  <CommentTagChip tag={comment.tag} />
                                )}
                              </div>
                              {zeroIndexPageNumber !== null && (
                                <span className="text-[10px] text-gray-500 mt-0.5">
                                  Page {zeroIndexPageNumber + 1}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-3">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {comment.body}
                          </p>
                          {comment.links.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <div className="flex flex-wrap gap-1.5">
                                {comment.links.map((link) => (
                                  <Button
                                    key={link.linkToCommentId}
                                    variant="outline"
                                    size="sm"
                                    className="h-auto py-1 px-2.5 text-[11px] gap-1 mr-0 mb-1.5 inline-flex items-center bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 rounded-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLinkClick(link);
                                    }}
                                  >
                                    <FileText size={10} className="shrink-0" />
                                    <span className="truncate">
                                      {link.text}
                                    </span>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default CommentsThread;
