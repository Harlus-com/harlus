import { CommentTag } from "./comment_ui_types";
import { cn } from "@/lib/utils";

interface CommentTagChipProps {
  tag: CommentTag;
}

const CommentTagChip: React.FC<CommentTagChipProps> = ({ tag }) => {
  const getTagText = (tag: CommentTag) => {
    switch (tag) {
      case CommentTag.ALIGNMENT:
        return "Alignment";
      case CommentTag.CONTRADICTION:
        return "Contradiction";
      default:
        return tag;
    }
  };

  const getTagColor = (tag: CommentTag) => {
    switch (tag) {
      case CommentTag.ALIGNMENT:
        return "bg-green-100 text-green-700";
      case CommentTag.CONTRADICTION:
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <span
      className={cn(
        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
        getTagColor(tag)
      )}
    >
      {getTagText(tag)}
    </span>
  );
};

export default CommentTagChip;
