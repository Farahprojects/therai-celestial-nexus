
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Settings, User, Bell, LifeBuoy, LogOut, CreditCard, Eye, Globe, Calendar, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { UserAvatar } from '@/components/settings/UserAvatar';
import Logo from '@/components/Logo';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useSettingsModal } from '@/contexts/SettingsModalContext';
import { LogoutConfirmationDialog } from '@/components/ui/logout-confirmation-dialog';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { AuthModal } from '@/components/auth/AuthModal';
// Dashboard sidebar removed
import { Sheet, SheetContent, SheetPortal } from '@/components/ui/sheet';
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

// Add types for message nav
type MessageFilterType = "inbox" | "sent" | "starred" | "archive" | "trash";

// Add types for website builder nav
interface WebsiteBuilderMenuProps {
  isWebsiteBuilderPageMobile?: boolean;
  onOpenModal?: (section: string) => void;
  onChangeTemplate?: () => void;
  onPublish?: () => void;
  isPublishing?: boolean;
}

interface NavMessageMenuProps {
  isMessagesPageMobile?: boolean;
  activeFilter?: MessageFilterType;
  unreadCount?: number;
  onFilterChange?: (filter: MessageFilterType) => void;
}

interface UnifiedNavigationProps extends NavMessageMenuProps, WebsiteBuilderMenuProps {
  isVisible?: boolean;
  isScrolled?: boolean;
}

