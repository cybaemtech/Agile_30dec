import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Project, User, Team, WorkItem } from "@shared/schema";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { CreateItemModal } from "@/components/modals/create-item-modal";
import { EditItemModal } from "@/components/modals/edit-item-modal";
import { DeleteItemModal } from "@/components/modals/delete-item-modal";
import { ArchiveProjectModal } from "@/components/modals/archive-project-modal";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { TimelineView } from "@/components/ui/timeline-view";
import { DeadlinesView } from "@/components/ui/deadlines-view";
import { ProjectCalendar } from "@/components/ui/project-calendar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, apiGet } from "@/lib/api-config";
import { useModal } from "@/hooks/use-modal";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Filter,
  Plus,
  Layers,
  ListFilter,
  ArrowDownUp,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Users,
  X,
  UserPlus,
  UserMinus
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";

// Helper function to check if a user can edit a work item - only assignees can edit
function canUserEditWorkItem(
  item: any,
  currentUser: any,
  allWorkItems: any[]
): boolean {
  // Admin and Scrum Master can always edit
  if (currentUser?.role === 'ADMIN' || currentUser?.role === 'SCRUM_MASTER') {
    return true;
  }

  // Regular users cannot edit EPIC or FEATURE items
  if (item.type === 'EPIC' || item.type === 'FEATURE') {
    return false;
  }

  // Only the assigned user can edit STORY, TASK, and BUG work items
  return (item.assigneeId === currentUser?.id);
}

