import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV_LINKS = [
  { to: '/chat', label: 'Conversation' },
  { to: '/goals', label: 'Quests' },
  { to: '/story', label: 'Story' },
  { to: '/documents', label: 'Documents' },
  { to: '/profile', label: 'About Me' },
  { to: '/feedback', label: 'Share Your Thoughts' },
  { to: '/survey', label: 'Survey' }
];

export function NavBar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const isClinician = user?.role === 'clinician' || user?.role === 'admin';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="nav-bar" role="banner">
      <Link to="/chat" className="nav-brand" aria-label="Sofia home">
        <span aria-hidden="true">🧭</span> Sofia
      </Link>
      {isAuthenticated && (
        <nav aria-label="Primary" className="nav-links">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}>
              {link.label}
            </NavLink>
          ))}
          {isClinician && (
            <NavLink to="/clinician" className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}>
              Clinician alerts
            </NavLink>
          )}
        </nav>
      )}
      <div className="nav-actions">
        {isAuthenticated && (
          <div className="nav-user">
            <span className="nav-user-name">{user?.name}</span>
            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
