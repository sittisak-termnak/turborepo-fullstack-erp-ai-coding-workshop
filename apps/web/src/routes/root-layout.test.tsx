import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { ROLE_LABELS } from '@erp/contracts';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { mockApi } from '@/test/mock-api';
import { HomePage } from './home';
import { RootLayout } from './root-layout';

const manager = { id: '5', email: 'manager01@erp.local', name: 'Manager One', role: 'MANAGER' };
const admin = { id: '1', email: 'admin01@erp.local', name: 'Admin One', role: 'ADMINISTRATOR' };

/** The shell always renders the home page, which calls /health. */
function mockSignedIn(user: typeof manager) {
  mockApi({
    'GET /auth/me': { user },
    'GET /health': { api: 'ok', database: 'ok', timestamp: '2026-01-15T17:30:00.000Z' },
  });
}

const mockSignedInManager = () => mockSignedIn(manager);

function renderShell() {
  const router = createMemoryRouter(
    [
      {
        element: <RootLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/stores', element: <p>หน้าจัดการสาขา</p> },
        ],
      },
    ],
    { initialEntries: ['/'] },
  );
  const { container } = render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return container;
}

describe('RootLayout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('names the application in Thai', async () => {
    mockSignedInManager();

    renderShell();

    expect(await screen.findByText('ระบบจัดการธุรกิจค้าปลีก')).toBeInTheDocument();
  });

  it('shows the signed-in user with a Thai role label and a Thai sign-out action', async () => {
    mockSignedInManager();

    renderShell();

    expect(await screen.findByText('Manager One')).toBeInTheDocument();
    expect(screen.getByText(ROLE_LABELS.MANAGER)).toBeInTheDocument();
    expect(screen.queryByText('MANAGER')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ออกจากระบบ/ })).toBeInTheDocument();
  });

  it('writes the home page in Thai, with no leftover English copy', async () => {
    mockSignedInManager();

    const container = renderShell();
    await screen.findByText('Manager One');

    expect(container.textContent).not.toMatch(/Welcome|workshop|The stack is up/i);
  });
});

// Store maintenance is the Administrator's screen. The API is what refuses everyone else
// (apps/api enforces it, and stores.controller.spec.ts proves the refusal); the shell only
// decides whether to offer the way in, so a Manager is not sent to a page that will 403.
describe('RootLayout store maintenance link', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers store maintenance to an Administrator', async () => {
    mockSignedIn(admin);

    renderShell();

    expect(await screen.findByRole('link', { name: 'จัดการสาขา' })).toBeInTheDocument();
  });

  it('does not offer it to a Manager, who the API would refuse anyway', async () => {
    mockSignedInManager();

    renderShell();

    await screen.findByText('Manager One');
    expect(screen.queryByRole('link', { name: 'จัดการสาขา' })).not.toBeInTheDocument();
  });
});
