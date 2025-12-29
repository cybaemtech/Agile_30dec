import React from "react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Mail, Calendar, Shield, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/data-utils";
import { apiRequest, apiGet } from "@/lib/api-config";
import { User, Team, Project } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { AddTeamMembersModal } from "@/components/modals/add-team-members-modal";


// Helper function to determine base path for links
const getBasePath = () => {
  if (typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/Agile/') || window.location.pathname === '/Agile')) {
    return '/Agile';
  }
  return '';
};

export default function TeamDetails() {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Extract team ID from the current location
  const teamId = location.split('/').pop();
  const teamIdNum = teamId ? parseInt(teamId) : 0;
  const basePath = getBasePath();

  console.log('Team Details - Location:', location, 'Team ID:', teamId);

  // Fetch current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/auth/user'],
    queryFn: () => apiGet('/auth/user'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch teams
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/teams'],
    queryFn: () => apiGet('/teams'),
  });

  // Fetch team details
  const { data: team } = useQuery<Team>({
    queryKey: ['/teams', teamId],
    queryFn: () => apiGet(`/teams/${teamId}`),
    enabled: !!teamId,
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/projects'],
    queryFn: () => apiGet('/projects'),
  });

  // Fetch users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/users'],
    queryFn: () => apiGet('/users'),
  });

  // Fetch team members
  const { data: teamMembers = [], isLoading: isLoadingMembers } = useQuery<any[]>({
    queryKey: [`/teams/${teamId}/members`],
    queryFn: () => apiGet(`/teams/${teamId}/members`),
    enabled: !!teamId,
    staleTime: 30 * 1000, // 30 seconds - refresh frequently to catch changes from project settings
    refetchOnWindowFocus: true, // Refresh when user switches back to this tab
  });

  // Get team projects, but only show projects where current user is assigned (or is Admin/Scrum Master)
  // isAdminOrScrum is declared below and used for both team and project access control
  // Assume each project has a 'members' array or fetch members for each project if needed
  const [projectMemberships, setProjectMemberships] = useState<{ [projectId: number]: boolean }>({});
  React.useEffect(() => {
    if (!currentUser || projects.length === 0) return;
    const fetchMemberships = async () => {
      const memberships: { [projectId: number]: boolean } = {};
      await Promise.all(projects.map(async (project) => {
        if (project.teamId !== teamIdNum) return;
        try {
          // Always fetch members from API (since project.members is not in type)
          let members: any[] = [];
          try {
            members = await apiGet(`/projects/${project.id}/members`);
          } catch {
            members = [];
          }
          memberships[project.id] = members.some((m: any) => m.user?.id === currentUser.id || m.id === currentUser.id);
        } catch {
          memberships[project.id] = false;
        }
      }));
      setProjectMemberships(memberships);
    };
    fetchMemberships();
  }, [projects, currentUser, teamIdNum]);

  // ...existing code...



  // Only assigned members, Admin, or Scrum can see the team
  const isAssignedMember = teamMembers.some((m: any) => m.user?.id === currentUser?.id);
  const isAdminOrScrum = currentUser?.role === 'ADMIN' || currentUser?.role === 'SCRUM_MASTER';
  // Admins/Scrum Masters see all team projects, others only those where they are assigned
  const teamProjects = projects.filter((project: Project) => {
    if (project.teamId !== teamIdNum) return false;
    if (isAdminOrScrum) return true;
    return projectMemberships[project.id];
  });

  if (!isAssignedMember && !isAdminOrScrum) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You are not assigned to this team and do not have permission to view its details.</p>
          <Button onClick={() => setLocation('/teams')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Teams
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-50">
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
        <main className="flex-1 overflow-auto p-6">
          <div className="flex items-center mb-6">
            <Button
              variant="ghost"
              className="mr-6 font-medium"
              onClick={() => setLocation('/teams')}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to teams
            </Button>
            {team && <h1 className="text-2xl font-bold">{team.name}</h1>}
          </div>
          {/* ...existing cards and dialogs... */}
          {!team ? (
            <div className="text-center py-12">
              <div className="animate-pulse">
                <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-4"></div>
                <div className="h-4 w-64 bg-gray-200 rounded mx-auto"></div>
              </div>
              <p className="text-gray-600 mt-4">Loading team details...</p>
              {teamId && (
                <p className="text-sm text-gray-500 mt-2">Team ID: {teamId}</p>
              )}
            </div>
          ) : (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="invitees">Invitees & Access</TabsTrigger>
                <TabsTrigger value="projects">Projects</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="w-full flex flex-col md:flex-row gap-6">
                  {/* Team info card */}
                  <Card className="flex-1 min-w-[280px] max-w-[400px]">
                    <CardHeader>
                      <CardTitle className="text-xl">Team Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-neutral-500">Description</h3>
                          <p className="mt-1">{team.description || "No description provided"}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-neutral-500">Created</h3>
                          <p className="mt-1">{formatDate(team.createdAt)}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-neutral-500">Team Lead</h3>
                          <div className="flex items-center mt-1">
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarFallback>
                                {team.createdBy && users.length > 0
                                  ? users.find(u => u.id === team.createdBy)?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'TL'
                                  : currentUser?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'TL'}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {team.createdBy && users.length > 0
                                ? users.find(u => u.id === team.createdBy)?.fullName || 'Team Lead'
                                : currentUser?.fullName || 'Team Lead'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-neutral-500">Total Members</h3>
                          <p className="mt-1 text-lg font-semibold">{teamMembers.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Members Tab */}
              <TabsContent value="members">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-xl flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      Team Members
                    </CardTitle>
                    <Button onClick={() => setShowAddMembersModal(true)}>
                      Add New Member
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {isLoadingMembers ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-neutral-500">Loading team members...</p>
                      </div>
                    ) : teamMembers.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-neutral-500">No team members added yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {teamMembers.map((member: any) => (
                          <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-center flex-1 min-w-0 gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {member.user?.fullName?.split(' ').map((n: string) => n[0]).join('') ||
                                    member.user?.username?.substring(0, 2)?.toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium">
                                  {member.user?.fullName || member.user?.username || 'Unknown User'}
                                </div>
                                <div className="text-sm text-neutral-500 flex items-center">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {member.user?.email}
                                </div>
                              </div>
                            </div>
                            <Badge variant="secondary" className="ml-2">
                              {member.role || 'MEMBER'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Invitees & Access Tab */}
              <TabsContent value="invitees">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center">
                      <Shield className="h-5 w-5 mr-2" />
                      Invitees & Access Levels
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Team Level Access */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Lock className="h-4 w-4 mr-2 text-blue-600" />
                          Team Level Access
                        </h3>
                        {teamMembers.length === 0 ? (
                          <p className="text-sm text-neutral-500 bg-gray-50 p-4 rounded">
                            No team members yet. Members get access to this team and all associated projects.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {teamMembers.map((member: any) => (
                              <div key={member.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7">
                                    <AvatarFallback className="text-xs">
                                      {member.user?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium text-sm">
                                      {member.user?.fullName || member.user?.username}
                                    </div>
                                    <div className="text-xs text-neutral-600">
                                      {member.user?.email}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Badge className="bg-blue-600">Team: {member.role || 'MEMBER'}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Project Level Access */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Lock className="h-4 w-4 mr-2 text-purple-600" />
                          Project Level Access
                        </h3>
                        {teamProjects.length === 0 ? (
                          <p className="text-sm text-neutral-500 bg-gray-50 p-4 rounded">
                            No projects assigned to this team yet.
                          </p>
                        ) : (
                          <div className="space-y-4">
                            {teamProjects.map((project: any) => (
                              <div key={project.id} className="border rounded-lg p-4 bg-purple-50 border-purple-200">
                                <div className="font-semibold text-sm mb-2 flex items-center">
                                  <Calendar className="h-4 w-4 mr-2" />
                                  {project.name} ({project.key})
                                </div>
                                <div className="space-y-2">
                                  {teamMembers.length > 0 ? (
                                    teamMembers.map((member: any) => (
                                      <div key={`${member.id}-${project.id}`} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">
                                          {member.user?.fullName || member.user?.username}
                                        </span>
                                        <Badge variant="outline" className="bg-purple-100 border-purple-300">
                                          Project: {member.role || 'MEMBER'}
                                        </Badge>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-xs text-neutral-500">No members in this team</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Access Summary */}
                      <div className="mt-6 pt-4 border-t">
                        <h4 className="font-semibold text-sm mb-3">Access Summary</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div className="bg-blue-50 p-3 rounded border border-blue-200">
                            <div className="font-medium text-blue-900">Team Members</div>
                            <div className="text-2xl font-bold text-blue-600">{teamMembers.length}</div>
                          </div>
                          <div className="bg-purple-50 p-3 rounded border border-purple-200">
                            <div className="font-medium text-purple-900">Associated Projects</div>
                            <div className="text-2xl font-bold text-purple-600">{teamProjects.length}</div>
                          </div>
                          <div className="bg-green-50 p-3 rounded border border-green-200">
                            <div className="font-medium text-green-900">Total Access Points</div>
                            <div className="text-2xl font-bold text-green-600">{teamMembers.length * (teamProjects.length + 1)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value="projects">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-xl">Team Projects</CardTitle>
                    <Calendar className="h-4 w-4 text-neutral-500" />
                  </CardHeader>
                  <CardContent>
                    {teamProjects.length === 0 ? (
                      <p className="text-neutral-500">No projects assigned to this team</p>
                    ) : (
                      <div className="space-y-3">
                        {teamProjects.map((project: any) => (
                          <div key={project.id} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition" onClick={() => setLocation(`/projects/${project.id}`)}>
                            <a
                              href={`/projects/${project.id}`}
                              className="font-medium text-primary hover:underline text-base block mb-1"
                              onClick={(e) => {
                                e.preventDefault();
                                setLocation(`/projects/${project.id}`);
                              }}
                            >
                              {project.name}
                            </a>
                            <div className="text-sm text-neutral-500 flex items-center gap-2">
                              <Badge variant="outline">{project.key}</Badge>
                              <Badge variant="secondary">{project.status}</Badge>
                            </div>
                            {project.description && (
                              <p className="text-sm text-neutral-600 mt-2">{project.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>

      <AddTeamMembersModal
        isOpen={showAddMembersModal}
        onClose={() => setShowAddMembersModal(false)}
        projectId={0}
        teamId={teamIdNum}
      />
    </div>
  );
}