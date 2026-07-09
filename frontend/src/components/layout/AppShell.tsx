import { ReactNode } from 'react';
import { NavBar } from './NavBar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <NavBar />
      <main id="main-content" className="app-main" role="main">
        {children}
      </main>
    </div>
  );
}
