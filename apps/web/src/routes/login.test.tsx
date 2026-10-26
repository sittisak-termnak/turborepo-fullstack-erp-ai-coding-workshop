import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { APP_ERRORS } from '@erp/contracts';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';
import { mockApi, unauthorized } from '@/test/mock-api';
import { LoginPage } from './login';

const admin = { id: '1', email: 'admin01@erp.local', name: 'Admin One', role: 'ADMINISTRATOR' };

function renderLogin(url = '/login') {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <p>Home page</p> },
      { path: '/orders', element: <p>Orders page</p> },
    ],
    { initialEntries: [url] },
  );
  const { container } = render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return container;
}

async function signIn(email: string, password: string) {
  fireEvent.change(await screen.findByLabelText('อีเมล'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signs in and goes to the redirect target', async () => {
    const fetch = mockApi({ 'GET /auth/me': { user: null }, 'POST /auth/login': admin });

    renderLogin('/login?redirect=%2Forders');
    await signIn('admin01@erp.local', 'password');

    expect(await screen.findByText('Orders page')).toBeInTheDocument();
    const login = fetch.mock.calls.find(([request]) => request.method === 'POST')![0];
    await expect(login.json()).resolves.toEqual({
      email: 'admin01@erp.local',
      password: 'password',
    });
  });

  // The actionable Thai text is the API's, from the shared catalogue, not a string on this screen.
  it('shows the Thai message the API returned for wrong credentials', async () => {
    mockApi({
      'GET /auth/me': { user: null },
      'POST /auth/login': unauthorized(APP_ERRORS.INVALID_CREDENTIALS.message),
    });

    renderLogin();
    await signIn('admin01@erp.local', 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      APP_ERRORS.INVALID_CREDENTIALS.message,
    );
  });

  it('shows the Thai unreachable message when the API cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        if (new URL(request.url).pathname.endsWith('/auth/me'))
          return Response.json({ user: null });
        throw new TypeError('Failed to fetch');
      }),
    );

    renderLogin();
    await signIn('admin01@erp.local', 'password');

    expect(await screen.findByRole('alert')).toHaveTextContent(APP_ERRORS.UNREACHABLE.message);
  });

  it('no longer displays demo credentials', async () => {
    mockApi({ 'GET /auth/me': { user: null } });

    const container = renderLogin();
    await screen.findByLabelText('อีเมล');

    expect(container.textContent).not.toMatch(/@erp\.local/);
    expect(container.textContent).not.toMatch(/password/i);
    expect(screen.queryByText(/ADMINISTRATOR|STORE_EMPLOYEE|MANAGER/)).not.toBeInTheDocument();
  });

  it('gives every input an accessible name', async () => {
    mockApi({ 'GET /auth/me': { user: null } });

    const container = renderLogin();
    await screen.findByLabelText('อีเมล');

    const inputs = [...container.querySelectorAll('input')];
    expect(inputs).toHaveLength(2);
    for (const input of inputs) expect(input).toHaveAccessibleName();
  });

  // NFR-06: the form must be completable and submittable without a mouse.
  it('can be completed and submitted by keyboard alone', async () => {
    const user = userEvent.setup();
    const fetch = mockApi({ 'GET /auth/me': { user: null }, 'POST /auth/login': admin });

    renderLogin('/login?redirect=%2Forders');
    await screen.findByLabelText('อีเมล');

    await user.tab();
    expect(screen.getByLabelText('อีเมล')).toHaveFocus();
    await user.keyboard('admin01@erp.local');
    await user.tab();
    expect(screen.getByLabelText('รหัสผ่าน')).toHaveFocus();
    await user.keyboard('password');
    await user.tab();
    expect(screen.getByRole('button', { name: 'เข้าสู่ระบบ' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Orders page')).toBeInTheDocument();
    expect(fetch.mock.calls.some(([request]) => request.method === 'POST')).toBe(true);
  });

  it('ignores a redirect to another site', async () => {
    mockApi({ 'GET /auth/me': { user: admin } });

    renderLogin('/login?redirect=%2F%2Fevil.example');

    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });
});
