import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { fileService } from "@/api/fileService";
import { WorkspaceFile } from "@/api/types";
import { FileSearch } from "lucide-react";

interface ContrastAnalysisProps {
  files: WorkspaceFile[];
  isOpen: boolean;
  onClose: () => void;
  onContrastAnalysisResult: (result: AnalysisResult) => void;
}

export interface Annotation {
  text: string;
  page: number;
  bbox: number[];
  verdict: string;
  explanation: string;
}

export interface AnalysisResult {
  fileId1: string;
  annotations: Annotation[];
}

const ContrastAnalysisPanel: React.FC<ContrastAnalysisProps> = ({
  files,
  isOpen,
  onClose,
  onContrastAnalysisResult,
}) => {
  const [selectedFile1, setSelectedFile1] = useState<WorkspaceFile | null>(
    null
  );
  const [selectedFile2, setSelectedFile2] = useState<WorkspaceFile | null>(
    null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const handleRunAnalysis = async () => {
    if (!selectedFile1 || !selectedFile2) return;
    const annotations: Annotation[] = [];
    setIsAnalyzing(true);
    try {
      const result = await fileService.runContrastAnalysis(
        selectedFile1.id,
        selectedFile2.id
      );
      for (const [key, value] of Object.entries(result)) {
        const annotation = value as any;
        annotations.push({
          text: key,
          page: annotation.page_num,
          bbox: annotation.bbox[0],
          verdict: annotation.verdict,
          explanation: annotation.explanation,
        });
      }
      onContrastAnalysisResult({
        fileId1: selectedFile1.id,
        annotations,
      });
    } catch (error) {
      console.error("Error running analysis:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col border-l border-border bg-card w-[500px] overflow-auto">
      <div className="p-4 font-medium text-lg border-b border-border flex justify-between items-center">
        <div className="flex items-center">
          <FileSearch className="mr-2" size={20} />
          Contrast Analysis
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="p-4 flex-1 overflow-auto">
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
    </div>
  );
};

export default ContrastAnalysisPanel;
