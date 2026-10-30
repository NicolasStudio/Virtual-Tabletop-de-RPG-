import { useEffect, lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from 'react-router-dom';
import { useAuth } from './store/auth.js';
import { LoginPage } from './pages/LoginPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CampaignPage } from './pages/CampaignPage.js';
// ScenePage carrega Konva (pesado) — só baixa quando o usuário abre o mapa
const ScenePage = lazy(() => import('./pages/ScenePage.js').then((m) => ({ default: m.ScenePage })));

function TopBar() {
  const { status, user } = useAuth();
  return (
    <header className="topbar">
      <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
        ⚔ TABLETOP VTT
      </Link>
      <span className="muted">Virtual Tabletop de RPG</span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
        {status === 'authed' ? (
          <>
            <Link to="/profile" className="badge ok" style={{ textDecoration: 'none' }}>
              {user?.displayName}
            </Link>
          </>
        ) : (
          <span className="badge">visitante</span>
        )}
      </span>
    </header>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === 'idle' || status === 'loading') {
    return <main className="container">Carregando…</main>;
  }
  if (status !== 'authed') {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  return <>{children}</>;
}

export function App() {
  const { bootstrap } = useAuth();
  useEffect(() => {
    void bootstrap(); // tenta restaurar sessão pelo cookie httpOnly
  }, [bootstrap]);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <TopBar />
        <Routes>
          {/* Cadastro e senha ficam na Ficha Ordem Paranormal (login pela Ficha) */}
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/campaigns/:id"
            element={
              <RequireAuth>
                <CampaignPage />
              </RequireAuth>
            }
          />
          <Route
            path="/campaigns/:campaignId/scene"
            element={
              <RequireAuth>
                <Suspense fallback={<main className="container">Carregando mapa…</main>}>
                  <ScenePage />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
