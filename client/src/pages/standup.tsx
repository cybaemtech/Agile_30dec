import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal";
import { useToast } from "@/hooks/use-toast";
import { ListTodo, Filter, X, CheckCircle, AlertTriangle, Search, Layers, Calendar } from "lucide-react";
import { apiGet } from "@/lib/api-config";
import { User, Team, Project, WorkItem } from "@shared/schema";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";

export default function DailyStandup() {
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [standupStatusFilter, setStandupStatusFilter] = useState<string[]>([]);
  const [standupPriorityFilter, setStandupPriorityFilter] = useState<string[]>([]);
  const [standupTypeFilter, setStandupTypeFilter] = useState<string[]>([]);
  const [standupAssigneeFilter, setStandupAssigneeFilter] = useState<string[]>([]);
  const [standupProjectFilter, setStandupProjectFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const { openModal } = useModal();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/users"],
    queryFn: () => apiGet("/users"),
  });

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/auth/user"],
    queryFn: () => apiGet("/auth/user"),
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/teams"],
    queryFn: () => apiGet("/teams"),
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/projects"],
    queryFn: () => apiGet("/projects"),
  });

  const isAdminOrScrum = currentUser?.role === "ADMIN" || currentUser?.role === "SCRUM_MASTER";

  const { data: allWorkItems = [] } = useQuery<WorkItem[]>({
    queryKey: ["/work-items/all"],
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

  const totals = React.useMemo(() => {
    const totalItems = allWorkItems.length;
    const tasks = allWorkItems.filter(i => i.type === "TASK").length;
    const bugs = allWorkItems.filter(i => i.type === "BUG").length;
    
    const done = allWorkItems.filter(i => i.status === "DONE").length;
    const inProgress = allWorkItems.filter(i => i.status === "IN_PROGRESS").length;
    const toDo = allWorkItems.filter(i => i.status === "TODO").length;
    const onHold = allWorkItems.filter(i => i.status === "ON_HOLD").length;
    
    const bugsByPriority = {
      CRITICAL: allWorkItems.filter(i => i.type === "BUG" && i.priority === "CRITICAL").length,
      HIGH: allWorkItems.filter(i => i.type === "BUG" && i.priority === "HIGH").length,
      MEDIUM: allWorkItems.filter(i => i.type === "BUG" && i.priority === "MEDIUM").length,
      LOW: allWorkItems.filter(i => i.type === "BUG" && i.priority === "LOW").length,
    };
    
    const estimatedHours = allWorkItems.reduce((acc, curr) => acc + (Number(curr.estimate) || 0), 0);
    
    return { totalItems, tasks, bugs, done, inProgress, toDo, onHold, bugsByPriority, estimatedHours };
  }, [allWorkItems]);

  const hasActiveStandupFilters = standupStatusFilter.length > 0 ||
    standupPriorityFilter.length > 0 ||
    standupTypeFilter.length > 0 ||
    standupAssigneeFilter.length > 0 ||
    standupProjectFilter.length > 0 ||
    dateRange.from !== undefined ||
    dateRange.to !== undefined;

  const filteredProjects = projects.filter((project: Project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.key.toLowerCase().includes(searchQuery.toLowerCase());
    const isActive = project.status !== "ARCHIVED";
    if (!isActive || !matchesSearch) return false;
    return true;
  });

  const resetStandupFilters = () => {
    setStandupStatusFilter([]);
    setStandupPriorityFilter([]);
    setStandupTypeFilter([]);
    setStandupAssigneeFilter([]);
    setStandupProjectFilter([]);
    setDateRange({ from: undefined, to: undefined });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
      <Sidebar
        user={currentUser}
        teams={teams}
        projects={projects}
        onCreateTeam={isAdminOrScrum ? () => openModal("createTeam") : undefined}
        onCreateProject={isAdminOrScrum ? () => openModal("createProject") : undefined}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={currentUser} onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 overflow-auto p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Daily Standup</h1>
              <p className="text-neutral-600 text-sm">Track daily progress across all projects</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                className="pl-9 w-[240px]"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-3 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-neutral-600" />
                <h3 className="font-medium text-neutral-900">Filters</h3>
              </div>
              {hasActiveStandupFilters && (
                <Button variant="ghost" size="sm" onClick={resetStandupFilters} className="text-sm">
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-700 mb-1 block">Project</label>
                <MultiSelect
                  value={standupProjectFilter}
                  onChange={setStandupProjectFilter}
                  options={filteredProjects.map(p => ({ value: p.id.toString(), label: `[${p.key}] ${p.name}` }))}
                  placeholder="All Projects"
                  maxDisplay={1}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-700 mb-1 block">Status</label>
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
                  maxDisplay={1}
                />
              </div>
              {isAdminOrScrum && (
                <div className="lg:col-span-2">
                  <label className="text-xs font-medium text-neutral-700 mb-1 block">Date Frame</label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      className="text-xs h-9"
                      onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value ? new Date(e.target.value) : undefined }))}
                    />
                    <Input
                      type="date"
                      className="text-xs h-9"
                      onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value ? new Date(e.target.value) : undefined }))}
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-neutral-700 mb-1 block">Type</label>
                <MultiSelect
                  value={standupTypeFilter}
                  onChange={setStandupTypeFilter}
                  options={[{ value: "TASK", label: "TASK" }, { value: "BUG", label: "BUG" }]}
                  placeholder="All Types"
                  maxDisplay={1}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-700 mb-1 block">Assignee</label>
                <MultiSelect
                  value={standupAssigneeFilter}
                  onChange={setStandupAssigneeFilter}
                  options={users.filter(u => u.isActive).map(u => ({ value: u.id.toString(), label: u.fullName }))}
                  placeholder="All Assignees"
                  maxDisplay={1}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white p-2.5 rounded-lg border border-neutral-200 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">TOTAL ITEMS</h3>
                <Layers className="h-4 w-4 text-neutral-400" />
              </div>
              <div className="text-3xl font-bold text-neutral-900 mb-1">{totals.totalItems}</div>
              <div className="flex gap-1">
                <span className="text-[9px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-600 font-medium">Tasks: {totals.tasks}</span>
                <span className="text-[9px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-600 font-medium">Bugs: {totals.bugs}</span>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm relative overflow-hidden flex flex-col">
              <div className="p-2 border-b border-neutral-100 flex justify-between items-center">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">BY STATUS</h3>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="grid grid-cols-2 flex-1">
                <div className="p-2 border-r border-b border-neutral-100 bg-emerald-50/30">
                  <div className="text-base font-bold text-emerald-600">{totals.done}</div>
                  <div className="text-[9px] text-emerald-600 font-medium uppercase">Done</div>
                </div>
                <div className="p-2 border-b border-neutral-100 bg-blue-50/30">
                  <div className="text-base font-bold text-blue-600">{totals.inProgress}</div>
                  <div className="text-[9px] text-blue-600 font-medium uppercase tracking-tight">In Progress</div>
                </div>
                <div className="p-2 border-r border-neutral-100">
                  <div className="text-base font-bold text-neutral-700">{totals.toDo}</div>
                  <div className="text-[9px] text-neutral-500 font-medium uppercase">To Do</div>
                </div>
                <div className="p-2 bg-amber-50/30">
                  <div className="text-base font-bold text-amber-600">{totals.onHold}</div>
                  <div className="text-[9px] text-amber-600 font-medium uppercase">On Hold</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm relative overflow-hidden flex flex-col">
              <div className="p-2 border-b border-neutral-100 flex justify-between items-center">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">BUG PRIORITY</h3>
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="grid grid-cols-2 flex-1">
                <div className="p-2 border-r border-b border-neutral-100 bg-rose-50/30">
                  <div className="text-base font-bold text-rose-600">{totals.bugsByPriority.CRITICAL}</div>
                  <div className="text-[9px] text-rose-600 font-medium uppercase">Critical</div>
                </div>
                <div className="p-2 border-b border-neutral-100 bg-orange-50/30">
                  <div className="text-base font-bold text-orange-600">{totals.bugsByPriority.HIGH}</div>
                  <div className="text-[9px] text-orange-600 font-medium uppercase">High</div>
                </div>
                <div className="p-2 border-r border-neutral-100 bg-amber-50/30">
                  <div className="text-base font-bold text-amber-600">{totals.bugsByPriority.MEDIUM}</div>
                  <div className="text-[9px] text-amber-600 font-medium uppercase">Medium</div>
                </div>
                <div className="p-2 bg-emerald-50/30">
                  <div className="text-base font-bold text-emerald-600">{totals.bugsByPriority.LOW}</div>
                  <div className="text-[9px] text-emerald-600 font-medium uppercase">Low</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-neutral-200 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">ESTIMATED HOURS</h3>
                <Calendar className="h-4 w-4 text-neutral-400" />
              </div>
              <div className="text-3xl font-bold text-neutral-900 mb-1">{totals.estimatedHours.toFixed(1)}</div>
              <div className="text-[9px] text-neutral-500 font-medium">Total estimated work hours</div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredProjects.map((project) => {
              let projectItems = allWorkItems.filter(
                item => item.projectId === project.id && (item.type === "TASK" || item.type === "BUG")
              );

              if (standupProjectFilter.length > 0 && !standupProjectFilter.includes(project.id.toString())) return null;

              if (dateRange.from || dateRange.to) {
                projectItems = projectItems.filter(item => {
                  const itemDate = new Date(item.createdAt);
                  if (dateRange.from && itemDate < dateRange.from) return false;
                  if (dateRange.to && itemDate > dateRange.to) return false;
                  return true;
                });
              }

              projectItems = projectItems.filter(item => {
                if (standupStatusFilter.length > 0 && !standupStatusFilter.includes(item.status)) return false;
                if (standupPriorityFilter.length > 0 && (!item.priority || !standupPriorityFilter.includes(item.priority))) return false;
                if (standupTypeFilter.length > 0 && !standupTypeFilter.includes(item.type)) return false;
                if (standupAssigneeFilter.length > 0 && (!item.assigneeId || !standupAssigneeFilter.includes(item.assigneeId.toString()))) return false;
                return true;
              });

              if (projectItems.length === 0 && hasActiveStandupFilters) return null;

              const projectDone = projectItems.filter(i => i.status === "DONE").length;
              const projectInProgress = projectItems.filter(i => i.status === "IN_PROGRESS").length;

              return (
                <div key={project.id} className="bg-white rounded border border-neutral-200 overflow-hidden shadow-sm">
                  <div className="px-2.5 py-2 border-b border-neutral-100 flex justify-between items-center bg-white">
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">{project.name}</h3>
                      <p className="text-[9px] text-neutral-500 font-medium uppercase tracking-wider mt-0.5">Code: {project.key}</p>
                    </div>
                    <div className="flex gap-4 items-center">
                      <div className="text-center">
                        <div className="text-sm font-bold text-neutral-900">{projectItems.length}</div>
                        <div className="text-[9px] text-neutral-500 font-bold uppercase tracking-tighter">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-neutral-900">{projectDone}</div>
                        <div className="text-[9px] text-neutral-500 font-bold uppercase tracking-tighter">Done</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-neutral-900">{projectInProgress}</div>
                        <div className="text-[9px] text-neutral-500 font-bold uppercase tracking-tighter">Progress</div>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#fcfcfc] border-b border-neutral-100">
                          <th className="px-2 py-1.5 text-[9px] font-bold text-neutral-500 uppercase tracking-widest w-10">#</th>
                          <th className="px-2 py-1.5 text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Task Title</th>
                          <th className="px-2 py-1.5 text-[9px] font-bold text-neutral-500 uppercase tracking-widest text-right w-20">Type</th>
                          <th className="px-2 py-1.5 text-[9px] font-bold text-neutral-500 uppercase tracking-widest text-right w-24">Priority</th>
                          <th className="px-2 py-1.5 text-[9px] font-bold text-neutral-500 uppercase tracking-widest text-right w-20">Est Hr</th>
                          <th className="px-2 py-1.5 text-[9px] font-bold text-neutral-500 uppercase tracking-widest text-right w-24">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {projectItems.length > 0 ? projectItems.map((item, index) => (
                          <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                            <td className="px-2 py-1.5 text-xs text-neutral-500">{index + 1}</td>
                            <td className="px-2 py-1.5 text-xs text-neutral-700">{item.title}</td>
                            <td className="px-2 py-1.5 text-right">
                              <span className={cn(
                                "text-[9px] font-bold px-2 py-0.5 rounded border uppercase inline-block",
                                item.type === "BUG" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-blue-50 text-blue-600 border-blue-100"
                              )}>
                                {item.type}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className={cn(
                                "text-[9px] font-bold px-2 py-0.5 rounded border uppercase inline-block",
                                item.priority === "CRITICAL" ? "bg-rose-100 text-rose-700 border-rose-200" :
                                item.priority === "HIGH" ? "bg-orange-50 text-orange-600 border-orange-100" :
                                item.priority === "MEDIUM" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                "bg-emerald-50 text-emerald-600 border-emerald-100"
                              )}>
                                {item.priority}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-xs text-neutral-600 text-right">
                              {item.estimate ? Number(item.estimate).toFixed(1) : "-"}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className={cn(
                                "text-[9px] font-bold px-2 py-0.5 rounded border uppercase inline-block",
                                item.status === "DONE" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                item.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-600 border-blue-100" :
                                item.status === "ON_HOLD" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                "bg-neutral-50 text-neutral-500 border-neutral-200"
                              )}>
                                {item.status.replace("_", " ")}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={6} className="px-2 py-2 text-center text-xs text-neutral-500 italic">No items found for this project.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
