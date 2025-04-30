import React, { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PdfViewerRef } from "./ReactPdfViewer";

// Define the Comment type
interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
  pageNumber?: number;
  highlightAreaId?: string;
}

// Define the props for the CommentsThread component
interface CommentsThreadProps {
  documentId?: string;
  pageNumber?: number;
  pdfViewerRef?: React.RefObject<PdfViewerRef>;
}

const CommentsThread: React.FC<CommentsThreadProps> = ({
  documentId,
  pageNumber,
  pdfViewerRef,
}) => {
  const [comments, setComments] = useState<Comment[]>([
    {
      id: "1",
      text: "This is an important section about equity analysis.",
      author: "User",
      timestamp: new Date(),
      pageNumber: 0,
      highlightAreaId: "area1",
    },
    {
      id: "2",
      text: "We should highlight the methodology used here.",
      author: "User",
      timestamp: new Date(),
      pageNumber: 3,
      highlightAreaId: "area4",
    },
  ]);
  const [newComment, setNewComment] = useState("");
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null
  );

  const handleAddComment = () => {
    if (newComment.trim()) {
      const comment: Comment = {
        id: Date.now().toString(),
        text: newComment,
        author: "User",
        timestamp: new Date(),
        pageNumber: pageNumber,
        highlightAreaId: pageNumber === 0 ? "area1" : "area4",
      };
      setComments([...comments, comment]);
      setNewComment("");
    }
  };

  const handleCommentClick = (comment: Comment) => {
    if (comment.pageNumber !== undefined && pdfViewerRef?.current) {
      if (selectedCommentId) {
        const previousComment = comments.find(
          (c) => c.id === selectedCommentId
        );
        if (previousComment?.highlightAreaId) {
          pdfViewerRef.current.setHighlightColor(
            previousComment.highlightAreaId,
            "yellow"
          );
        }
      }

      pdfViewerRef.current.jumpToPage(comment.pageNumber);

      if (comment.highlightAreaId) {
        pdfViewerRef.current.setHighlightColor(
          comment.highlightAreaId,
          "green"
        );
      }

      setSelectedCommentId(comment.id);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Comments</h2>
        {pageNumber && (
          <p className="text-sm text-muted-foreground">Page {pageNumber}</p>
        )}
      </div>

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
                className={`w-full cursor-pointer transition-colors ${
                  selectedCommentId === comment.id
                    ? "bg-green-50 border-green-200"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => handleCommentClick(comment)}
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
                        {comment.pageNumber !== undefined &&
                          ` • Page ${comment.pageNumber + 1}`}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <p className="text-sm">{comment.text}</p>
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
