
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Settings, LayoutDashboard } from "lucide-react";
import { useNavigationState } from "@/contexts/NavigationStateContext";


const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getSafeRedirectPath } = useNavigationState();

  useEffect(() => {
  }, [location.pathname]);

  const handleGoBack = () => {
    // Try to go back in history, but if it's not possible (e.g., opened directly),
    // navigate to the last known safe route
    const lastSafePath = getSafeRedirectPath();
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate(lastSafePath);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-5xl font-bold mb-4 text-primary">404</h1>
        <p className="text-xl text-gray-600 mb-6">Oops! Page not found</p>
        
        <div className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleGoBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          
          <Link to={user ? getSafeRedirectPath() : "/"} className="block">
            <Button className="w-full">
              <Home className="mr-2 h-4 w-4" />
              {user ? "Return to Chat" : "Return to Home"}
            </Button>
          </Link>
          
          {user && (
            <div className="space-y-2 pt-2">
              <p className="text-sm text-gray-500">Or navigate to:</p>
              <Link to="/calendar" className="block">
                <Button variant="ghost" className="w-full">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Calendar
                </Button>
              </Link>
              <Link to="/settings" className="block">
                <Button variant="ghost" className="w-full">
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
