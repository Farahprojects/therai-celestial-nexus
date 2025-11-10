import { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import { supabaseAdmin } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard, Check } from 'lucide-react';

export default function SubscriptionPanel() {
  const { data: users, isLoading } = useUsers();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newPlan, setNewPlan] = useState<string>('free');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedUser = users?.find(u => u.id === selectedUserId);

  const handleUpdateSubscription = async () => {
    if (!selectedUserId || !supabaseAdmin) return;

    setUpdating(true);
    setMessage(null);

    try {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_plan: newPlan,
          subscription_active: isActive,
          subscription_status: isActive ? 'active' : 'inactive',
        })
        .eq('id', selectedUserId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Subscription updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      // Clear form after 2 seconds
      setTimeout(() => {
        setSelectedUserId('');
        setMessage(null);
      }, 2000);
    } catch (error) {
      console.error('Error updating subscription:', error);
      setMessage({ type: 'error', text: 'Failed to update subscription' });
    } finally {
      setUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600 font-light">Loading subscriptions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center space-x-3 mb-6">
          <CreditCard className="w-6 h-6 text-gray-900" />
          <h2 className="text-2xl font-light text-gray-900">Subscription Management</h2>
        </div>

        {/* Override Form */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-light text-gray-700 mb-2">
              Select User
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                const user = users?.find(u => u.id === e.target.value);
                if (user?.profile) {
                  setNewPlan(user.profile.subscription_plan || 'free');
                  setIsActive(user.profile.subscription_active);
                }
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 font-light"
            >
              <option value="">Choose a user...</option>
              {users?.map(user => (
                <option key={user.id} value={user.id}>
                  {user.email} ({user.profile?.subscription_plan || 'free'})
                </option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <>
              <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                <p className="text-sm font-light text-gray-600">
                  <span className="font-medium">Current Plan:</span> {selectedUser.profile?.subscription_plan || 'free'}
                </p>
                <p className="text-sm font-light text-gray-600">
                  <span className="font-medium">Status:</span>{' '}
                  <span className={selectedUser.profile?.subscription_active ? 'text-green-600' : 'text-red-600'}>
                    {selectedUser.profile?.subscription_active ? 'Active' : 'Inactive'}
                  </span>
                </p>
                <p className="text-sm font-light text-gray-600">
                  <span className="font-medium">Credits:</span> {selectedUser.profile?.credits || 0}
                </p>
              </div>

              <div>
                <label className="block text-sm font-light text-gray-700 mb-2">
                  New Plan
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 font-light"
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 focus:ring-gray-900"
                />
                <label htmlFor="isActive" className="text-sm font-light text-gray-700">
                  Subscription Active
                </label>
              </div>

              {message && (
                <div className={`p-4 rounded-xl ${
                  message.type === 'success' ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <p className={`text-sm font-light flex items-center space-x-2 ${
                    message.type === 'success' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {message.type === 'success' && <Check className="w-4 h-4" />}
                    <span>{message.text}</span>
                  </p>
                </div>
              )}

              <button
                onClick={handleUpdateSubscription}
                disabled={updating}
                className="w-full bg-gray-900 text-white py-3 px-6 rounded-xl font-light hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Updating...' : 'Update Subscription'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subscription Overview */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <h3 className="text-lg font-light text-gray-900 mb-4">Subscription Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['free', 'pro', 'lifetime'].map(plan => {
            const count = users?.filter(u => (u.profile?.subscription_plan || 'free') === plan).length || 0;
            return (
              <div key={plan} className="p-6 bg-gray-50 rounded-xl">
                <p className="text-sm font-light text-gray-600 capitalize mb-1">{plan}</p>
                <p className="text-3xl font-light text-gray-900">{count}</p>
                <p className="text-xs font-light text-gray-500 mt-1">users</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}



