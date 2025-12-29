import { useState, useMemo, useRef, useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { X, Search, Check } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { emailSchema, User } from '@shared/schema';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { apiRequest, apiGet } from '@/lib/api-config';
import { validateCorporateEmails } from '@/lib/email-validation';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddTeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  teamId: number | null;
}

const formSchema = z.object({
  selectedUsers: z.array(z.number()).min(1, {
    message: "Please select at least one user",
  }),
});

export function AddTeamMembersModal({
  isOpen,
  onClose,
  projectId,
  teamId,
}: AddTeamMembersModalProps) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  // Fetch all users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/users'],
    queryFn: () => apiGet('/users'),
    enabled: isOpen,
  });

  // Fetch team members to exclude already-added members
  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: [`/teams/${teamId}/members`],
    queryFn: () => apiGet(`/teams/${teamId}/members`),
    enabled: isOpen && !!teamId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedUsers: [],
    },
  });

  const selectedUsers = form.watch('selectedUsers');

  // Filter users based on search query and exclude already-added members
  const filteredUsers = useMemo(() => {
    const teamMemberIds = teamMembers.map((m: any) => m.user?.id || m.userId);
    return users
      .filter((user) => !teamMemberIds.includes(user.id))
      .filter((user) =>
        user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 10); // Limit to 10 items
  }, [searchQuery, users, teamMembers]);

  // Reset highlighted index when dropdown or search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, showDropdown, filteredUsers.length]);

  const selectedUserDetails = users.filter((u) => selectedUsers.includes(u.id));

  const toggleUserSelection = (userId: number) => {
    const current = selectedUsers;
    if (current.includes(userId)) {
      form.setValue('selectedUsers', current.filter((id) => id !== userId));
    } else {
      form.setValue('selectedUsers', [...current, userId]);
    }
  };

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!teamId) {
      toast({
        title: "Error",
        description: "This project is not associated with a team.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Add each selected user to the team
      const addMemberPromises = values.selectedUsers.map(async (userId) => {
        try {
          await apiRequest('POST', `/teams/${teamId}/members`, {
            userId: userId,
            role: "MEMBER",
          });
          return true;
        } catch (error) {
          console.error("Failed to add user to team:", error);
          return false;
        }
      });

      const results = await Promise.all(addMemberPromises);
      const successCount = results.filter((r) => r === true).length;

      if (successCount > 0) {
        toast({
          title: "Success!",
          description: `Added ${successCount} member${successCount > 1 ? 's' : ''} to the team.`,
        });

        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: [`/teams/${teamId}/members`] });

        // Close the modal
        form.reset();
        onClose();
        setSearchQuery('');
        setShowDropdown(false);
      } else {
        toast({
          title: "Error",
          description: "Failed to add members to the team.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding team members:", error);
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Add Team Members</span>
            <Button variant="ghost" className="h-6 w-6 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Search Input */}
            <FormItem>
              <FormLabel className="text-sm font-medium">Search Members</FormLabel>
              <FormControl>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onKeyDown={(e) => {
                      if (!showDropdown || filteredUsers.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightedIndex((prev) => Math.min(prev + 1, filteredUsers.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredUsers[highlightedIndex]) {
                          toggleUserSelection(filteredUsers[highlightedIndex].id);
                        }
                      }
                    }}
                    className="pl-10"
                  />
                </div>
              </FormControl>
            </FormItem>

            {/* User Selection Dropdown */}
            {showDropdown && (
              <div className="border rounded-lg bg-white shadow-md" ref={dropdownRef}>
                <ScrollArea className="h-[250px]">
                  {filteredUsers.length > 0 ? (
                    <div className="p-2">
                      {filteredUsers.map((user, idx) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleUserSelection(user.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg mb-1 transition ${highlightedIndex === idx ? 'bg-neutral-200 ring-2 ring-blue-600' : 'hover:bg-neutral-100'}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback className="text-xs">
                                {user.fullName?.split(' ').map((n) => n[0]).join('') || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-left min-w-0">
                              <div className="text-sm font-medium truncate">{user.fullName}</div>
                              <div className="text-xs text-neutral-500 truncate">{user.email}</div>
                            </div>
                          </div>
                          {selectedUsers.includes(user.id) && (
                            <Check className="h-4 w-4 text-green-600 flex-shrink-0 ml-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-neutral-500">
                      {searchQuery ? 'No users found' : 'Type to search members'}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            {/* Selected Users List */}
            {selectedUserDetails.length > 0 && (
              <div className="border rounded-lg p-3 bg-blue-50">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  {selectedUserDetails.length} user{selectedUserDetails.length !== 1 ? 's' : ''} selected
                </p>
                <div className="space-y-2">
                  {selectedUserDetails.map((user) => (
                    <div key={user.id} className="flex items-center justify-between bg-white p-2 rounded border border-blue-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-6 w-6 flex-shrink-0">
                          <AvatarFallback className="text-xs">
                            {user.fullName?.split(' ').map((n) => n[0]).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">{user.fullName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleUserSelection(user.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || selectedUsers.length === 0}>
                {loading ? "Adding..." : "Add Members"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}