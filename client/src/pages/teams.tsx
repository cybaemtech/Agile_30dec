import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TeamCard } from "@/components/teams/team-card";
import { CreateTeam } from "@/components/teams/create-team";
import { InviteModal } from "@/components/modals/invite-modal";
import { ManageTeamModal } from "@/components/modals/manage-team-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  PlusCircle, 
  Search, 
  UserPlus, 
  Settings, 
  UserRound 
} from "lucide-react";
import { apiGet } from "@/lib/api-config";
import { Team, User, Project } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Simplified TeamCard component with proper member fetching
function SimpleTeamCard({ 
  team, 
  creator, 
  projectCount,
  currentUser,
  users
}: { 
  team: Team; 
  creator?: User; 
  projectCount: number; 
  currentUser?: User;
  users: User[];
}) {
  const { toast } = useToast();
  
  // Fetch team members for this specific team
  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: [`/teams/${team.id}/members`],
    queryFn: () => apiGet(`/teams/${team.id}/members`),
    staleTime: 30000, // Cache for 30 seconds
  });

  const { refetch: refetchTeams } = useQuery<Team[]>({
    queryKey: ['/teams'],
    queryFn: () => apiGet('/teams'),
  });

  const handleTeamDeleted = () => {
    refetchTeams();
    toast({
      title: "Success",
      description: "Team deleted successfully",
    });
  };

  const handleMembersChange = () => {
    // This will trigger a refetch of team members
    queryClient.invalidateQueries({ queryKey: [`/teams/${team.id}/members`] });
  };

  // Extract user data from team members robustly
  let memberUsers: User[] = [];
  if (Array.isArray(teamMembers) && users) {
    memberUsers = teamMembers
      .map((member) => {
        const userId = member.user?.id ?? member.user_id;
        const user = users.find((u) => u.id === userId);
        if (user && (user.isActive === undefined || user.isActive)) {
          return user;
        }
        return undefined;
      })
      .filter((user): user is User => !!user);
  }

  return (
    <TeamCard
      team={team}
      creator={creator}
      members={memberUsers}
      projectCount={projectCount}
      onMembersChange={handleMembersChange}
      onTeamDeleted={handleTeamDeleted}
      currentUser={currentUser}
    />
  );
}

