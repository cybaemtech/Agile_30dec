import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-config";

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  isActive: boolean;
  role: string;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectAccess {
  userId: number;
  projectId: number;
  role: string | null;
  permissions: string[];
}

export function useCurrentUser() {
  return useQuery<User>({
    queryKey: ['/auth/user'],
    queryFn: () => apiGet('/auth/user'),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProjectAccess(projectId: number, userId?: number) {
  return useQuery<ProjectAccess>({
    queryKey: [`/project-access/${projectId}/permissions/${userId}`],
    queryFn: () => apiGet(`/project-access/${projectId}/permissions/${userId}`),
    enabled: !!projectId && !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useUserProjects() {
  return useQuery({
    queryKey: ['/project-access'],
    queryFn: () => apiGet('/project-access'),
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

// Helper function to check if user has specific permission
export function hasProjectPermission(
  userPermissions: string[] | undefined, 
  requiredPermission: string
): boolean {
  return userPermissions?.includes(requiredPermission) || false;
}

// Helper function to check if user is admin or has elevated role
export function isElevatedUser(userRole: string | undefined): boolean {
  return ['ADMIN', 'SCRUM_MASTER'].includes(userRole || '');
}

// Helper function to check if user owns the project
export function isProjectOwner(userId: number | undefined, projectCreatedBy: number): boolean {
  return userId === projectCreatedBy;
}