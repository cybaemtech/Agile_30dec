import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { OTPInput } from '@/components/ui/otp-input';
import { API_BASE_URL } from '@/lib/api-config';
import { Mail, Clock, RefreshCw, Shield, CheckCircle } from 'lucide-react';

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
  onVerificationSuccess?: () => void;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  onClose,
  email: initialEmail = '',
  onVerificationSuccess
}) => {
  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      if (isOpen) {
        setStep('otp');
      }
    }
  }, [initialEmail, isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendOTP = async (isResend = false) => {
    if (!email.trim()) {
      toast({
        variant: 'destructive',
        title: 'Email required',
        description: 'Please enter your email address.'
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        variant: 'destructive',
        title: 'Invalid email',
        description: 'Please enter a valid email address.'
      });
      return;
    }

    if (isResend) {
      setIsResending(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/email-verification/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: isResend ? 'OTP resent' : 'OTP sent',
          description: result.message
        });
        setStep('otp');
        setCountdown(120); // 2 minutes countdown for resend
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to send OTP',
          description: result.message
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Network error',
        description: 'Failed to send OTP. Please check your connection.'
      });
    } finally {
      setIsLoading(false);
      setIsResending(false);
    }
  };

  const verifyOTP = async (otpCode: string) => {
    if (!otpCode || otpCode.length !== 6) {
      toast({
        variant: 'destructive',
        title: 'Invalid OTP',
        description: 'Please enter a complete 6-digit OTP.'
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/email-verification/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, otp: otpCode }),
      });

      const result = await response.json();

      if (response.ok) {
        setStep('success');
        toast({
          title: 'Email verified!',
          description: 'Your email has been successfully verified.'
        });
        
        // Delay the success callback to show the success state
        setTimeout(() => {
          onVerificationSuccess?.();
          onClose();
        }, 2000);
      } else {
        toast({
          variant: 'destructive',
          title: 'Verification failed',
          description: result.message
        });
        setOtp('');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Network error',
        description: 'Failed to verify OTP. Please check your connection.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (step !== 'success') {
      setStep('email');
      setOtp('');
      setCountdown(0);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <Shield className="w-5 h-5 text-blue-500" />
            )}
            {step === 'email' && 'Email Verification Required'}
            {step === 'otp' && 'Verify Your Email'}
            {step === 'success' && 'Email Verified Successfully!'}
          </DialogTitle>
          <DialogDescription>
            {step === 'email' && 'To secure your account, please verify your email address.'}
            {step === 'otp' && 'Enter the 6-digit verification code sent to your email.'}
            {step === 'success' && 'Your account is now secure and ready to use.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'email' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="mt-1"
                disabled={isLoading}
              />
            </div>
            <DialogFooter>
              <Button onClick={handleClose} variant="outline" disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={() => sendOTP()} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send OTP
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-sm text-muted-foreground">
                We've sent a verification code to:
              </p>
              <p className="font-medium">{email}</p>
            </div>

            <div className="space-y-4">
              <Label className="text-center block">Enter Verification Code</Label>
              <OTPInput
                length={6}
                onComplete={verifyOTP}
                value={otp}
                disabled={isLoading}
                className="justify-center"
              />
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Didn't receive the code?
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => sendOTP(true)}
                disabled={countdown > 0 || isResending}
                className="h-auto p-0"
              >
                {countdown > 0 ? (
                  <>
                    <Clock className="w-4 h-4 mr-1" />
                    Resend in {countdown}s
                  </>
                ) : isResending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    Resending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Resend OTP
                  </>
                )}
              </Button>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center space-y-6 py-4">
            <div className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Verification Complete!</h3>
              <p className="text-muted-foreground">
                Your email has been verified successfully. You can now securely access your account.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EmailVerificationModal;