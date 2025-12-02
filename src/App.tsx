import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { Suspense, lazy } from 'react'

// Lazy load heavy components
const AuthedAppShell = lazy(() => import('@/AuthedAppShell'))
const JoinConversation = lazy(() => import('@/pages/JoinConversation'))
const JoinFolder = lazy(() => import('@/pages/JoinFolder'))
import { AuthProvider } from '@/contexts/AuthContext'
import NavigationStateProvider from '@/contexts/NavigationStateContext'
import { ModeProvider } from '@/contexts/ModeContext'
import { ThreadsProvider } from '@/contexts/ThreadsContext'
import { ModalStateProvider } from '@/contexts/ModalStateProvider'
import { SettingsModalProvider } from '@/contexts/SettingsModalContext'
import { AuthModalProvider } from '@/contexts/AuthModalContext'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import { OnboardingGuard } from '@/components/onboarding/OnboardingGuard'

const queryClient = new QueryClient()

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <NavigationStateProvider>
      <AuthProvider>
        <ThreadsProvider>
          <SubscriptionProvider>
            <ModalStateProvider>
              <SettingsModalProvider>
                <AuthModalProvider>
                  <ModeProvider>
                    {children}
                  </ModeProvider>
                </AuthModalProvider>
              </SettingsModalProvider>
            </ModalStateProvider>
          </SubscriptionProvider>
        </ThreadsProvider>
      </AuthProvider>
    </NavigationStateProvider>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <AppProviders>
          <OnboardingGuard>
            <div className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <Routes>
                  {/* Public routes - no auth required */}
                  <Route path="/join/:chatId" element={<JoinConversation />} />
                  <Route path="/folder/:folderId" element={<JoinFolder />} />

                  {/* All other routes go through AuthedAppShell */}
                  <Route path="/*" element={<AuthedAppShell />} />
                </Routes>
              </Suspense>
            </div>
          </OnboardingGuard>
        </AppProviders>
        <Toaster />
      </Router>
    </QueryClientProvider>
  )
}

export default App