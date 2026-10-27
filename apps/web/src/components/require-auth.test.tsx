import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthStatus } from '@/components/health-status';
import { createQueryClient } from '@/lib/query-client';
import { mockApi, unauthorized } from '@/test/mock-api';
import { RequireAuth } from './require-auth';

const storeEmployee = {
  id: '2',
  email: 'staff_b01@erp.local',
  name: 'Staff B01',
  role: 'STORE_EMPLOYEE',
};

function LoginStub() {
  const location = useLocation();
  return <p>Login page {location.search}</p>;
}

function renderProtected(page: React.ReactElement, url = '/orders') {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginStub /> },
      { element: <RequireAuth />, children: [{ path: '/orders', element: page }] },
    ],
    { initialEntries: [url] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('RequireAuth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the page for a signed-in user', async () => {
    mockApi({ 'GET /auth/me': { user: storeEmployee } });

    renderProtected(<p>Orders page</p>);

    expect(await screen.findByText('Orders page')).toBeInTheDocument();
  });

  // This is the first thing on screen on a cold load of any page, so it has to be Thai too.
  it('says it is loading in Thai while the session is still unknown', () => {
    mockApi({ 'GET /auth/me': { user: storeEmployee } });

    renderProtected(<p>Orders page</p>);

    expect(screen.getByText('กำลังโหลด…')).toBeInTheDocument();
  });

  it('redirects to /login and remembers where the user was going', async () => {
    mockApi({ 'GET /auth/me': { user: null } });

    renderProtected(<p>Orders page</p>, '/orders?status=open');

    expect(
      await screen.findByText('Login page ?redirect=%2Forders%3Fstatus%3Dopen'),
    ).toBeInTheDocument();
  });

  it('redirects to /login when any API call answers 401', async () => {
    mockApi({ 'GET /auth/me': { user: storeEmployee }, 'GET /health': unauthorized() });

    renderProtected(<HealthStatus />);

    expect(await screen.findByText(/^Login page/)).toBeInTheDocument();
  });
});
