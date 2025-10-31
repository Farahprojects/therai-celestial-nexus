import { useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoginModal from '@/components/auth/LoginModal';
import UnifiedNavigation from '@/components/UnifiedNavigation';
import Footer from '@/components/Footer';
import { getRedirectPath } from '@/utils/redirectUtils';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // Auto-scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      // Check for redirect param first, then location state, then default
      const redirectPath = getRedirectPath(searchParams);
      const from = redirectPath || (location.state as any)?.from?.pathname || '/therai';
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, location.state, searchParams]);

  const handleSuccess = () => {
    // Check for redirect param first, then location state, then default
    const redirectPath = getRedirectPath(searchParams);
    const from = redirectPath || (location.state as any)?.from?.pathname || '/therai';
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-white">
      <UnifiedNavigation />
      <div className="pt-8">
        <LoginModal onSuccess={handleSuccess} showAsPage={true} />
      </div>
      <Footer />
    </div>
  );
}