import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
import { apiRequest } from "@/lib/queryClient";
import { apiGet } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { TagsInput } from "@/components/ui/tags-input";
import { Trash2 } from "lucide-react";

// Create a schema specifically for the form - matching CreateItemModal
const workItemFormSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().optional(),
  tags: z.string().optional(),
  status: z.string(),
  priority: z.string().optional(),
  parentId: z.number().optional().nullable(),
  assigneeId: z.number().optional().nullable(),
  estimate: z.string().optional(),
  actualHours: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  projectId: z.number(),
  type: z.string(), // Added type to schema for validation logic
  bugType: z.string().optional(),
  severity: z.string().optional(),
  currentBehavior: z.string().optional(),
  expectedBehavior: z.string().optional(),
  referenceUrl: z.string().optional(),
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
  // Current Behavior and Expected Behavior are required ONLY for DEFECT or PROD_INCIDENT bug types
  if (data.type === 'BUG' && (data.bugType === 'DEFECT' || data.bugType === 'PROD_INCIDENT')) {
    return data.currentBehavior && data.currentBehavior.trim().length > 0 &&
           data.expectedBehavior && data.expectedBehavior.trim().length > 0;
  }
  return true;
}, {
  message: "Current Behavior and Expected Behavior are required for Defects and Prod Incidents",
  path: ["currentBehavior"],
});

type WorkItemFormValues = z.infer<typeof workItemFormSchema>;

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workItem?: WorkItem;
  projects?: Project[];
}

