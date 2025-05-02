import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileSearch } from "lucide-react";
import { WorkspaceFile } from "@/api/types";
import { fileService } from "@/api/fileService";

export interface ContrastResult {
  fileId: string;
  claimChecks: {
    annotations: {
      id: string;
      page: number;
      left: number;
      top: number;
      width: number;
      height: number;
    }[];
    verdict: string;
    explanation: string;
  }[];
}

interface ContrastAnalysisDialogProps {
  files: WorkspaceFile[];
  onContrastAnalysisResult: (result: ContrastResult) => void;
}

const ContrastAnalysisDialog: React.FC<ContrastAnalysisDialogProps> = ({
  files,
  onContrastAnalysisResult,
}) => {
  const [selectedFile1, setSelectedFile1] = useState<WorkspaceFile | null>(
    null
  );
  const [selectedFile2, setSelectedFile2] = useState<WorkspaceFile | null>(
    null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleRunAnalysis = async () => {
    if (!selectedFile1 || !selectedFile2) return;
    setIsAnalyzing(true);
    try {
      const result = await fileService.runContrastAnalysis(
        selectedFile1.id,
        selectedFile2.id
      );
      onContrastAnalysisResult(result);
      setIsOpen(false);
    } catch (error) {
      console.error("Error running analysis:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="group relative">
          <FileSearch size={16} />
          <div className="absolute top-full left-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Analyze
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch size={20} />
            Contrast Analysis
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Compare Documents</h3>
            <p className="text-muted-foreground mb-4">
              Select two documents to analyze and compare their content,
              structure, and key points.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <div className="text-sm font-medium mb-2">First Document</div>
                <div className="border rounded-md overflow-hidden">
                  <div className="max-h-[200px] overflow-y-auto">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className={`p-3 cursor-pointer hover:bg-muted ${
                          selectedFile1?.id === file.id ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedFile1(file)}
                      >
                        <div className="flex items-center">
                          <div className="ml-2 truncate">{file.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Second Document</div>
                <div className="border rounded-md overflow-hidden">
                  <div className="max-h-[200px] overflow-y-auto">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className={`p-3 cursor-pointer hover:bg-muted ${
                          selectedFile2?.id === file.id ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedFile2(file)}
                      >
                        <div className="flex items-center">
                          <div className="ml-2 truncate">{file.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleRunAnalysis}
              disabled={!selectedFile1 || !selectedFile2 || isAnalyzing}
              className="w-full max-w-xs"
            >
              {isAnalyzing ? "Analyzing..." : "Run Analysis"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContrastAnalysisDialog;
