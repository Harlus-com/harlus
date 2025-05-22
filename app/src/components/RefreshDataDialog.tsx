import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { fileService } from "@/api/fileService";
import { Workspace } from "@/api/workspace_types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check, Import } from "lucide-react";
// import { useForm } from "react-hook-form";
// import { z } from "zod";
// import { zodResolver } from "@hookform/resolvers/zod";

interface RefreshDataDialogProps {
  workspace: Workspace | null;
}

// two values to process existing and new folders with same logic
interface Suggestion {
  display: string; // human‐friendly label, e.g. Add folder "reports > sec > 10K"
  original: string; // raw folder key, e.g. reports > sec > 10K
}

// Turn “reports > sec>10K” or “reports /sec /10K” etc into “reports/sec/10K”
function parseDestination(input: string): string {
  return input
    .split(/[>/]/)
    .map((seg) => seg.trim())
    .filter(Boolean)
    .join("/");
}

export default function RefreshDataDialog({ 
  workspace
}: RefreshDataDialogProps) {
  const { toast } = useToast();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [wasSuccessful, setWasSuccessful] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const [selectedDirectory, setSelectedDirectory] = useState<string>("");
  const [allFolderPaths, setAllFolderPaths] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const defaultStartDate = useMemo(() => {
    return `${new Date().getFullYear() - 1}-01-01`;
  }, []);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);

  const dialogRef = useRef<HTMLDivElement>(null); // for outside click detection

  // const formSchema = z.object({
  //   directory: z.string().min(1, "Please select a directory"),
  //   startDate: z.string().min(6).max(10),
  // });

  // const form = useForm<z.infer<typeof formSchema>>({
  //   resolver: zodResolver(formSchema),
  //   defaultValues: {directory: "", startDate: defaultStartDate},
  // });

  const computeSuggestions = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      const matched = allFolderPaths.filter((path) =>
        path.toLowerCase().includes(q)
      );
      const list: Suggestion[] = matched.map((path) => ({
        display: path,
        original: path,
      }));
      if (!matched.some((path) => path.toLowerCase() === q)) {
        list.push({
          display: `Add new folder "${query.trim()}"`,
          original: query.trim(),
        });
      }
      return list;
    },
    [allFolderPaths]
  );

  // Load all folders once dialog opens
  useEffect(() => {
    if (!showDialog) {
      setAllFolderPaths([]);
      return;
    }
    (async () => {
      try {
        const localFolders: LocalFolder[] = await window.electron.getLocalFolders(
          workspace.localDir
        );
        const flat = localFolders.map(f =>
          f.pathRelativeToWorkspace.join(" > ")
        );
        setAllFolderPaths(flat);
      } catch (err) {
        console.error("Failed to load folders", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Unable to load folder list",
        });
      }
    })();
  }, [showDialog, workspace, toast]);

  // Update suggestions when text changes and suggestions enabled
  useEffect(() => {
    if (!showDialog || !showSuggestions) {
      setSuggestions([]);
      return;
    }
    if (!selectedDirectory.trim()) {
      setSuggestions(
        allFolderPaths.map((path) => ({ display: path, original: path }))
      );
      return;
    }
    setSuggestions(computeSuggestions(selectedDirectory));
  }, [selectedDirectory, showDialog, showSuggestions, allFolderPaths, computeSuggestions]);

  const handleSuggestionClick = useCallback((s: Suggestion) => {
    setSelectedDirectory(s.original);
    setTimeout(() => {
      setShowSuggestions(false);
      setSuggestions([]);
    }, 0);
  }, []);
  
  const handleInputFocus = useCallback(() => {
    setShowSuggestions(true);
    if (selectedDirectory.trim()) {
      setSuggestions(computeSuggestions(selectedDirectory));
    }
  }, [computeSuggestions, selectedDirectory]);

  const handleInputBlur = () => {
    setShowSuggestions(false);
  };

  // // Browse button fallback
  // const handleSelectDirectory = async () => {
  //   try {
  //     const directory = await window.electron.openDirectoryDialog();
  //     if (directory) {
  //       setSelectedDirectory(directory);
  //       form.setValue("directory", directory);
  //     }
  //   } catch (error) {
  //     console.error("Error selecting directory:", error);
  //     toast({
  //       variant: "destructive",
  //       title: "Error",
  //       description: "Failed to select directory",
  //     });
  //   }
  // };

  const performRefresh = useCallback(
    async (destination: string, date: string) => {
      if (isRefreshing || !workspace?.id) return;
      setIsRefreshing(true);
      setWasSuccessful(false);
      try {
        // TODO: handle smoothly if no new files to download
        await fileService.refreshOnlineData(
          workspace,
          destination,
          date
        );
        setWasSuccessful(true);
        toast({
          title: "Successful refresh!",
          description: `New files added to the folder ${destination}`,
        });
        // TODO: reload workspace to see files
        setTimeout(() => setWasSuccessful(false), 2000);
      } catch (err: any) {
        console.error(err);
        toast({
          variant: "destructive",
          title: "Error",
          description:
            err.message || "Failed to refresh online data",
        });
      } finally {
        setIsRefreshing(false);
      }
    },
    [isRefreshing, workspace, toast]
  );

  const openDialog = useCallback(() => {
    setSelectedDirectory("");
    setStartDate(defaultStartDate);
    setShowDialog(true);
    setShowSuggestions(false);
  }, [defaultStartDate]);

  const onConfirm = useCallback(() => {
    setShowDialog(false);
    const finalPath = parseDestination(selectedDirectory);
    performRefresh(finalPath, startDate);
    setSuggestions([]);
    setShowSuggestions(false);
  }, [selectedDirectory, startDate, performRefresh]);

  const onCancel = useCallback(() => {
    setShowDialog(false);
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target as Node)
      ) {
        onCancel();
      }
    }
    if (showDialog) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showDialog, onCancel]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={openDialog}
        disabled={isRefreshing}
        className="group relative"
      >
        {isRefreshing ? (
          <RefreshCw size={16} className="animate-spin" />
        ) : wasSuccessful ? (
          <Check size={16} className="text-green-500" />
        ) : (
          <Import size={16} />
        )}
        <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-black text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {isRefreshing
            ? "Fetching Reports..."
            : wasSuccessful
            ? "Fetch Complete!"
            : "Fetch Reports"}
        </div>
      </Button>

      <AlertDialog open={showDialog} onOpenChange={(open) => open ? setShowDialog(true) : onCancel()}>
        <AlertDialogContent ref={dialogRef} className="max-w-md p-6">
          <div className="py-4 relative">
            <label htmlFor="start-date" className="block mb-1">
              Destination folder
            </label>
            <Input
              id="directory"
              placeholder="Type to search or create a folder"
              value={selectedDirectory}
              onChange={(e) => setSelectedDirectory(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="w-full pr-24"
            />
            {/* <Button
              type="button"
              variant="outline"
              onClick={handleSelectDirectory}
              className="absolute top-1 right-1"
            >
              Browse
            </Button> */}

            {suggestions.length > 0 && (
              <ul className="absolute z-10 top-full left-0 w-full bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-60 overflow-auto">
                {suggestions.map((s) => (
                  <li
                    key={s.display}
                    onMouseDown={() => handleSuggestionClick(s)}
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    {s.display}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="py-4">
            <label htmlFor="start-date" className="block mb-1">
              Start Date
            </label>
            <Input
              type="date"
              id="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full"
            />
          </div>

          <AlertDialogFooter className="flex justify-end space-x-3">
            <AlertDialogCancel asChild>
              <Button onClick={onCancel} className="bg-white text-black border border-gray-300 hover:bg-gray-100">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={onConfirm} className="bg-blue-500 text-white hover:bg-blue-600">Confirm</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
