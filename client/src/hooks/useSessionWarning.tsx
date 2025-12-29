import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-config';

/**
 * Hook to warn users about session expiry and provide refresh option
 */
export function useSessionWarning(isAuthenticated: boolean, user: any) {
  const { toast } = useToast();
  const [warningShown, setWarningShown] = useState(false);
  
  useEffect(() => {
    if (!isAuthenticated || !user?.sessionExpiry) {
      setWarningShown(false);
      return;
    }

    const sessionExpiry = new Date(user.sessionExpiry).getTime();
    const now = Date.now();
    const timeLeft = sessionExpiry - now;
    
    // Show warning 15 minutes before expiry
    const warningTime = timeLeft - (15 * 60 * 1000);
    
    if (warningTime <= 0 && !warningShown) {
      // Session about to expire, show warning
      setWarningShown(true);
      
      toast({
        title: "Session Expiring Soon",
        description: "Your session will expire in 15 minutes. Click to extend.",
        variant: "default",
        action: (
          <button
            onClick={async () => {
              try {
                await apiRequest('POST', '/auth/refresh', {});
                toast({
                  title: "Session Extended",
                  description: "Your session has been extended for another 8 hours.",
                  variant: "default",
                });
                setWarningShown(false);
              } catch (error) {
                toast({
                  title: "Failed to Extend Session",
                  description: "Please save your work and log in again.",
                  variant: "destructive",
                });
              }
            }}
            className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm hover:bg-primary/90"
          >
            Extend Session
          </button>
        ),
      });
    }
    
    // Set timeout to show warning
    if (warningTime > 0) {
      const timeout = setTimeout(() => {
        if (!warningShown) {
          setWarningShown(true);
          toast({
            title: "Session Expiring Soon",
            description: "Your session will expire in 15 minutes. Click to extend.",
            variant: "default",
            action: (
              <button
                onClick={async () => {
                  try {
                    await apiRequest('POST', '/auth/refresh', {});
                    toast({
                      title: "Session Extended",
                      description: "Your session has been extended for another 8 hours.",
                      variant: "default",
                    });
                    setWarningShown(false);
                  } catch (error) {
                    toast({
                      title: "Failed to Extend Session",
                      description: "Please save your work and log in again.",
                      variant: "destructive",
                    });
                  }
                }}
                className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm hover:bg-primary/90"
              >
                Extend Session
              </button>
            ),
          });
        }
      }, warningTime);
      
      return () => clearTimeout(timeout);
    }
  }, [isAuthenticated, user?.sessionExpiry, warningShown, toast]);
}