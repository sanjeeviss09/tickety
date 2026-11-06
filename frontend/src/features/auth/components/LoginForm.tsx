import { useState } from 'react';
import { useForm as useHookForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const loginSchema = z.object({
  employee_id: z.string().min(1, { message: 'Employee ID is required' }),
  password: z.string().min(5, { message: 'Password must be at least 5 characters' }),
});

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  const checkEmployeeResetStatus = async (empId: string): Promise<boolean> => {
    const clean = empId?.trim();
    if (!clean) return false;
    try {
      const res = await api.get(`/auth/check-user/${encodeURIComponent(clean)}`);
      if (res.data?.data?.password_reset_required) {
        setIsFirstLogin(true);
        setIsPasswordReset(true);
        setError(null);
        setSuccess('Your password has been reset. Please enter a new password below to sign in.');
        return true;
      }
    } catch {}
    return false;
  };

  const handleForgotPassword = async () => {
    const employee_id = form.getValues('employee_id');
    if (!employee_id) {
      setError('Please enter your Employee ID first to reset your password.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const resetMode = await checkEmployeeResetStatus(employee_id);
      if (resetMode) {
        return;
      }

      // Switch directly to new password setup mode for internal accounts
      setIsFirstLogin(true);
      setIsPasswordReset(true);
      setSuccess('Enter your new password below and click "Set New Password & Login".');
    } catch (err: any) {
      setError(err.message || 'Failed to initiate password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const form = useHookForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      employee_id: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const email = `${values.employee_id.toLowerCase()}@deskpulse.internal`;
      
      if (isFirstLogin) {
        // Handle first time password setup via backend
        const response = await api.post('/auth/first-login', {
          employee_id: values.employee_id,
          password: values.password
        });
        
        if (response.data.status === 'success') {
          // Use the real email returned by the backend (not the fake @deskpulse.internal one)
          const loginEmail = response.data.email || `${values.employee_id.toLowerCase()}@deskpulse.internal`;
          
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: values.password,
          });
          
          if (signInError) throw signInError;
        }
      } else {
        // Standard login - try internal email format first
        let { error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: values.password,
        });

        // Fallback: If internal email format failed, check if employee has a custom email in profile
        if (signInError && signInError.message.includes('Invalid login credentials')) {
          try {
            const profileRes = await api.get(`/employees`);
            const matchedEmp = profileRes.data.data?.find(
              (e: any) => e.employee_id?.toUpperCase() === values.employee_id.toUpperCase()
            );
            if (matchedEmp?.email_address && matchedEmp.email_address !== email) {
              const res = await supabase.auth.signInWithPassword({
                email: matchedEmp.email_address,
                password: values.password,
              });
              signInError = res.error;
            }
          } catch {}
        }

        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            const wasReset = await checkEmployeeResetStatus(values.employee_id);
            if (wasReset) {
              form.setValue('password', '');
              return;
            }
            throw new Error('Invalid credentials. If this is your first time logging in or your password was reset, please click "First time login / Reset? Set up your password."');
          }
          throw signInError;
        }
      }
    } catch (err: any) {
      // Axios error extraction
      const data = err.response?.data;
      let message = err.message || 'An error occurred during login';
      
      if (data) {
        if (typeof data.message === 'string') {
          message = data.message;
        } else if (typeof data.message === 'object' && data.message !== null) {
          message = data.message.message || JSON.stringify(data.message);
        } else if (data.errors && data.errors.length > 0) {
          const firstErr = data.errors[0];
          message = typeof firstErr === 'string' ? firstErr : (firstErr.message || JSON.stringify(firstErr));
        }
      }
      
      if (typeof message === 'object') {
        // Handle empty object explicitly
        if (Object.keys(message).length === 0) {
          message = 'Network error or rate limit exceeded. Please try again.';
        } else {
          message = JSON.stringify(message);
        }
      }

      // Handle the literal string "{}" which can happen from Supabase Auth errors
      if (message === '{}' || message === '""') {
        message = 'An unexpected authentication error occurred. Please verify your details or try again later.';
      }

      setError(String(message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          {isFirstLogin ? (isPasswordReset ? 'Set New Password' : 'Setup Account') : 'Sign In'}
        </CardTitle>
        <CardDescription>
          {isFirstLogin 
            ? 'Enter your Employee ID and create a new password to sign in.'
            : 'Enter your Employee ID and password to access your account.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. AXX09"
                      {...field}
                      onBlur={(e) => {
                        field.onBlur();
                        if (!isFirstLogin && e.target.value?.trim()) {
                          checkEmployeeResetStatus(e.target.value);
                        }
                      }}
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
                  <FormLabel>{isFirstLogin ? 'New Password' : 'Password'}</FormLabel>
                  <FormControl>
                    <Input placeholder={isFirstLogin ? 'Enter new password (min 5 chars)' : '••••••••'} type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
            
            {success && (
              <div className="text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2.5">{success}</div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? (isFirstLogin ? 'Setting password...' : 'Signing in...')
                : (isFirstLogin ? (isPasswordReset ? 'Set New Password & Login' : 'Set Password & Login') : 'Sign In')}
            </Button>
            
            <div className="flex flex-col space-y-2 text-center mt-4">
              <Button 
                type="button" 
                variant="link" 
                onClick={() => {
                  setIsFirstLogin(!isFirstLogin);
                  setIsPasswordReset(false);
                  setError(null);
                  setSuccess(null);
                }}
              >
                {isFirstLogin ? 'Already have a password? Sign in here.' : 'First time login / Password reset? Set new password.'}
              </Button>
              
              {!isFirstLogin && (
                <Button 
                  type="button" 
                  variant="link" 
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                >
                  Forgot your password?
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
