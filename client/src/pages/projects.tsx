import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateProject } from "@/components/projects/create-project";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal";
import { useToast } from "@/hooks/use-toast";
import { Layers, PlusCircle, Search, Folder, Archive, ListTodo, Filter, X, CheckCircle, AlertTriangle, Clock, Users } from "lucide-react";
import { calculateProjectStats } from "@/lib/data-utils";
import { apiGet } from "@/lib/api-config";
import { User, Team, Project, WorkItem } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
export default function Projects() {
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "dailyStandup">("active");
  const [viewMode, setViewMode] = useState<"card" | "table">("table");

  // Daily Standup Filters - Changed to arrays for multi-select
  const [standupStatusFilter, setStandupStatusFilter] = useState<string[]>([]);
  const [standupPriorityFilter, setStandupPriorityFilter] = useState<string[]>([]);
  const [standupTypeFilter, setStandupTypeFilter] = useState<string[]>([]);
  const [standupAssigneeFilter, setStandupAssigneeFilter] = useState<string[]>([]);
  const [standupProjectFilter, setStandupProjectFilter] = useState<string[]>([]);

  const {
    modalType,
    isOpen,
    openModal,
    closeModal
  } = useModal();

  // Fetch all users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/users'],
    queryFn: () => apiGet('/users'),
  });

  // Fetch authenticated user
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/auth/user'],
    queryFn: () => apiGet('/auth/user'),
  });

  // Debug: Log current user and users
  console.log('Current user:', currentUser);
  console.log('All users:', users);

  // Fetch teams
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/teams'],
    queryFn: () => apiGet('/teams'),
  });

  // Fetch projects
  const { data: projects = [], refetch: refetchProjects } = useQuery<Project[]>({
    queryKey: ['/projects'],
    queryFn: () => apiGet('/projects'),
  });

  // Debug: Log projects to see what we're getting
  console.log('Projects fetched:', projects);

  // Fetch work items for all projects
  const { data: allWorkItems = [] } = useQuery<WorkItem[]>({
    queryKey: ['/work-items/all'],
    queryFn: async () => {
      if (!projects.length) return [];

      const workItemPromises = projects.map(async (project: Project) => {
        try {
          const items = await apiGet(`/projects/${project.id}/work-items`);
          return items.map((item: WorkItem) => ({
            ...item,
            projectKey: project.key,
            projectName: project.name
          }));
        } catch {
          return [];
        }
      });

      const results = await Promise.all(workItemPromises);
      return results.flat();
    },
    enabled: projects.length > 0,
  });

  const handleProjectSuccess = () => {
    refetchProjects();
    toast({
      title: "Success",
      description: "Project created successfully",
    });
  };

  // Build a map of teamId -> member user IDs by fetching from API
  const [teamMembersByTeamId, setTeamMembersByTeamId] = useState<Record<number, number[]>>({});
  React.useEffect(() => {
    if (!teams.length) return;
    const fetchAllTeamMembers = async () => {
      const map: Record<number, number[]> = {};
      await Promise.all(teams.map(async (team) => {
        try {
          const members = await apiGet(`/teams/${team.id}/members`);
          map[team.id] = members.map((m: any) => m.user?.id || m.id);
        } catch {
          map[team.id] = [];
        }
      }));
      setTeamMembersByTeamId(map);
    };
    fetchAllTeamMembers();
  }, [teams]);
  function teamMembersOf(teamId: number): number[] {
    return teamMembersByTeamId[teamId] || [];
  }

  // TEMPORARY FIX: Allow all authenticated users access for testing
  const isAdminOrScrum = currentUser?.role === 'ADMIN' || currentUser?.role === 'SCRUM_MASTER';
  const canCreateProject = currentUser?.role === 'ADMIN' || currentUser?.role === 'SCRUM_MASTER';

  // Reset all daily standup filters
  const resetStandupFilters = () => {
    setStandupStatusFilter([]);
    setStandupPriorityFilter([]);
    setStandupTypeFilter([]);
    setStandupAssigneeFilter([]);
    setStandupProjectFilter([]);
  };

  // Check if any standup filter is active
  const hasActiveStandupFilters = standupStatusFilter.length > 0 ||
    standupPriorityFilter.length > 0 ||
    standupTypeFilter.length > 0 ||
    standupAssigneeFilter.length > 0 ||
    standupProjectFilter.length > 0;

  const filteredProjects = projects.filter((project: Project) => {
    // Apply search filter
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.key && project.key.toLowerCase().includes(searchQuery.toLowerCase()));

    // For daily standup, filter based on team membership
    if (statusFilter === "dailyStandup") {
      const isActive = project.status !== 'ARCHIVED';
      if (!isActive || !matchesSearch) return false;

      // Admins and Scrum Masters can see all projects
      if (isAdminOrScrum) {
        return true;
      }
      // Only show if user is assigned as a member of the project's team
      const isTeamMember = currentUser && project.teamId && teamMembersOf(project.teamId).includes(currentUser.id);
      return isTeamMember;
    }

    // Apply status filter for regular project views
    const matchesStatusFilter = statusFilter === "active"
      ? project.status !== 'ARCHIVED'
      : project.status === 'ARCHIVED';

    if (!matchesStatusFilter || !matchesSearch) return false;

    // Admins and Scrum Masters can see all projects
    if (isAdminOrScrum) {
      return true;
    }

    // Only show if user is assigned as a member of the project's team
    const isTeamMember = currentUser && project.teamId && teamMembersOf(project.teamId).includes(currentUser.id);
    return isTeamMember;
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        user={currentUser}
        teams={teams}
        projects={projects}
        onCreateTeam={isAdminOrScrum ? () => openModal("createTeam") : undefined}
        onCreateProject={canCreateProject ? () => openModal("createProject") : undefined}
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
        <Header
          user={currentUser}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-semibold mb-1">Projects</h1>
                <p className="text-neutral-600">Manage and monitor all your projects</p>
              </div>
              <div className="flex space-x-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <Input
                    className="pl-9 w-[240px]"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {canCreateProject && (
                  <Button onClick={() => openModal("createProject")}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                )}
              </div>
            </div>

            {/* Project Information Section */}
           

            {/* Status Filter Tabs + View Toggle */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter("active")}
                className={`px-4 py-2 rounded-md transition-all duration-200 ${statusFilter === "active"
                  ? "bg-white shadow-sm text-gray-900 font-medium"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                  }`}
                data-testid="button-active-projects"
              >
                <Folder className="h-4 w-4 mr-2" />
                Active Projects
              </Button>
              {isAdminOrScrum && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter("archived")}
                  className={`px-4 py-2 rounded-md transition-all duration-200 ${statusFilter === "archived"
                    ? "bg-white shadow-sm text-gray-900 font-medium"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                    }`}
                  data-testid="button-archived-projects"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archived Projects
                </Button>
              )}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                >
                  Table
                </Button>
                <Button
                  variant={viewMode === "card" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                >
                  Cards
                </Button>
              </div>
            </div>

            {/* Daily Standup View */}
            {statusFilter === "dailyStandup" ? (
              <div className="space-y-6">
                {/* Filters Section */}
                <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-neutral-600" />
                      <h3 className="font-medium text-neutral-900">Filters</h3>
                    </div>
                    {hasActiveStandupFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetStandupFilters}
                        className="text-sm"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear All
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Project Filter */}
                    <div>
                      <label className="text-sm font-medium text-neutral-700 mb-1 block">Project</label>
                      <MultiSelect
                        value={standupProjectFilter}
                        onChange={setStandupProjectFilter}
                        options={filteredProjects.map(project => ({
                          value: project.id.toString(),
                          label: `[${project.key}] ${project.name}`,
                          searchFields: [project.key, project.name]
                        }))}
                        placeholder="All Projects"
                        searchPlaceholder="Search by project key or name..."
                        maxDisplay={1}
                      />
                    </div>

                    {/* Status Filter */}
                    <div>
                      <label className="text-sm font-medium text-neutral-700 mb-1 block">Status</label>
                      <MultiSelect
                        value={standupStatusFilter}
                        onChange={setStandupStatusFilter}
                        options={[
                          { value: "TODO", label: "TODO" },
                          { value: "IN_PROGRESS", label: "IN PROGRESS" },
                          { value: "ON_HOLD", label: "ON HOLD" },
                          { value: "DONE", label: "DONE" }
                        ]}
                        placeholder="All Statuses"
                        searchPlaceholder="Search statuses..."
                        maxDisplay={1}
                      />
                    </div>

                    {/* Priority Filter */}
                    <div>
                      <label className="text-sm font-medium text-neutral-700 mb-1 block">Priority</label>
                      <MultiSelect
                        value={standupPriorityFilter}
                        onChange={setStandupPriorityFilter}
                        options={[
                          { value: "LOW", label: "LOW" },
                          { value: "MEDIUM", label: "MEDIUM" },
                          { value: "HIGH", label: "HIGH" },
                          { value: "CRITICAL", label: "CRITICAL" }
                        ]}
                        placeholder="All Priorities"
                        searchPlaceholder="Search priorities..."
                        maxDisplay={1}
                      />
                    </div>

                    {/* Type Filter */}
                    <div>
                      <label className="text-sm font-medium text-neutral-700 mb-1 block">Type</label>
                      <MultiSelect
                        value={standupTypeFilter}
                        onChange={setStandupTypeFilter}
                        options={[
                          { value: "TASK", label: "TASK" },
                          { value: "BUG", label: "BUG" }
                        ]}
                        placeholder="All Types"
                        searchPlaceholder="Search types..."
                        maxDisplay={1}
                      />
                    </div>

                    {/* Assignee Filter */}
                    <div>
                      <label className="text-sm font-medium text-neutral-700 mb-1 block">Assignee</label>
                      <MultiSelect
                        value={standupAssigneeFilter}
                        onChange={setStandupAssigneeFilter}
                        options={[
                          { value: "unassigned", label: "Unassigned" },
                          ...users.map(user => ({
                            value: user.id.toString(),
                            label: user.fullName
                          }))
                        ]}
                        placeholder="All Assignees"
                        searchPlaceholder="Search assignees..."
                        maxDisplay={1}
                      />
                    </div>
                  </div>
                </div>

                {(() => {
                  // Calculate overall statistics for all filtered items
                  const allFilteredItems = filteredProjects.flatMap((project: Project) => {
                    let tasksAndBugs = allWorkItems.filter(
                      item => item.projectId === project.id && (item.type === 'TASK' || item.type === 'BUG')
                    );

                    // Apply filters
                    if (standupProjectFilter.length > 0 && !standupProjectFilter.includes(project.id.toString())) {
                      return [];
                    }

                    tasksAndBugs = tasksAndBugs.filter(item => {
                      if (standupStatusFilter.length > 0 && !standupStatusFilter.includes(item.status)) return false;
                      if (standupPriorityFilter.length > 0 && (!item.priority || !standupPriorityFilter.includes(item.priority))) return false;
                      if (standupTypeFilter.length > 0 && !standupTypeFilter.includes(item.type)) return false;
                      if (standupAssigneeFilter.length > 0) {
                        if (standupAssigneeFilter.includes("unassigned") && item.assigneeId !== null) {
                          if (!item.assigneeId || !standupAssigneeFilter.includes(item.assigneeId.toString())) return false;
                        } else if (!standupAssigneeFilter.includes("unassigned")) {
                          if (!item.assigneeId || !standupAssigneeFilter.includes(item.assigneeId.toString())) return false;
                        } else {
                          if (item.assigneeId !== null && !standupAssigneeFilter.includes(item.assigneeId.toString())) return false;
                        }
                      }
                      return true;
                    });

                    return tasksAndBugs;
                  });

                  const totalItems = allFilteredItems.length;
                  const totalTasks = allFilteredItems.filter(i => i.type === 'TASK').length;
                  const totalBugs = allFilteredItems.filter(i => i.type === 'BUG').length;

                  const statusCounts = {
                    TODO: allFilteredItems.filter(i => i.status === 'TODO').length,
                    IN_PROGRESS: allFilteredItems.filter(i => i.status === 'IN_PROGRESS').length,
                    ON_HOLD: allFilteredItems.filter(i => i.status === 'ON_HOLD').length,
                    DONE: allFilteredItems.filter(i => i.status === 'DONE').length,
                  };

                  const priorityCounts = {
                    CRITICAL: allFilteredItems.filter(i => i.type === 'BUG' && i.priority === 'CRITICAL').length,
                    HIGH: allFilteredItems.filter(i => i.type === 'BUG' && i.priority === 'HIGH').length,
                    MEDIUM: allFilteredItems.filter(i => i.type === 'BUG' && i.priority === 'MEDIUM').length,
                    LOW: allFilteredItems.filter(i => i.type === 'BUG' && i.priority === 'LOW').length,
                  };

                  const totalHours = allFilteredItems.reduce((sum, item) => sum + (item.estimate ? Number(item.estimate) : 0), 0);


                  return (
                    <>
                      {/* Visual Statistics Section */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Items Card */}
                        <div className="bg-white border border-gray-300 rounded-md p-3 shadow-sm hover:shadow-md transition-all duration-300">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-[10px] font-semibold text-black uppercase tracking-wide">Total Items</h3>
                            <ListTodo className="h-4 w-4 text-black" />
                          </div>
                          <p className="text-2xl font-bold text-black">{totalItems}</p>
                          <div className="flex gap-1 mt-1.5 text-[10px]">
                            <span className="text-black px-1.5 py-0.5 rounded font-medium" style={{backgroundColor: '#f3f4f6'}}>Tasks: {totalTasks}</span>
                            <span className="text-black px-1.5 py-0.5 rounded font-medium" style={{backgroundColor: '#f3f4f6'}}>Bugs: {totalBugs}</span>
                          </div>
                        </div>

                        {/* Status Breakdown Card */}
                        <div className="bg-white border border-emerald-200 rounded-md p-3 shadow-sm hover:shadow-md transition-all duration-300">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">By Status</h3>
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 mt-1.5 text-[10px]">
                            <div className="bg-emerald-50 px-1.5 py-1.5 rounded">
                              <div className="font-bold text-lg text-emerald-700">{statusCounts.DONE}</div>
                              <div className="text-emerald-600 text-[9px] font-medium">Done</div>
                            </div>
                            <div className="bg-sky-50 px-1.5 py-1.5 rounded">
                              <div className="font-bold text-lg text-sky-700">{statusCounts.IN_PROGRESS}</div>
                              <div className="text-sky-600 text-[9px] font-medium">In Progress</div>
                            </div>
                            <div className="bg-gray-50 px-1.5 py-1.5 rounded">
                              <div className="font-bold text-lg text-gray-600">{statusCounts.TODO}</div>
                              <div className="text-gray-600 text-[9px] font-medium">To Do</div>
                            </div>
                            <div className="bg-amber-50 px-1.5 py-1.5 rounded">
                              <div className="font-bold text-lg text-amber-700">{statusCounts.ON_HOLD}</div>
                              <div className="text-amber-600 text-[9px] font-medium">On Hold</div>
                            </div>
                          </div>
                        </div>

                        {/* Bug Priority Card */}
                        <div className="bg-white border border-rose-200 rounded-md p-3 shadow-sm hover:shadow-md transition-all duration-300">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-[10px] font-semibold text-rose-700 uppercase tracking-wide">Bug Priority</h3>
                            <AlertTriangle className="h-4 w-4 text-rose-500" />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 mt-1.5 text-[10px]">
                            <div className="bg-rose-50 px-1.5 py-1.5 rounded">
                              <div className="font-bold text-lg text-rose-700">{priorityCounts.CRITICAL}</div>
                              <div className="text-rose-600 text-[9px] font-medium">Critical</div>
                            </div>
                            <div className="bg-orange-50 px-1.5 py-1.5 rounded">
                              <div className="font-bold text-lg text-orange-700">{priorityCounts.HIGH}</div>
                              <div className="text-orange-600 text-[9px] font-medium">High</div>
                            </div>
                            <div className="bg-yellow-50 px-1.5 py-1.5 rounded">
                              <div className="font-bold text-lg text-yellow-700">{priorityCounts.MEDIUM}</div>
                              <div className="text-yellow-600 text-[9px] font-medium">Medium</div>
                            </div>
                            <div className="bg-emerald-50 px-1.5 py-1.5 rounded">
                              <div className="font-bold text-lg text-emerald-700">{priorityCounts.LOW}</div>
                              <div className="text-emerald-600 text-[9px] font-medium">Low</div>
                            </div>
                          </div>
                        </div>

                        {/* Total Hours Card */}
                        <div className="bg-white border border-black-200 rounded-md p-3 shadow-sm hover:shadow-md transition-all duration-300">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-[10px] font-semibold text-black-700 uppercase tracking-wide">Estimated Hours</h3>
                            <Clock className="h-4 w-4 text-black-500" />
                          </div>
                          <p className="text-2xl font-bold text-black-700">{totalHours.toFixed(1)}</p>
                          <p className="text-[10px] text-black-600 mt-1.5 font-medium">Total estimated work hours</p>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {filteredProjects.length === 0 ? (
                  <div className="text-center py-12">
                    <ListTodo className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No active projects found</h3>
                    <p className="text-neutral-500 mb-4">
                      {searchQuery
                        ? "Try adjusting your search query"
                        : "No active projects available for daily standup"}
                    </p>
                  </div>
                ) : (
                  filteredProjects.map((project: Project) => {
                    // Get tasks and bugs for this project
                    let tasksAndBugs = allWorkItems.filter(
                      item => item.projectId === project.id && (item.type === 'TASK' || item.type === 'BUG')
                    );

                    // Apply standup filters
                    if (standupProjectFilter.length > 0 && !standupProjectFilter.includes(project.id.toString())) {
                      return null;
                    }

                    tasksAndBugs = tasksAndBugs.filter(item => {
                      if (standupStatusFilter.length > 0 && !standupStatusFilter.includes(item.status)) return false;
                      if (standupPriorityFilter.length > 0 && (!item.priority || !standupPriorityFilter.includes(item.priority))) return false;
                      if (standupTypeFilter.length > 0 && !standupTypeFilter.includes(item.type)) return false;
                      if (standupAssigneeFilter.length > 0) {
                        if (standupAssigneeFilter.includes("unassigned") && item.assigneeId !== null) {
                          if (!item.assigneeId || !standupAssigneeFilter.includes(item.assigneeId.toString())) return false;
                        } else if (!standupAssigneeFilter.includes("unassigned")) {
                          if (!item.assigneeId || !standupAssigneeFilter.includes(item.assigneeId.toString())) return false;
                        } else {
                          if (item.assigneeId !== null && !standupAssigneeFilter.includes(item.assigneeId.toString())) return false;
                        }
                      }
                      return true;
                    });

                    if (tasksAndBugs.length === 0) return null;

                    const projectTasks = tasksAndBugs.filter(i => i.type === 'TASK');
                    const projectBugs = tasksAndBugs.filter(i => i.type === 'BUG');
                    const completedItems = tasksAndBugs.filter(i => i.status === 'DONE').length;
                    const inProgressItems = tasksAndBugs.filter(i => i.status === 'IN_PROGRESS').length;

                    return (
                      <div key={project.id} className="bg-white rounded-lg border-0 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                        {/* Project Header */}
                        <div className="bg-gray-100 px-4 py-2 text-black">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h2 className="text-sm font-medium truncate">{project.name}</h2>
                              <p className="text-[10px] opacity-80">Code: <span className="font-mono">{project.key}</span></p>
                            </div>
                            <div className="flex gap-1.5">
                              <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded text-center min-w-[45px]">
                                <div className="text-sm font-medium">{tasksAndBugs.length}</div>
                                <div className="text-[8px] opacity-80">Total</div>
                              </div>
                              <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded text-center min-w-[45px]">
                                <div className="text-sm font-medium">{completedItems}</div>
                                <div className="text-[8px] opacity-80">Done</div>
                              </div>
                              <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded text-center min-w-[45px]">
                                <div className="text-sm font-medium">{inProgressItems}</div>
                                <div className="text-[8px] opacity-80">Progress</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Items Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full" data-testid={`table-standup-${project.key}`}>
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider w-12">
                                  #
                                </th>
                                <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider" style={{ minWidth: '280px', maxWidth: '380px' }}>
                                  Task Title
                                </th>
                                <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider w-16">
                                  Type
                                </th>
                                <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider w-20">
                                  Priority
                                </th>
                                <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider w-16">
                                  EST Hr
                                </th>
                                <th className="px-3 py-1 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider w-24">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                              {tasksAndBugs.map((item: any, index) => {
                                const getStatusColor = (status: string) => {
                                  switch (status) {
                                    case 'TODO': return 'bg-gray-100 text-gray-700 border border-gray-200';
                                    case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700 border border-blue-200';
                                    case 'ON_HOLD': return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
                                    case 'DONE': return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
                                    default: return 'bg-gray-100 text-gray-700 border border-gray-200';
                                  }
                                };

                                const getPriorityColor = (priority: string) => {
                                  switch (priority) {
                                    case 'LOW': return 'bg-gray-100 text-gray-600 border border-gray-200';
                                    case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
                                    case 'HIGH': return 'bg-orange-100 text-orange-700 border border-orange-200';
                                    case 'CRITICAL': return 'bg-red-100 text-red-700 border border-red-200';
                                    default: return 'bg-gray-100 text-gray-600 border border-gray-200';
                                  }
                                };

                                const getTypeColor = (type: string) => {
                                  switch (type) {
                                    case 'TASK': return 'bg-blue-100 text-blue-700 border border-blue-200';
                                    case 'BUG': return 'bg-red-100 text-red-700 border border-red-200';
                                    default: return 'bg-gray-100 text-gray-700 border border-gray-200';
                                  }
                                };

                                return (
                                  <tr key={item.id} className="hover:bg-blue-50/50 transition-colors duration-150" data-testid={`row-standup-item-${item.externalId}`}>
                                    <td className="px-3 py-1 whitespace-nowrap text-xs text-gray-600">
                                      {index + 1}
                                    </td>
                                    <td className="px-3 py-1 text-xs text-gray-900">
                                      <div className="flex items-start">
                                        <span className="break-words leading-tight">{item.title}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-1 whitespace-nowrap">
                                      <span className={`px-2 py-0.5 inline-flex text-[10px] rounded ${getTypeColor(item.type)}`}>
                                        {item.type}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1 whitespace-nowrap">
                                      <span className={`px-2 py-0.5 inline-flex text-[10px] rounded ${getPriorityColor(item.priority || 'MEDIUM')}`}>
                                        {item.priority || 'MEDIUM'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1 whitespace-nowrap text-xs text-gray-700 text-center">
                                      {item.estimate ? Number(item.estimate).toFixed(1) : '-'}
                                    </td>
                                    <td className="px-3 py-1 whitespace-nowrap">
                                      <span className={`px-2 py-0.5 inline-flex text-[10px] rounded ${getStatusColor(item.status)}`}>
                                        {item.status.replace('_', ' ')}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Projects table or grid view */
              filteredProjects.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {statusFilter === "archived" 
                      ? "No Archived projects found" 
                      : "No projects found"}
                  </h3>
                </div>
              ) : viewMode === "table" ? (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">PROJECT</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">STATUS</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">TEAM</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">WORK ITEMS</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">ISSUES</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">TARGET DATE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredProjects.map((project: Project) => {
                        const team = teams.find((t: Team) => t.id === project.teamId);
                        const projectItems = allWorkItems.filter(item => item.projectId === project.id);
                        const epics = projectItems.filter(i => i.type === 'EPIC').length;
                        const features = projectItems.filter(i => i.type === 'FEATURE').length;
                        const stories = projectItems.filter(i => i.type === 'STORY').length;
                        const tasks = projectItems.filter(i => i.type === 'TASK').length;
                        const bugs = projectItems.filter(i => i.type === 'BUG').length;
                        const teamMemberIds = project.teamId ? teamMembersOf(project.teamId) : [];
                        
                        const getStatusColor = (status: string) => {
                          switch(status) {
                            case 'PLANNING': return 'bg-blue-100 text-blue-800';
                            case 'ACTIVE': return 'bg-green-100 text-green-800';
                            case 'ARCHIVED': return 'bg-gray-100 text-gray-800';
                            default: return 'bg-gray-100 text-gray-800';
                          }
                        };
                        
                        return (
                          <tr key={project.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <Link href={`/projects/${project.id}`}>
                                <div className="cursor-pointer hover:text-blue-600 transition-colors">
                                  <p className="font-semibold text-gray-900">{project.key}</p>
                                  <p className="text-sm text-gray-600 hover:text-blue-700">{project.name}</p>
                                </div>
                              </Link>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                                {project.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-700">{team?.name || '-'}</span>
                                <span className="text-xs text-gray-500">({teamMemberIds.length})</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-3 text-sm">
                                <span className="text-purple-600">{epics} Epics</span>
                                <span className="text-blue-600">{features} Features</span>
                                <span className="text-green-600">{stories} Stories</span>
                                <span className="text-orange-600">{tasks} Tasks</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-sm ${bugs > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                {bugs > 0 ? `${bugs} 🔴` : 'None'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {project.targetDate ? new Date(project.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProjects.map((project: Project) => {
                    const creator = users.find((user: User) => user.id === project.createdBy);
                    const team = teams.find((team: Team) => team.id === project.teamId);
                    const teamMemberIds = project.teamId ? teamMembersOf(project.teamId) : [];
                    const memberCount = teamMemberIds.length;
                    const projectItems = allWorkItems.filter(item => item.projectId === project.id);
                    const stats = calculateProjectStats(projectItems);
                    return (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        creator={creator}
                        team={team}
                        stats={stats}
                        memberCount={memberCount}
                        teamMemberIds={teamMemberIds}
                      />
                    );
                  })}
                </div>
              )
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <CreateProject
        isOpen={isOpen && modalType === "createProject"}
        onClose={closeModal}
        onSuccess={handleProjectSuccess}
        teams={teams}
        userId={currentUser?.id || 22} // Default to admin user
        currentUser={currentUser}
      />
    </div>
  );
}