export default function ProjectDetails() {
  const [_, params] = useRoute('/projects/:id');
  const [_path, navigate] = useLocation();
  const projectId = params?.id ? parseInt(params.id) : 0;

  // Debug logging for production
  console.log('[ProjectDetails] Component loaded, projectId:', projectId);
  console.log('[ProjectDetails] URL params:', params);
  console.log('[ProjectDetails] Current location:', window?.location?.href);
  console.log('[ProjectDetails] API Base URL check:', {
    hostname: window?.location?.hostname,
    pathname: window?.location?.pathname,
    envVar: import.meta.env.VITE_API_BASE_URL
  });



  // New project view tab state
  const [projectView, setProjectView] = useState<'overview' | 'board' | 'list' | 'backlog' | 'settings'>('overview');

  // Timeline view settings
  const [timeUnit, setTimeUnit] = useState<'Quarter' | 'Month' | 'Week'>('Quarter');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<number[]>([]);
  const [filterFeature, setFilterFeature] = useState<number | undefined>(undefined);

  // State for expanded items in the hierarchical view
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  // State for project settings form
  const [editedProject, setEditedProject] = useState<{
    name: string;
    description: string;
  }>({ name: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [showKeyResetDialog, setShowKeyResetDialog] = useState(false);
  const [newProjectKey, setNewProjectKey] = useState("");
  const [isResettingKey, setIsResettingKey] = useState(false);
  const [assignTeamId, setAssignTeamId] = useState<string>("");
  const [isAssigningTeam, setIsAssigningTeam] = useState(false);
  const [showAssignTeamDialog, setShowAssignTeamDialog] = useState(false);

  // State for inline editing in backlog view
  const [editingCell, setEditingCell] = useState<{ itemId: number; field: 'title' | 'status' | 'priority' | 'assignee' } | null>(null);
  const [editValues, setEditValues] = useState<{ title?: string; status?: string; priority?: string; assignee?: string }>({});

  // Quick action modal state for creating items under parent work items
  const [quickActionModal, setQuickActionModal] = useState<{
    isOpen: boolean;
    parentStory: WorkItem | null;
    type: 'FEATURE' | 'STORY' | 'TASK' | 'BUG' | null;
  }>({
    isOpen: false,
    parentStory: null,
    type: null,
  });

  const {
    modalType,
    isOpen,
    openModal,
    closeModal,
    modalProps
  } = useModal();

  const { toast } = useToast();

  // Fetch current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/auth/user'],
    queryFn: async () => {
      console.log('[ProjectDetails] Fetching current user');
      try {
        const result = await apiGet('/auth/user');
        console.log('[ProjectDetails] User data received:', result);
        return result;
      } catch (error) {
        console.error('[ProjectDetails] Error fetching user:', error);
        throw error;
      }
    },
    retry: false,
  });

  // Fetch project details with better error handling
  const { data: project, isLoading: isProjectLoading, error: projectError, isError } = useQuery<Project>({
    queryKey: [`/projects/${projectId}`],
    queryFn: async () => {
      console.log(`[ProjectDetails] Fetching project ${projectId}`);
      try {
        const result = await apiGet(`/projects/${projectId}`);
        console.log(`[ProjectDetails] Project data received:`, result);
        return result;
      } catch (error) {
        console.error(`[ProjectDetails] Error fetching project ${projectId}:`, error);
        throw error;
      }
    },
    enabled: !!projectId && projectId > 0,
    retry: 2,
    staleTime: 0, // Always consider stale to ensure fresh data
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch on component mount
  });

  // Sync form state when project data loads
  useEffect(() => {
    if (project) {
      setEditedProject({
        name: project.name || '',
        description: project.description || ''
      });
    }
  }, [project]);

  // Auto-filter board view based on user role and reset filters when switching views
  useEffect(() => {
    if (projectView === 'board' && currentUser?.id) {
      // Admin and Scrum Master can see all tasks, others see only their assigned tasks
      if (currentUser.role === 'ADMIN' || currentUser.role === 'SCRUM_MASTER') {
        setFilterAssignee([]); // Show all tasks for admin/scrum master
      } else {
        setFilterAssignee([currentUser.id]); // Filter to current user for regular users
      }
    } else if (projectView !== 'board') {
      // Clear all filters when leaving board view to prevent stale state
      setFilterAssignee([]);
      setFilterType([]);
      setFilterStatus([]);
      setFilterPriority([]);
      setFilterFeature(undefined);
    }
  }, [projectView, currentUser?.id, currentUser?.role]);

  // Fetch teams
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/teams'],
    queryFn: () => apiGet('/teams'),
  });

  // Fetch all projects for sidebar
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/projects'],
    queryFn: () => apiGet('/projects'),
  });

  // Fetch work items for this project
  const { data: workItems = [], refetch: refetchWorkItems } = useQuery<WorkItem[]>({
    queryKey: [`/projects/${projectId}/work-items`],
    queryFn: () => apiGet(`/projects/${projectId}/work-items`),
    enabled: !!projectId && projectId > 0,
  });

  // Fetch project team members
  const { data: projectTeamMembers = [], refetch: refetchTeamMembers } = useQuery<User[]>({
    queryKey: [`/projects/${projectId}/team-members`],
    queryFn: async () => {
      if (!projectId) return [];
      const members = await apiGet(`/projects/${projectId}/team-members`);
      return members;
    },
    enabled: !!projectId && projectId > 0
  });

  // Fetch all users for adding to team
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/users'],
    queryFn: () => apiGet('/users'),
  });

  // Mutation for inline editing work items
  const updateWorkItemMutation = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: number; updates: Partial<WorkItem> }) => {
      const response = await apiRequest('PATCH', `/api/work-items/${itemId}`, updates);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update work item');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/projects/${projectId}/work-items`] });
      toast({
        title: "Updated successfully",
        description: "Work item has been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper function to start inline editing
  const startInlineEdit = (itemId: number, field: 'title' | 'status' | 'priority' | 'assignee', currentValue: string) => {
    if (!canUserEditWorkItem(workItems?.find(i => i.id === itemId), currentUser, workItems || [])) {
      return;
    }
    setEditingCell({ itemId, field });
    setEditValues({ [field]: currentValue });
  };

  // Helper function to save inline edit
  const saveInlineEdit = async (itemId: number, field: 'title' | 'status' | 'priority' | 'assignee') => {
    const value = editValues[field];
    if (field !== 'assignee' && (value === undefined || value.trim() === '')) {
      toast({
        title: "Error",
        description: "Value cannot be empty",
        variant: "destructive",
      });
      cancelInlineEdit();
      return;
    }

    const updateData: any = {};
    if (field === 'assignee') {
      // Handle assignee field specially - convert to number or null
      updateData.assigneeId = value && value !== 'unassigned' ? parseInt(value) : null;
    } else {
      updateData[field] = value;
    }

    await updateWorkItemMutation.mutateAsync({
      itemId,
      updates: updateData
    });

    cancelInlineEdit();
  };

  // Helper function to cancel inline edit
  const cancelInlineEdit = () => {
    setEditingCell(null);
    setEditValues({});
  };

  // Helper function to check if all child items are completed
  const canMarkParentAsDone = (parentItem: WorkItem, allItems: WorkItem[]): { canMark: boolean; incompleteChildren: WorkItem[] } => {
    // Only validate parent items (EPIC, FEATURE, STORY)
    if (!['EPIC', 'FEATURE', 'STORY'].includes(parentItem.type)) {
      return { canMark: true, incompleteChildren: [] };
    }

    // Find all direct child items
    const childItems = allItems.filter(item => item.parentId === parentItem.id);
    
    // Find incomplete children (any child that is not DONE, regardless of type)
    const incompleteChildren = childItems.filter(child => child.status !== 'DONE');

    // For hierarchical validation:
    // EPIC can only be DONE if all FEATURE children are DONE
    // FEATURE can only be DONE if all STORY children are DONE  
    // STORY can only be DONE if all TASK/BUG children are DONE
    
    return {
      canMark: incompleteChildren.length === 0,
      incompleteChildren
    };
  };

  // Helper function to handle status change with validation
  const handleStatusChange = (itemId: number, newStatus: string, item: WorkItem) => {
    if (newStatus === 'DONE' && ['EPIC', 'FEATURE', 'STORY'].includes(item.type)) {
      const validation = canMarkParentAsDone(item, workItems || []);
      
      if (!validation.canMark) {
        const childTypesText = validation.incompleteChildren.map(child => child.type.toLowerCase()).join(', ');
        toast({
          title: "Cannot mark as Done",
          description: `This ${item.type.toLowerCase()} has ${validation.incompleteChildren.length} incomplete child item(s): ${childTypesText}. Complete all child items first.`,
          variant: "destructive",
        });
        cancelInlineEdit();
        return;
      }
    }

    // If validation passes, proceed with the update
    updateWorkItemMutation.mutate({
      itemId: itemId,
      updates: { status: newStatus }
    });
    cancelInlineEdit();
  };

  // Function to handle navigation with null check
  const goToProjects = () => {
    if (navigate) navigate('/projects');
  };

  // Early return if no valid project ID
  if (!projectId || projectId <= 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Invalid Project</h2>
          <p className="text-gray-600 mb-4">The project ID is invalid or missing.</p>
          <Button onClick={goToProjects}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  // Check if user is authenticated first
  if (currentUser === null) {
    // Redirect to login if not authenticated
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  // Restore project handler
  const handleRestoreProject = async () => {
    // Don't proceed if project ID is invalid
    if (!projectId) return;

    try {
      // Call API to restore project (set status to ACTIVE)
      const response = await apiRequest(
        'PATCH',
        `/api/projects/${projectId}`,
        { status: "ACTIVE" }
      );

      if (response.ok) {
        // Show success message
        toast({
          title: "Project restored",
          description: "The project has been restored successfully",
        });

        // Refresh the project data
        await queryClient.invalidateQueries({ queryKey: [`/projects/${projectId}`] });
        await queryClient.invalidateQueries({ queryKey: ['/projects'] });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to restore project",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error restoring project:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while restoring the project",
        variant: "destructive",
      });
    }
  };

  // Delete project handler
  const handleDeleteProject = async () => {
    // Don't proceed if project ID is invalid
    if (!projectId) return;

    // Confirm with user before deleting
    if (project?.name && !window.confirm(`Are you sure you want to delete ${project.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Call API to delete project
      const response = await apiRequest(
        'DELETE',
        `/api/projects/${projectId}`
      );

      if (response.ok) {
        // Show success message
        toast({
          title: "Project deleted",
          description: "The project has been deleted successfully",
        });

        // Redirect to projects page
        goToProjects();

        // Invalidate cache
        await queryClient.invalidateQueries({ queryKey: ['/projects'] });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to delete project",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting the project",
        variant: "destructive",
      });
    }
  };

  // Save project details handler
  const handleSaveProject = async () => {
    if (!projectId || !editedProject.name.trim()) {
      toast({
        title: "Error",
        description: "Project name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Call API to update project
      const response = await apiRequest(
        'PATCH',
        `/api/projects/${projectId}`,
        {
          name: editedProject.name.trim(),
          description: editedProject.description.trim()
        }
      );

      if (response.ok) {
        // Show success message
        toast({
          title: "Project updated",
          description: "Project details have been saved successfully",
        });

        // Invalidate cache to refresh project data
        await queryClient.invalidateQueries({ queryKey: [`/projects/${projectId}`] });
        await queryClient.invalidateQueries({ queryKey: ['/projects'] });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to update project",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating project:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating the project",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Add team member handler - Enhanced to sync with project team
  const handleAddTeamMember = async () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user to add",
        variant: "destructive",
      });
      return;
    }

    try {
      // If project has a team, add to that team
      if (project?.teamId) {
        const response = await apiRequest(
          'POST',
          `/teams/${project.teamId}/members`,
          {
            userId: parseInt(selectedUserId),
            role: 'MEMBER'
          }
        );

        if (response.ok) {
          toast({
            title: "Success",
            description: "Team member added successfully to both project and team",
          });
          setSelectedUserId("");
          refetchTeamMembers();
        } else {
          const errorData = await response.json();
          toast({
            title: "Error",
            description: errorData.message || "Failed to add team member",
            variant: "destructive",
          });
        }
      } else {
        // Project has no team assigned, just add as project member
        toast({
          title: "Info",
          description: "This project has no team assigned. Please assign a team first or the member will only be added as a project collaborator.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding team member:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  // Assign team to project handler
  const handleAssignTeam = async () => {
    if (!assignTeamId) {
      toast({
        title: "Error",
        description: "Please select a team to assign",
        variant: "destructive",
      });
      return;
    }

    setIsAssigningTeam(true);

    try {
      const response = await apiRequest(
        'PATCH',
        `/projects/${projectId}`,
        {
          teamId: parseInt(assignTeamId)
        }
      );

      if (response.ok) {
        toast({
          title: "Team Assigned",
          description: "Team has been successfully assigned to this project",
        });
        setShowAssignTeamDialog(false);
        setAssignTeamId("");

        // Invalidate cache to refresh project data
        await queryClient.invalidateQueries({ queryKey: [`/projects/${projectId}`] });
        await queryClient.invalidateQueries({ queryKey: ['/projects'] });
        refetchTeamMembers();
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to assign team",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error assigning team:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while assigning team",
        variant: "destructive",
      });
    } finally {
      setIsAssigningTeam(false);
    }
  };

  // Remove team member handler
  const handleRemoveTeamMember = async (userId: number) => {
    if (!project?.teamId) return;

    setRemovingMemberId(userId);

    try {
      const response = await apiRequest(
        'DELETE',
        `/teams/${project.teamId}/members/${userId}`
      );

      if (response.ok) {
        const result = await response.json();
        
        if (result.user_removed_from_system) {
          toast({
            title: "Success",
            description: `Team member removed successfully. ${result.removed_member} has been removed from the system as they were not part of any other teams.`,
            duration: 6000,
          });
        } else {
          toast({
            title: "Success",
            description: result.message || "Team member removed successfully",
          });
        }
        refetchTeamMembers();
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to remove team member",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error removing team member:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Reset project key handler (Admin only)
  const handleResetProjectKey = async () => {
    if (!newProjectKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a new project key",
        variant: "destructive",
      });
      return;
    }

    // Validate project key format
    if (!/^[A-Z0-9]{2,10}$/.test(newProjectKey.trim())) {
      toast({
        title: "Error",
        description: "Project key must be 2-10 uppercase letters and numbers only",
        variant: "destructive",
      });
      return;
    }

    setIsResettingKey(true);

    try {
      const response = await apiRequest(
        'PATCH',
        `/api/projects/${projectId}`,
        {
          key: newProjectKey.trim().toUpperCase()
        }
      );

      if (response.ok) {
        toast({
          title: "Project Key Updated",
          description: `Project key has been changed to ${newProjectKey.trim().toUpperCase()}. All work item IDs will now use this new key.`,
        });
        setShowKeyResetDialog(false);
        setNewProjectKey("");

        // Invalidate cache to refresh project data
        await queryClient.invalidateQueries({ queryKey: [`/projects/${projectId}`] });
        await queryClient.invalidateQueries({ queryKey: ['/projects'] });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to update project key",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating project key:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating the project key",
        variant: "destructive",
      });
    } finally {
      setIsResettingKey(false);
    }
  };

  // Quick action handlers for creating items under parent work items
  const openQuickAction = (parentItem: WorkItem, type: 'FEATURE' | 'STORY' | 'TASK' | 'BUG') => {
    setQuickActionModal({
      isOpen: true,
      parentStory: parentItem,
      type,
    });
  };

  const closeQuickAction = () => {
    setQuickActionModal({
      isOpen: false,
      parentStory: null,
      type: null,
    });
  };

  const handleQuickActionSuccess = () => {
    closeQuickAction();
    // Refresh work items after creating new task/bug
    queryClient.invalidateQueries({ queryKey: [`/projects/${projectId}/work-items`] });
  };

  // Show loading state
  if (isProjectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project details...</p>
        </div>
      </div>
    );
  }

  // Robust role check
  const isAdminOrScrum =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'SCRUM_MASTER';

  // User role for UI display
  const userRole = currentUser?.role;

  // Show error state 
  if (projectError || isError || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Project Not Found</h2>
          <p className="text-gray-600 mb-4">
            The project you're looking for doesn't exist or couldn't be loaded.
          </p>
          <div className="space-y-2">
            <Button onClick={() => window.location.reload()} className="mr-2">
              Retry
            </Button>
            <Button variant="outline" onClick={goToProjects}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const features = Array.isArray(workItems) ? workItems.filter(item => item.type === 'FEATURE') : [];

  const handleWorkItemsUpdate = () => {
    refetchWorkItems();
  };

  // Quick action handlers for creating items under parent work items
  const openQuickActionModal = (parentItem: WorkItem, type: 'FEATURE' | 'STORY' | 'TASK' | 'BUG') => {
    openQuickAction(parentItem, type);
  };

  const closeQuickActionModal = () => {
    setQuickActionModal({
      isOpen: false,
      parentStory: null,
      type: null,
    });
  };

  // Toggle expansion state of an item
  const toggleItemExpansion = (itemId: number) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Organize work items in a hierarchical structure: Epics > Features > Stories > Tasks/Bugs
  const organizeWorkItemsHierarchically = () => {
    if (!Array.isArray(workItems)) return [];

    // Extract all items by type
    const epics = workItems.filter(item => item.type === 'EPIC');
    const features = workItems.filter(item => item.type === 'FEATURE');
    const stories = workItems.filter(item => item.type === 'STORY');
    const tasksAndBugs = workItems.filter(item => item.type === 'TASK' || item.type === 'BUG');

    // Debug logging
    console.log('[DEBUG] Work Items Organization:');
    console.log('Epics:', epics.map(e => ({ id: e.id, title: e.title, parentId: e.parentId })));
    console.log('Features:', features.map(f => ({ id: f.id, title: f.title, parentId: f.parentId })));
    console.log('Stories:', stories.map(s => ({ id: s.id, title: s.title, parentId: s.parentId })));

    // Create the hierarchy
    const hierarchicalItems = [];

    // Process epics
    for (const epic of epics) {
      hierarchicalItems.push({
        ...epic,
        level: 0,
        hasChildren: features.some(f => f.parentId === epic.id)
      });

      // If this epic is expanded, add its features
      if (expandedItems[epic.id]) {
        const epicFeatures = features.filter(f => f.parentId === epic.id);
        for (const feature of epicFeatures) {
          hierarchicalItems.push({
            ...feature,
            level: 1,
            hasChildren: stories.some(s => s.parentId === feature.id)
          });

          // If this feature is expanded, add its stories
          if (expandedItems[feature.id]) {
            const featureStories = stories.filter(s => s.parentId === feature.id);
            for (const story of featureStories) {
              hierarchicalItems.push({
                ...story,
                level: 2,
                hasChildren: tasksAndBugs.some(tb => tb.parentId === story.id)
              });

              // If this story is expanded, add its tasks and bugs
              if (expandedItems[story.id]) {
                const storyTasksAndBugs = tasksAndBugs.filter(tb => tb.parentId === story.id);
                for (const taskOrBug of storyTasksAndBugs) {
                  hierarchicalItems.push({
                    ...taskOrBug,
                    level: 3,
                    hasChildren: false
                  });
                }
              }
            }
          }
        }
      }
    }

    // Add orphaned features (those without epics) and always show their children
    const orphanedFeatures = features.filter(f => !f.parentId || !epics.some(e => e.id === f.parentId));
    for (const feature of orphanedFeatures) {
      hierarchicalItems.push({
        ...feature,
        level: 0,
        hasChildren: stories.some(s => s.parentId === feature.id)
      });

      // Always show stories under features regardless of expansion state
      const featureStories = stories.filter(s => s.parentId === feature.id);
      console.log(`[DEBUG] Feature "${feature.title}" has ${featureStories.length} stories:`, featureStories.map(s => s.title));

      for (const story of featureStories) {
        hierarchicalItems.push({
          ...story,
          level: 1,
          hasChildren: tasksAndBugs.some(tb => tb.parentId === story.id)
        });

        // If this story is expanded, add its tasks and bugs
        if (expandedItems[story.id]) {
          const storyTasksAndBugs = tasksAndBugs.filter(tb => tb.parentId === story.id);
          for (const taskOrBug of storyTasksAndBugs) {
            hierarchicalItems.push({
              ...taskOrBug,
              level: 2,
              hasChildren: false
            });
          }
        }
      }
    }

    // Add orphaned stories (only if they truly don't belong to any feature)
    const orphanedStories = stories.filter(s => !s.parentId || !features.some(f => f.id === s.parentId));
    for (const story of orphanedStories) {
      hierarchicalItems.push({
        ...story,
        level: 0,
        hasChildren: tasksAndBugs.some(tb => tb.parentId === story.id)
      });

      // If this story is expanded, add its tasks and bugs
      if (expandedItems[story.id]) {
        const storyTasksAndBugs = tasksAndBugs.filter(tb => tb.parentId === story.id);
        for (const taskOrBug of storyTasksAndBugs) {
          hierarchicalItems.push({
            ...taskOrBug,
            level: 1,
            hasChildren: false
          });
        }
      }
    }

    // Add orphaned tasks and bugs
    const orphanedTasksAndBugs = tasksAndBugs.filter(tb => !tb.parentId || !stories.some(s => s.id === tb.parentId));
    for (const taskOrBug of orphanedTasksAndBugs) {
      hierarchicalItems.push({
        ...taskOrBug,
        level: 0,
        hasChildren: false
      });
    }

    console.log('[DEBUG] Final hierarchy:', hierarchicalItems.map(item => ({
      title: item.title,
      type: item.type,
      level: item.level,
      parentId: item.parentId
    })));

    return hierarchicalItems;
  };

  const getFilterTypesOptions = () => {
    return [
      { value: 'STORY', label: 'Stories' },
      { value: 'TASK', label: 'Tasks' },
      { value: 'BUG', label: 'Bugs' },
    ];
  };

  // Generic filter handler for string-based filters
  const handleStringFilter = (
    value: string,
    currentValues: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    clearValue: string = "ALL"
  ) => {
    if (value === clearValue) {
      setter([]);
    } else {
      if (currentValues.includes(value)) {
        setter(currentValues.filter(v => v !== value));
      } else {
        setter([...currentValues, value]);
      }
    }
  };

  // Generic filter handler for number-based filters
  const handleNumberFilter = (
    value: number,
    currentValues: number[],
    setter: React.Dispatch<React.SetStateAction<number[]>>,
    clearValue: number = -1
  ) => {
    if (value === clearValue) {
      setter([]);
    } else {
      if (currentValues.includes(value)) {
        setter(currentValues.filter(v => v !== value));
      } else {
        setter([...currentValues, value]);
      }
    }
  };

  // Handler for type filter
  const handleFilterTypeChange = (value: string) => {
    handleStringFilter(value, filterType, setFilterType);
  };

  // Handler for status filter
  const handleFilterStatusChange = (value: string) => {
    handleStringFilter(value, filterStatus, setFilterStatus);
  };

  // Handler for priority filter
  const handleFilterPriorityChange = (value: string) => {
    handleStringFilter(value, filterPriority, setFilterPriority);
  };

  // Handler for assignee filter
  const handleFilterAssigneeChange = (value: string) => {
    if (value === "all") {
      // Clear the filter to show all assignees
      setFilterAssignee([]);
    } else if (value === "unassigned") {
      // Filter for unassigned items (-1 represents unassigned)
      setFilterAssignee([-1]);
    } else {
      // Filter by specific user ID
      const userId = parseInt(value);
      setFilterAssignee([userId]);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        user={currentUser}
        teams={teams}
        projects={projects}
        onCreateTeam={() => openModal("createTeam")}
        onCreateProject={() => openModal("createProject")}
      />

      {/* Mobile menu toggle */}
      <div className="md:hidden fixed bottom-4 right-4 z-10">
        <Button
          className="rounded-full shadow-lg p-3 h-12 w-12"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Layers className="h-5 w-5" />
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        <main className="flex-1 overflow-auto">
          {/* Project navigation */}
          <div className="bg-white border-b border-neutral-200">
            <div className="flex items-center px-6 py-3">
              <Button variant="ghost" className="mr-6 font-medium" onClick={goToProjects}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to projects
              </Button>

              <nav className="flex space-x-6 overflow-x-auto">
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setProjectView('overview'); }}
                  className={`border-b-2 ${projectView === 'overview'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900'
                    } font-medium py-3`}
                >
                  Overview
                </a>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setProjectView('board'); }}
                  className={`border-b-2 ${projectView === 'board'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900'
                    } font-medium py-3`}
                >
                  Board
                </a>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setProjectView('list'); }}
                  className={`border-b-2 ${projectView === 'list'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900'
                    } font-medium py-3`}
                >
                  List
                </a>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setProjectView('backlog'); }}
                  className={`border-b-2 ${projectView === 'backlog'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900'
                    } font-medium py-3`}
                >
                  Backlog View
                </a>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setProjectView('settings'); }}
                  className={`border-b-2 ${projectView === 'settings'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900'
                    } font-medium py-3`}
                >
                  Settings
                </a>
              </nav>
            </div>
          </div>

          {/* Project content */}
          <div className="p-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold mb-1">{project?.name || 'Loading project...'}</h1>
                <p className="text-neutral-600">{project?.description || 'No description provided'}</p>
              </div>
              {/* Only show Create Item button on specific tabs */}
              {projectView !== 'overview' && projectView !== 'settings' && (
                <div className="flex space-x-3">
                  <Button onClick={() => openModal("createItem")}>
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Create Item</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Overview Tab Content */}
            {projectView === 'overview' && (
              <div>
                <div className="mb-6">
                  {/* Project Information section */}

                  <div className="bg-white border rounded-md shadow-sm p-4">
                    <h3 className="text-lg font-medium mb-4">Project Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <h4 className="text-sm font-medium mb-1 text-neutral-500">ID</h4>
                        <p className="text-sm font-medium break-all">{project?.key || 'N/A'}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1 text-neutral-500">Created by</h4>
                        <p className="text-sm break-all">
                          {(() => {
                            const creator = allUsers?.find(user => user.id === project?.createdBy);
                            return creator?.email || creator?.fullName || creator?.username || 'Unknown';
                          })()}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1 text-neutral-500">Created at</h4>
                        <p className="text-sm">
                          {project?.createdAt
                            ? new Date(project.createdAt).toLocaleDateString()
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1 text-neutral-500">Start date</h4>
                        <p className="text-sm">
                          {project?.startDate
                            ? new Date(project.startDate).toLocaleDateString()
                            : 'No start date set'}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1 text-neutral-500">Target date</h4>
                        <p className="text-sm">
                          {project?.targetDate
                            ? new Date(project.targetDate).toLocaleDateString()
                            : 'No target date set'}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1 text-neutral-500">Team</h4>
                        <p className="text-sm break-all">
                          {teams && project?.teamId
                            ? teams.find(t => t.id === project.teamId)?.name
                            : 'No team assigned'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Items with Deadlines section - moved after Project Information */}
                  <div className="bg-white border rounded-md shadow-sm mb-6 mt-6">
                    <div className="p-4 border-b">
                      <h3 className="text-lg font-medium">Items with Deadlines</h3>
                    </div>
                    <DeadlinesView
                      workItems={Array.isArray(workItems) ? workItems : []}
                      users={Array.isArray(projectTeamMembers) ? projectTeamMembers : []}
                      projects={project ? [project as Project] : []}
                    />
                  </div>

                  {/* Timeline View */}
                  <div className="bg-white border rounded-md shadow-sm">
                    <div className="p-4 border-b bg-gray-50">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">Epics & Features Timeline</h3>
                        <div className="flex items-center space-x-4">
                         
                          
                        </div>
                      </div>
                    </div>
                    <TimelineView
                      timeUnit={timeUnit}
                      workItems={workItems}
                      onTimeUnitChange={(unit) => setTimeUnit(unit)}
                    />
                  </div>
                </div>


              </div>
            )}

            {/* Board Tab Content */}
            {projectView === 'board' && (
              <div className="bg-white border rounded-md shadow-sm">
                <div className="p-4 border-b">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="text-lg font-medium">My Kanban Board</h3>
                      <p className="text-xs text-blue-600 mt-1">
                        Showing only your assigned tasks.
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-neutral-600">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-gray-500 rounded-full mr-1"></div>
                        <span>Can edit/delete</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-neutral-300 rounded-full mr-1"></div>
                        <span>View only</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Type Filter */}
                    <div className="flex items-center">
                      <span className="text-xs font-medium mr-2">Type:</span>
                      <Select
                        value={filterType.length > 0 ? filterType[0] : "ALL"}
                        onValueChange={handleFilterTypeChange}
                      >
                        <SelectTrigger className="h-8 px-2 text-xs w-28">
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All types</SelectItem>
                          <SelectItem value="FEATURE">Features</SelectItem>
                          <SelectItem value="STORY">Stories</SelectItem>
                          <SelectItem value="TASK">Tasks</SelectItem>
                          <SelectItem value="BUG">Bugs</SelectItem>
                        </SelectContent>
                      </Select>
                      {filterType.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-1">
                          {filterType.map(type => (
                            <Badge
                              key={type}
                              variant="outline"
                              className="text-xs py-0 h-6"
                              onClick={() => handleFilterTypeChange(type)}
                            >
                              {type}
                              <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center">
                      <span className="text-xs font-medium mr-2">Status:</span>
                      <Select
                        value={filterStatus.length > 0 ? filterStatus[0] : "ALL"}
                        onValueChange={handleFilterStatusChange}
                      >
                        <SelectTrigger className="h-8 px-2 text-xs w-28">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All statuses</SelectItem>
                          <SelectItem value="TODO">To Do</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="DONE">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      {filterStatus.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-1">
                          {filterStatus.map(status => (
                            <Badge
                              key={status}
                              variant="outline"
                              className="text-xs py-0 h-6"
                              onClick={() => handleFilterStatusChange(status)}
                            >
                              {status.replace('_', ' ')}
                              <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Priority Filter */}
                    <div className="flex items-center">
                      <span className="text-xs font-medium mr-2">Priority:</span>
                      <Select
                        value={filterPriority.length > 0 ? filterPriority[0] : "ALL"}
                        onValueChange={handleFilterPriorityChange}
                      >
                        <SelectTrigger className="h-8 px-2 text-xs w-28">
                          <SelectValue placeholder="All priorities" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All priorities</SelectItem>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      {filterPriority.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-1">
                          {filterPriority.map(priority => (
                            <Badge
                              key={priority}
                              variant="outline"
                              className="text-xs py-0 h-6"
                              onClick={() => handleFilterPriorityChange(priority)}
                            >
                              {priority}
                              <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Feature Filter */}
                    <div className="flex items-center">
                      <span className="text-xs font-medium mr-2">Feature:</span>
                      <Select
                        value={filterFeature ? String(filterFeature) : "ALL"}
                        onValueChange={(value) => {
                          setFilterFeature(value !== "ALL" ? parseInt(value) : undefined);
                        }}
                      >
                        <SelectTrigger className="h-8 px-2 text-xs w-28">
                          <SelectValue placeholder="All features" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All features</SelectItem>
                          {features.map(feature => (
                            <SelectItem key={feature.id} value={String(feature.id)}>
                              {feature.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {filterFeature && (
                        <div className="flex flex-wrap gap-1 ml-1">
                          <Badge
                            variant="outline"
                            className="text-xs py-0 h-6"
                            onClick={() => setFilterFeature(undefined)}
                          >
                            {features.find(f => f.id === filterFeature)?.title || 'Unknown Feature'}
                            <X className="h-3 w-3 ml-1" />
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <KanbanBoard
                  projectId={Number(projectId)}
                  users={projectTeamMembers || []}
                  currentUser={currentUser}
                  workItems={Array.isArray(workItems)
                    ? workItems.filter(item => {
                      // Only show specific types in kanban (exclude EPICs)
                      if (item.type === 'EPIC') {
                        return false;
                      }

                      // Filter by type if any type filters are selected
                      if (filterType.length > 0 && !filterType.includes(item.type)) {
                        return false;
                      }

                      // Filter by status if any status filters are selected
                      if (filterStatus.length > 0 && !filterStatus.includes(item.status)) {
                        return false;
                      }

                      // Filter by priority if any priority filters are selected
                      if (filterPriority.length > 0 && (!item.priority || !filterPriority.includes(item.priority))) {
                        return false;
                      }

                      // If feature filter is active, only show items belonging to that feature
                      if (filterFeature && item.parentId !== filterFeature) {
                        return false;
                      }

                      // Filter by assignee if any assignee filters are selected
                      if (filterAssignee.length > 0) {
                        // Handle unassigned case
                        if (filterAssignee.includes(-1) && !item.assigneeId) {
                          return true;
                        }
                        // Handle assigned case
                        if (item.assigneeId && filterAssignee.includes(item.assigneeId)) {
                          return true;
                        }
                        // If filter is active but item doesn't match, exclude it
                        return false;
                      }

                      return true;
                    })
                    : []
                  }
                  onItemEdit={async (item) => {
                    try {
                      // Fetch full work item details from API
                      const fullItem = await apiGet(`/work-items/${item.id}`);
                      openModal("editItem", { workItem: fullItem });
                    } catch (err) {
                      toast({
                        title: "Error loading item",
                        description: "Could not load full item details. Please try again.",
                        variant: "destructive",
                      });
                    }
                  }}
                  onItemDelete={(item) => openModal("deleteItem", { workItem: item })}
                  onQuickAction={openQuickAction}
                  onStatusChange={async (itemId, status) => {
                    try {
                      // Find the item being updated
                      const item = workItems?.find(w => w.id === itemId);
                      if (!item) {
                        toast({
                          title: "Error",
                          description: "Item not found",
                          variant: "destructive"
                        });
                        return;
                      }

                      // Validate if marking as DONE for parent items
                      if (status === 'DONE' && ['EPIC', 'FEATURE', 'STORY'].includes(item.type)) {
                        const validation = canMarkParentAsDone(item, workItems || []);
                        
                        if (!validation.canMark) {
                          const childTypesText = validation.incompleteChildren.map(child => child.type.toLowerCase()).join(', ');
                          toast({
                            title: "Cannot mark as Done",
                            description: `This ${item.type.toLowerCase()} has ${validation.incompleteChildren.length} incomplete child item(s): ${childTypesText}. Complete all child items first.`,
                            variant: "destructive",
                          });
                          return;
                        }
                      }

                      const response = await apiRequest(
                        'PATCH',
                        `/work-items/${itemId}`,
                        { status }
                      );

                      if (response.ok) {
                        refetchWorkItems();
                      } else {
                        toast({
                          title: "Error",
                          description: "Failed to update item status",
                          variant: "destructive"
                        });
                      }
                    } catch (error) {
                      console.error("Error updating item status:", error);
                      toast({
                        title: "Error",
                        description: "An unexpected error occurred",
                        variant: "destructive"
                      });
                    }
                  }}
                />
              </div>
            )}

            {/* List Tab Content */}
            {projectView === 'list' && (
              <div className="bg-white border rounded-md shadow-sm">
                <div className="p-4 border-b">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-medium">All Work Items</h3>
                    <div className="flex items-center space-x-4 text-xs text-neutral-600">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-gray-500 rounded-full mr-1"></div>
                        <span>Can edit/delete</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-neutral-300 rounded-full mr-1"></div>
                        <span>View only</span>
                      </div>
                      <span className="text-xs text-neutral-500">
                        {currentUser?.role === 'ADMIN' || currentUser?.role === 'SCRUM_MASTER'
                          ? 'Admin/Scrum Master: Can edit all items'
                          : 'Can only edit items you created'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Type Filter */}
                    <div className="flex items-center">
                      <span className="text-xs font-medium mr-2">Type:</span>
                      <Select
                        value={filterType.length > 0 ? filterType[0] : "ALL"}
                        onValueChange={handleFilterTypeChange}
                      >
                        <SelectTrigger className="h-8 px-2 text-xs w-28">
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All types</SelectItem>
                          <SelectItem value="EPIC">Epics</SelectItem>
                          <SelectItem value="FEATURE">Features</SelectItem>
                          <SelectItem value="STORY">Stories</SelectItem>
                          <SelectItem value="TASK">Tasks</SelectItem>
                          <SelectItem value="BUG">Bugs</SelectItem>
                        </SelectContent>
                      </Select>
                      {filterType.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-1">
                          {filterType.map(type => (
                            <Badge
                              key={type}
                              variant="outline"
                              className="text-xs py-0 h-6"
                              onClick={() => handleFilterTypeChange(type)}
                            >
                              {type}
                              <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center">
                      <span className="text-xs font-medium mr-2">Status:</span>
                      <Select
                        value={filterStatus.length > 0 ? filterStatus[0] : "ALL"}
                        onValueChange={handleFilterStatusChange}
                      >
                        <SelectTrigger className="h-8 px-2 text-xs w-28">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All statuses</SelectItem>
                          <SelectItem value="TODO">To Do</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="DONE">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      {filterStatus.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-1">
                          {filterStatus.map(status => (
                            <Badge
                              key={status}
                              variant="outline"
                              className="text-xs py-0 h-6"
                              onClick={() => handleFilterStatusChange(status)}
                            >
                              {status.replace('_', ' ')}
                              <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Priority Filter */}
                    <div className="flex items-center">
                      <span className="text-xs font-medium mr-2">Priority:</span>
                      <Select
                        value={filterPriority.length > 0 ? filterPriority[0] : "ALL"}
                        onValueChange={handleFilterPriorityChange}
                      >
                        <SelectTrigger className="h-8 px-2 text-xs w-28">
                          <SelectValue placeholder="All priorities" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All priorities</SelectItem>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      {filterPriority.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-1">
                          {filterPriority.map(priority => (
                            <Badge
                              key={priority}
                              variant="outline"
                              className="text-xs py-0 h-6"
                              onClick={() => handleFilterPriorityChange(priority)}
                            >
                              {priority}
                              <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Assignee Filter */}
                    <div className="flex items-center">
                      <span className="text-xs font-medium mr-2">Assignee:</span>
                      <Select
                        value={filterAssignee.length > 0 ? String(filterAssignee[0]) : "ALL"}
                        onValueChange={handleFilterAssigneeChange}
                      >
                        <SelectTrigger className="h-8 px-2 text-xs w-28">
                          <SelectValue placeholder="All assignees" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All assignees</SelectItem>
                          {Array.isArray(projectTeamMembers) && projectTeamMembers.map(user => (
                            <SelectItem key={user.id} value={String(user.id)}>
                              {user.fullName || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {filterAssignee.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-1">
                          {filterAssignee.map(userId => {
                            const user = Array.isArray(projectTeamMembers) ? projectTeamMembers.find(u => u.id === userId) : null;
                            return (
                              <Badge
                                key={userId}
                                variant="outline"
                                className="text-xs py-0 h-6"
                                onClick={() => handleFilterAssigneeChange("all")}
                              >
                                {userId === -1 ? "Unassigned" : (user ? (user.fullName || user.username) : "Unknown User")}
                                <X className="h-3 w-3 ml-1" />
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-left bg-neutral-100 text-xs text-neutral-700 border-b border-neutral-200">
                        <th className="font-medium px-2 py-1.5 border-r border-neutral-200">ID</th>
                        <th className="font-medium px-2 py-1.5 border-r border-neutral-200">Title</th>
                        <th className="font-medium px-2 py-1.5 border-r border-neutral-200">Type</th>
                        <th className="font-medium px-2 py-1.5 border-r border-neutral-200">Status</th>
                        <th className="font-medium px-2 py-1.5 border-r border-neutral-200">Priority</th>
                        <th className="font-medium px-2 py-1.5 border-r border-neutral-200">Assignee</th>
                        <th className="font-medium px-2 py-1.5 border-r border-neutral-200">EST HR</th>
                        <th className="font-medium px-2 py-1.5 border-r border-neutral-200">Last Updated</th>
                        <th className="font-medium px-2 py-1.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(workItems) && workItems
                        .filter(item => {
                          // Filter by type if any type filters are selected
                          if (filterType.length > 0 && !filterType.includes(item.type)) {
                            return false;
                          }

                          // Filter by status if any status filters are selected
                          if (filterStatus.length > 0 && !filterStatus.includes(item.status)) {
                            return false;
                          }

                          // Filter by priority if any priority filters are selected
                          if (filterPriority.length > 0 && (!item.priority || !filterPriority.includes(item.priority))) {
                            return false;
                          }

                          // Filter by assignee if any assignee filters are selected
                          if (filterAssignee.length > 0) {
                            // Handle unassigned case
                            if (filterAssignee.includes(-1) && !item.assigneeId) {
                              return true;
                            }
                            // Handle assigned case
                            if (item.assigneeId && filterAssignee.includes(item.assigneeId)) {
                              return true;
                            }
                            // If filter is active but item doesn't match, exclude it
                            return false;
                          }

                          return true;
                        })
                        .map(item => (
                          <tr key={item.id} className="border-b border-neutral-200 hover:bg-neutral-50 text-xs">
                            <td className="px-2 py-1.5 border-r border-neutral-200">{item.externalId}</td>
                            <td className="px-2 py-1.5 border-r border-neutral-200">
                              <div className="flex items-center justify-between">
                                <span
                                  className={`${currentUser?.role === 'ADMIN' ||
                                    currentUser?.role === 'SCRUM_MASTER' ||
                                    item.reporterId === currentUser?.id ||
                                    item.assigneeId === currentUser?.id
                                    ? 'cursor-pointer hover:text-primary hover:underline'
                                    : 'cursor-default'
                                    }`}
                                  onClick={() => {
                                    if (canUserEditWorkItem(item, currentUser, workItems || [])) {
                                      openModal("editItem", { workItem: item });
                                    }
                                  }}
                                  title={
                                    canUserEditWorkItem(item, currentUser, workItems || [])
                                      ? 'Click to edit'
                                      : `Created on ${(() => {
                                        const date = new Date(item.createdAt);
                                        return date.toLocaleString('en-IN', {
                                          timeZone: 'Asia/Kolkata',
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: true
                                        }).replace(/,\s* /, ', ');
                                      })()}`
                                  }
                                >
                              <div className="flex flex-col">
                                <span className="font-medium text-neutral-900 line-clamp-1">{item.title}</span>
                                {item.type === 'EPIC' || item.type === 'FEATURE' || item.type === 'STORY' ? (
                                  <div className="flex gap-2 text-[10px] text-neutral-500 mt-0.5">
                                    {item.estimate && (
                                      <span>Est: <span className="font-medium text-neutral-700">{Number(item.estimate).toFixed(1)}h</span></span>
                                    )}
                                    {item.actualHours && (
                                      <span>Act: <span className="font-medium text-orange-600">{Number(item.actualHours).toFixed(1)}h</span></span>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                                </span>
                                
                                {/* Quick action buttons for EPIC items - Add Feature */}
                                {item.type === 'EPIC' && currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SCRUM_MASTER') && (
                                  <div className="flex gap-1 ml-auto">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openQuickAction(item, 'FEATURE');
                                      }}
                                      className="w-6 h-6 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded border border-gray-300 transition-colors flex items-center justify-center"
                                      title="Add Feature under this Epic"
                                    >
                                      +F
                                    </button>
                                  </div>
                                )}
                                
                                {/* Quick action buttons for FEATURE items - Add Story */}
                                {item.type === 'FEATURE' && currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SCRUM_MASTER') && (
                                  <div className="flex gap-1 ml-auto">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openQuickAction(item, 'STORY');
                                      }}
                                      className="w-6 h-6 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded border border-green-300 transition-colors flex items-center justify-center"
                                      title="Add Story under this Feature"
                                    >
                                      +S
                                    </button>
                                  </div>
                                )}
                                
                                {/* Quick action buttons for STORY items in list view */}
                                {item.type === 'STORY' && currentUser && (
                                  <div className="flex gap-1 ml-auto">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openQuickAction(item, 'TASK');
                                      }}
                                      className="w-6 h-6 text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 rounded border border-orange-300 transition-colors flex items-center justify-center"
                                      title="Add Task under this Story"
                                    >
                                      +T
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openQuickAction(item, 'BUG');
                                      }}
                                      className="w-6 h-6 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded border border-red-300 transition-colors flex items-center justify-center"
                                      title="Add Bug under this Story"
                                    >
                                      +B
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 border-r border-neutral-200">
                              <span className={`inline-block px-1.5 py-0.5 rounded-sm text-xs ${item.type === 'EPIC' ? 'bg-purple-100 text-purple-800' :
                                item.type === 'FEATURE' ? 'bg-gray-100 text-gray-800' :
                                  item.type === 'STORY' ? 'bg-green-100 text-green-800' :
                                    item.type === 'TASK' ? 'bg-orange-100 text-orange-800' :
                                      'bg-red-100 text-red-800'
                                }`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 border-r border-neutral-200">
                              <span className={`inline-block px-1.5 py-0.5 rounded-sm text-xs ${item.status === 'TODO' ? 'bg-neutral-100 text-neutral-800' :
                                item.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                                  'bg-emerald-100 text-emerald-800'
                                }`}>
                                {item.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 border-r border-neutral-200">
                              {item.priority ? (
                                <span className={`inline-block px-1.5 py-0.5 rounded-sm text-xs ${item.priority === 'LOW' ? 'bg-neutral-100 text-neutral-800' :
                                  item.priority === 'MEDIUM' ? 'bg-gray-100 text-gray-800' :
                                    item.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                      'bg-red-100 text-red-800'
                                  }`}>
                                  {item.priority}
                                </span>
                              ) : (
                                <span className="text-neutral-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 border-r border-neutral-200">
                              {item.assigneeId ? (
                                <div className="flex items-center">
                                  <div className="h-4 w-4 rounded-full bg-neutral-200 flex items-center justify-center text-xs mr-1">
                                    {projectTeamMembers.find(u => u.id === item.assigneeId)?.fullName.substring(0, 1) || "?"}
                                  </div>
                                  <span className="text-xs truncate max-w-[100px]">
                                    {projectTeamMembers.find(u => u.id === item.assigneeId)?.fullName || "Unknown"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-neutral-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 border-r border-neutral-200">
                              <span className="text-xs text-neutral-600 text-center">
                                {item.estimate ? `${Number(item.estimate).toFixed(1)}h` : '-'}
                                {item.actualHours && (
                                  <div className="text-[10px] text-orange-600 font-medium">
                                    Act: {Number(item.actualHours).toFixed(1)}h
                                  </div>
                                )}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 border-r border-neutral-200">
                              {(item.updatedBy || item.updatedByName) && item.updatedAt ? (
                                <div className="flex flex-col">
                                  <div className="flex items-center">
                                    <div className="h-4 w-4 rounded-full bg-green-200 flex items-center justify-center text-xs mr-1">
                                      {(projectTeamMembers.find(u => u.id === item.updatedBy)?.fullName || item.updatedByName || "Unknown").substring(0, 1)}
                                    </div>
                                    <span className="text-xs truncate max-w-[100px]">
                                      {projectTeamMembers.find(u => u.id === item.updatedBy)?.fullName || item.updatedByName || "Unknown"}
                                    </span>
                                  </div>
                                  <span className="text-xs text-neutral-400 ml-5">
                                    {(() => {
                                      const date = new Date(item.updatedAt);
                                      return date.toLocaleString('en-IN', {
                                        timeZone: 'Asia/Kolkata',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                      }).replace(/,\s*/, ', ');
                                    })()}
                                  </span>
                                </div>
                              ) : item.updatedAt ? (
                                <span className="text-xs text-neutral-600">
                                  {(() => {
                                    const date = new Date(item.updatedAt);
                                    return date.toLocaleString('en-IN', {
                                      timeZone: 'Asia/Kolkata',
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    }).replace(/,\s*/, ', ');
                                  })()}
                                </span>
                              ) : (
                                <span className="text-neutral-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex space-x-1">
                                {/* Check if user can edit this item */}
                                {canUserEditWorkItem(item, currentUser, workItems || []) ? (
                                  <>
                                    {/* Delete button - Only ADMIN and SCRUM_MASTER */}
                                    {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SCRUM_MASTER') && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 w-5 p-0 text-red-500"
                                        onClick={() => openModal("deleteItem", { workItem: item })}
                                        title="Delete item (Admin/Scrum Master only)"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs text-neutral-400">No access</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      {(!Array.isArray(workItems) || workItems.length === 0) && (
                        <tr>
                          <td colSpan={9} className="px-2 py-4 text-center text-neutral-500 text-xs">
                            No work items found. Create your first work item to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Backlog View Tab Content */}
            {projectView === 'backlog' && (
              <div className="bg-white border rounded-md shadow-sm">
                <div className="px-4 py-2 border-b bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Backlog View</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="px-2 py-1 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider w-80">
                          Title & Hierarchy
                          <div className="text-[8px] font-normal text-gray-500 normal-case mt-0.5">Click title text for modal • Click row for inline edit</div>
                        </th>
                        <th className="px-2 py-1 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider w-20">
                          Status
                        </th>
                        <th className="px-2 py-1 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider w-18">
                          Priority
                        </th>
                        <th className="px-2 py-1 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider w-24">
                          Assignee
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {organizeWorkItemsHierarchically().map((item: any) => {
                        const indentationStyles = {
                          0: "pl-2", // Epic
                          1: "pl-8", // Feature 
                          2: "pl-16", // Story
                          3: "pl-24" // Task/Bug
                        };
                        const paddingClass = indentationStyles[item.level as keyof typeof indentationStyles] || "pl-2";

                        const typeColors = {
                          'EPIC': 'bg-purple-500',
                          'FEATURE': 'bg-blue-500',
                          'STORY': 'bg-green-500',
                          'TASK': 'bg-orange-500',
                          'BUG': 'bg-red-500'
                        };

                        const statusColors = {
                          'TODO': 'bg-gray-100 text-gray-700 border-gray-300',
                          'IN_PROGRESS': 'bg-blue-100 text-blue-700 border-blue-300',
                          'ON_HOLD': 'bg-yellow-100 text-yellow-700 border-yellow-300',
                          'DONE': 'bg-green-100 text-green-700 border-green-300'
                        };

                        const priorityColors = {
                          'LOW': 'bg-gray-100 text-gray-600 border-gray-300',
                          'MEDIUM': 'bg-yellow-100 text-yellow-700 border-yellow-300',
                          'HIGH': 'bg-orange-100 text-orange-700 border-orange-300',
                          'CRITICAL': 'bg-red-100 text-red-700 border-red-300'
                        };

                        return (
                          <tr 
                            key={item.id} 
                            className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                            onClick={(e) => {
                              // Only handle row click if not clicking on interactive elements
                              if (e.target === e.currentTarget || 
                                  (e.target as HTMLElement).closest('.row-clickable')) {
                                if (canUserEditWorkItem(item, currentUser, workItems || [])) {
                                  // For row clicks, start inline editing of title
                                  startInlineEdit(item.id, 'title', item.title);
                                }
                              }
                            }}
                            title={canUserEditWorkItem(item, currentUser, workItems || []) ? 'Click empty area to edit title inline' : ''}
                          >
                            {/* Title Column with Type Indicator and Hierarchy */}
                            <td className={`px-1 py-2 ${paddingClass} row-clickable`}>
                              <div className="flex items-start">
                                {/* Expand/Collapse Button */}
                                {item.hasChildren && (
                                  <button
                                    className="mr-2 p-0.5 hover:bg-gray-200 rounded focus:outline-none flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleItemExpansion(item.id);
                                    }}
                                  >
                                    {expandedItems[item.id] ? (
                                      <ChevronDown className="h-3 w-3 text-gray-500" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-gray-500" />
                                    )}
                                  </button>
                                )}
                                {!item.hasChildren && <div className="w-5 flex-shrink-0" />}

                                {/* Type Circle Badge */}
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white flex-shrink-0 mr-2 ${typeColors[item.type as keyof typeof typeColors] || 'bg-gray-500'
                                  }`}>
                                  {item.type === 'EPIC' ? 'E' :
                                    item.type === 'FEATURE' ? 'F' :
                                      item.type === 'STORY' ? 'S' :
                                        item.type === 'TASK' ? 'T' :
                                          item.type === 'BUG' ? 'B' : '?'}
                                </div>

                                {/* Title */}
                                <div className="flex-1 min-w-0">
                                  {editingCell?.itemId === item.id && editingCell?.field === 'title' ? (
                                    <input
                                      type="text"
                                      value={editValues.title || ''}
                                      onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                                      onBlur={() => saveInlineEdit(item.id, 'title')}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          saveInlineEdit(item.id, 'title');
                                        } else if (e.key === 'Escape') {
                                          cancelInlineEdit();
                                        }
                                      }}
                                      autoFocus
                                      className="w-full text-xs px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white z-10 relative"
                                    />
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <div
                                        className={`text-xs leading-snug break-words ${canUserEditWorkItem(item, currentUser, workItems || [])
                                          ? 'cursor-pointer hover:text-blue-600 hover:underline'
                                          : 'text-gray-700'
                                          } ${item.level === 0 ? 'text-gray-900' :
                                            item.level === 1 ? 'text-gray-800' :
                                              'text-gray-700'}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (canUserEditWorkItem(item, currentUser, workItems || [])) {
                                            openModal("editItem", { workItem: item });
                                          }
                                        }}
                                        title={canUserEditWorkItem(item, currentUser, workItems || []) ? 'Click title text to open edit modal' : `${item.type}: ${item.title}`}
                                      >
                                    <div className="flex flex-col">
                                <span className="font-medium text-neutral-900 line-clamp-1">{item.title}</span>
                                {item.type === 'EPIC' || item.type === 'FEATURE' || item.type === 'STORY' ? (
                                  <div className="flex gap-2 text-[10px] text-neutral-500 mt-0.5">
                                    {item.estimate && (
                                      <span>Est: <span className="font-medium text-neutral-700">{Number(item.estimate).toFixed(1)}h</span></span>
                                    )}
                                    {item.actualHours && (
                                      <span>Act: <span className="font-medium text-orange-600">{Number(item.actualHours).toFixed(1)}h</span></span>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                                      </div>
                                      
                                      {/* Quick action buttons for EPIC items - Add Feature */}
                                      {item.type === 'EPIC' && currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SCRUM_MASTER') && (
                                        <div className="flex gap-1 ml-auto">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openQuickAction(item, 'FEATURE');
                                            }}
                                            className="w-6 h-6 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 rounded border border-gray-300 transition-colors flex items-center justify-center"
                                            title="Add Feature under this Epic"
                                          >
                                            +F
                                          </button>
                                        </div>
                                      )}
                                      
                                      {/* Quick action buttons for FEATURE items - Add Story */}
                                      {item.type === 'FEATURE' && currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SCRUM_MASTER') && (
                                        <div className="flex gap-1 ml-auto">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openQuickAction(item, 'STORY');
                                            }}
                                            className="w-6 h-6 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded border border-green-300 transition-colors flex items-center justify-center"
                                            title="Add Story under this Feature"
                                          >
                                            +S
                                          </button>
                                        </div>
                                      )}
                                      
                                      {/* Quick action buttons for STORY items */}
                                      {item.type === 'STORY' && currentUser && (
                                        <div className="flex gap-1 ml-auto">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openQuickAction(item, 'TASK');
                                            }}
                                            className="w-6 h-6 text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 rounded border border-orange-300 transition-colors flex items-center justify-center"
                                            title="Add Task under this Story"
                                          >
                                            +T
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openQuickAction(item, 'BUG');
                                            }}
                                            className="w-6 h-6 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded border border-red-300 transition-colors flex items-center justify-center"
                                            title="Add Bug under this Story"
                                          >
                                            +B
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Status Column */}
                            <td className="px-2 py-1">
                              {editingCell?.itemId === item.id && editingCell?.field === 'status' ? (
                                <Select
                                  value={editValues.status || item.status}
                                  onValueChange={(value) => {
                                    setEditValues({ ...editValues, status: value });
                                    handleStatusChange(item.id, value, item);
                                  }}
                                  open={true}
                                  onOpenChange={(open) => {
                                    if (!open) cancelInlineEdit();
                                  }}
                                >
                                  <SelectTrigger className="h-6 w-28 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="TODO">To Do</SelectItem>
                                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                                    <SelectItem value="DONE">Done</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span
                                  className={`px-1.5 py-0.5 inline-flex text-[10px] rounded border ${statusColors[item.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700 border-gray-300'} ${canUserEditWorkItem(item, currentUser, workItems || []) ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (canUserEditWorkItem(item, currentUser, workItems || [])) {
                                      startInlineEdit(item.id, 'status', item.status);
                                    }
                                  }}
                                  title={canUserEditWorkItem(item, currentUser, workItems || []) ? 'Click to edit status' : ''}
                                >
                                  {item.status.replace('_', ' ')}
                                </span>
                              )}
                            </td>

                            {/* Priority Column */}
                            <td className="px-2 py-1">
                              {editingCell?.itemId === item.id && editingCell?.field === 'priority' ? (
                                <Select
                                  value={editValues.priority || item.priority || 'MEDIUM'}
                                  onValueChange={(value) => {
                                    setEditValues({ ...editValues, priority: value });
                                    updateWorkItemMutation.mutate({
                                      itemId: item.id,
                                      updates: { priority: value }
                                    });
                                    cancelInlineEdit();
                                  }}
                                  open={true}
                                  onOpenChange={(open) => {
                                    if (!open) cancelInlineEdit();
                                  }}
                                >
                                  <SelectTrigger className="h-6 w-24 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="LOW">Low</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="HIGH">High</SelectItem>
                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : item.priority ? (
                                <span
                                  className={`px-1.5 py-0.5 inline-flex text-[10px] rounded border ${priorityColors[item.priority as keyof typeof priorityColors] || 'bg-gray-100 text-gray-600 border-gray-300'} ${canUserEditWorkItem(item, currentUser, workItems || []) ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (canUserEditWorkItem(item, currentUser, workItems || [])) {
                                      startInlineEdit(item.id, 'priority', item.priority || 'MEDIUM');
                                    }
                                  }}
                                  title={canUserEditWorkItem(item, currentUser, workItems || []) ? 'Click to edit priority' : ''}
                                >
                                  {item.priority}
                                </span>
                              ) : (
                                <span
                                  className={`text-gray-400 text-[10px] ${canUserEditWorkItem(item, currentUser, workItems || []) ? 'cursor-pointer hover:text-blue-600' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (canUserEditWorkItem(item, currentUser, workItems || [])) {
                                      startInlineEdit(item.id, 'priority', 'MEDIUM');
                                    }
                                  }}
                                  title={canUserEditWorkItem(item, currentUser, workItems || []) ? 'Click to set priority' : ''}
                                >
                                  -
                                </span>
                              )}
                            </td>

                            {/* Assignee Column */}
                            <td className="px-2 py-1">
                              {editingCell?.itemId === item.id && editingCell?.field === 'assignee' ? (
                                <Select
                                  value={editValues.assignee || (item.assigneeId ? String(item.assigneeId) : 'unassigned')}
                                  onValueChange={async (value) => {
                                    setEditValues({ ...editValues, assignee: value });
                                    try {
                                      const result = await updateWorkItemMutation.mutateAsync({
                                        itemId: item.id,
                                        updates: { assigneeId: value === 'unassigned' ? null : parseInt(value) }
                                      });
                                      cancelInlineEdit();
                                    } catch (error) {
                                      console.error("Error updating assignee:", error);
                                      toast({
                                        title: "Error",
                                        description: `Failed to update assignee: ${error.message || 'Unknown error'}`,
                                        variant: "destructive",
                                      });
                                      cancelInlineEdit();
                                    }
                                  }}
                                  open={true}
                                  onOpenChange={(open) => {
                                    if (!open) cancelInlineEdit();
                                  }}
                                >
                                  <SelectTrigger className="h-6 w-24 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {Array.isArray(projectTeamMembers) && projectTeamMembers.length > 0 ? projectTeamMembers.map(user => (
                                      <SelectItem key={user.id} value={String(user.id)}>
                                        {user.fullName || user.username}
                                      </SelectItem>
                                    )) : (
                                      <SelectItem value="no-members" disabled>No team members available</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              ) : item.assigneeId ? (
                                <div 
                                  className={`flex items-center ${canUserEditWorkItem(item, currentUser, workItems || []) ? 'cursor-pointer hover:ring-2 hover:ring-blue-300 rounded px-1' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (canUserEditWorkItem(item, currentUser, workItems || [])) {
                                      startInlineEdit(item.id, 'assignee', String(item.assigneeId));
                                    }
                                  }}
                                  title={canUserEditWorkItem(item, currentUser, workItems || []) ? 'Click to change assignee' : ''}
                                >
                                  <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[9px] text-blue-700 mr-1 flex-shrink-0">
                                    {(Array.isArray(projectTeamMembers) ? projectTeamMembers.find(u => u.id === item.assigneeId)?.fullName?.substring(0, 1)?.toUpperCase() : null) || "?"}
                                  </div>
                                  <span className="text-[10px] text-gray-700 truncate max-w-20">
                                    {(Array.isArray(projectTeamMembers) ? projectTeamMembers.find(u => u.id === item.assigneeId)?.fullName : null) || "Unknown"}
                                  </span>
                                </div>
                              ) : (
                                <span 
                                  className={`text-gray-400 text-[10px] ${canUserEditWorkItem(item, currentUser, workItems || []) ? 'cursor-pointer hover:text-blue-600' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (canUserEditWorkItem(item, currentUser, workItems || [])) {
                                      startInlineEdit(item.id, 'assignee', 'unassigned');
                                    }
                                  }}
                                  title={canUserEditWorkItem(item, currentUser, workItems || []) ? 'Click to assign user' : ''}
                                >
                                  Unassigned
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {(!Array.isArray(workItems) || workItems.length === 0) && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500 text-sm">
                            No work items found. Create your first work item to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Settings Tab Content */}
            {projectView === 'settings' && (
              <div className="bg-white border rounded-md shadow-sm">
                <div className="p-6">
                  <h3 className="text-lg font-medium mb-6">Project Settings</h3>
                  <div className="space-y-8">
                    {/* Project Details Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-md font-medium">Project Details</h4>
                        {!isAdminOrScrum && (
                          <div className="text-sm text-neutral-500 bg-neutral-50 px-3 py-1 rounded-md border">
                            <span className="text-xs">👤</span> Only Admin and Scrum Master can edit project details
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="projectName" className="block text-sm font-medium mb-1">
                            Project Name
                          </label>
                          <Input
                            id="projectName"
                            value={editedProject.name}
                            onChange={(e) => setEditedProject(prev => ({ ...prev, name: e.target.value }))}
                            disabled={!isAdminOrScrum}
                            className="max-w-lg"
                            placeholder="Enter project name"
                          />
                        </div>
                        <div>
                          <label htmlFor="projectKey" className="block text-sm font-medium mb-1">
                            Project Key
                          </label>
                          <div className="flex items-center space-x-2">
                            <Input
                              id="projectKey"
                              value={project?.key || 'N/A'}
                              disabled
                              className="max-w-lg bg-gray-50"
                              placeholder="Project key will appear here"
                            />
                            {userRole === 'ADMIN' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowKeyResetDialog(true)}
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                Reset Key
                              </Button>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-neutral-500">
                            <span className="inline-flex items-center">
                              🔒 The project key is used in work item IDs and cannot be changed after creation.
                              {userRole === 'ADMIN' && (
                                <span className="text-red-500 ml-1">
                                  • Reset only in emergency situations
                                </span>
                              )}
                            </span>
                          </p>
                        </div>
                        <div>
                          <label htmlFor="projectDescription" className="block text-sm font-medium mb-1">
                            Description
                          </label>
                          <Textarea
                            id="projectDescription"
                            value={editedProject.description}
                            onChange={(e) => setEditedProject(prev => ({ ...prev, description: e.target.value }))}
                            disabled={!isAdminOrScrum}
                            className="max-w-lg"
                            rows={3}
                            placeholder="Enter project description"
                          />
                        </div>
                        {/* Save button for admins/scrum masters */}
                        {isAdminOrScrum && (
                          <div className="flex gap-3">
                            <Button
                              onClick={handleSaveProject}
                              disabled={isSaving || !editedProject.name.trim()}
                              className="mt-4"
                            >
                              {isSaving ? "Saving..." : "Save Changes"}
                            </Button>
                            {/* Reset button to restore original values */}
                            <Button
                              variant="outline"
                              onClick={() => setEditedProject({
                                name: project?.name || '',
                                description: project?.description || ''
                              })}
                              disabled={isSaving}
                              className="mt-4"
                            >
                              Reset
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Team Assignment Section */}
                    <div>
                      <h4 className="text-md font-medium mb-4">Team Assignment</h4>
                      <div className="border rounded-md p-4 max-w-3xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Current Team: {project?.teamId ?
                                teams?.find(team => team.id === project.teamId)?.name || 'Unknown Team' :
                                'No team assigned'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {project?.teamId ?
                                'Team members can be assigned to work items and access project resources.' :
                                'Assign a team to enable team member management and collaboration.'}
                            </p>
                          </div>
                          {isAdminOrScrum && (
                            <Button
                              variant="outline"
                              onClick={() => setShowAssignTeamDialog(true)}
                              className="text-gray-600 hover:text-gray-700 border-gray-300 hover:border-gray-400"
                            >
                              <Users className="h-4 w-4 mr-1" />
                              {project?.teamId ? 'Change Team' : 'Assign Team'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Team Section */}
                    <div>
                      <h4 className="text-md font-medium mb-4">Team Management</h4>
                      {project?.teamId ? (
                        <div className="border rounded-md overflow-hidden max-w-3xl">
                          {/* Current Team Members */}
                          <div className="bg-neutral-50 px-4 py-3 border-b">
                            <h5 className="text-sm font-medium">Current Team Members ({projectTeamMembers?.length || 0})</h5>
                          </div>
                          <div className="p-4">
                            {projectTeamMembers && projectTeamMembers.length > 0 ? (
                              <div className="space-y-2">
                                {projectTeamMembers.map(member => (
                                  <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-8 h-8 bg-gray-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                                        {member.fullName?.substring(0, 1) || member.username?.substring(0, 1) || "?"}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{member.fullName || member.username}</p>
                                        <p className="text-xs text-gray-500 capitalize">{member.role?.toLowerCase().replace('_', ' ')}</p>
                                      </div>
                                    </div>
                                    {isAdminOrScrum && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRemoveTeamMember(member.id)}
                                        disabled={removingMemberId === member.id}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        {removingMemberId === member.id ? (
                                          <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />

                                        ) : (
                                          <UserMinus className="h-3 w-3" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-neutral-500 text-center py-4">
                                No team members assigned to this project yet.
                              </p>
                            )}
                          </div>

                          {/* Add Team Member */}
                          {isAdminOrScrum && (
                            <div className="border-t bg-neutral-50 px-4 py-3">
                              <div className="flex items-center space-x-3">
                                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select a user to add..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allUsers
                                      ?.filter(user => !projectTeamMembers?.some(member => member.id === user.id))
                                      ?.map(user => (
                                        <SelectItem key={user.id} value={user.id.toString()}>
                                          <div className="flex items-center space-x-2">
                                            <div className="w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs">
                                              {user.fullName?.substring(0, 1) || user.username?.substring(0, 1) || "?"}
                                            </div>
                                            <span>{user.fullName || user.username}</span>
                                          </div>
                                        </SelectItem>
                                      )) || []}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  onClick={handleAddTeamMember}
                                  disabled={!selectedUserId}
                                >
                                  <UserPlus className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="border rounded-md p-6 max-w-3xl text-center">
                          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <h5 className="text-lg font-medium text-gray-900 mb-2">No Team Assigned</h5>
                          <p className="text-sm text-gray-500 mb-4">
                            This project doesn't have a team assigned yet. Assign a team to enable member management and collaboration features.
                          </p>
                          {isAdminOrScrum && (
                            <Button
                              variant="outline"
                              onClick={() => setShowAssignTeamDialog(true)}
                              className="text-gray-600 hover:text-gray-700 border-gray-300 hover:border-gray-400"
                            >
                              <Users className="h-4 w-4 mr-1" />
                              Assign Team
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Danger Zone - Admin and Scrum Master Only */}
                    {isAdminOrScrum && (
                      <div>
                        <h4 className="text-md font-medium mb-4 text-red-600">Danger Zone</h4>
                        <div className="space-y-4 border border-red-200 rounded-md p-4">
                          {/* Debug info - remove after fixing */}
                          {(() => {
                            const status = project?.status;
                            const isArchived = status === 'ARCHIVED' ||
                              status === 'archived' ||
                              status?.toUpperCase() === 'ARCHIVED' ||
                              status?.toLowerCase() === 'archived';

                            return isArchived ? (
                              <div className="flex items-center justify-between py-4">
                                <div>
                                  <h4 className="text-sm font-medium text-green-800">Restore Project</h4>
                                  <p className="text-sm text-green-600">Restore this project to active views.</p>
                                </div>
                                <Button
                                  variant="outline"
                                  className="border-green-300 text-green-600 hover:bg-green-50 hover:text-green-700"
                                  onClick={handleRestoreProject}
                                >
                                  Restore Project
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between py-4">
                                <div>
                                  <h4 className="text-sm font-medium text-red-800">Archive Project</h4>
                                  <p className="text-sm text-red-600">Archive this project to hide it from active views.</p>
                                </div>
                                <Button
                                  variant="outline"
                                  className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => openModal("archiveProject", { project })}
                                >
                                  Archive Project
                                </Button>
                              </div>
                            );
                          })()}

                          <div className="flex items-center justify-between py-4">
                            <div>
                              <h4 className="text-sm font-medium text-red-800">Delete Project</h4>
                              <p className="text-sm text-red-600">This action cannot be undone. All data will be permanently deleted.</p>
                            </div>
                            <Button
                              variant="outline"
                              className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={handleDeleteProject}
                            >
                              Delete Project
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {isOpen && modalType === "createItem" && (
        <CreateItemModal
          isOpen={isOpen}
          onClose={closeModal}
          onSuccess={handleWorkItemsUpdate}
          projects={projects}
          workItems={workItems}
          currentProject={project}
        />
      )}

      {isOpen && modalType === "editItem" && (
        <EditItemModal
          isOpen={isOpen}
          onClose={closeModal}
          onSuccess={handleWorkItemsUpdate}
          workItem={modalProps.workItem}
          projects={projects}
        />
      )}

      {isOpen && modalType === "deleteItem" && (
        <DeleteItemModal
          isOpen={isOpen}
          onClose={closeModal}
          onSuccess={handleWorkItemsUpdate}
          workItem={modalProps.workItem}
        />
      )}

      {/* Quick Action Modal for creating items under parent work items */}
      <CreateItemModal
        isOpen={quickActionModal.isOpen}
        onClose={closeQuickAction}
        onSuccess={handleQuickActionSuccess}
        projects={projects}
        workItems={workItems}
        currentProject={project}
        preselectedParent={quickActionModal.parentStory ?? undefined}
        preselectedType={quickActionModal.type ?? undefined}
      />

      {isOpen && modalType === "archiveProject" && (
        <ArchiveProjectModal
          isOpen={isOpen}
          onClose={closeModal}
          onSuccess={async () => {
            // Invalidate both the projects list and specific project cache
            await queryClient.invalidateQueries({ queryKey: ['/projects'] });
            await queryClient.invalidateQueries({ queryKey: [`/projects/${projectId}`] });
            // Redirect to projects page after successful archive
            goToProjects();
          }}
          project={modalProps.project}
        />
      )}

      {/* Project Key Reset Dialog (Admin Only) */}
      <Dialog open={showKeyResetDialog} onOpenChange={setShowKeyResetDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ Reset Project Key</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>This is an emergency function that will change the project key.</p>
              <p><strong>Warning:</strong> All future work items will use the new key. Existing work item IDs will not change.</p>
              <p className="text-red-600 font-medium">Only use this if the current key was entered incorrectly!</p>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Current Project Key: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{project?.key}</span>
              </label>
            </div>
            <div>
              <label htmlFor="newProjectKey" className="block text-sm font-medium mb-2">
                New Project Key
              </label>
              <Input
                id="newProjectKey"
                value={newProjectKey}
                onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                placeholder="Enter new project key (e.g., PROJ)"
                className="font-mono"
                maxLength={10}
              />
              <p className="text-xs text-gray-500 mt-1">
                Must be 2-10 uppercase letters and numbers only
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowKeyResetDialog(false);
                setNewProjectKey("");
              }}
              disabled={isResettingKey}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetProjectKey}
              disabled={isResettingKey || !newProjectKey.trim()}
            >
              {isResettingKey ? "Resetting..." : "Reset Project Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Assignment Dialog (Admin/Scrum Master Only) */}
      <Dialog open={showAssignTeamDialog} onOpenChange={setShowAssignTeamDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              {project?.teamId ? 'Change Project Team' : 'Assign Team to Project'}
            </DialogTitle>
            <DialogDescription>
              {project?.teamId
                ? 'Select a different team to assign to this project. This will change which team members have access to the project.'
                : 'Select a team to assign to this project. Team members will be able to access the project and be assigned to work items.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Current Team: <span className="font-semibold">{project?.teamId ?
                  teams?.find(team => team.id === project.teamId)?.name || 'Unknown Team' :
                  'No team assigned'}</span>
              </label>
            </div>
            <div>
              <label htmlFor="assignTeamId" className="block text-sm font-medium mb-2">
                Select Team
              </label>
              <Select value={assignTeamId} onValueChange={setAssignTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a team..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No team (remove team assignment)</SelectItem>
                  {teams?.filter(team => team.id !== project?.teamId).map(team => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>{team.name}</span>
                      </div>
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignTeamDialog(false);
                setAssignTeamId("");
              }}
              disabled={isAssigningTeam}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignTeam}
              disabled={isAssigningTeam || !assignTeamId}
            >
              {isAssigningTeam ? "Assigning..." : (project?.teamId ? "Change Team" : "Assign Team")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
