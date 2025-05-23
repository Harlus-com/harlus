import { getHighestZeroIndexedPageNumber } from "@/comments/comment_util";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { useMemo } from "react";
import { ChatSourceCommentGroup } from "./chat_types";
import { useFileContext } from "@/files/FileContext";
interface SourceBadgeProps {
  source: ChatSourceCommentGroup;
  onClick: () => void;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  source,
  onClick,
}) => {
  const { getFile } = useFileContext();
  const file = getFile(source.fileId);
  if (!file) {
    console.error(`File with id ${source.fileId} not found`);
    return null;
  }
  const fileName = file.name;

  // Extract page numbers if available
  const pageNumbers = useMemo(() => {
    if (!source.chatSourceComments) return [];

    return [
      ...new Set(
        source.chatSourceComments
          .map((comment) =>
            getHighestZeroIndexedPageNumber(
              comment?.highlightArea?.boundingBoxes
            )
          )
          .filter((pageNumber) => pageNumber !== null)
          .map((pageNumber) => pageNumber + 1)
      ),
    ];
  }, [source.chatSourceComments]);

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-auto py-1 px-2.5 text-[11px] gap-1 mr-0 mb-1.5 inline-flex items-center bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 rounded-full grow basis-full sm:basis-[48%] sm:mr-0 sm:max-w-[49%]"
      onClick={onClick}
    >
      <FileText size={10} className="shrink-0" />
      <span className="truncate">{fileName}</span>
      {pageNumbers.length > 0 && (
        <Badge
          variant="secondary"
          className="h-4 px-1 text-[9px] bg-blue-200 rounded-full ml-0.5 shrink-0"
        >
          p.{pageNumbers.join(",")}
        </Badge>
      )}
    </Button>
  );
};
