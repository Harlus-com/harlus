import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { workspaceService } from "@/api/workspaceService";
import { useToast } from "@/components/ui/use-toast";
import { FolderIcon } from "lucide-react";

const formSchema = z.object({
  ticker: z.string().min(1).max(5),
  directory: z.string().min(1, "Please select a directory"),
});

const WorkspaceNew = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(
    null
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ticker: "",
      directory: "",
    },
  });

  const handleSelectDirectory = async () => {
    try {
      const directory = await window.electron.openDirectoryDialog();
      if (directory) {
        setSelectedDirectory(directory);
        form.setValue("directory", directory);
      }
    } catch (error) {
      console.error("Error selecting directory:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to select directory",
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const workspace = await workspaceService.createWorkspace(
        values.ticker,
        values.directory
      );

      toast({
        title: "Workspace created",
        description: `Created workspace for ${workspace.name}`,
      });
      navigate(`/workspace/${workspace.id}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create workspace",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-8">Create New Workspace</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="ticker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ticker Symbol</FormLabel>
                  <FormControl>
                    <Input placeholder="AAPL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="directory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace Directory</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        placeholder="Select a directory"
                        value={selectedDirectory || ""}
                        readOnly
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSelectDirectory}
                    >
                      Browse
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => navigate("/")}
              >
                Cancel
              </Button>
              <Button type="submit">Create Workspace</Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default WorkspaceNew;
