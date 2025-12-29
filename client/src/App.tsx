import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetails from "@/pages/project-details";
import Teams from "@/pages/teams";
import TeamDetails from "@/pages/team-details";
import Timeline from "@/pages/timeline";
import Reports from "@/pages/reports";
import ReportBug from "@/pages/report-bug";
import ProjectBugReports from "@/pages/project-bug-reports";
import DailyStandup from "@/pages/standup";
import LoginPage from "@/pages/login";
import Register from "@/pages/register";
import { useAuth } from "./hooks/useAuth";
import { useSessionHeartbeat } from "./hooks/useSessionHeartbeat";
import { useSessionWarning } from "./hooks/useSessionWarning";
import { useEffect } from "react";


function Routes() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading, isError, isUnauthenticated } = useAuth();
  
  // Keep session alive during user activity
  useSessionHeartbeat(isAuthenticated);
  
  // Warn user about session expiry
  useSessionWarning(isAuthenticated, user);

  console.log('[Routes] Auth state:', { isAuthenticated, isUnauthenticated, isLoading, location });

  // Immediate redirect logic - but only after auth state is determined
  useEffect(() => {
    // Don't redirect if we're still loading auth state
    if (isLoading) return;
    
    if (isUnauthenticated) {
      if (!location.startsWith("/login") && !location.startsWith("/register")) {
        console.log('[App] Redirecting unauthenticated user to login from:', location);
        setLocation("/login");
      }
    } else if (isAuthenticated && location === "/") {
      setLocation("/dashboard");
    }
  }, [location, setLocation, isAuthenticated, isUnauthenticated, isLoading]);

  // Show loading spinner while determining auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={Register} />

      {/* Protected routes - show login immediately if not authenticated */}
      <Route path="/dashboard">
        {isAuthenticated ? <Dashboard /> : <LoginPage />}
      </Route>
      <Route path="/projects">
        {isAuthenticated ? <Projects /> : <LoginPage />}
      </Route>
      <Route path="/projects/:id">
        {isAuthenticated ? <ProjectDetails /> : <LoginPage />}
      </Route>
      <Route path="/teams">
        {isAuthenticated ? <Teams /> : <LoginPage />}
      </Route>
      <Route path="/teams/:id">
        {isAuthenticated ? <TeamDetails /> : <LoginPage />}
      </Route>
      <Route path="/timeline">
        {isAuthenticated ? <Timeline /> : <LoginPage />}
      </Route>
      <Route path="/calendar">
        {isAuthenticated ? <Timeline /> : <LoginPage />}
      </Route>
      <Route path="/reports">
        {isAuthenticated ? <Reports /> : <LoginPage />}
      </Route>
      <Route path="/report-bug">
        {isAuthenticated ? <ReportBug /> : <LoginPage />}
      </Route>
      <Route path="/project-bug-reports">
        {isAuthenticated ? <ProjectBugReports /> : <LoginPage />}
      </Route>
      <Route path="/standup">
        {isAuthenticated ? <DailyStandup /> : <LoginPage />}
      </Route>

      {/* Catch all - always show login for unauthenticated users */}
      <Route>
        {isAuthenticated ? <NotFound /> : <LoginPage />}
      </Route>
    </Switch>
  );
}

function App() {
  const base = import.meta.env.PROD ? '/Agile' : '/';
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen">
          <Toaster />
          <WouterRouter base={base}>
            <Routes />
          </WouterRouter>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
