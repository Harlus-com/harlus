import { FileGroupCount } from "@/components/panels";
import { FilesToOpen } from "./file_types";

export function getFileGroupsToOpen(
  filesToOpen: FilesToOpen
): FileGroupCount[] {
  return Array.from(
    new Set(
      Object.entries(filesToOpen).map(([fileId, options]) => options.fileGroup)
    )
  );
}

export function fileGroupCounts() {
  return [
    FileGroupCount.ONE,
    FileGroupCount.TWO,
    FileGroupCount.THREE,
    FileGroupCount.FOUR,
  ];
}
