import { Link } from "wouter";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Layers, Users, CalendarDays, Trash2 } from "lucide-react";
import { Project, Team, User } from "@shared/schema";
import { apiGet, apiRequest } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface ProjectCardProps {
  project: Project;
  creator?: User;
  team?: Team;
  stats?: {
    epics: number;
    features: number;
    stories: number;
    tasks: number;
    bugs: number;
  };
  memberCount?: number;
  onProjectDeleted?: () => void;
  teamMemberIds?: number[];
}

export function ProjectCard({ 
  project, 
  creator, 
  team,
  stats = { epics: 0, features: 0, stories: 0, tasks: 0, bugs: 0 },
  memberCount,
  onProjectDeleted,
  teamMemberIds = []
}: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  // Fetch current user to check permissions
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/auth/user'],
    queryFn: () => apiGet('/auth/user'),
    retry: false,
  });

  // Check if current user can delete project (admin/scrum master only)
  const canDeleteProject = currentUser && (
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'SCRUM_MASTER'
  );

  // Check if current user is a member of this project's team or is admin/scrum master
  const hasTeamAccess = currentUser && (
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'SCRUM_MASTER' ||
    teamMemberIds.includes(currentUser.id)
  );

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/projects/${project.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/projects'] });
      onProjectDeleted?.();
      toast({
        title: "Project deleted",
        description: `Project "${project.name}" has been deleted successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete project.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteProject = () => {
    deleteProjectMutation.mutate();
    setShowDeleteDialog(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-amber-100 text-amber-800 border-amber-200";
      case "COMPLETED": return "bg-green-100 text-green-800 border-green-200";
      case "ARCHIVED": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };
  
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={getStatusColor(project.status)}>
              {project.status}
            </Badge>
            {team && hasTeamAccess && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                <Users className="h-3 w-3 mr-1" />
                {team.name}
                {typeof memberCount === 'number' && (
                  <span className="ml-2 text-xs text-blue-600">{memberCount} member{memberCount === 1 ? '' : 's'}</span>
                )}
              </Badge>
            )}
          </div>
        </div>
          {project.key && (
            <div className="mb-1 text-xs text-neutral-500">
              <span className="font-semibold">Project Key:</span> {project.key}
            </div>
          )}
        <CardTitle className="text-lg font-semibold mt-2">{project.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {project.description || "No description provided"}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="flex justify-between text-sm text-neutral-600 mb-4">
          <div className="flex items-center">
            <CalendarDays className="h-4 w-4 mr-1" />
            {formatDate(new Date(project.createdAt))}
          </div>
          
          <div className="flex items-center">
            <span className="mr-1">Created by:</span>
            <Avatar className="h-5 w-5 mr-1">
              <AvatarFallback className="text-xs">
                {(() => {
                  // Use creator if available, otherwise use project's stored creator info
                  if (creator) {
                    return creator.email.substring(0, 2).toUpperCase();
                  }
                  const email = project.createdByEmail || '';
                  const name = project.createdByName || '';
                  const displayText = email !== 'unknown@example.com' ? email : (name !== 'Unknown User' ? name : 'U');
                  return displayText.substring(0, 2).toUpperCase();
                })()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm" title={(() => {
              if (creator) {
                return `${creator.fullName} (${creator.email})`;
              }
              const email = project.createdByEmail || '';
              const name = project.createdByName || '';
              if (email !== 'unknown@example.com') return email;
              if (name !== 'Unknown User') return name;
              return 'Unknown User';
            })()}>
              {(() => {
                if (creator) {
                  return creator.email;
                }
                const email = project.createdByEmail || '';
                const name = project.createdByName || '';
                if (email !== 'unknown@example.com') return email;
                if (name !== 'Unknown User') return name;
                return 'Unknown User';
              })()}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-5 gap-2 text-xs">
          <div className="flex flex-col items-center p-2 bg-blue-50 rounded-md">
            <span className="font-semibold text-blue-700">{stats.epics}</span>
            <span className="text-neutral-600">Epics</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-purple-50 rounded-md">
            <span className="font-semibold text-purple-700">{stats.features}</span>
            <span className="text-neutral-600">Features</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-indigo-50 rounded-md">
            <span className="font-semibold text-indigo-700">{stats.stories}</span>
            <span className="text-neutral-600">Stories</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-green-50 rounded-md">
            <span className="font-semibold text-green-700">{stats.tasks}</span>
            <span className="text-neutral-600">Tasks</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-red-50 rounded-md">
            <span className="font-semibold text-red-700">{stats.bugs}</span>
            <span className="text-neutral-600">Bugs</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-2">
        <Link href={`/projects/${project.id}`} className="w-full">
          <Button variant="default" className="w-full">
            <Layers className="h-4 w-4 mr-2" />
            View Project
          </Button>
        </Link>
      </CardFooter>
      
      {/* Delete Project Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the project "{project.name}"? This action cannot be undone.
              All work items, reports, and data associated with this project will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