export default function Teams() {
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [showManageTeam, setShowManageTeam] = useState(false);
  const { modalType, openModal, closeModal, isOpen } = useModal();
  
  // Fetch current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/auth/user'],
    queryFn: () => apiGet('/auth/user'),
  });
  
  // Fetch teams
  const { data: teams = [], refetch: refetchTeams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ['/teams'],
    queryFn: () => apiGet('/teams'),
  });
  
  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/projects'],
    queryFn: () => apiGet('/projects'),
  });
  
  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/users'],
    queryFn: () => apiGet('/users'),
  });

  const isAdminOrScrum = currentUser?.role === 'ADMIN' || currentUser?.role === 'SCRUM_MASTER';

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(u => {
    const searchLower = userSearchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(searchLower) ||
      u.email.toLowerCase().includes(searchLower) ||
      u.username.toLowerCase().includes(searchLower) ||
      u.role.toLowerCase().includes(searchLower)
    );
  });

  const activeUsers = filteredUsers.filter(u => u.isActive);
  const inactiveUsers = filteredUsers.filter(u => !u.isActive);

  const toggleUserStatus = async (user: User) => {
    try {
      const response = await fetch(`/Agile/api/users/${user.id}/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ isActive: !user.isActive })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update status');
      }
      
      queryClient.invalidateQueries({ queryKey: ['/users'] });
      toast({
        title: "Status Updated",
        description: `${user.fullName} is now ${!user.isActive ? 'active' : 'inactive'}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not update user status.",
        variant: "destructive"
      });
    }
  };

  const UserCard = ({ user }: { user: User }) => (
    <Card 
      className="mb-3 hover:bg-accent/50 transition-colors cursor-pointer border shadow-sm bg-background"
      onClick={() => isAdminOrScrum && toggleUserStatus(user)}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-12 w-12 border">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/5 text-primary font-bold">
                {user.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className={cn(
              "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
              user.isActive ? "bg-green-500" : "bg-gray-400"
            )} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-tight text-foreground">{user.fullName}</span>
            <span className="text-sm text-muted-foreground">{user.email}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {isAdminOrScrum && (
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "text-xs font-semibold px-3 py-1 rounded-full",
                user.isActive ? "text-red-500 hover:text-red-600 hover:bg-red-50" : "text-green-500 hover:text-green-600 hover:bg-green-50"
              )}
            >
              {user.isActive ? "Deactivate" : "Activate"}
            </Button>
          )}
          <Badge variant="secondary" className="font-semibold px-4 py-1.5 rounded-full bg-muted/50 text-muted-foreground border-none">
            {user.role}
          </Badge>
          <UserRound className="h-5 w-5 text-muted-foreground/40" />
        </div>
      </CardContent>
    </Card>
  );

  if (teamsLoading || projectsLoading || usersLoading) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar user={currentUser} teams={teams} projects={projects} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header user={currentUser} onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
          <main className="flex-1 overflow-auto p-6">
            <Skeleton className="h-12 w-48 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        user={currentUser}
        teams={teams}
        projects={projects}
        onCreateTeam={isAdminOrScrum ? () => openModal("createTeam") : undefined}
        onCreateProject={isAdminOrScrum ? () => openModal("createProject") : undefined}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={currentUser} onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="mb-4">
              <h1 className="text-2xl font-semibold mb-1">Team Management</h1>
              <p className="text-neutral-600 text-sm">Manage your teams, members, and organizational users</p>
            </div>

            <Tabs defaultValue="teams" className="w-full">
              <TabsList className="bg-muted/30 p-1 mb-4">
                <TabsTrigger value="teams" className="px-8 py-2">
                  <Users className="h-4 w-4 mr-2" />
                  Teams ({teams.length})
                </TabsTrigger>
                {isAdminOrScrum && (
                  <TabsTrigger value="users" className="px-8 py-2">
                    <UserRound className="h-4 w-4 mr-2" />
                    All Users ({users.length})
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="teams" className="focus-visible:outline-none">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <Input
                      className="pl-9 w-[300px]"
                      placeholder="Search teams..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    {isAdminOrScrum && (
                      <Button variant="outline" onClick={() => openModal("inviteMembers")}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite
                      </Button>
                    )}
                    {isAdminOrScrum && (
                      <Button onClick={() => openModal("createTeam")}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        New Team
                      </Button>
                    )}
                  </div>
                </div>

                {filteredTeams.length === 0 ? (
                  <div className="text-center py-20 bg-muted/5 rounded-xl border border-dashed">
                    <Users className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No teams found</h3>
                    <p className="text-neutral-500">Try adjusting your search query</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTeams.map(team => (
                      <SimpleTeamCard
                        key={team.id}
                        team={team}
                        creator={users.find(u => u.id === team.createdBy)}
                        projectCount={projects.filter(p => p.teamId === team.id).length}
                        currentUser={currentUser}
                        users={users}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="users" className="focus-visible:outline-none">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div className="flex gap-4 text-sm font-medium">
                    <span className="text-muted-foreground">Active: <span className="text-foreground font-bold">{users.filter(u => u.isActive).length}</span></span>
                    <span className="text-muted-foreground">Inactive: <span className="text-foreground font-bold">{users.filter(u => !u.isActive).length}</span></span>
                  </div>
                  <div className="relative w-full md:w-[400px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search users..." 
                      className="pl-10 bg-background"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <Tabs defaultValue="all_list" className="w-full">
                    <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 mb-6">
                      <TabsTrigger value="all_list" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
                        All ({filteredUsers.length})
                      </TabsTrigger>
                      <TabsTrigger value="active_list" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
                        Active ({activeUsers.length})
                      </TabsTrigger>
                      <TabsTrigger value="inactive_list" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">
                        Inactive ({inactiveUsers.length})
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="all_list" className="space-y-3">
                      {filteredUsers.map(user => <UserCard key={user.id} user={user} />)}
                    </TabsContent>
                    
                    <TabsContent value="active_list" className="space-y-3">
                      {activeUsers.map(user => <UserCard key={user.id} user={user} />)}
                    </TabsContent>
                    
                    <TabsContent value="inactive_list" className="space-y-3">
                      {inactiveUsers.map(user => <UserCard key={user.id} user={user} />)}
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <CreateTeam
        isOpen={isOpen && modalType === "createTeam"}
        onClose={closeModal}
        onSuccess={(team) => { refetchTeams(); return team; }}
        userId={currentUser?.id || 1}
      />
      
      <InviteModal
        isOpen={isOpen && modalType === "inviteMembers"}
        onClose={closeModal}
        teams={teams}
        onCreateTeam={async (name) => { refetchTeams(); return { name } as any; }}
      />

      <ManageTeamModal
        isOpen={showManageTeam}
        onClose={() => setShowManageTeam(false)}
      />
    </div>
  );
}
