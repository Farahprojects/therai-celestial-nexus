import { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import { supabaseAdmin } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { Coins, Plus, Minus, Check } from 'lucide-react';

export default function CreditManagement() {
  const { data: users, isLoading } = useUsers();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [creditAmount, setCreditAmount] = useState<number>(0);
  const [operation, setOperation] = useState<'add' | 'remove'>('add');
  const [reason, setReason] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedUser = users?.find(u => u.id === selectedUserId);

  const handleUpdateCredits = async () => {
    if (!selectedUserId || !supabaseAdmin || creditAmount <= 0) return;

    setUpdating(true);
    setMessage(null);

    try {
      // Get current credits
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('credits')
        .eq('id', selectedUserId)
        .single();

      if (fetchError) throw fetchError;

      const currentCredits = profile?.credits || 0;
      const newCredits = operation === 'add' 
        ? currentCredits + creditAmount 
        : Math.max(0, currentCredits - creditAmount);

      // Update credits
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ credits: newCredits })
        .eq('id', selectedUserId);

      if (updateError) throw updateError;

      // Log transaction
      await supabaseAdmin
        .from('credit_transactions')
        .insert({
          user_id: selectedUserId,
          amount: operation === 'add' ? creditAmount : -creditAmount,
          description: reason || `Admin ${operation === 'add' ? 'added' : 'removed'} credits`,
          transaction_type: 'admin_adjustment',
        });

      setMessage({ 
        type: 'success', 
        text: `Successfully ${operation === 'add' ? 'added' : 'removed'} ${creditAmount} credits` 
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setCreditAmount(0);
        setReason('');
        setMessage(null);
      }, 2000);
    } catch (error) {
      console.error('Error updating credits:', error);
      setMessage({ type: 'error', text: 'Failed to update credits' });
    } finally {
      setUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600 font-light">Loading credit data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center space-x-3 mb-6">
          <Coins className="w-6 h-6 text-gray-900" />
          <h2 className="text-2xl font-light text-gray-900">Credit Management</h2>
        </div>

        {/* Credit Modification Form */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-light text-gray-700 mb-2">
              Select User
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 font-light"
            >
              <option value="">Choose a user...</option>
              {users?.map(user => (
                <option key={user.id} value={user.id}>
                  {user.email} ({user.profile?.credits || 0} credits)
                </option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm font-light text-gray-600">
                  <span className="font-medium">Current Balance:</span>{' '}
                  <span className="text-2xl text-gray-900">{selectedUser.profile?.credits || 0}</span> credits
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setOperation('add')}
                  className={`flex items-center justify-center space-x-2 py-3 px-6 rounded-xl font-light transition-colors ${
                    operation === 'add'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Credits</span>
                </button>
                <button
                  onClick={() => setOperation('remove')}
                  className={`flex items-center justify-center space-x-2 py-3 px-6 rounded-xl font-light transition-colors ${
                    operation === 'remove'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                  <span>Remove Credits</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-light text-gray-700 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  min="0"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 font-light"
                  placeholder="Enter credit amount"
                />
              </div>

              <div>
                <label className="block text-sm font-light text-gray-700 mb-2">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 font-light"
                  placeholder="e.g., Refund, Bonus, Adjustment"
                />
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
                onClick={handleUpdateCredits}
                disabled={updating || creditAmount <= 0}
                className="w-full bg-gray-900 text-white py-3 px-6 rounded-xl font-light hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Processing...' : `${operation === 'add' ? 'Add' : 'Remove'} ${creditAmount} Credits`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Credit Statistics */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <h3 className="text-lg font-light text-gray-900 mb-4">Credit Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-gray-50 rounded-xl">
            <p className="text-sm font-light text-gray-600 mb-1">Total Credits</p>
            <p className="text-3xl font-light text-gray-900">
              {users?.reduce((sum, u) => sum + (u.profile?.credits || 0), 0).toLocaleString() || 0}
            </p>
          </div>
          <div className="p-6 bg-gray-50 rounded-xl">
            <p className="text-sm font-light text-gray-600 mb-1">Average per User</p>
            <p className="text-3xl font-light text-gray-900">
              {users && users.length > 0
                ? Math.round(users.reduce((sum, u) => sum + (u.profile?.credits || 0), 0) / users.length)
                : 0}
            </p>
          </div>
          <div className="p-6 bg-gray-50 rounded-xl">
            <p className="text-sm font-light text-gray-600 mb-1">Users with Credits</p>
            <p className="text-3xl font-light text-gray-900">
              {users?.filter(u => (u.profile?.credits || 0) > 0).length || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


