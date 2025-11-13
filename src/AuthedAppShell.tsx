import React, { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import UserSettings from './pages/UserSettings';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Auth from './pages/auth/Auth';
import { AuthGuard } from './components/auth/AuthGuard';
import { StrictAuthGuard } from './components/auth/StrictAuthGuard';
import { PublicOnlyGuard } from './components/auth/PublicOnlyGuard';
import Contact from './pages/Contact';
import About from './pages/About';
import Legal from './pages/Legal';
import Pricing from './pages/Pricing';
import Support from './pages/Support';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsNativeApp } from '@/hooks/use-native-app';
import SubscriptionPaywall from './pages/SubscriptionPaywall';
import SubscriptionSuccess from './pages/SubscriptionSuccess';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import ChatContainer from './pages/ChatContainer';
import Index from './pages/Index';
import MobileLanding from './pages/MobileLanding';
import NotFound from './pages/NotFound';
const EmbeddedCheckout = lazy(() => import('./pages/EmbeddedCheckout'));
const SubscriptionManagement = lazy(() => import('./pages/SubscriptionManagement'));
import Beats from './pages/Beats';
import { CheckoutPage } from './pages/CheckoutPage';
import { CheckoutSuccessPage } from './pages/CheckoutSuccessPage';

// This shell contains all routes that can rely on context providers. Providers are now applied at the App root.
const AuthedAppShell: React.FC = () => {
  const isMobile = useIsMobile();
  const isNativeApp = useIsNativeApp();

  return (
    <Routes>
      {/* Main public route - show MobileLanding on mobile, Index on desktop */}
      <Route path="/" element={
        isMobile ? <MobileLanding /> : <Index />
      } />
      
      {/* Public routes */}
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/support" element={<Support />} />
      <Route path="/legal" element={<Legal />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      
      {/* Auth routes - redirect mobile users to landing page */}
      <Route path="/login" element={
        isMobile ? <Navigate to="/" replace /> : <Login />
      } />
      <Route path="/signup" element={
        isMobile ? <Navigate to="/" replace /> : <Signup />
      } />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/password" element={<Auth />} />
      <Route path="/auth/email" element={<Auth />} />
      
      {/* Payment/subscription routes */}
      <Route path="/subscription" element={<StrictAuthGuard><SubscriptionPaywall /></StrictAuthGuard>} />
      <Route path="/subscription-paywall" element={<StrictAuthGuard><SubscriptionPaywall /></StrictAuthGuard>} />
      <Route path="/success" element={<SubscriptionSuccess />} />
      <Route path="/cancel" element={<SubscriptionPaywall />} />
      <Route path="/stripe" element={<EmbeddedCheckout />} />
      <Route path="/manage-subscription" element={<AuthGuard><SubscriptionManagement /></AuthGuard>} />
      
      {/* Credit purchase checkout routes */}
      <Route path="/checkout" element={<AuthGuard><CheckoutPage /></AuthGuard>} />
      <Route path="/checkout/success" element={<AuthGuard><CheckoutSuccessPage /></AuthGuard>} />
      
      {/* Auth routes - /c/:thread_id - REQUIRES AUTH */}
      <Route path="/c/:threadId" element={<AuthGuard><ChatContainer /></AuthGuard>} />
      
      {/* Folder routes - /folders/:folderId - REQUIRES AUTH */}
      <Route path="/folders/:folderId" element={<AuthGuard><ChatContainer /></AuthGuard>} />
      
      {/* Auth clean page - no auto thread creation */}
      <Route path="/therai" element={<AuthGuard><ChatContainer /></AuthGuard>} />
      
      {/* Protected routes */}
      <Route path="/settings" element={<AuthGuard><UserSettings /></AuthGuard>} />
      <Route path="/beats" element={<Beats />} />
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AuthedAppShell;