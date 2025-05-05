import React, { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PdfViewerRef } from "../components/ReactPdfViewer";
import { useComments } from "./useComments";
import { CommentLink, ReadonlyComment } from "./comment_ui_types";

// Define the props for the CommentsThread component
interface CommentsThreadProps {
  pdfViewerRef: React.RefObject<PdfViewerRef>;
  fileId: string;
}
const EXAMPLE_COMMENTS = [
  {
    id: "1",
    text: "This is an important section about equity analysis.",
    author: "User",
    timestamp: new Date(),
    reactPdfAnnotation: {
      id: "area1",
      page: 0,
      height: 1.55401,
      width: 28.7437,
      left: 16.3638,
      top: 16.6616,
    },
  },
  {
    id: "2",
    text: "We should highlight the methodology used here.",
    author: "User",
    timestamp: new Date(),
    reactPdfAnnotation: {
      id: "area4",
      page: 3,
      height: 1.55401,
      width: 28.7437,
      left: 16.3638,
      top: 16.6616,
    },
  },
];
const CommentsThread: React.FC<CommentsThreadProps> = ({
  fileId,
  pdfViewerRef,
}) => {
  const { getActiveComments, setSelectedComment } = useComments();
  const [newComment, setNewComment] = useState("");
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null
  );

  // filter out hidden comments
  const comments: ReadonlyComment[] = getActiveComments(fileId).filter(
    (c) => !c.isHidden
  );

  console.log("comments", comments);

  const handleAddComment = () => {
    // your existing add-comment logic…
  };

  const handleCommentClick = (comment: ReadonlyComment) => {
    setSelectedComment(comment.id);
    setSelectedCommentId(comment.id);
    pdfViewerRef.current?.jumpToPage(comment.jumpToPageNumber);
  };

  const handleLinkClick = (link: CommentLink) => {
    setSelectedComment(link.linkToCommentId);
    setSelectedCommentId(link.linkToCommentId);
    // optionally jump to page of the linked comment here
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        {comments.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No comments yet
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <Card
                key={comment.id}
                onClick={() => handleCommentClick(comment)}
                className={`w-full cursor-pointer transition-colors ${
                  selectedCommentId === comment.id
                    ? "bg-green-50 border-green-200"
                    : "hover:bg-gray-50"
                }`}
                style={{ borderLeft: `4px solid ${comment.color}` }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{comment.author[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <CardTitle className="text-sm">
                        {comment.author}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {comment.timestamp.toLocaleString()}
                        {comment.jumpToPageNumber !== undefined &&
                          ` • Page ${comment.jumpToPageNumber}`}
                      </p>
                      {comment.header && (
                        <p className="mt-1 text-sm font-medium">
                          {comment.header}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <p className="text-sm">{comment.body}</p>
                  {comment.links.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold">Links:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {comment.links.map((link) => (
                          <li key={link.linkToCommentId}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLinkClick(link);
                              }}
                              className="underline hover:text-blue-600"
                            >
                              {link.text}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="mb-2"
        />
        <Button onClick={handleAddComment} className="w-full">
          Add Comment
        </Button>
      </div>
    </div>
  );
};

export default CommentsThread;
