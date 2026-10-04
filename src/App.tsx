import {
  useEffect,
  useState,
} from 'react';

import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ResetPassword from './pages/ResetPassword';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Tutor from './pages/Tutor';
import Practice from './pages/Practice';
import Progress from './pages/Progress';
import History from './pages/History';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

import Layout from './components/Layout';

function Guard({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  const loc = useLocation();

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: loc.pathname,
        }}
      />
    );
  }

  return <>{children}</>;
}

export default function App() {
  const [session, setSession] =
    useState<Session | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [passwordRecovery, setPasswordRecovery] =
    useState(false);

  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(data.session);
      setLoading(false);
    }

    loadSession();

    const {
      data,
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        setSession(session);

        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true);
          setLoading(false);

          if (window.location.pathname !== '/reset-password') {
            nav('/reset-password', {
              replace: true,
            });
          }

          return;
        }

        if (event === 'SIGNED_OUT') {
          setPasswordRecovery(false);
        }
      }
    );

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [nav]);

  useEffect(() => {
    if (
      session &&
      !passwordRecovery &&
      (
        loc.pathname === '/login' ||
        loc.pathname === '/signup'
      )
    ) {
      nav('/dashboard', {
        replace: true,
      });
    }
  }, [
    session,
    passwordRecovery,
    loc.pathname,
    nav,
  ]);

  if (loading) {
    return (
      <div className="screen-center">
        Loading LearnMate AI…
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Landing />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/signup"
        element={<Signup />}
      />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      <Route
        path="/onboarding"
        element={
          <Guard session={session}>
            <Onboarding />
          </Guard>
        }
      />

      <Route
        path="/"
        element={<Layout />}
      >
        <Route
          path="dashboard"
          element={
            <Guard session={session}>
              <Dashboard />
            </Guard>
          }
        />

        <Route
          path="tutor"
          element={
            <Guard session={session}>
              <Tutor />
            </Guard>
          }
        />

        <Route
          path="practice"
          element={
            <Guard session={session}>
              <Practice />
            </Guard>
          }
        />

        <Route
          path="progress"
          element={
            <Guard session={session}>
              <Progress />
            </Guard>
          }
        />

        <Route
          path="history"
          element={
            <Guard session={session}>
              <History />
            </Guard>
          }
        />

        <Route
          path="profile"
          element={
            <Guard session={session}>
              <Profile />
            </Guard>
          }
        />

        <Route
          path="settings"
          element={
            <Guard session={session}>
              <Settings />
            </Guard>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  );
}