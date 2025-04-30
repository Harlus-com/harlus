import React from "react";
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

const formSchema = z.object({
  ticker: z.string().min(1).max(5),
  name: z.string().min(1).max(100),
});

const WorkspaceNew = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const workspace = await workspaceService.createWorkspace(values.ticker);
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
      <div className="max-w-md mx-auto py-8 px-4">
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Apple Inc." {...field} />
                  </FormControl>
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
