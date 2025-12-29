import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buttonVariants } from "@/components/ui/button";
import {
  LayoutDashboard,
  Layers,
  Users,
  Calendar,
  BarChart,
  Bug,
  ListTodo,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Team, Project, User } from "@shared/schema";
import CybaemLogo from "@/assets/cybaem-logo.png";

interface SidebarProps {
  user?: User;
  teams?: Team[];
  projects?: Project[];
  onCreateTeam?: () => void;
  onCreateProject?: () => void;
}

const menuItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", isActive: (loc: string) => loc === "/dashboard" },
  { href: "/teams", icon: Users, label: "Team Management", isActive: (loc: string) => loc === "/teams" || loc.startsWith("/teams/") },
  { href: "/projects", icon: Layers, label: "Project Management", isActive: (loc: string) => loc === "/" || loc === "/projects" || loc.startsWith("/projects/") },
  { href: "/standup", icon: ListTodo, label: "Daily Standup", isActive: (loc: string) => loc === "/standup" },
  { href: "/timeline", icon: Calendar, label: "Timeline", isActive: (loc: string) => loc === "/timeline" || loc === "/calendar" },
  { href: "/reports", icon: BarChart, label: "Reports", isActive: (loc: string) => loc === "/reports" },
  { href: "/project-bug-reports", icon: Bug, label: "Project Bug Reviews", isActive: (loc: string) => loc === "/project-bug-reports" },
];

// Initialize sidebar state from localStorage
const getInitialSidebarState = () => {
  if (typeof window !== 'undefined') {
    const savedState = localStorage.getItem('sidebar-collapsed');
    return savedState !== null ? JSON.parse(savedState) : true;
  }
  return true;
};

export function Sidebar({
  user,
  teams = [],
  projects = [],
  onCreateTeam,
  onCreateProject,
}: SidebarProps) {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(getInitialSidebarState);

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsCollapsed((prev: boolean) => !prev);
  };

  return (
    <aside 
      className={cn(
        "bg-white border-r border-neutral-200 flex-shrink-0 hidden md:flex flex-col h-full shadow-sm transition-all duration-300 relative z-20",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Header with Logo and Toggle */}
      <div className={cn(
        "border-b border-neutral-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 transition-all duration-300",
        isCollapsed ? "p-2 flex-col gap-2" : "p-4"
      )}>
        {!isCollapsed && (
          <div className="flex flex-col items-center justify-center flex-1">
            <span className="font-bold text-xl text-blue-700 mb-2 tracking-wide">ProjectHub</span>
            <img src={CybaemLogo} alt="Cybaem Tech Logo" className="h-10 opacity-90" />
            <p className="text-xs text-gray-500 mt-1 text-center">Agile Project Management</p>
          </div>
        )}
        
        {isCollapsed && (
          <img src={CybaemLogo} alt="Logo" className="h-8 opacity-90" />
        )}

        <button
          onClick={handleToggle}
          className={cn(
            "p-1.5 hover:bg-blue-100 rounded transition-colors flex-shrink-0",
            isCollapsed ? "w-full flex justify-center" : ""
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
        >
          {isCollapsed ? (
            <ChevronsRight className="h-5 w-5 text-blue-700" />
          ) : (
            <ChevronsLeft className="h-5 w-5 text-blue-700" />
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <ScrollArea className="flex-1">
        <div className={isCollapsed ? "p-2" : "p-4"}>
          {!isCollapsed && (
            <div className="mb-3">
              <h2 className="text-xs uppercase font-semibold text-neutral-500 tracking-wider mb-2">
                Workspace
              </h2>
              <div className="h-px bg-gradient-to-r from-neutral-200 to-transparent"></div>
            </div>
          )}
          
          <ul className={cn("space-y-1", isCollapsed && "space-y-2")}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.isActive(location);
              
              // Only show Daily Standup for ADMIN and SCRUM_MASTER
              if (item.label === "Daily Standup" && user) {
                if (user.role !== "ADMIN" && user.role !== "SCRUM_MASTER") {
                  return null;
                }
              }

              return (
                <li key={item.href}>
                  <Link href={item.href}>
                    <a
                      className={cn(
                        "flex items-center rounded-lg transition-colors duration-200 group",
                        isCollapsed 
                          ? "p-2 justify-center h-10 w-10 mx-auto" 
                          : "p-3 justify-start",
                        isActive
                          ? "text-primary bg-primary/10 border-l-4 border-primary"
                          : "text-neutral-700 hover:bg-neutral-100 hover:text-primary"
                      )}
                      title={item.label}
                    >
                      <div className={cn(
                        "flex items-center justify-center",
                        isCollapsed ? "w-full" : "mr-3"
                      )}>
                        <Icon className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                      </div>
                      {!isCollapsed && (
                        <span className="font-medium text-sm">{item.label}</span>
                      )}
                    </a>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </ScrollArea>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-neutral-200">
          <div className="text-center">
            <p className="text-xs text-gray-500">
              User menu available in header
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
