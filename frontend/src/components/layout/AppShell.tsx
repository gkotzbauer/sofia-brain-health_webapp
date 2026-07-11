import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { NavBar } from './NavBar';

export function AppShell({ children }: { children: ReactNode }) {
  // The chat route's three-panel layout (chat + memory journal + feedback)
  // needs far more width than the app's default 720px reading-width shell
  // -- widened just for that route rather than raising the cap globally,
  // which would make every other (single-column, prose-heavy) page too wide.
  const { pathname } = useLocation();
  const isWideRoute = pathname === '/chat';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <NavBar />
      <main id="main-content" className={isWideRoute ? 'app-main app-main-wide' : 'app-main'} role="main">
        {children}
      </main>
    </div>
  );
}
