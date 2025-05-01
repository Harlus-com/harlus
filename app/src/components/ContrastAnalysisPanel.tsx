import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fileService } from "@/api/fileService";
import { WorkspaceFile } from "@/api/types";
import { ArrowRight, FileSearch } from "lucide-react";

interface ContrastAnalysisProps {
  files: WorkspaceFile[];
  isOpen: boolean;
  onClose: () => void;
}

interface AnalysisResult {
  similarities: string[];
  differences: {
    file1: string;
    file2: string;
    context: string;
  }[];
}

const ContrastAnalysisPanel: React.FC<ContrastAnalysisProps> = ({
  files,
  isOpen,
  onClose,
}) => {
  const [selectedFile1, setSelectedFile1] = useState<WorkspaceFile | null>(
    null
  );
  const [selectedFile2, setSelectedFile2] = useState<WorkspaceFile | null>(
    null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );

  const handleRunAnalysis = async () => {
    if (!selectedFile1 || !selectedFile2) return;

    setIsAnalyzing(true);

    try {
      const result = await fileService.runContrastAnalysis(
        selectedFile1.id,
        selectedFile2.id
      );
      console.log(result);
    } catch (error) {
      console.error("Error running analysis:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile1(null);
    setSelectedFile2(null);
    setAnalysisResult(null);
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
        {!analysisResult ? (
          <>
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
                  <div className="text-sm font-medium mb-2">
                    Second Document
                  </div>
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
          </>
        ) : (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <h3 className="text-lg font-medium">Analysis Results</h3>
              <Button variant="outline" size="sm" onClick={handleReset}>
                New Comparison
              </Button>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium">Comparing:</div>
              </div>
              <div className="flex items-center justify-between bg-muted p-3 rounded-md">
                <div className="truncate max-w-[45%]">
                  {selectedFile1?.name}
                </div>
                <ArrowRight size={16} className="text-muted-foreground mx-2" />
                <div className="truncate max-w-[45%]">
                  {selectedFile2?.name}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-md font-medium mb-2">Key Similarities</h4>
              <Card className="p-4">
                <ul className="list-disc list-inside space-y-2">
                  {analysisResult.similarities.map((item, index) => (
                    <li key={index} className="text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div>
              <h4 className="text-md font-medium mb-2">Key Differences</h4>
              <div className="space-y-4">
                {analysisResult.differences.map((diff, index) => (
                  <Card key={index} className="p-4">
                    <div className="text-sm font-medium mb-2 text-muted-foreground">
                      {diff.context}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted rounded-md text-sm">
                        {diff.file1}
                      </div>
                      <div className="p-3 bg-muted rounded-md text-sm">
                        {diff.file2}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContrastAnalysisPanel;
