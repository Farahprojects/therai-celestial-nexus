import { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import { supabaseAdmin } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { Shield, Crown, Check } from 'lucide-react';

export default function RoleManagement() {
  const { data: users, isLoading } = useUsers();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedUser = users?.find(u => u.id === selectedUserId);
  const isCurrentlyAdmin = selectedUser?.role === 'admin';

  const handleToggleAdminRole = async () => {
    if (!selectedUserId || !supabaseAdmin) return;

    setUpdating(true);
    setMessage(null);

    try {
      if (isCurrentlyAdmin) {
        // Remove admin role
        const { error } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', selectedUserId)
          .eq('role', 'admin');

        if (error) throw error;
        setMessage({ type: 'success', text: 'Admin role revoked successfully' });
      } else {
        // Add admin role
        const { error } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: selectedUserId,
            role: 'admin',
          });

        if (error) throw error;
        setMessage({ type: 'success', text: 'Admin role granted successfully' });
      }

      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      // Clear message after 2 seconds
      setTimeout(() => {
        setMessage(null);
      }, 2000);
    } catch (error) {
      console.error('Error updating role:', error);
      setMessage({ type: 'error', text: 'Failed to update role' });
    } finally {
      setUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600 font-light">Loading roles...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="w-6 h-6 text-gray-900" />
          <h2 className="text-2xl font-light text-gray-900">Role Management</h2>
        </div>

        {/* Role Assignment Form */}
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
                  {user.email} {user.role === 'admin' && '(Admin)'}
                </option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <>
              <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-light text-gray-600">
                    <span className="font-medium">Email:</span> {selectedUser.email}
                  </p>
                  {isCurrentlyAdmin && (
                    <Crown className="w-5 h-5 text-yellow-500" />
                  )}
                </div>
                <p className="text-sm font-light text-gray-600">
                  <span className="font-medium">Current Role:</span>{' '}
                  <span className={isCurrentlyAdmin ? 'text-yellow-600 font-medium' : 'text-gray-900'}>
                    {isCurrentlyAdmin ? 'Admin' : 'User'}
                  </span>
                </p>
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
                onClick={handleToggleAdminRole}
                disabled={updating}
                className={`w-full py-3 px-6 rounded-xl font-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isCurrentlyAdmin
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {updating 
                  ? 'Updating...' 
                  : isCurrentlyAdmin 
                    ? 'Revoke Admin Role' 
                    : 'Grant Admin Role'
                }
              </button>

              {isCurrentlyAdmin && (
                <div className="p-4 bg-yellow-50 rounded-xl">
                  <p className="text-sm text-yellow-800 font-light">
                    ⚠️ Warning: Revoking admin role will immediately remove all administrative privileges.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Admin List */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <h3 className="text-lg font-light text-gray-900 mb-4">Current Administrators</h3>
        
        {users?.filter(u => u.role === 'admin').length === 0 ? (
          <p className="text-gray-500 font-light text-center py-8">No admin users found</p>
        ) : (
          <div className="space-y-3">
            {users?.filter(u => u.role === 'admin').map(user => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.email}</p>
                    {user.profile?.display_name && (
                      <p className="text-xs text-gray-500 font-light">{user.profile.display_name}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-light text-gray-500">Admin</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <p className="text-sm font-light text-gray-600">
            <span className="font-medium">{users?.filter(u => u.role === 'admin').length || 0}</span>{' '}
            administrator(s)
          </p>
        </div>
      </div>
    </div>
  );
}




