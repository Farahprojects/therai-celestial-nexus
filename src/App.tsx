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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes, reducing unnecessary re-fetches
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Keep data in cache for 10 minutes even when unused
      gcTime: 10 * 60 * 1000, // 10 minutes
      // Don't refetch when window regains focus (reduces API calls)
      refetchOnWindowFocus: false,
      // Refetch when reconnecting to network
      refetchOnReconnect: true,
      // Refetch on mount if data is stale
      refetchOnMount: true,
      // Custom retry logic: don't retry on 4xx errors, retry 3 times on others
      retry: (failureCount, error) => {
        // Don't retry on client errors (4xx) - check if error has status property
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) {
          return false;
        }
        // Retry up to 3 times for server errors or network issues
        return failureCount < 3;
      },
      // Exponential backoff for retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Don't retry mutations by default (they should be idempotent)
      retry: false,
    },
  },
})

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