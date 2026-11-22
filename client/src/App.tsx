import { RouterProvider } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { router } from './router';

function AuthGate() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return <RouterProvider router={router} />;
}

export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
