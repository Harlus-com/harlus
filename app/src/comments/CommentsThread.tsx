import React, { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PdfViewerRef } from "../components/ReactPdfViewer";
import { useComments } from "./useComments";
import { CommentLink, ReadonlyComment, CommentColor } from "./comment_ui_types";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { FileGroupCount } from "@/components/panels";
import CommentTagChip from "./ComentTagChip";

interface CommentsThreadProps {
  pdfViewerRef: React.RefObject<PdfViewerRef>;
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
  pdfViewerRef,
  openFile,
}) => {
  const { getActiveComments, setSelectedComment } = useComments();
  const [newComment, setNewComment] = useState("");
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null
  );

  const comments: ReadonlyComment[] = getActiveComments(fileId).filter(
    (c) => !c.isHidden
  );

  const handleAddComment = () => {
    // your existing add-comment logic…
  };

  const handleCommentClick = (comment: ReadonlyComment) => {
    setSelectedComment(comment.id);
    setSelectedCommentId(comment.id);
    pdfViewerRef.current?.jumpToPage(comment.jumpToPageNumber - 1);
  };

  const handleLinkClick = (link: CommentLink) => {
    setSelectedComment(link.linkToCommentId);
    setSelectedCommentId(link.linkToCommentId);
    openFile(link.likeToFileId, {
      showComments: true,
      fileGroup: FileGroupCount.ONE, // TODO: Maybe have this open a new file group?
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
            <p className="text-xs text-gray-500">
              Add a comment to start the discussion
            </p>
          </div>
        ) : (
          <div className="space-y-4 pl-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className={cn(
                  "transition-all duration-200",
                  selectedCommentId === comment.id
                    ? "-translate-x-4"
                    : "cursor-pointer"
                )}
              >
                <Card
                  onClick={() => handleCommentClick(comment)}
                  className={cn(
                    "w-full",
                    selectedCommentId === comment.id
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
                          {comment.tag && <CommentTagChip tag={comment.tag} />}
                        </div>
                        {comment.jumpToPageNumber !== undefined && (
                          <span className="text-[10px] text-gray-500 mt-0.5">
                            Page {comment.jumpToPageNumber}
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
                              <span className="truncate">{link.text}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-gray-100 bg-white">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[52px] max-h-[120px] resize-none text-sm border-gray-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-300 py-2 px-2.5 rounded-md mb-2"
        />
        <Button
          onClick={handleAddComment}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Add Comment
        </Button>
      </div>
    </div>
  );
};

export default CommentsThread;
