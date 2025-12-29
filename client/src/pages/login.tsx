import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LucideLogIn, Shield, Mail, Clock, RefreshCw, ArrowLeft } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { API_BASE_URL } from "@/lib/api-config";
import { ForgotPasswordModal } from "@/components/modals/forgot-password-modal";
import { OTPInput } from "@/components/ui/otp-input";

// Login form schema
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password should be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loginStep, setLoginStep] = useState<'credentials' | 'otp'>('credentials');
  const [pendingCredentials, setPendingCredentials] = useState<LoginFormValues | null>(null);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  // Create form with validation
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Check if already logged in
  useEffect(() => {
    // Don't auto-redirect if logout was just initiated
    const logoutInitiated = sessionStorage.getItem('logout-initiated');
    if (logoutInitiated) {
      sessionStorage.removeItem('logout-initiated');
      return;
    }

    // Check if user is already logged in using the auth hook
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/user`, {
          credentials: 'include'
        });
        if (response.ok) {
          const userData = await response.json();
          if (userData && userData.id && !userData.isUnauthenticated) {
            console.log('[Login] User already authenticated, redirecting to dashboard');
            setLocation('/dashboard');
          }
        }
      } catch (error) {
        // Not authenticated, stay on login page
        console.log('[Login] Not authenticated, staying on login page');
      }
    };
    
    // Only check auth once when component mounts
    checkAuth();
  }, []);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Handle initial credentials submission - SECURE OTP FLOW ONLY
  const onSubmitCredentials = async (data: LoginFormValues) => {
    setIsLoading(true);
    
    try {
      console.log('[Login] Starting secure OTP login flow');
      
      // SECURITY: Always use OTP flow - no bypass allowed
      const response = await fetch(`${API_BASE_URL}/login-otp/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // OTP sent successfully, move to OTP verification step
        setPendingCredentials(data);
        setLoginStep('otp');
        setOtpSent(true);
        setCountdown(120); // 2 minutes countdown for resend
        toast({
          title: "Verification code sent",
          description: `Please check your email for the verification code.`,
        });
      } else if (response.status === 401) {
        // Invalid credentials
        toast({
          variant: "destructive",
          title: "Login failed",
          description: "Invalid email or password.",
        });
      } else if (response.status === 429) {
        // Rate limited
        toast({
          variant: "destructive",
          title: "Too many attempts",
          description: result.message || "Please wait before trying again.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: result.message || "An error occurred. Please try again.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: "An error occurred during login. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Send OTP for login verification
  const sendOTPForLogin = async (email: string) => {
    if (!pendingCredentials) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/login-otp/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(pendingCredentials),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setOtpSent(true);
        setCountdown(120); // 2 minutes countdown for resend
        toast({
          title: "OTP sent",
          description: `A new verification code has been sent to ${email}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to send OTP",
          description: result.message || "Please try again.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Network error",
        description: "Failed to send OTP. Please check your connection.",
      });
    }
  };

  // Verify OTP and complete login
  const verifyOTPAndLogin = async (otpCode: string) => {
    if (!pendingCredentials) return;
    
    setIsLoading(true);

    try {
      // Verify OTP and complete login
      const response = await fetch(`${API_BASE_URL}/login-otp/verify-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          email: pendingCredentials.email, 
          password: pendingCredentials.password,
          otp: otpCode 
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Login successful
        await queryClient.invalidateQueries({ queryKey: ['/auth/user'] });
        await new Promise(resolve => setTimeout(resolve, 100));

        toast({
          title: "Login successful",
          description: "Welcome back to the project management system."
        });

        // Reset states and redirect
        setLoginStep('credentials');
        setPendingCredentials(null);
        setOtp('');
        setLocation('/projects');
      } else {
        toast({
          variant: "destructive",
          title: "Verification failed",
          description: result.message || "Invalid OTP. Please try again.",
        });
        setOtp('');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: "An error occurred during verification. Please try again.",
      });
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const resendOTP = async () => {
    if (!pendingCredentials) return;
    await sendOTPForLogin(pendingCredentials.email);
  };

  // Go back to credentials step
  const goBackToCredentials = () => {
    setLoginStep('credentials');
    setPendingCredentials(null);
    setOtp('');
    setOtpSent(false);
    setCountdown(0);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-tl from-gray-900 to-slate-800">
      <Card className="w-full max-w-md border-none shadow-lg bg-white/5 backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-400 to-violet-500 text-transparent bg-clip-text">
            Project Management System
          </CardTitle>
          <CardDescription className="text-center text-gray-300">
            {loginStep === 'credentials' 
              ? 'Enter your credentials to sign in'
              : 'Enter the verification code sent to your email'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Security Notice */}
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center text-blue-400 text-sm">
              <Shield className="mr-2 h-4 w-4" />
              <span>Secure login with email verification required</span>
            </div>
          </div>

          {loginStep === 'credentials' ? (
            // Credentials Form
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitCredentials)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-200">Email</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="your.email@example.com" 
                          {...field} 
                          className="bg-gray-800/60 border-gray-700 text-gray-100"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-200">Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          {...field} 
                          className="bg-gray-800/60 border-gray-700 text-gray-100"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Shield className="mr-2 h-4 w-4" /> Secure Sign In
                    </span>
                  )}
                </Button>
                
                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-gray-400 hover:text-gray-200"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot your password?
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            // OTP Verification Step
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto">
                  <Mail className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-sm text-gray-300">
                  We've sent a verification code to:
                </p>
                <p className="font-medium text-gray-100">{pendingCredentials?.email}</p>
              </div>

              <div className="space-y-4">
                <Label className="text-center block text-gray-200">Enter Verification Code</Label>
                <OTPInput
                  length={6}
                  onComplete={verifyOTPAndLogin}
                  value={otp}
                  disabled={isLoading}
                  className="justify-center"
                />
              </div>

              <div className="text-center space-y-3">
                <p className="text-sm text-gray-400">
                  Didn't receive the code?
                </p>
                <div className="flex flex-col space-y-2">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={resendOTP}
                    disabled={countdown > 0 || isLoading}
                    className="h-auto p-0 text-blue-400 hover:text-blue-300"
                  >
                    {countdown > 0 ? (
                      <>
                        <Clock className="w-4 h-4 mr-1" />
                        Resend in {countdown}s
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Resend Code
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="link"
                    size="sm"
                    onClick={goBackToCredentials}
                    disabled={isLoading}
                    className="h-auto p-0 text-gray-400 hover:text-gray-200"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Login
                  </Button>
                </div>
              </div>

              {isLoading && (
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2 text-blue-400">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm">Verifying code...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        
        <ForgotPasswordModal
          isOpen={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />
      </Card>
    </div>
  );
}