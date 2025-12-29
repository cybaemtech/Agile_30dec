import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Bug, Send, AlertTriangle } from "lucide-react";
import { apiGet, apiRequest } from "@/lib/api-config";
import { User, Team, Project } from "@shared/schema";

const bugReportSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  projectId: z.string().min(1, "Please select a project"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  stepsToReproduce: z.string().optional(),
});

type BugReportFormValues = z.infer<typeof bugReportSchema>;

export default function ReportBug() {
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/auth/user'],
    queryFn: () => apiGet('/auth/user'),
    retry: false,
  });

  // Fetch teams
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/teams'],
    queryFn: () => apiGet('/teams'),
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/projects'],
    queryFn: () => apiGet('/projects'),
  });

  // Filter projects based on user's team membership
  const accessibleProjects = projects.filter(project => {
    if (currentUser?.role === 'ADMIN') return true;
    if (!project.teamId) return false;
    
    return true;
  });

  const form = useForm<BugReportFormValues>({
    resolver: zodResolver(bugReportSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: "",
      priority: "MEDIUM",
      stepsToReproduce: "",
    },
  });

  const onSubmit = async (data: BugReportFormValues) => {
    setIsSubmitting(true);
    try {
      const project = projects.find(p => p.id === parseInt(data.projectId));
      if (!project) {
        throw new Error("Project not found");
      }

      // Create a work item of type BUG
      const workItemData = {
        title: data.title,
        description: data.description,
        type: "BUG",
        priority: data.priority,
        status: "TODO",
        projectId: parseInt(data.projectId),
        reporterId: currentUser?.id,
        // Add steps to reproduce to description if provided
        ...(data.stepsToReproduce && {
          description: `${data.description}\n\n**Steps to Reproduce:**\n${data.stepsToReproduce}`
        })
      };

      await apiRequest('POST', '/work-items', workItemData);

      toast({
        title: "Bug Report Submitted",
        description: `Bug report "${data.title}" has been created successfully.`,
      });

      // Reset form
      form.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit bug report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        user={currentUser}
        teams={teams}
        projects={projects}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={currentUser} 
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} 
        />
        
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <div className="flex items-center mb-2">
                  <Bug className="h-6 w-6 text-red-500 mr-2" />
                  <h1 className="text-2xl font-semibold">Report a Bug</h1>
                </div>
                <p className="text-neutral-600">
                  Help us improve the system by reporting bugs you encounter.
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                    Bug Report Form
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bug Title *</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Brief description of the bug"
                              />
                            </FormControl>
                            <FormDescription>
                              Provide a clear, concise title for the bug
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="projectId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Combobox
                                options={accessibleProjects.map(project => ({
                                  value: project.id.toString(),
                                  label: `${project.name} (${project.key})`
                                }))}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Search and select the project where you found the bug..."
                                searchPlaceholder="Search projects..."
                                emptyText="No accessible projects found."
                                required={true}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="LOW">Low</SelectItem>
                                <SelectItem value="MEDIUM">Medium</SelectItem>
                                <SelectItem value="HIGH">High</SelectItem>
                                <SelectItem value="CRITICAL">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bug Description *</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Describe the bug in detail. What happened? What did you expect to happen?"
                                rows={5}
                              />
                            </FormControl>
                            <FormDescription>
                              Provide as much detail as possible about the bug
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="stepsToReproduce"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Steps to Reproduce</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="1. Go to...&#10;2. Click on...&#10;3. Enter...&#10;4. Bug occurs..."
                                rows={4}
                              />
                            </FormControl>
                            <FormDescription>
                              Help us reproduce the bug by providing step-by-step instructions
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end space-x-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => form.reset()}
                          disabled={isSubmitting}
                        >
                          Clear Form
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSubmitting}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {isSubmitting ? "Submitting..." : "Submit Bug Report"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}