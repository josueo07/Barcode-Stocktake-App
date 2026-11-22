import { RouterProvider } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { router } from './router';

function AuthGate() {
  const { user, logout } = useAuth();
  if (!user) return <LoginPage />;
  return (
    <>
      <div className="user-bar">
        <span>
          {user.displayName} · {user.role === 'supervisor' ? 'Supervisor' : 'Contador'}
        </span>
        {user.role === 'supervisor' && <a href="/users">Personas</a>}
        <button type="button" className="link-button" onClick={logout}>
          Salir
        </button>
      </div>
      <RouterProvider router={router} />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
