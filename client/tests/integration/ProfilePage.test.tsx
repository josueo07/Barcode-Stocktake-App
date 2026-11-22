import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { config } from '../../src/config';
import { AuthContext, type AuthContextValue } from '../../src/auth/AuthContext';
import { ProfilePage } from '../../src/pages/ProfilePage';
import { UsersPage } from '../../src/pages/UsersPage';
import { server } from '../mocks/server';

function auth(role: 'supervisor' | 'counter'): AuthContextValue {
  return {
    user: { id: 1, username: 'ana', displayName: 'Ana Rivera', role },
    isSupervisor: role === 'supervisor',
    login: async () => {},
    logout: vi.fn(async () => true),
    updateCurrentUser: vi.fn(),
  };
}

function renderWith(value: AuthContextValue, page: JSX.Element) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter>{page}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProfilePage', () => {
  it("shows the counter's activity and no team section", async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/auth/me/stats`, () =>
        HttpResponse.json({ stats: { scans: 12, units: 40, sessions: 2, lastScanAt: null } }),
      ),
    );
    renderWith(auth('counter'), <ProfilePage />);
    expect(screen.getByText('AR')).toBeInTheDocument();
    expect(screen.getByText('Contador')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('40')).toBeInTheDocument());
    expect(screen.queryByText('Personas')).not.toBeInTheDocument();
  });

  it('checks the new PIN matches before sending it', async () => {
    renderWith(auth('counter'), <ProfilePage />);
    await userEvent.type(screen.getByLabelText('PIN actual'), '123456');
    await userEvent.type(screen.getByLabelText('PIN nuevo (mínimo 6)'), '999999');
    await userEvent.type(screen.getByLabelText('Repite el PIN nuevo'), '999998');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar PIN' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/no coinciden/);
  });
});

describe('UsersPage', () => {
  it('shows one supervisor and a list of counters, and only adds counters', async () => {
    let created: unknown = null;
    server.use(
      http.get(`${config.apiBaseUrl}/api/users`, () =>
        HttpResponse.json({
          users: [
            {
              id: 1,
              username: 'ana',
              displayName: 'Ana Rivera',
              role: 'supervisor',
              active: true,
              createdAt: '',
            },
            {
              id: 2,
              username: 'luis',
              displayName: 'Luis',
              role: 'counter',
              active: true,
              createdAt: '',
            },
            {
              id: 3,
              username: 'marta',
              displayName: 'Marta',
              role: 'counter',
              active: true,
              createdAt: '',
            },
          ],
        }),
      ),
      http.post(`${config.apiBaseUrl}/api/users`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json({ user: {} }, { status: 201 });
      }),
    );
    renderWith(auth('supervisor'), <UsersPage />);
    await waitFor(() => expect(screen.getByText('Contadores (2)')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Nombre'), 'Pedro');
    await userEvent.type(screen.getByLabelText('Usuario para entrar'), 'pedro');
    await userEvent.type(screen.getByLabelText(/PIN/), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir contador' }));
    await waitFor(() =>
      expect(created).toEqual({
        username: 'pedro',
        displayName: 'Pedro',
        pin: '123456',
        role: 'counter',
      }),
    );
  });
});