export function EditItemModal({
  isOpen,
  onClose,
  onSuccess,
  workItem,
  projects = []
}: EditItemModalProps) {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  console.log("EditItemModal - isOpen:", isOpen, "workItem:", workItem);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Set up the form
  const form = useForm<WorkItemFormValues>({
    resolver: zodResolver(workItemFormSchema),
    defaultValues: {
      title: "",
      description: "",
      tags: "",
      status: "TODO",
      priority: "MEDIUM",
      parentId: null,
      assigneeId: null,
      estimate: "",
      startDate: null,
      endDate: null,
      projectId: 0,
      type: "STORY",
      bugType: "BUG",
      severity: "LOW",
      currentBehavior: "",
      expectedBehavior: "",
      referenceUrl: "",
    },
  });

  // Watch projectId to update dependent queries
  const selectedProjectId = form.watch("projectId");
  
  // Watch behavior fields to ensure they're always in sync
  const watchedCurrentBehavior = form.watch("currentBehavior");
  const watchedExpectedBehavior = form.watch("expectedBehavior");
  const watchedBugType = form.watch("bugType");

  // Fetch the fresh work item data to ensure we have all fields including bug fields
  const { data: freshWorkItem } = useQuery<WorkItem>({
    queryKey: [`/work-items/${workItem?.id}`],
    queryFn: async () => {
      if (!workItem?.id) return workItem;
      const item = await apiGet(`/work-items/${workItem.id}`);
      console.log("Fresh work item fetched:", item);
      return item;
    },
    enabled: !!workItem?.id && isOpen,
    staleTime: 0, // Always refetch to get fresh data
  });

  // Use the fresh work item if available, otherwise use the prop
  const displayWorkItem = freshWorkItem || workItem;

  // Fetch current user for role-based restrictions
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/auth/user'],
    queryFn: () => apiGet('/auth/user'),
  });

  const isAdminOrScrum = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SCRUM_MASTER');

  // Fetch project team members for assignee dropdown
  const { data: projectTeamMembers = [] } = useQuery<User[]>({
    queryKey: [`/projects/${selectedProjectId}/team-members`],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const members = await apiGet(`/projects/${selectedProjectId}/team-members`);
      return members;
    },
    enabled: !!selectedProjectId && isOpen
  });

  // Fetch all work items from the project for parent selection
  const { data: allWorkItems = [] } = useQuery<WorkItem[]>({
    queryKey: [`/projects/${selectedProjectId}/work-items`],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const items = await apiGet(`/projects/${selectedProjectId}/work-items`);
      return items;
    },
    enabled: !!selectedProjectId && isOpen
  });

  // Only show valid parent options based on work item type and project
  const getValidParents = () => {
    if (!workItem || !allWorkItems.length) return [];

    // Filter work items by the same project first
    const projectWorkItems = allWorkItems.filter(item =>
      item.projectId === selectedProjectId && item.id !== workItem.id
    );

    switch (workItem.type) {
      case "FEATURE":
        return projectWorkItems.filter(item => item.type === "EPIC");
      case "STORY":
        return projectWorkItems.filter(item => item.type === "FEATURE");
      case "TASK":
      case "BUG":
        return projectWorkItems.filter(item => item.type === "STORY");
      default:
        return [];
    }
  };

  // Get valid parent label based on work item type
  const getParentLabel = () => {
    if (!workItem) return "Parent";

    switch (workItem.type) {
      case "FEATURE": return "Epic";
      case "STORY": return "Feature";
      case "TASK":
      case "BUG": return "Story";
      default: return "Parent";
    }
  };

  // Update form when displayWorkItem changes (which includes fresh data with bug fields)
  useEffect(() => {
    if (displayWorkItem && isOpen) {
      console.log("📋 EDIT MODAL: Fresh item loaded:", displayWorkItem);
      console.log("📋 Bug fields in item:", {
        bugType: displayWorkItem.bugType,
        severity: displayWorkItem.severity,
        currentBehavior: displayWorkItem.currentBehavior,
        expectedBehavior: displayWorkItem.expectedBehavior,
      });

      // Format dates for the form - use local date to avoid timezone issues
      const formatLocalDateForInput = (dateValue: string | Date | null): string | null => {
        if (!dateValue) return null;
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateFormatted = formatLocalDateForInput(displayWorkItem.startDate);
      const endDateFormatted = formatLocalDateForInput(displayWorkItem.endDate);

      console.log("📋 Setting form values from displayWorkItem:", {
        currentBehavior: displayWorkItem.currentBehavior,
        expectedBehavior: displayWorkItem.expectedBehavior,
        bugType: displayWorkItem.bugType,
        severity: displayWorkItem.severity,
        actualHours: displayWorkItem.actualHours,
        actualHoursString: displayWorkItem.actualHours?.toString(),
        status: displayWorkItem.status
      });

      // Map both possible snake_case and camelCase field names from backend response
      const itemData = displayWorkItem as any;
      
      // Properly handle actualHours - convert to string for form, handle falsy values
      const actualHoursValue = displayWorkItem.actualHours !== null && displayWorkItem.actualHours !== undefined 
        ? displayWorkItem.actualHours.toString()
        : "";
      
      const formData: WorkItemFormValues = {
        title: displayWorkItem.title,
        description: displayWorkItem.description || "",
        tags: displayWorkItem.tags || "",
        status: displayWorkItem.status,
        priority: displayWorkItem.priority || "MEDIUM",
        parentId: displayWorkItem.parentId || null,
        assigneeId: displayWorkItem.assigneeId || null,
        estimate: displayWorkItem.estimate?.toString() || "",
        actualHours: actualHoursValue,
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        projectId: displayWorkItem.projectId,
        type: displayWorkItem.type,
        bugType: itemData.bugType || itemData.bug_type || "BUG",
        severity: itemData.severity || "LOW",
        currentBehavior: itemData.currentBehavior || itemData.current_behavior || "",
        expectedBehavior: itemData.expectedBehavior || itemData.expected_behavior || "",
        referenceUrl: itemData.referenceUrl || itemData.reference_url || "",
      };

      console.log("🔍 WorkItem from API:", displayWorkItem);
      console.log("📋 Form data to reset:", formData);
      form.reset(formData);

      // CRITICAL: Double-check if the form actually reset with values
      // Sometimes react-hook-form needs a tiny tick to reflect values from displayWorkItem
      if (itemData.current_behavior || itemData.currentBehavior) {
        form.setValue("currentBehavior", itemData.currentBehavior || itemData.current_behavior || "", { shouldDirty: false, shouldTouch: false });
      }
      if (itemData.expected_behavior || itemData.expectedBehavior) {
        form.setValue("expectedBehavior", itemData.expectedBehavior || itemData.expected_behavior || "", { shouldDirty: false, shouldTouch: false });
      }
      if (itemData.bug_type || itemData.bugType) {
        form.setValue("bugType", itemData.bugType || itemData.bug_type || "BUG", { shouldDirty: false, shouldTouch: false });
      }
      if (displayWorkItem.actualHours !== null && displayWorkItem.actualHours !== undefined) {
        form.setValue("actualHours", actualHoursValue, { shouldDirty: false, shouldTouch: false });
      }

      // Verify form was reset
      setTimeout(() => {
        // Force sync values to ensure they are present for validation
        const currentVal = itemData.currentBehavior || itemData.current_behavior || "";
        const expectedVal = itemData.expectedBehavior || itemData.expected_behavior || "";
        const bugTypeVal = itemData.bugType || itemData.bug_type || "BUG";

        if (currentVal) {
          form.setValue("currentBehavior", currentVal, { shouldValidate: false, shouldDirty: false });
        }
        if (expectedVal) {
          form.setValue("expectedBehavior", expectedVal, { shouldValidate: false, shouldDirty: false });
        }
        if (bugTypeVal) {
          form.setValue("bugType", bugTypeVal, { shouldValidate: false, shouldDirty: false });
        }
        if (displayWorkItem.actualHours !== null && displayWorkItem.actualHours !== undefined) {
          form.setValue("actualHours", actualHoursValue, { shouldValidate: false, shouldDirty: false });
        }

        console.log("📋 Form values after reset:", {
          bugType: form.getValues("bugType"),
          currentBehavior: form.getValues("currentBehavior"),
          expectedBehavior: form.getValues("expectedBehavior"),
          severity: form.getValues("severity"),
          actualHours: form.getValues("actualHours"),
          status: form.getValues("status")
        });
      }, 50);
    }
  }, [displayWorkItem, isOpen, form]);

  // Handle form submission
  const onSubmit = async (data: WorkItemFormValues) => {
    if (!workItem) {
      toast({
        title: "Error",
        description: "No work item provided for editing.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("=== EDIT ITEM DEBUG START ===");
      console.log("Original work item:", workItem);
      console.log("Form data submitted:", data);
      console.log("Raw tags value:", data.tags);
      console.log("Tags type:", typeof data.tags);
      console.log("Tags length:", data.tags?.length);

      // Prepare data for submission
      const submitData = {
        ...data,
        // Convert empty strings or "null" strings to null for optional fields
        tags: data.tags?.trim() || null,
        parentId: data.parentId || null,
        assigneeId: data.assigneeId || null,
        estimate: data.estimate || null,
        actualHours: data.actualHours !== undefined && data.actualHours !== null && data.actualHours !== '' ? Number(data.actualHours) : null,
        // Format dates properly - send as ISO strings for database compatibility
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        projectId: data.projectId,
        // Include bug-specific fields
        bugType: data.bugType || null,
        severity: data.severity || null,
        currentBehavior: data.currentBehavior || null,
        expectedBehavior: data.expectedBehavior || null,
        referenceUrl: data.referenceUrl || null,
      };

      console.log("Final submitData:", submitData);
      console.log("Processed tags value:", submitData.tags);
      console.log("API endpoint:", `/work-items/${workItem.id}`);
      
      // Handle screenshot upload if a new file is selected
      if (selectedFile) {
        try {
          const reader = new FileReader();
          const base64String = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });
          
          (submitData as any).screenshot = null;
          (submitData as any).screenshotBlob = base64String;
          const timestamp = new Date().getTime();
          (submitData as any).screenshotPath = `screenshot_${timestamp}_${selectedFile.name}`;
        } catch (error) {
          console.error("Error processing screenshot:", error);
        }
      }

      console.log("=== MAKING API REQUEST ===");
      const response = await apiRequest("PATCH", `/work-items/${workItem.id}`, submitData);

      console.log("=== API RESPONSE ===");
      console.log("API Response:", response);
      console.log("=== EDIT ITEM DEBUG END ===");

      toast({
        title: "Item updated",
        description: "The item has been updated successfully.",
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error updating work item:", error);

      // Check if it's a validation error with field-specific errors
      if (error?.response?.data?.errors) {
        const apiErrors = error.response.data.errors;
        console.log("Validation errors:", apiErrors);

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
          description: "Could not update the item. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Handle delete work item
  const handleDeleteWorkItem = async () => {
    if (!workItem) return;

    try {
      await apiRequest("DELETE", `/work-items/${workItem.id}`);

      toast({
        title: "Item deleted",
        description: "The work item has been deleted successfully.",
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error deleting work item:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Could not delete the item. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Get estimate label based on selected type
  const getEstimateLabel = () => {
    return workItem?.type === "STORY" ? "Story Points" : "Estimated Hours";
  };

  const isEstimateEditable = workItem?.type === "TASK" || workItem?.type === "BUG";

  const isActualHoursEnabled = form.watch("status") === "DONE";

  if (!workItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg font-semibold">Edit {workItem.externalId}: {workItem.title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
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

            {/* Description field - show right after title for non-TASK types */}
            {workItem?.type !== 'TASK' && (
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Description
                      {['STORY', 'BUG'].includes(workItem?.type || '') && <span className="text-red-500"> *</span>}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter description"
                        value={field.value || ""}
                        rows={3}
                      />
                    </FormControl>
                    {['STORY', 'BUG'].includes(workItem?.type || '') && (
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
            {workItem?.type === "BUG" && (
              <div className="space-y-4 bg-blue-50 p-4 rounded border border-blue-200" key={`bug-fields-${workItem?.id}`}>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="bugType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Bug Type <span className="text-red-500">*</span></FormLabel>
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
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
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
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
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
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
                        <FormLabel className="text-sm">
                          Current Behavior
                          {(watchedBugType === 'DEFECT' || watchedBugType === 'PROD_INCIDENT') && <span className="text-red-500"> *</span>}
                        </FormLabel>
                        <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="What is happening?" 
                                rows={2} 
                                className={`text-sm ${(watchedBugType === 'DEFECT' || watchedBugType === 'PROD_INCIDENT') && !field.value ? "border-orange-500 ring-2 ring-orange-300 bg-orange-50" : ""}`}
                                value={field.value ?? ""} 
                                onChange={(e) => {
                                  field.onChange(e);
                                  form.trigger("currentBehavior");
                                }} 
                              />
                        </FormControl>
                        {(watchedBugType === 'DEFECT' || watchedBugType === 'PROD_INCIDENT') && !field.value && (
                          <FormDescription className="text-orange-600 font-medium text-[11px]">
                            ⚠️ Required for Defects and Production Incidents
                          </FormDescription>
                        )}
                        {(watchedBugType === 'DEFECT' || watchedBugType === 'PROD_INCIDENT') && field.value && (
                          <FormDescription className="text-green-600 text-[11px]">
                            ✓ Documented
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expectedBehavior"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">
                          Expected Behavior
                          {(watchedBugType === 'DEFECT' || watchedBugType === 'PROD_INCIDENT') && <span className="text-red-500"> *</span>}
                        </FormLabel>
                        <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="What should happen?" 
                                rows={2} 
                                className={`text-sm ${(watchedBugType === 'DEFECT' || watchedBugType === 'PROD_INCIDENT') && !field.value ? "border-orange-500 ring-2 ring-orange-300 bg-orange-50" : ""}`}
                                value={field.value ?? ""} 
                                onChange={(e) => {
                                  field.onChange(e);
                                  form.trigger("currentBehavior");
                                }} 
                              />
                        </FormControl>
                        {(watchedBugType === 'DEFECT' || watchedBugType === 'PROD_INCIDENT') && !field.value && (
                          <FormDescription className="text-orange-600 font-medium text-[11px]">
                            ⚠️ Required for Defects and Production Incidents
                          </FormDescription>
                        )}
                        {(watchedBugType === 'DEFECT' || watchedBugType === 'PROD_INCIDENT') && field.value && (
                          <FormDescription className="text-green-600 text-[11px]">
                            ✓ Documented
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {workItem?.type !== 'TASK' && (
              <>
                {/* Screenshot field immediately after bug section for BUG */}
                {workItem?.type === 'BUG' && (
                  <FormItem>
                    <FormLabel>Screenshot (Optional)</FormLabel>
                    <FormControl>
                      <div
                        className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-6 text-center hover:border-neutral-400 transition-colors cursor-pointer"
                        onDragOver={e => {
                          e.preventDefault();
                          e.currentTarget.classList.add('border-primary');
                        }}
                        onDragLeave={e => {
                          e.currentTarget.classList.remove('border-primary');
                        }}
                        onDrop={e => {
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
                          onChange={e => {
                            if (e.target.files && e.target.files.length > 0) {
                              setSelectedFile(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                          id="edit-screenshot-input"
                        />
                        <label htmlFor="edit-screenshot-input" className="cursor-pointer">
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
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (displayWorkItem as any)?.screenshotBlob || (displayWorkItem as any)?.screenshot || (displayWorkItem as any)?.screenshot_blob ? (
                              <div className="relative group">
                                <div className="flex flex-col items-center">
                                  <img 
                                    src={(displayWorkItem as any).screenshotBlob || (displayWorkItem as any).screenshot || (displayWorkItem as any).screenshot_blob || ""} 
                                    alt="Screenshot" 
                                    className="max-h-32 border rounded mx-auto cursor-zoom-in" 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.open((displayWorkItem as any).screenshotBlob || (displayWorkItem as any).screenshot || (displayWorkItem as any).screenshot_blob || "", '_blank');
                                    }}
                                  />
                                  <p className="text-sm mt-2">Drag and drop or click to change</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                      await apiRequest("PATCH", `/work-items/${workItem.id}`, {
                                        screenshot: null,
                                        screenshotBlob: null,
                                        screenshotPath: null
                                      });
                                      toast({
                                        title: "Screenshot removed",
                                        description: "The screenshot has been removed successfully.",
                                      });
                                      onSuccess();
                                    } catch (error) {
                                      console.error("Error removing screenshot:", error);
                                      toast({
                                        title: "Error",
                                        description: "Could not remove screenshot.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
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
              </>
            )}

            {/* Tags field - only show for Stories */}
            {workItem?.type === "STORY" && (
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
                        value={field.value?.toString()}
                        onValueChange={(value) => {
                          const id = parseInt(value);
                          field.onChange(id);
                          // Reset dependent fields when project changes
                          if (workItem && id !== workItem.projectId) {
                            form.setValue("parentId", null);
                            form.setValue("assigneeId", null);
                          }
                        }}
                        placeholder="Search and select project..."
                        searchPlaceholder="Search projects..."
                        emptyText="No projects found."
                        disabled={true}
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
                        options={[
                          { value: "unassigned", label: "Unassigned" },
                          ...projectTeamMembers.map(user => {
                            const name = user.fullName || user.username;
                            const username = user.fullName ? ` (@${user.username})` : '';
                            let roleDisplay = '';

                            if (user.role === 'ADMIN') {
                              roleDisplay = ' [Admin]';
                            } else if (user.role === 'SCRUM_MASTER') {
                              roleDisplay = ' [Scrum Master]';
                            }

                            return {
                              value: user.id.toString(),
                              label: `${name}${username}${roleDisplay}`,
                              searchFields: [
                                user.fullName || '',
                                user.username || '',
                                user.email || '',
                                user.role || ''
                              ].filter(Boolean)
                            };
                          })
                        ]}
                        value={field.value?.toString() || "unassigned"}
                        onValueChange={(value) => field.onChange(value && value !== "unassigned" ? parseInt(value) : null)}
                        placeholder="Search and select assignee..."
                        searchPlaceholder="Search team members..."
                        emptyText="No team members found."
                        disabled={!isAdminOrScrum}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Parent relationship field - show for items that can have parents */}
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{getParentLabel()}</FormLabel>
                    {workItem.type === "FEATURE" && (
                      <FormDescription>
                        Features must be created under an Epic. Please select a parent Epic.
                      </FormDescription>
                    )}
                    <FormControl>
                      {workItem.type === "EPIC" || getValidParents().length === 0 ? (
                        <Combobox
                          options={[]}
                          value=""
                          placeholder={`No ${getParentLabel().toLowerCase()}s available`}
                          disabled={true}
                        />
                      ) : (
                        <Combobox
                          options={[
                            { value: "none", label: "None" },
                            ...getValidParents().map(item => ({
                              value: item.id.toString(),
                              label: `${item.externalId}: ${item.title}${item.description ? ` - ${item.description.substring(0, 50)}${item.description.length > 50 ? '...' : ''}` : ''}`
                            }))
                          ]}
                          value={field.value?.toString() || "none"}
                          onValueChange={(value) => field.onChange(value && value !== "none" ? parseInt(value) : null)}
                          placeholder={`Search and select ${getParentLabel().toLowerCase()}...`}
                          searchPlaceholder={`Search ${getParentLabel().toLowerCase()}s...`}
                          emptyText={`No ${getParentLabel().toLowerCase()}s found.`}
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
                      <FormLabel>
                        {getEstimateLabel()} {['STORY', 'FEATURE', 'EPIC'].includes(workItem.type) ? "(Auto-calculated)" : <span className="text-red-500">*</span>}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={workItem.type === "STORY" ? "Story points" : "Hours"}
                          value={field.value || ""}
                          disabled={['STORY', 'FEATURE', 'EPIC'].includes(workItem.type)}
                        />
                      </FormControl>
                      {['STORY', 'FEATURE', 'EPIC'].includes(workItem.type) && (
                        <FormDescription className="text-[10px]">
                          Sum of all child items.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="actualHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Actual Hours 
                        {['STORY', 'FEATURE', 'EPIC'].includes(workItem.type) ? 
                          " (Auto-calculated)" 
                          : isActualHoursEnabled && <span className="text-red-500">*</span>
                        }
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          placeholder="Hours"
                          value={field.value !== undefined && field.value !== null && field.value !== '' ? field.value : ''}
                          disabled={['STORY', 'FEATURE', 'EPIC'].includes(workItem.type)}
                          className={['STORY', 'FEATURE', 'EPIC'].includes(workItem.type) ? "bg-muted" : isActualHoursEnabled && !field.value ? "border-orange-500 ring-2 ring-orange-300 bg-orange-50" : ""}
                        />
                      </FormControl>
                      {['STORY', 'FEATURE', 'EPIC'].includes(workItem.type) ? (
                        <FormDescription className="text-[10px]">
                          Sum of all child items.
                        </FormDescription>
                      ) : (isActualHoursEnabled && (field.value === undefined || field.value === null || field.value === "")) ? (
                        <FormDescription className="text-orange-600 font-medium text-[11px]">
                          ⚠️ Required: Please enter actual hours spent to complete this item.
                        </FormDescription>
                      ) : (isActualHoursEnabled && (field.value !== undefined && field.value !== null && field.value !== "")) ? (
                        <FormDescription className="text-green-600 text-[11px]">
                          ✓ {field.value} hours recorded
                        </FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Ref URL field - show for BUG type after Actual Hours */}
            {workItem?.type === "BUG" && (
              <FormField
                control={form.control}
                name="referenceUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Ref URL (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Show date fields for Epics, Features, and Stories */}
            {(workItem.type === "EPIC" || workItem.type === "FEATURE" || workItem.type === "STORY") && (
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

            <div className="flex justify-between pt-4 border-t">
              <div>
                {/* Delete button - only for admin and scrum master */}
                {isAdminOrScrum && (
                  <Button
                    variant="destructive"
                    type="button"
                    onClick={() => setShowDeleteDialog(true)}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Item
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">Update Item</Button>
              </div>
            </div>
          </form>
        </Form>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Work Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{workItem?.title}"? This action cannot be undone and will permanently remove the work item and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteWorkItem}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Work Item
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}