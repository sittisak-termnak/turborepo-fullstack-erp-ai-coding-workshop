import { useMutation, useQueryClient } from '@tanstack/react-query';
import { APP_ERRORS } from '@erp/contracts';
import { ORPCError } from '@orpc/client';
import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeRedirect, useSession } from '@/lib/auth';
import { orpc } from '@/lib/orpc';

/**
 * The API answers with the actionable Thai message from the shared catalogue, so it is displayed
 * as-is. Only a request that never reached the API needs a message from this side.
 */
function signInErrorMessage(error: unknown): string {
  return error instanceof ORPCError ? error.message : APP_ERRORS.UNREACHABLE.message;
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirect'));
  const queryClient = useQueryClient();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation(
    orpc.auth.login.mutationOptions({
      // Storing the session re-renders this page, which then redirects below.
      onSuccess: (user) => queryClient.setQueryData(orpc.auth.me.queryKey(), { user }),
    }),
  );

  if (session.data?.user) return <Navigate to={redirectTo} replace />;

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">ระบบจัดการธุรกิจค้าปลีก</CardTitle>
          <CardDescription>กรุณาเข้าสู่ระบบเพื่อใช้งาน</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              login.mutate({ email, password });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {login.error && (
              <p role="alert" className="text-sm text-destructive">
                {signInErrorMessage(login.error)}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
