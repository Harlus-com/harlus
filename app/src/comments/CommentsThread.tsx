import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useComments } from "./useComments";
import { CommentLink, ReadonlyComment, CommentColor } from "./comment_ui_types";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { FileGroupCount } from "@/components/panels";
import CommentTagChip from "./ComentTagChip";
import {
  getHighestZeroIndexedPageNumber,
  getHighestZeroIndexedPageNumberFromHighlightArea,
} from "./comment_util";

interface CommentsThreadProps {
  fileId: string;
  openFile: (
    fileId: string,
    options: {
      showComments: boolean;
      fileGroup: FileGroupCount;
      initialPage?: number;
    }
  ) => void;
}

const CommentsThread: React.FC<CommentsThreadProps> = ({
  fileId,
  openFile,
}) => {
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
    
    const pageNumber = link.linkToPageNumber;
    
    openFile(link.linkToFileId, {
      showComments: false,
      fileGroup: FileGroupCount.TWO,
      initialPage: pageNumber,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
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
                    <CardContent className="py-2 px-3 relative">
                      {comment.tag && (
                        <div className="absolute top-2 right-3">
                          <CommentTagChip tag={comment.tag} />
                        </div>
                      )}
                      
                      <div className={cn(comment.tag && "mt-6")}>
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
                                  <span className="truncate">{link.text}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default CommentsThread;
