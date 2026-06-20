import React, { useEffect, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import FAQ from './components/FAQ';
import UserManual from './components/UserManual';
import { CodeExplorer } from './components/CodeExplorer';
import { useAppContext } from './context/AppContext';

// RequiresAnalysis route guard: redirects to /dashboard if decompiler result is missing
interface RouteGuardProps {
  children: React.ReactNode;
}

const RequiresAnalysis: React.FC<RouteGuardProps> = ({ children }) => {
  const { result } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!result) {
      navigate('/dashboard', { replace: true });
    }
  }, [result, navigate]);

  if (!result) return null;
  return <>{children}</>;
};

// Dedicated page component for /explorer
const ExplorerPage: React.FC = () => {
  const { result, flashBuffer, setIsExplorerOpen } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    setIsExplorerOpen(true);
    return () => {
      setIsExplorerOpen(false);
    };
  }, [setIsExplorerOpen]);

  if (!result) return null;

  return (
    <div className="h-screen w-screen overflow-hidden">
      <CodeExplorer
        result={result}
        flashBuffer={flashBuffer}
        onClose={() => navigate('/dashboard', { replace: true })}
      />
    </div>
  );
};

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setIsDemoMode, connectionStatus, flashBuffer, resetAllPipelineState } = useAppContext();

  // STATE-001 / STATE-014: when pathname becomes '/', reset isDemoMode. Do NOT reset on FAQ or manual.
  useEffect(() => {
    if (location.pathname === '/') {
      setIsDemoMode(false);
      resetAllPipelineState();
    }
  }, [location.pathname, setIsDemoMode, resetAllPipelineState]);

  const isFirstRender = useRef(true);

  // STATE-015: Refresh guard redirects to '/' when connectionStatus==='idle' AND flashBuffer===null AND session was active (only on mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      const sessionActive = sessionStorage.getItem('binino_session_active');
      if (
        (location.pathname === '/dashboard' || location.pathname === '/explorer') &&
        sessionActive === 'true' &&
        connectionStatus === 'idle' &&
        flashBuffer === null
      ) {
        sessionStorage.removeItem('binino_session_active');
        alert("Session data was lost on refresh — please reconnect.");
        navigate('/', { replace: true });
      }
    }
  }, [location.pathname, connectionStatus, flashBuffer, navigate]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/manual" element={<UserManual />} />
      <Route
        path="/explorer"
        element={
          <RequiresAnalysis>
            <ExplorerPage />
          </RequiresAnalysis>
        }
      />
    </Routes>
  );
};

export default App;