const UnifiedNavigation = ({
  isMessagesPageMobile,
  activeFilter,
  unreadCount,
  onFilterChange,
  isWebsiteBuilderPageMobile,
  onOpenModal,
  onChangeTemplate,
  onPublish,
  isPublishing,
  isVisible = true,
  isScrolled = false,
}: UnifiedNavigationProps = {}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  
  const { openSettings } = useSettingsModal();
  const { isAuthModalOpen, openAuthModal, closeAuthModal, authModalMode } = useAuthModal();
  
  const isLoggedIn = !!user;
  const isCalendarPage = location.pathname === '/calendar';
  
  // Dashboard pages are now cleaned up - only calendar remains
  const isDashboardPageWithBurgerMenu = isCalendarPage;
  const isDashboardPage = isCalendarPage;
  const isMessagesPage = false; // Messages removed
  const isWebsiteBuilderPage = false; // Website builder removed

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const handleSignOutClick = () => {
    setShowLogoutDialog(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutDialog(false);
    await signOut();
  };

  const handleLogoutCancel = () => {
    setShowLogoutDialog(false);
  };

  const handleOpenSettings = (panel: string) => {
    openSettings(panel as "general" | "account" | "notifications" | "support" | "billing");
  };

  // Mobile auth handlers
  const handleMobileLogin = () => {
    if (isMobile) {
      openAuthModal('login');
    } else {
      navigate('/login');
    }
  };

  const handleMobileSignup = () => {
    if (isMobile) {
      openAuthModal('signup');
    } else {
      navigate('/signup');
    }
  };

  const handlePreview = () => {
    try {
      // Generate a unique preview ID
      const previewId = Date.now().toString();
      
      // Open preview in new tab
      const previewUrl = `/preview/${previewId}`;
      window.open(previewUrl, '_blank');
      
    } catch (error) {
      console.error('Error opening preview:', error);
    }
  };

  const showHeaderSearch = false; // Messages page removed

  // For global header search: only on mobile, only for /dashboard/messages
  const headerSearch = searchParams.get('search') || '';
  const setHeaderSearch = (val: string) => {
    // Keep all other params, just update 'search'
    const next = new URLSearchParams(searchParams);
    if (val) {
      next.set('search', val);
    } else {
      next.delete('search');
    }
    setSearchParams(next, { replace: true });
  };

  // Show burger menu for website builder on BOTH mobile AND desktop
  const showDashboardBurgerMenu = isLoggedIn && isDashboardPageWithBurgerMenu;

  // Determine nav wrapper padding
  // - Remove horizontal px-4 padding for mobile burger-menu dashboard pages
  // - Keep px-4/etc for all other navs (public, desktop, etc)
  let navWrapperClass =
    "h-full max-w-none ";
  if (
    isDashboardPageWithBurgerMenu &&
    isMobile
  ) {
    navWrapperClass += "px-0";
  } else {
    navWrapperClass += "px-4 sm:px-6 lg:px-8";
  }

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 w-full h-16 bg-white z-50 shadow-sm border-b transition-all duration-300 ease-in-out ${
        isVisible 
          ? 'translate-y-0 opacity-100' 
          : '-translate-y-full opacity-0'
      } ${isScrolled ? 'shadow-md' : 'shadow-sm'}`}>
        <div className={navWrapperClass}>
          <div className="flex justify-between items-center h-full">
            {/* Left section */}
            <div className="flex items-center">
              {/* ---- DESKTOP & MOBILE BURGER BUTTON (controlled by showDashboardBurgerMenu) ---- */}
              {showDashboardBurgerMenu ? (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleSidebar} 
                  className="mr-2"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              ) : !isLoggedIn ? (
                <Logo />
              ) : null}
            </div>
            
            {/* Centered logo or search bar */}
            <div className="absolute left-1/2 transform -translate-x-1/2 min-w-0 max-w-full flex items-center">
              {showHeaderSearch ? (
                <div className="relative flex-1 w-full max-w-[70vw] sm:max-w-xs mx-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    value={headerSearch}
                    onChange={e => setHeaderSearch(e.target.value)}
                    className="pl-10 h-9 rounded-full bg-gray-100 focus:bg-white text-sm outline-none w-full border border-gray-200"
                    placeholder="Search mail"
                    style={{ minWidth: 0 }}
                    aria-label="Search mail"
                  />
                </div>
              ) : (
                isLoggedIn && (
                  <Logo />
                )
              )}
            </div>
            
            {/* Desktop Navigation - only for not logged in users */}
            <div className="hidden md:flex items-center space-x-8">
              {!isLoggedIn && (
                <>

                  <Link 
                    to="/pricing" 
                    className="text-gray-700 hover:text-gray-900 transition-all duration-300 ease-out hover:translate-y-[-1px] transform text-sm font-medium group relative"
                  >
                    <span className="relative">
                      Pricing
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 ease-out group-hover:w-full"></span>
                    </span>
                  </Link>
                  <Link 
                    to="/about" 
                    className="text-gray-700 hover:text-gray-900 transition-all duration-300 ease-out hover:translate-y-[-1px] transform text-sm font-medium group relative"
                  >
                    <span className="relative">
                      About
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 ease-out group-hover:w-full"></span>
                    </span>
                  </Link>
                  <Link 
                    to="/contact" 
                    className="text-gray-700 hover:text-gray-900 transition-all duration-300 ease-out hover:translate-y-[-1px] transform text-sm font-medium group relative"
                  >
                    <span className="relative">
                      Contact
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 ease-out group-hover:w-full"></span>
                    </span>
                  </Link>
                </>
              )}
            </div>

            {/* Call to Action Buttons or User Menu */}
            <div className="flex items-center space-x-4">
              {isLoggedIn ? (
                <>
                  {/* Website Builder Action Buttons */}
                  {isWebsiteBuilderPage && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant={isMobile ? "ghost" : "outline"}
                        size="sm"
                        onClick={handlePreview}
                        className={`flex items-center gap-2 ${isMobile ? 'border-0 bg-transparent hover:bg-transparent p-2' : ''}`}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="hidden md:inline">Preview</span>
                      </Button>
                      <Button
                        variant={isMobile ? "ghost" : "default"}
                        size="sm"
                        onClick={onPublish}
                        disabled={isPublishing}
                        className={`flex items-center gap-2 ${isMobile ? 'border-0 bg-transparent hover:bg-transparent p-2' : ''}`}
                      >
                        {isPublishing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span className="hidden md:inline">Publishing...</span>
                          </>
                        ) : (
                          <>
                            <Globe className="h-4 w-4" />
                            <span className="hidden md:inline">Publish</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="p-0 h-auto rounded-full">
                        <UserAvatar size="sm" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-48">
                      <div className="px-4 py-2 text-sm">
                        <p className="font-medium">{user.email}</p>
                      </div>
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem onClick={() => handleOpenSettings('general')}>
                        <Settings className="mr-2 h-4 w-4" />
                        General
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenSettings('account')}>
                        <User className="mr-2 h-4 w-4" />
                        Account Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenSettings('billing')}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Billing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenSettings('notifications')}>
                        <Bell className="mr-2 h-4 w-4" />
                        Notifications
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenSettings('support')}>
                        <LifeBuoy className="mr-2 h-4 w-4" />
                        Support
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem onClick={() => navigate('/calendar')}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Calendar
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem onClick={handleSignOutClick} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Button 
                    className="px-6 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-all duration-300"
                    onClick={handleMobileLogin}
                  >
                    Log In
                  </Button>
                  <Button 
                    className="px-6 rounded-full bg-white text-gray-900 border border-gray-900 hover:bg-gray-50 transition-all duration-300"
                    onClick={handleMobileSignup}
                  >
                    Sign Up
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button - Only for non-logged in users */}
            {!isLoggedIn && (
              <div className="md:hidden">
                <button
                  onClick={toggleMenu}
                  className="text-gray-700 focus:outline-none"
                >
                  {isMenuOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu - Only for non-logged in users */}
        {isMenuOpen && !isLoggedIn && (
          <div className="absolute top-full left-0 right-0 md:hidden bg-white border-t shadow-lg z-40">
            <div className="px-4 py-4 space-y-2">

              <Link 
                to="/pricing" 
                className="block text-gray-700 hover:text-gray-900 transition-all duration-300 ease-out py-2 group relative"
              >
                <span className="relative">
                  Pricing
                  <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 ease-out group-hover:w-full"></span>
                </span>
              </Link>
              <Link 
                to="/about" 
                className="block text-gray-700 hover:text-gray-900 transition-all duration-300 ease-out py-2 group relative"
              >
                <span className="relative">
                  About
                  <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 ease-out group-hover:w-full"></span>
                </span>
              </Link>
              <Link 
                to="/contact" 
                className="block text-gray-700 hover:text-gray-900 transition-all duration-300 ease-out py-2 group relative"
              >
                <span className="relative">
                  Contact
                  <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 ease-out group-hover:w-full"></span>
                </span>
              </Link>
              
              <div className="flex flex-col space-y-2 pt-4">
                <Button 
                  className="w-full rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-all duration-300"
                  onClick={handleMobileLogin}
                >
                  Log In
                </Button>
                <Button 
                  className="w-full rounded-full bg-white text-gray-900 border border-gray-900 hover:bg-gray-50 transition-all duration-300"
                  onClick={handleMobileSignup}
                >
                  Sign Up
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Sidebar Sheet for Dashboard Pages with Burger Menu - WITHOUT OVERLAY */}
      {isDashboardPage && (
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetPortal>
            <SheetPrimitive.Content
              className="fixed inset-y-0 left-0 z-50 h-full w-[240px] border-r bg-white p-0 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=closed]:duration-300 data-[state=open]:duration-500"
            >
              <div onClick={closeSidebar}>
                {/* Sidebar content removed - dashboard cleaned up */}
                <div className="p-4 text-center text-gray-500">
                  Navigation removed
                </div>
              </div>
            </SheetPrimitive.Content>
          </SheetPortal>
        </Sheet>
      )}

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmationDialog
        isOpen={showLogoutDialog}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
      />

      {/* Mobile Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        defaultMode={authModalMode}
      />
    </>
  );
};

export default UnifiedNavigation;
