import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Search, X, Users, Plus } from "lucide-react";
import { format, endOfMonth, endOfQuarter, differenceInDays, differenceInMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api-config";
import { User, Team, Project, WorkItem as SchemaWorkItem } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GanttViewMode = 'month' | 'quarter' | 'year';

interface WorkItem {
  id: number;
  externalId: string;
  title: string;
  description: string | null;
  type: 'EPIC' | 'FEATURE' | 'STORY' | 'TASK' | 'BUG';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  projectId: number;
  parentId: number | null;
  assigneeId: number | null;
  reporterId: number;
  estimate: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  projectKey?: string;
  projectName?: string;
}

interface ProjectTimelineRow {
  id: number;
  key: string;
  name: string;
  status: string;
  teamName: string;
  memberCount: number;
  epicsCount: number;
  featuresCount: number;
  storiesCount: number;
  tasksCount: number;
  bugsCount: number;
  startDate: Date | null;
  targetDate: Date | null;
  durationYears: number;
  createdBy: string;
  createdAt: Date | null;
}

const statusColors: Record<string, string> = {
  PLANNING: 'bg-blue-500',
  ACTIVE: 'bg-green-500',
  COMPLETED: 'bg-gray-500',
  ARCHIVED: 'bg-gray-400'
};

const statusBadgeColors: Record<string, string> = {
  PLANNING: 'bg-blue-100 text-blue-700 border-blue-200',
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  COMPLETED: 'bg-gray-100 text-gray-700 border-gray-200',
  ARCHIVED: 'bg-gray-100 text-gray-600 border-gray-200'
};

const statusBarColors: Record<string, string> = {
  PLANNING: 'bg-blue-500',
  ACTIVE: 'bg-green-500',
  COMPLETED: 'bg-gray-400',
  ARCHIVED: 'bg-gray-300'
};

// Project Gantt Chart Component
const ProjectGanttChart = ({ 
  projects, 
  teams, 
  workItems, 
  users,
  viewMode,
  currentYear,
  onYearChange,
  onViewModeChange,
  teamMemberCounts = {}
}: { 
  projects: Project[], 
  teams: Team[], 
  workItems: WorkItem[],
  users: User[],
  viewMode: GanttViewMode,
  currentYear: number,
  onYearChange: (year: number) => void,
  onViewModeChange: (mode: GanttViewMode) => void,
  teamMemberCounts?: Record<number, number>
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  // Generate time periods based on view mode
  const timePeriods = useMemo(() => {
    const periods: { label: string; start: Date; end: Date }[] = [];
    
    if (viewMode === 'month') {
      // Show 12 months of a single year
      for (let i = 0; i < 12; i++) {
        const start = new Date(currentYear, i, 1);
        const end = endOfMonth(start);
        periods.push({
          label: format(start, 'MMM'),
          start,
          end
        });
      }
    } else if (viewMode === 'quarter') {
      // Show 6 quarters spanning 1.5 years
      for (let q = 0; q < 6; q++) {
        const yearOffset = Math.floor(q / 4);
        const quarterInYear = q % 4;
        const year = currentYear + yearOffset;
        const start = new Date(year, quarterInYear * 3, 1);
        const end = endOfQuarter(start);
        periods.push({
          label: `Q${quarterInYear + 1} ${year}`,
          start,
          end
        });
      }
    } else {
      // Year view - show 3 full years
      for (let i = 0; i < 3; i++) {
        const year = currentYear + i;
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31);
        periods.push({
          label: String(year),
          start,
          end
        });
      }
    }
    
    return periods;
  }, [viewMode, currentYear]);

  // Get visible range
  const rangeStart = timePeriods.length > 0 ? timePeriods[0].start : new Date();
  const rangeEnd = timePeriods.length > 0 ? timePeriods[timePeriods.length - 1].end : new Date();

  // Build project timeline rows with enriched data
  const projectRows = useMemo(() => {
    return projects
      .filter(p => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const team = teams.find(t => t.id === p.teamId);
          const matchesSearch = 
            p.name.toLowerCase().includes(query) ||
            p.key.toLowerCase().includes(query) ||
            (team?.name || '').toLowerCase().includes(query) ||
            p.status.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }
        
        // Status filter
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        
        // Team filter
        if (teamFilter !== 'all' && p.teamId?.toString() !== teamFilter) return false;
        
        return true;
      })
      .map(project => {
        const team = teams.find(t => t.id === project.teamId);
        const projectWorkItems = workItems.filter(w => w.projectId === project.id);
        const creator = users.find(u => u.id === project.createdBy);
        
        const startDate = project.startDate ? new Date(project.startDate) : null;
        const targetDate = project.targetDate ? new Date(project.targetDate) : null;
        
        let durationYears = 0;
        if (startDate && targetDate) {
          durationYears = differenceInMonths(targetDate, startDate) / 12;
        }

        return {
          id: project.id,
          key: project.key,
          name: project.name,
          status: project.status,
          teamName: team?.name || 'No Team',
          epicsCount: projectWorkItems.filter(w => w.type === 'EPIC').length,
          featuresCount: projectWorkItems.filter(w => w.type === 'FEATURE').length,
          storiesCount: projectWorkItems.filter(w => w.type === 'STORY').length,
          tasksCount: projectWorkItems.filter(w => w.type === 'TASK').length,
          bugsCount: projectWorkItems.filter(w => w.type === 'BUG').length,
          startDate,
          targetDate,
          durationYears,
          memberCount: project.teamId ? (teamMemberCounts[project.teamId] || 0) : 0,
          createdBy: creator?.email || 'Unknown',
          createdAt: project.createdAt ? new Date(project.createdAt) : null
        };
      });
  }, [projects, teams, workItems, users, searchQuery, statusFilter, teamFilter, teamMemberCounts]);

  // Calculate bar position and width for a project
  const getBarStyle = (row: ProjectTimelineRow) => {
    if (!row.startDate || !row.targetDate || timePeriods.length === 0) {
      return null;
    }

    const totalDays = differenceInDays(rangeEnd, rangeStart);
    if (totalDays <= 0) return null;

    // Check if project is completely outside visible range
    if (row.targetDate < rangeStart || row.startDate > rangeEnd) {
      return { isOutOfRange: true };
    }

    // Clamp project dates to visible range
    const barStart = row.startDate < rangeStart ? rangeStart : row.startDate;
    const barEnd = row.targetDate > rangeEnd ? rangeEnd : row.targetDate;

    const startOffset = differenceInDays(barStart, rangeStart);
    const barDays = differenceInDays(barEnd, barStart);

    const left = (startOffset / totalDays) * 100;
    const width = Math.max((barDays / totalDays) * 100, 3);

    return { 
      left: `${Math.max(0, left)}%`, 
      width: `${Math.min(width, 100 - left)}%`,
      continuesLeft: row.startDate < rangeStart,
      continuesRight: row.targetDate > rangeEnd,
      isOutOfRange: false
    };
  };

  const totalItemsCount = (row: ProjectTimelineRow) => {
    return row.epicsCount + row.featuresCount + row.storiesCount + row.tasksCount;
  };

  const matchingCount = projectRows.length;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-6 w-6" />
              Projects Timeline
            </h1>
            <p className="text-gray-600">Manage and monitor all your projects</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Search and Filters Row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects, teams, or keys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PLANNING">Planning</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(team => (
                <SelectItem key={team.id} value={team.id.toString()}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={viewMode} onValueChange={(v) => onViewModeChange(v as GanttViewMode)}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month View</SelectItem>
              <SelectItem value="quarter">Quarter View</SelectItem>
              <SelectItem value="year">Year View</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => onYearChange(currentYear - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[120px] text-center">
              {viewMode === 'year' ? `${currentYear} - ${currentYear + 2}` : 
               viewMode === 'quarter' ? `${currentYear} - ${currentYear + 1}` : 
               currentYear}
            </span>
            <Button variant="outline" size="sm" onClick={() => onYearChange(currentYear + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search Results Count */}
        {searchQuery && (
          <div className="mt-3 text-sm text-gray-600">
            Found {matchingCount} project{matchingCount !== 1 ? 's' : ''} matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Gantt Chart */}
      <div className="p-6">
        <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              {/* Column Headers */}
              <div className="flex border-b bg-gray-50 sticky top-0 z-20">
                <div className="w-80 flex-shrink-0 p-3 font-semibold text-sm border-r bg-gray-50">
                  Project Details
                </div>
                <div className="flex-1 flex">
                  {timePeriods.map((period, idx) => (
                    <div 
                      key={idx} 
                      className="flex-1 text-center py-3 px-2 text-sm font-medium border-r last:border-r-0 bg-gray-50"
                      style={{ minWidth: viewMode === 'month' ? '70px' : viewMode === 'quarter' ? '100px' : '120px' }}
                    >
                      {period.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Project Rows */}
              {projectRows.length > 0 ? (
                projectRows.map((row) => {
                  const barStyle = getBarStyle(row);
                  const isOutOfRange = barStyle && 'isOutOfRange' in barStyle && barStyle.isOutOfRange;
                  
                  return (
                    <div key={row.id} className="flex border-b hover:bg-gray-50 transition-colors">
                      {/* Project Metadata Panel - Fixed 320px */}
                      <div className="w-80 flex-shrink-0 p-3 border-r bg-white">
                        <div className="flex items-start gap-2 mb-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium border",
                            statusBadgeColors[row.status] || 'bg-gray-100 text-gray-800'
                          )}>
                            {row.status}
                          </span>
                          <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{row.key}</span>
                          {row.durationYears >= 2 && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                              {row.durationYears.toFixed(1)} years
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1 truncate" title={row.name}>{row.name}</h4>
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                          <Users className="h-3 w-3" />
                          <span>{row.teamName}</span>
                          {row.memberCount > 0 && <span className="text-gray-400">• {row.memberCount} members</span>}
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap gap-1">
                          <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{row.epicsCount} Epics</span>
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{row.featuresCount} Features</span>
                          <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{row.storiesCount} Stories</span>
                          <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{row.tasksCount} Tasks</span>
                          {row.bugsCount > 0 && (
                            <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{row.bugsCount} Bugs</span>
                          )}
                        </div>
                      </div>

                      {/* Timeline Grid with Bar */}
                      <div className="flex-1 relative" style={{ minHeight: '100px' }}>
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex">
                          {timePeriods.map((_, idx) => (
                            <div 
                              key={idx} 
                              className="flex-1 border-r last:border-r-0 bg-white"
                              style={{ minWidth: viewMode === 'month' ? '70px' : viewMode === 'quarter' ? '100px' : '120px' }}
                            />
                          ))}
                        </div>

                        {/* Project Bar or Out of Range Message */}
                        {isOutOfRange ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-gray-400 italic">Not in current view range</span>
                          </div>
                        ) : barStyle && !('isOutOfRange' in barStyle && barStyle.isOutOfRange) ? (
                          <>
                            <div 
                              className={cn(
                                "absolute top-1/2 -translate-y-1/2 h-9 rounded-md flex items-center text-white text-xs font-medium px-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden",
                                statusBarColors[row.status] || 'bg-gray-500'
                              )}
                              style={{
                                left: barStyle.left,
                                width: barStyle.width,
                              }}
                              title={`${row.name}: ${row.startDate ? format(row.startDate, 'MMM d, yyyy') : ''} → ${row.targetDate ? format(row.targetDate, 'MMM d, yyyy') : ''}`}
                            >
                              {/* Left continuation indicator */}
                              {barStyle.continuesLeft && (
                                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-black/20 to-transparent flex items-center justify-start pl-1">
                                  <ChevronLeft className="h-3 w-3" />
                                </div>
                              )}
                              
                              <span className={cn("truncate flex-1", barStyle.continuesLeft && "ml-4", barStyle.continuesRight && "mr-4")}>
                                {row.name} <span className="opacity-75">| {totalItemsCount(row)} items</span>
                              </span>
                              
                              {/* Right continuation indicator */}
                              {barStyle.continuesRight && (
                                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-black/20 to-transparent flex items-center justify-end pr-1">
                                  <ChevronRight className="h-3 w-3" />
                                </div>
                              )}
                            </div>

                            {/* Date labels below bar */}
                            {row.startDate && row.targetDate && (
                              <div className="absolute bottom-1 left-0 right-0 px-2">
                                <div 
                                  className="text-[10px] text-gray-500 flex items-center gap-1 whitespace-nowrap"
                                  style={{ 
                                    marginLeft: barStyle.left,
                                    maxWidth: barStyle.width 
                                  }}
                                >
                                  <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                                  {format(row.startDate, 'MMM d, yyyy')} → {format(row.targetDate, 'MMM d, yyyy')}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-gray-400 italic">No dates set</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center">
                  {searchQuery ? (
                    <div className="text-gray-500">
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No projects found</p>
                      <p className="text-sm">No projects matching "{searchQuery}"</p>
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No projects to display</p>
                      <p className="text-sm">Create your first project to see it on the timeline</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-6 p-4 bg-white rounded-lg border mt-4 shadow-sm">
          <div className="text-sm font-medium text-gray-700">Status Legend:</div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span className="text-sm text-gray-600">Planning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-sm text-gray-600">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-400"></div>
            <span className="text-sm text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Starts before view</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Extends beyond view</span>
              <ChevronRight className="h-4 w-4 text-gray-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Timeline() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [ganttViewMode, setGanttViewMode] = useState<GanttViewMode>('quarter');
  
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/auth/user'],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/teams'],
  });
  
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/projects'],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/users'],
    queryFn: () => apiGet('/users'),
  });

  // Fetch team members for all teams
  const [teamMemberCounts, setTeamMemberCounts] = useState<Record<number, number>>({});
  
  useEffect(() => {
    if (!teams.length) return;
    const fetchTeamMembers = async () => {
      const counts: Record<number, number> = {};
      await Promise.all(teams.map(async (team) => {
        try {
          const members = await apiGet(`/teams/${team.id}/members`);
          counts[team.id] = Array.isArray(members) ? members.length : 0;
        } catch {
          counts[team.id] = 0;
        }
      }));
      setTeamMemberCounts(counts);
    };
    fetchTeamMembers();
  }, [teams]);

  const { data: allWorkItems = [] } = useQuery<WorkItem[]>({
    queryKey: ['/work-items'],
    queryFn: async () => {
      try {
        const items = await apiGet('/work-items');
        return items.map((item: WorkItem) => {
          const project = projects.find(p => p.id === item.projectId);
          return {
            ...item,
            projectKey: project?.key || '',
            projectName: project?.name || 'Unknown Project'
          };
        });
      } catch (error) {
        console.error('Error fetching work items:', error);
        return [];
      }
    },
    enabled: true,
  });

  const handleViewModeChange = (mode: GanttViewMode) => {
    setGanttViewMode(mode);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={currentUser}
        teams={teams}
        projects={projects}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          <ProjectGanttChart 
            projects={projects}
            teams={teams}
            workItems={allWorkItems}
            users={users}
            viewMode={ganttViewMode}
            currentYear={currentYear}
            onYearChange={setCurrentYear}
            onViewModeChange={handleViewModeChange}
            teamMemberCounts={teamMemberCounts}
          />
        </main>
      </div>
    </div>
  );
}
