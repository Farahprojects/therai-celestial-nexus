import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PublicOnlyGuardProps {
  children: React.ReactNode;
}

export const PublicOnlyGuard: React.FC<PublicOnlyGuardProps> = ({ children }) => {
  const { user, loading } = useAuth();

  // Show loading state while checking auth
  if (loading) {
    return <div>Loading...</div>;
  }

  // If user is authenticated, redirect to thread selection page
  if (user) {
    return <Navigate to="/therai" replace />;
  }

  // If not authenticated, show public content
  return <>{children}</>;
};