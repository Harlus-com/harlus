import React, { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PdfViewerRef } from "../components/ReactPdfViewer";
import { Comment } from "@/api/types";

// Define the props for the CommentsThread component
interface CommentsThreadProps {
  pdfViewerRef: React.RefObject<PdfViewerRef>;
  comments: Comment[];
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

const CommentsThread: React.FC<CommentsThreadProps> = (props) => {
  const [comments, setComments] = useState<Comment[]>(props.comments);
  const [newComment, setNewComment] = useState("");
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null
  );

  const pdfViewerRef = props.pdfViewerRef;
  const handleAddComment = () => {};

  const handleCommentClick = (comment: Comment) => {
    console.log("handleCommentClick", comment);
    if (!!pdfViewerRef?.current) {
      if (selectedCommentId) {
        const previousActiveComment = comments.find(
          (c) => c.id === selectedCommentId
        );
        if (previousActiveComment?.reactPdfAnnotation) {
          pdfViewerRef.current.setHighlightColor(
            previousActiveComment.reactPdfAnnotation,
            "yellow"
          );
        }
      }

      pdfViewerRef.current.jumpToPage(comment.reactPdfAnnotation.page);

      if (comment.reactPdfAnnotation) {
        console.log("setting highlight color", comment.reactPdfAnnotation);
        pdfViewerRef.current.setHighlightColor(
          comment.reactPdfAnnotation,
          "green"
        );
      }

      setSelectedCommentId(comment.id);
    }
  };
  const pageNumber = 1;

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
                        {comment.reactPdfAnnotation &&
                          ` • Page ${comment.reactPdfAnnotation.page + 1}`}
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
