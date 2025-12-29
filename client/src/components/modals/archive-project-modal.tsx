import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Archive, AlertTriangle } from "lucide-react";

interface ArchiveProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project?: Project;
}

export function ArchiveProjectModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  project
}: ArchiveProjectModalProps) {
  const { toast } = useToast();
  
  const handleArchive = async () => {
    if (!project) {
      toast({
        title: "Error",
        description: "No project provided for archiving.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await apiRequest(
        'PATCH',
        `/api/projects/${project.id}`,
        { status: "ARCHIVED" }
      );

      if (response.ok) {
        toast({
          title: "Project archived",
          description: "The project has been archived successfully.",
        });
        
        // Invalidate cache for both projects list and specific project
        await queryClient.invalidateQueries({ queryKey: ['/projects'] });
        await queryClient.invalidateQueries({ queryKey: [`/projects/${project.id}`] });
        
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to archive project",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error archiving project:", error);
      
      toast({
        title: "Error",
        description: "An unexpected error occurred while archiving the project",
        variant: "destructive",
      });
    }
  };
  
  if (!project) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center text-amber-600 mb-2">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <DialogTitle className="text-lg font-semibold">Archive Project</DialogTitle>
          </div>
          <DialogDescription className="text-neutral-600">
            Are you sure you want to archive <span className="font-medium text-neutral-800">"{project.name}"</span>?
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800 border border-blue-200 mb-3">
          <div className="flex items-center mb-2">
            <Archive className="h-4 w-4 mr-2" />
            <p className="font-medium">What happens when you archive a project:</p>
          </div>
          <ul className="list-disc list-inside space-y-1 ml-6">
            <li>The project will be moved to the archived section</li>
            <li>It will be hidden from the active projects view</li>
            <li>All work items will remain accessible</li>
            <li>You can restore the project later if needed</li>
          </ul>
        </div>
        
        <DialogFooter className="mt-6">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="default" 
            onClick={handleArchive}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}