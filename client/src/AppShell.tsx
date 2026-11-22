import { Link, Outlet } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Avatar } from './components/common/Avatar';

/** iPhone-style top bar: app name on the left, the signed-in person's avatar on the right. */
export function AppShell() {
  const { user } = useAuth();
  return (
    <>
      <header className="nav-bar">
        <Link to="/" className="nav-bar-title">
          Inventario J&amp;R
        </Link>
        {user && (
          <Link to="/perfil" className="nav-bar-profile" aria-label="Mi perfil">
            <Avatar name={user.displayName} size="sm" />
          </Link>
        )}
      </header>
      <div className="app-content">
        <Outlet />
      </div>
    </>
  );
}
