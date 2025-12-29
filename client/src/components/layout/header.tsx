import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Search, Bell, HelpCircle, ChevronDown, LogOut, Key } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordModal } from "@/components/modals/change-password-modal";
import { Project, User as UserType } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { SessionTimer } from "@/components/ui/session-timer";

interface HeaderProps {
  currentProject?: Project;
  projects?: Project[];
  user?: UserType;
  onMobileMenuToggle?: () => void;
}

export function Header({
  currentProject,
  projects = [],
  user,
  onMobileMenuToggle
}: HeaderProps) {
  const [location, navigate] = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleBackToTeams = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/teams');
  };

  const handleChangePassword = () => {
    setShowChangePassword(true);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      // Call logout API
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Logout API call error:', error);
    }

    // Clear all data
    localStorage.clear();
    sessionStorage.clear();

    // Set a flag in sessionStorage to prevent auto-login redirect
    sessionStorage.setItem('logout-initiated', 'true');

    // Invalidate auth queries specifically first
    await queryClient.invalidateQueries({ queryKey: ['/auth/user'] });
    await queryClient.removeQueries({ queryKey: ['/auth/user'] });

    // Clear entire query cache
    queryClient.clear();

    // Use window.location.replace for immediate redirect without history
    window.location.replace(`${window.location.origin}/Agile/login`);
  };

  const getUserInitials = (user?: UserType) => {
    if (!user) return "U";
    if (user.fullName) {
      const names = user.fullName.split(" ");
      return names.length >= 2 ?
        `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() :
        user.fullName.substring(0, 2).toUpperCase();
    }
    return user.username ? user.username.substring(0, 2).toUpperCase() : "U";
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800';
      case 'SCRUM_MASTER':
        return 'bg-purple-100 text-purple-800';
      case 'PROJECT_MANAGER':
        return 'bg-blue-100 text-blue-800';
      case 'TEAM_LEAD':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <header className="bg-white border-b border-neutral-200 py-4 px-6 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          className="md:hidden text-neutral-500"
          onClick={onMobileMenuToggle}
          title="Toggle mobile menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {currentProject && (
          <div className="relative">
            <div className="flex items-center text-neutral-800 font-medium bg-neutral-100 rounded-md px-4 py-2 hover:bg-neutral-200 cursor-pointer">
              <span className="truncate max-w-[160px] md:max-w-[240px]">
                {currentProject.name}
              </span>
              <ChevronDown className="ml-2 h-4 w-4" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* Session Timer - Always show if user is logged in */}
        {user && (
          <SessionTimer
            expiryTime={(user as any).sessionExpiry || (Date.now() + 8 * 60 * 60 * 1000)}
            className="mr-2 border border-neutral-200 shadow-sm bg-white"
          />
        )}

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center space-x-2 px-2 py-1 h-auto" disabled={isLoggingOut}>
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl || undefined} alt={user?.fullName || user?.username || "User"} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="text-sm font-medium text-gray-900">
                  {user?.fullName || user?.username || "User"}
                </span>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${getRoleBadgeColor(user?.role)}`}
                  >
                    {user?.role?.replace('_', ' ') || 'Member'}
                  </Badge>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="font-medium">{user?.fullName || user?.username || "User"}</span>
              <span className="text-xs text-gray-500 font-normal">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleChangePassword}
              className="cursor-pointer"
              disabled={isLoggingOut}
            >
              <Key className="mr-2 h-4 w-4" />
              <span>Change Password</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
              disabled={isLoggingOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </header>
  );
}