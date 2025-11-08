import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import { useAdminRole } from './hooks/useAdminRole';
import { supabase } from './lib/supabase';

const queryClient = new QueryClient();

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const { isAdmin, isLoading } = useAdminRole(session?.user?.id);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session ?? null);
      })
      .finally(() => {
        if (isMounted) {
          setInitializing(false);
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 font-light">Loading session...</div>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={setSession} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 font-light">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto p-8 bg-white rounded-xl shadow-sm space-y-4">
          <h1 className="text-2xl font-light text-gray-900">Access Denied</h1>
          <p className="text-gray-600 font-light">
            You do not have admin privileges to access this dashboard.
          </p>
          <button
            onClick={() => setSession(null)}
            className="w-full bg-gray-900 text-white py-3 px-6 rounded-xl font-light hover:bg-gray-800 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard session={session} onLogout={() => setSession(null)} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;

