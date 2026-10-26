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

/** The shell always renders the home page, which calls /health. */
function mockSignedInManager() {
  mockApi({
    'GET /auth/me': { user: manager },
    'GET /health': { api: 'ok', database: 'ok', timestamp: '2026-01-15T17:30:00.000Z' },
  });
}

function renderShell() {
  const router = createMemoryRouter(
    [{ element: <RootLayout />, children: [{ path: '/', element: <HomePage /> }] }],
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
