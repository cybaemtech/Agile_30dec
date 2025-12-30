import { useState } from "react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";;
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Project, User, WorkItem } from "@shared/schema";
import { insertWorkItemSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { apiGet } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { TagsInput } from "@/components/ui/tags-input";

// Create a schema specifically for the form
const workItemFormSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().optional(),
  tags: z.string().optional(),
  type: z.string(),
  status: z.string(),
  priority: z.string().min(1, 'Priority is required'),
  projectId: z.number(),
  parentId: z.number().optional().nullable(),
  assigneeId: z.number().optional().nullable(),
  reporterId: z.number().optional().nullable(),
  estimate: z.string().optional(),
  actualHours: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  externalId: z.string().optional(),
  githubUrl: z.string().url({ message: "Please enter a valid GitHub URL" }).optional().or(z.literal("")),
  // Bug-specific fields
  bugType: z.string().optional(),
  currentBehavior: z.string().optional(),
  expectedBehavior: z.string().optional(),
  referenceUrl: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal("")),
  severity: z.string().optional(),
  screenshotFile: z.instanceof(File).optional().nullable(),
}).refine((data) => {
  // Description is required for STORY and BUG types
  if (['STORY', 'BUG'].includes(data.type)) {
    return data.description && data.description.trim().length > 0;
  }
  return true;
}, {
  message: "Description is required for Stories and Bugs",
  path: ["description"],
}).refine((data) => {
  // Actual hours is required when status is DONE
  if (data.status === 'DONE') {
    return data.actualHours !== undefined && data.actualHours !== null && data.actualHours.trim().length > 0;
  }
  return true;
}, {
  message: "Actual hours is required when status is DONE",
  path: ["actualHours"],
}).refine((data) => {
  // Estimate is required for all types
  return data.estimate && data.estimate.trim().length > 0;
}, {
  message: "Estimate is required",
  path: ["estimate"],
}).refine((data) => {
  // Parent/Story is required for TASK, BUG, FEATURE (not EPIC)
  if (!['EPIC'].includes(data.type)) {
    return data.parentId && data.parentId > 0;
  }
  return true;
}, {
  message: "Parent is required for this item type",
  path: ["parentId"],
}).refine((data) => {
  // For BUG type: bugType is required
  if (data.type === 'BUG') {
    return data.bugType && data.bugType.trim().length > 0;
  }
  return true;
}, {
  message: "Bug type is required",
  path: ["bugType"],
}).refine((data) => {
  // For BUG with DEFECT or PROD_INCIDENT: current and expected behavior required
  if (data.type === 'BUG' && ['DEFECT', 'PROD_INCIDENT'].includes(data.bugType || '')) {
    return (data.currentBehavior && data.currentBehavior.trim().length > 0) &&
           (data.expectedBehavior && data.expectedBehavior.trim().length > 0);
  }
  return true;
}, {
  message: "Current and Expected Behavior are required for Defects and Production Incidents",
  path: ["currentBehavior"],
});

type WorkItemFormValues = z.infer<typeof workItemFormSchema>;

interface CreateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projects: Project[];
  workItems: WorkItem[];
  currentProject?: Project;
  preselectedParent?: WorkItem;
  preselectedType?: string;
  itemToEdit?: WorkItem; // Pass the item to edit here
}

