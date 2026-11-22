import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../src/config';
import { AuthContext, type AuthContextValue } from '../../src/auth/AuthContext';
import { SessionListPage } from '../../src/pages/SessionListPage';
import { server } from '../mocks/server';

const draftSession = {
  id: 1,
  name: 'Draft Session',
  status: 'draft' as const,
  notes: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date().toISOString(),
};

const activeSession = {
  ...draftSession,
  id: 2,
  name: 'Active Session',
  status: 'active' as const,
};

const supervisorAuth: AuthContextValue = {
  user: { id: 1, username: 'sup', displayName: 'Sup', role: 'supervisor' },
  isSupervisor: true,
  login: async () => {},
  logout: async () => true,
  updateCurrentUser: () => {},
};

function renderPage() {
  return render(
    <AuthContext.Provider value={supervisorAuth}>
      <MemoryRouter>
        <SessionListPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('SessionListPage', () => {
  afterEach(() => vi.restoreAllMocks());
  it('shows the delete action for drafts and active sessions', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/sessions`, () =>
        HttpResponse.json({ sessions: [draftSession, activeSession] }),
      ),
    );

    renderPage();

    await waitFor(() => expect(screen.getByText('Draft Session')).toBeInTheDocument());
    expect(screen.getByText('Active Session')).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    const draftItem = items.find((li) => li.textContent?.includes('Draft Session'));
    const activeItem = items.find((li) => li.textContent?.includes('Active Session'));

    expect(
      within(draftItem as HTMLElement).getByRole('button', { name: /borrar/i }),
    ).toBeInTheDocument();
    expect(
      within(activeItem as HTMLElement).getByRole('button', { name: /borrar/i }),
    ).toBeInTheDocument();
  });

  it('removes a session from the list after a successful delete', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    let sessions = [draftSession];
    server.use(
      http.get(`${config.apiBaseUrl}/api/sessions`, () => HttpResponse.json({ sessions })),
      http.delete(`${config.apiBaseUrl}/api/sessions/1`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('confirm')).toBe('true');
        sessions = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Draft Session')).toBeInTheDocument());
    const deleteButton = screen.getByRole('button', { name: /borrar/i });
    await user.click(deleteButton);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining(draftSession.name));
    expect(sessions).toEqual([draftSession]);
    await user.click(deleteButton);

    await waitFor(() => expect(screen.getByText(/todavía no hay conteos/i)).toBeInTheDocument());
  });

  it('shows an error banner when delete fails and keeps the session listed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    server.use(
      http.get(`${config.apiBaseUrl}/api/sessions`, () =>
        HttpResponse.json({ sessions: [draftSession] }),
      ),
      http.delete(`${config.apiBaseUrl}/api/sessions/1`, () =>
        HttpResponse.json(
          { error: { message: 'No se pudo borrar el conteo.' } },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Draft Session')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /borrar/i }));

    await waitFor(() =>
      expect(screen.getByText(/no se pudo borrar el conteo/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('Draft Session')).toBeInTheDocument();
  });
});
