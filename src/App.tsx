import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import AuthedAppShell from '@/AuthedAppShell'
import JoinConversation from '@/pages/JoinConversation'
import { AuthProvider } from '@/contexts/AuthContext'
import NavigationStateProvider from '@/contexts/NavigationStateContext'
import { ModeProvider } from '@/contexts/ModeContext'
import { ThreadsProvider } from '@/contexts/ThreadsContext'
import { ModalStateProvider } from '@/contexts/ModalStateProvider'
import { SettingsModalProvider } from '@/contexts/SettingsModalContext'
import { AuthModalProvider } from '@/contexts/AuthModalContext'
import { PricingProvider } from '@/contexts/PricingContext'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'

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
                  <PricingProvider>
                    <ModeProvider>
                      {children}
                    </ModeProvider>
                  </PricingProvider>
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
      <Router>
        <AppProviders>
          <Routes>
            {/* Public routes - no auth required */}
            <Route path="/join/:chatId" element={<JoinConversation />} />
            
            {/* All other routes go through AuthedAppShell */}
            <Route path="/*" element={<AuthedAppShell />} />
          </Routes>
        </AppProviders>
        <Toaster />
      </Router>
    </QueryClientProvider>
  )
}

export default App