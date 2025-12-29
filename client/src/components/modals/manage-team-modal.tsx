
import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InactivateIcon, ActivateIcon, InactiveIcon } from "./user-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiRequest } from "@/lib/api-config";
import { queryClient } from "@/lib/queryClient";

interface ManageTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface User {
  id: number;
  email: string;
  fullName: string;
  username: string;
  isActive: boolean;
  role: string;
  avatarUrl: string | null;
}

export const ManageTeamModal: React.FC<ManageTeamModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const [inactivatingUserId, setInactivatingUserId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: users = [], refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ['/users'],
    enabled: isOpen,
    queryFn: async () => {
      try {
        return await apiGet('/users');
      } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
      }
    },
  });

  // Filter users by search (all fields)
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const totalCount = users.length;
  const activeCount = users.filter(u => u.isActive).length;
  const inactiveCount = totalCount - activeCount;

  const inactivateMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest('PATCH', `/users/${userId}`, { isActive: false });
    },
    onSuccess: () => {
      refetchUsers();
      queryClient.invalidateQueries({ queryKey: ['/users'] });
      queryClient.invalidateQueries({ queryKey: ['/users/all'] });
      setInactivatingUserId(null);
      toast({
        title: "Success",
        description: "User inactivated successfully",
      });
    },
    onError: (error: any) => {
      setInactivatingUserId(null);
      toast({
        title: "Error",
        description: error.message || "Failed to inactivate user",
        variant: "destructive",
      });
    },
  });

  const handleInactivateUser = (userId: number) => {
    setInactivatingUserId(userId);
    inactivateMutation.mutate(userId);
  };

  // Activate user mutation
  const activateMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest('PATCH', `/users/${userId}`, { isActive: true });
    },
    onSuccess: () => {
      refetchUsers();
      queryClient.invalidateQueries({ queryKey: ['/users'] });
      setInactivatingUserId(null);
      toast({
        title: "Success",
        description: "User activated successfully",
      });
    },
    onError: (error: any) => {
      setInactivatingUserId(null);
      toast({
        title: "Error",
        description: error.message || "Failed to activate user",
        variant: "destructive",
      });
    },
  });

  const handleActivateUser = (userId: number) => {
    setInactivatingUserId(userId);
    activateMutation.mutate(userId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Team - All Users</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div className="flex gap-4 text-sm">
              <span>Total: <b>{totalCount}</b></span>
              <span>Active: <b>{activeCount}</b></span>
              <span>Inactive: <b>{inactiveCount}</b></span>
            </div>
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm w-full sm:w-64"
              placeholder="Search users (name, email, username, role)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No users found.</div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback>
                        {user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{user.fullName}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                  {user.isActive ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={inactivatingUserId === user.id}
                      onClick={() => handleInactivateUser(user.id)}
                      title="Inactivate user"
                    >
                      <InactivateIcon />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={inactivatingUserId === user.id}
                      onClick={() => handleActivateUser(user.id)}
                      title="Activate user"
                    >
                      <ActivateIcon />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
