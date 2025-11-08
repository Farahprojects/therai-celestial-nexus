import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { getBillingMode } from '@/utils/billingMode';
import { useChatStore } from '@/core/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MessageSquare, Clock } from 'lucide-react';
import Logo from '@/components/Logo';
import { toast } from 'sonner';

const ThreadSelectionPage: React.FC = () => {
  const { user } = useAuth();
  const { isSubscriptionActive } = useSubscription();
  const billingMode = getBillingMode();
  const navigate = useNavigate();
  const { threads, loadThreads, addThread, isLoadingThreads } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);

  // Thread loading is handled by useChatInitialization on page mount

  const handleCreateNewThread = async () => {
    if (!user) return;
    
    // Gate: Check subscription in subscription mode
    if (billingMode === 'SUBSCRIPTION' && !isSubscriptionActive) {
      toast.error('Subscription required to create new conversations');
      navigate('/subscription-paywall');
      return;
    }
    
    setIsCreating(true);
    try {
      const threadId = await addThread(user.id, 'chat', 'Chat'); // Placeholder title, upgraded on first message
      navigate(`/c/${threadId}`);
    } catch (error) {
      console.error('Failed to create new thread:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectThread = (threadId: string) => {
    navigate(`/c/${threadId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="w-full py-8 flex justify-center border-b border-gray-100">
        <Logo size="md" />
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light text-gray-900 mb-4">
            Welcome back
          </h1>
          <p className="text-xl text-gray-600 font-light">
            Choose a conversation or start a new one
          </p>
        </div>

        {/* Create New Thread */}
        <div className="mb-8">
          <Button
            onClick={handleCreateNewThread}
            disabled={isCreating}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-4 rounded-full text-lg"
          >
            {isCreating ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Creating...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Plus className="h-5 w-5 mr-3" />
                Start New Chat
              </div>
            )}
          </Button>
        </div>

        {/* Thread History */}
        <div className="mb-8">
          <h2 className="text-2xl font-light text-gray-900 mb-6">Recent Conversations</h2>
          
          {isLoadingThreads ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : threads.filter(t => t.mode !== 'profile').length > 0 ? (
            <div className="grid gap-4">
              {threads.filter(t => t.mode !== 'profile').map((thread) => (
                <Card 
                  key={thread.id} 
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleSelectThread(thread.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-light text-gray-900 mb-1">
                          {thread.title || 'Untitled Chat'}
                        </h3>
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatDate(thread.updated_at)}
                        </div>
                      </div>
                      <MessageSquare className="h-5 w-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-light text-gray-900 mb-2">No conversations yet</h3>
                <p className="text-gray-500 font-light">
                  Start your first chat to see it here
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default ThreadSelectionPage;