export function CreateItemModal({
  isOpen,
  onClose,
  onSuccess,
  projects,
  workItems,
  currentProject,
  preselectedParent,
  preselectedType,
  itemToEdit
}: CreateItemModalProps) {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>("TASK");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // Track selected project for dynamic assignee list
  const [selectedProjectId, setSelectedProjectId] = useState<number>(currentProject?.id || (projects.length > 0 ? projects[0].id : 0));

  // Fetch current user for role-based type restriction
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/auth/user'],
    queryFn: () => apiGet('/auth/user'),
  });

  // Fetch project team members for assignee dropdown
  const { data: projectTeamMembers = [], isLoading: teamMembersLoading, error: teamMembersError } = useQuery({
    queryKey: [`/projects/${selectedProjectId}/team-members`],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      console.log(' Fetching team members for project:', selectedProjectId);
      const members = await apiGet(`/projects/${selectedProjectId}/team-members`);
      console.log(' Team members fetched:', members);
      return members;
    },
    enabled: !!selectedProjectId && isOpen
  });

  // Only allow item types based on user role - memoize to prevent unnecessary re-renders
  const isAdminOrScrum = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SCRUM_MASTER');
  const allowedTypes = React.useMemo(() => {
    return isAdminOrScrum
      ? ["EPIC", "FEATURE", "STORY", "TASK", "BUG"]
      : ["TASK", "BUG"];
  }, [isAdminOrScrum]);

  // Set default type based on user permissions and preselected type - memoize
  const defaultType = React.useMemo(() => {
    if (preselectedType && allowedTypes.includes(preselectedType)) {
      return preselectedType;
    }
    return isAdminOrScrum ? "EPIC" : "TASK";
  }, [preselectedType, allowedTypes, isAdminOrScrum]);
  
  // Track if modal has been initialized to prevent repeated resets
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Set up the form first
  const form = useForm<WorkItemFormValues>({
    resolver: zodResolver(workItemFormSchema),
    defaultValues: {
      title: "",
      description: "",
      tags: "",
      type: defaultType,
      status: "TODO",
      priority: "MEDIUM",
      projectId: selectedProjectId,
      parentId: preselectedParent?.id || null,
      assigneeId: null,
      reporterId: null,
      estimate: "",
      actualHours: "",
      startDate: null,
      endDate: null,
      githubUrl: "",
      bugType: "BUG",
      currentBehavior: "",
      expectedBehavior: "",
      referenceUrl: "",
      severity: "LOW",
    },
  });
  
  // Track bug-specific field state
  const [bugType, setBugType] = useState<string>("BUG");

  // Set assignee to current user when modal opens (only initial default, never overwrites)
  React.useEffect(() => {
    if (isOpen && currentUser && projectTeamMembers.length > 0) {
      const currentAssignee = form.getValues("assigneeId");
      const currentReporter = form.getValues("reporterId");
      const isUserInTeam = projectTeamMembers.some((member: User) => member.id === currentUser.id);

      // Only set defaults on modal open, never overwrite existing values
      if (!currentAssignee && isUserInTeam) {
        form.setValue("assigneeId", currentUser.id, { shouldValidate: false });
      }
      if (!currentReporter) {
        form.setValue("reporterId", currentUser.id, { shouldValidate: false });
      }
    }
  }, [isOpen, currentUser, projectTeamMembers]);

  // Initialize with correct type and values when modal opens (edit mode)
  React.useEffect(() => {
    if (isOpen && currentUser && !isInitialized) {
      if (itemToEdit) {
        // Populate all fields from the item to edit
        Object.entries(itemToEdit).forEach(([key, value]) => {
          if (form.getValues()[key as keyof WorkItemFormValues] !== undefined) {
            form.setValue(key as any, value ?? "");
          }
        });
        setSelectedType(itemToEdit.type);
        setIsInitialized(true);
        if (itemToEdit.projectId) setSelectedProjectId(itemToEdit.projectId);
      } else {
        const typeToSet = preselectedType && allowedTypes.includes(preselectedType) ? preselectedType : defaultType;
        setSelectedType(typeToSet);
        form.setValue("type", typeToSet);
        setIsInitialized(true);
        // Set preselected parent if provided
        if (preselectedParent) {
          form.setValue("parentId", preselectedParent.id);
          form.setValue("projectId", preselectedParent.projectId);
          setSelectedProjectId(preselectedParent.projectId);
        }
      }
    }
  }, [isOpen, currentUser, defaultType, form, preselectedType, preselectedParent, allowedTypes, isInitialized, itemToEdit]);

  // Reset form and initialization flag when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      form.reset({
        title: "",
        description: "",
        tags: "",
        type: defaultType,
        status: "TODO",
        priority: "MEDIUM",
        projectId: selectedProjectId,
        parentId: null,
        assigneeId: null,
        reporterId: null,
        estimate: "",
        startDate: null,
        endDate: null,
      });
      setSelectedType(defaultType);
      setIsInitialized(false); // Reset initialization flag when modal closes
    }
  }, [isOpen, form, defaultType, selectedProjectId]);

  // Only show valid parent options based on selected type and project
  const getValidParents = () => {
    // Filter work items by selected project first
    const projectWorkItems = workItems.filter(item => item.projectId === selectedProjectId);

    switch (selectedType) {
      case "FEATURE":
        return projectWorkItems.filter(item => item.type === "EPIC");
      case "STORY":
        return projectWorkItems.filter(item => item.type === "FEATURE");
      case "TASK":
      case "BUG":
        // SECURITY: Only allow TASK and BUG to be children of STORY items
        return projectWorkItems.filter(item => item.type === "STORY");
      default:
        return [];
    }
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    form.setValue("type", value);

    // Reset parentId when type changes since the valid parents will change
    form.setValue("parentId", null);

    // Reset bug fields if switching away from BUG type
    if (value !== "BUG") {
      form.setValue("bugType", "BUG");
      form.setValue("severity", "LOW");
      form.setValue("currentBehavior", "");
      form.setValue("expectedBehavior", "");
      form.setValue("referenceUrl", "");
      setBugType("BUG");
    }
  };

  // Auto-set priority based on bug type
  const handleBugTypeChange = (value: string) => {
    setBugType(value);
    form.setValue("bugType", value);
    
    // Auto-set priority based on bug type
    const priorityMap: { [key: string]: string } = {
      'BUG': 'LOW',
      'DEFECT': 'MEDIUM',
      'PROD_INCIDENT': 'HIGH'
    };
    
    form.setValue("priority", priorityMap[value] || 'MEDIUM');
  };

  // Handle form submission
  const onSubmit = async (data: WorkItemFormValues) => {
    // Prevent duplicate submissions
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Validation: Features must have an Epic parent
      if (data.type === 'FEATURE' && (!data.parentId)) {
        toast({
          title: "Epic Required",
          description: "Features must be created under an Epic. Please select a parent Epic first.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Validation: Stories must have a Feature parent
      if (data.type === 'STORY' && (!data.parentId)) {
        toast({
          title: "Feature Required",
          description: "Stories must be created under a Feature. Please select a parent Feature first.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Validation: Task and Bug must have a Story parent (REQUIRED)
      if (['TASK', 'BUG'].includes(data.type) && !data.parentId) {
        toast({
          title: "Story Required",
          description: `${data.type.charAt(0) + data.type.slice(1).toLowerCase()}s must be created under a Story. Please select a parent Story first.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Validation: Story and Bug must have description (Task is optional)
      if (['STORY', 'BUG'].includes(data.type) && (!data.description || data.description.trim() === '')) {
        toast({
          title: "Description Required",
          description: `${data.type.charAt(0) + data.type.slice(1).toLowerCase()}s must have a description. Please provide details about the work to be done.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Prepare data for submission - ensure all required fields are present
      const submitData: any = {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        tags: data.tags?.trim() || null,
        type: data.type,
        status: data.status,
        priority: data.priority || 'MEDIUM',
        projectId: Number(data.projectId),
        parentId: data.parentId ? Number(data.parentId) : null,
        assigneeId: data.assigneeId ? Number(data.assigneeId) : null,
        reporterId: data.reporterId ? Number(data.reporterId) : (projectTeamMembers.length > 0 ? projectTeamMembers[0].id : null),
        estimate: data.estimate ? Number(data.estimate) : null,
        actualHours: data.actualHours !== undefined && data.actualHours !== null && data.actualHours !== '' ? Number(data.actualHours) : null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        githubUrl: data.githubUrl?.trim() || null,
        // Bug-specific fields
        bugType: data.type === 'BUG' ? data.bugType : null,
        currentBehavior: data.type === 'BUG' ? (data.currentBehavior?.trim() || null) : null,
        expectedBehavior: data.type === 'BUG' ? (data.expectedBehavior?.trim() || null) : null,
        referenceUrl: data.type === 'BUG' ? data.referenceUrl?.trim() : null,
        severity: data.type === 'BUG' ? data.severity : null,
        screenshot: null, // Will be set if screenshot is provided
        screenshotPath: null, // Will be set if screenshot is provided
      };

      // Convert screenshot to base64 if provided
      if (selectedFile && data.type === 'BUG') {
        try {
          const reader = new FileReader();
          await new Promise<void>((resolve, reject) => {
            reader.onload = () => {
              const base64String = reader.result as string;
              // Store in screenshotBlob column
              submitData.screenshot = null;
              submitData.screenshotBlob = base64String;
              // Generate a filename for the screenshot
              const timestamp = new Date().getTime();
              const filename = `screenshot_${timestamp}_${selectedFile.name}`;
              submitData.screenshotPath = filename;
              resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });
        } catch (error) {
          console.error("Error converting screenshot:", error);
          toast({
            title: "Warning",
            description: "Could not process screenshot, continuing without it.",
            variant: "default",
          });
        }
      }

      console.log("Creating work item with data:", submitData);
      console.log("Tags value being submitted:", data.tags);
      const response = await apiRequest("POST", "/work-items", submitData);

      toast({
        title: "Item created",
        description: "The item has been created successfully.",
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error creating work item:", error);

      // Check if it's a validation error with field-specific errors
      if (error?.response?.data?.errors) {
        const apiErrors = error.response.data.errors;

        // Set field-specific errors
        apiErrors.forEach((err: { path: string; message: string }) => {
          if (form.getValues()[err.path as keyof WorkItemFormValues] !== undefined) {
            form.setError(err.path as any, { message: err.message });
          }
        });

        toast({
          title: "Validation error",
          description: "Please check the form fields and try again.",
          variant: "destructive",
        });
      } else if (error?.response?.data?.message) {
        // Show specific error message from API
        toast({
          title: "Error",
          description: error.response.data.message,
          variant: "destructive",
        });
      } else {
        // Generic error
        toast({
          title: "Error",
          description: "Could not create the item. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get estimate label based on selected type
  const getEstimateLabel = () => {
    return selectedType === "STORY" ? "Story Points" : "Estimated Hours";
  };

  // Get valid parent label based on selected type
  const getParentLabel = () => {
    switch (selectedType) {
      case "FEATURE": return "Epic";
      case "STORY": return "Feature";
      case "TASK":
      case "BUG": return "Story";
      default: return "Parent";
    }
  };

  const isActualHoursEnabled = form.watch("status") === "DONE";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Create New Item</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="mb-6">
              <FormLabel className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Item Type</FormLabel>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {allowedTypes.map(type => (
                  <Button
                    key={type}
                    type="button"
                    variant={selectedType === type ? "default" : "outline"}
                    className={`py-3 px-4 h-12 w-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                      selectedType === type 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                        : "bg-background border border-input hover:bg-accent hover:text-accent-foreground"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTypeChange(type);
                    }}
                  >
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description field - show right after title for all non-TASK types */}
            {selectedType !== 'TASK' && (
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Description
                      {['STORY', 'BUG'].includes(selectedType) && <span className="text-red-500"> *</span>}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={`Enter ${selectedType.toLowerCase()} description - describe what needs to be done`}
                        value={field.value || ""}
                        rows={3}
                      />
                    </FormControl>
                    {['STORY', 'BUG'].includes(selectedType) && (
                      <FormDescription>
                        Required: Provide clear details about what work needs to be completed.
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Bug-specific fields - show right after description for BUG type */}
            {selectedType === "BUG" && (
              <div className="space-y-4 bg-blue-50 p-4 rounded border border-blue-200">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="bugType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Bug Type <span className="text-red-500">*</span></FormLabel>
                        <Select value={field.value} onValueChange={handleBugTypeChange}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="BUG">Bug (Low)</SelectItem>
                            <SelectItem value="DEFECT">Defect (Medium)</SelectItem>
                            <SelectItem value="PROD_INCIDENT">Prod Incident (High)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Priority <span className="text-red-500">*</span></FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="LOW">Low</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Severity <span className="text-red-500">*</span></FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select" />
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
                </div>

                <div className="space-y-4 mt-4 pt-4 border-t border-blue-200">
                  <FormField
                    control={form.control}
                    name="currentBehavior"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Current Behavior</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="What is happening?" rows={2} className="text-sm" value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expectedBehavior"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Expected Behavior</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="What should happen?" rows={2} className="text-sm" value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Tags field - only show for Stories */}
            {selectedType === "STORY" && (
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <TagsInput
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Add tags (e.g., WebApp, Integration, Backend API)..."
                      />
                    </FormControl>
                    <FormDescription>
                      Press Enter or comma to add tags. Use tags to categorize work items by component, platform, or functionality.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Screenshot upload for bugs only */}
            {selectedType === "BUG" && (
              <FormItem>
                <FormLabel>Screenshot (Optional)</FormLabel>
                <FormControl>
                  <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-6 text-center hover:border-neutral-400 transition-colors cursor-pointer"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-primary');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-primary');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-primary');
                      const files = e.dataTransfer.files;
                      if (files.length > 0) {
                        const file = files[0];
                        if (file.type.startsWith('image/')) {
                          setSelectedFile(file);
                        } else {
                          toast({
                            title: "Invalid file type",
                            description: "Please upload an image file",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      id="screenshot-input"
                    />
                    <label htmlFor="screenshot-input" className="cursor-pointer">
                      <div className="text-neutral-600 dark:text-neutral-400">
                        {selectedFile ? (
                          <div className="relative group">
                            <p className="font-medium text-green-600">{selectedFile.name}</p>
                            <p className="text-sm">Click or drag to change</p>
                            <img
                              src={URL.createObjectURL(selectedFile)}
                              alt="Preview"
                              className="max-h-32 mt-2 mx-auto border rounded"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedFile(null);
                              }}
                            >
                              <span className="sr-only">Remove</span>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium">Drag and drop your screenshot</p>
                            <p className="text-sm">or click to select an image</p>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </FormControl>
                <FormDescription>
                  Attach a screenshot to help illustrate the bug. Supported formats: PNG, JPG, GIF
                </FormDescription>
              </FormItem>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Combobox
                        options={projects.map(project => ({
                          value: project.id.toString(),
                          label: project.name,
                          searchFields: [
                            project.name || '',
                            project.key || '',
                            project.description || ''
                          ].filter(Boolean)
                        }))}
                        value={selectedProjectId.toString()}
                        onValueChange={(value) => {
                          const id = parseInt(value);
                          setSelectedProjectId(id);
                          field.onChange(id);
                          // Reset dependent fields when project changes
                          form.setValue("parentId", null);
                        }}
                        placeholder="Search and select project..."
                        searchPlaceholder="Search projects..."
                        emptyText="No projects found."
                        required={true}
                        disabled={!!currentProject}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee</FormLabel>
                    <FormControl>
                      <Combobox
                        options={(() => {
                          const assigneeOptions = [
                            { value: "unassigned", label: "Unassigned" },
                            ...projectTeamMembers.map((user: User) => {
                              const option = {
                                value: user.id.toString(),
                                label: (() => {
                                  const name = user.fullName || user.username;
                                  const username = user.fullName ? ` (@${user.username})` : '';
                                  let roleDisplay = '';

                                  if (user.role === 'ADMIN') {
                                    roleDisplay = ' [Admin]';
                                  } else if (user.role === 'SCRUM_MASTER') {
                                    roleDisplay = ' [Scrum Master]';
                                  }

                                  return `${name}${username}${roleDisplay}`;
                                })(),
                                searchFields: [
                                  user.fullName || '',
                                  user.username || '',
                                  user.email || '',
                                  user.role || ''
                                ].filter(Boolean)
                              };
                              return option;
                            })
                          ];
                          return assigneeOptions;
                        })()}
                        value={field.value?.toString() || "unassigned"}
                        onValueChange={(value) => field.onChange(value && value !== "unassigned" ? parseInt(value) : null)}
                        placeholder={teamMembersLoading ? "Loading team members..." : "Select assignee..."}
                        searchPlaceholder="Search team members..."
                        emptyText={teamMembersError ? "Error loading team members" : "No team members found."}
                        required={['STORY', 'TASK', 'BUG'].includes(selectedType)}
                        disabled={!isAdminOrScrum}
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-gray-500">
                      {!isAdminOrScrum
                        ? "Default assigned to you - only admins and scrum masters can change assignee"
                        : currentUser && projectTeamMembers.some((m: User) => m.id === currentUser.id)
                          ? "Default assigned to you - you can change this if needed"
                          : "Select who will be responsible for completing this work"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {getParentLabel()} <span className="text-red-500">*</span>
                    </FormLabel>
                    {selectedType === "FEATURE" && (
                      <FormDescription>
                        Features must be created under an Epic. Please select a parent Epic.
                      </FormDescription>
                    )}
                    {['TASK', 'BUG'].includes(selectedType) && (
                      <FormDescription>
                        {selectedType.charAt(0) + selectedType.slice(1).toLowerCase()}s must be created under a Story. Please select a parent Story.
                      </FormDescription>
                    )}
                    <FormControl>
                      {selectedType === "EPIC" || getValidParents().length === 0 ? (
                        <Combobox
                          options={[]}
                          value=""
                          placeholder={`No ${getParentLabel().toLowerCase()}s available`}
                          disabled={true}
                        />
                      ) : (
                        <Combobox
                          options={(() => {
                            const validParents = getValidParents();
                            const baseOptions = validParents.map(item => ({
                              value: item.id.toString(),
                              label: `${item.externalId}: ${item.title}${item.description ? ` - ${item.description.substring(0, 50)}${item.description.length > 50 ? '...' : ''}` : ''}`
                            }));
                            
                            // Only add 'None' option for STORY items (they can optionally have Feature parent)
                            if (selectedType === 'STORY') {
                              return [
                                { value: "none", label: "None" },
                                ...baseOptions
                              ];
                            }
                            
                            // For TASK and BUG, don't allow 'None' - Story is required
                            return baseOptions;
                          })()
                          }
                          value={field.value?.toString() || (selectedType === 'STORY' ? "none" : "")}
                          onValueChange={(value) => field.onChange(value && value !== "none" ? parseInt(value) : null)}
                          placeholder={`Search and select ${getParentLabel().toLowerCase()}...`}
                          searchPlaceholder={`Search ${getParentLabel().toLowerCase()}s...`}
                          emptyText={`No ${getParentLabel().toLowerCase()}s found. ${['TASK', 'BUG'].includes(selectedType) ? 'You need to create a Story first.' : ''}`}
                          required={['FEATURE', 'TASK', 'BUG'].includes(selectedType)}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status <span className="text-red-500">*</span></FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TODO">To Do</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="ON_HOLD">On Hold</SelectItem>
                        <SelectItem value="DONE">Done</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="estimate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{getEstimateLabel()} <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={selectedType === "STORY" ? "Story points" : "Hours"}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="actualHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Hours</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          placeholder="Hours"
                          value={field.value || ""}
                          disabled={!isActualHoursEnabled}
                          className={!isActualHoursEnabled ? "bg-muted" : isActualHoursEnabled && !field.value ? "animate-pulse border-orange-500 ring-2 ring-orange-200" : ""}
                        />
                      </FormControl>
                      {isActualHoursEnabled && !field.value && (
                        <FormDescription className="text-orange-600 font-medium text-xs">
                          Please enter actual hours spent to complete this item.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Ref URL field - show for BUG type after Actual Hours */}
            {selectedType === "BUG" && (
              <FormField
                control={form.control}
                name="referenceUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Ref URL (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://..." value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* GitHub URL field - only for EPICs */}
            {selectedType === "EPIC" && (
              <FormField
                control={form.control}
                name="githubUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GitHub Repository URL (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="https://github.com/owner/repository" 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Link to the GitHub repository for this EPIC. This will be used for source code tracking and integration.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(selectedType === "EPIC" || selectedType === "FEATURE" || selectedType === "STORY") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
