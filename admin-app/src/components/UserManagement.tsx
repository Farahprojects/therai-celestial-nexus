import { useState, useMemo } from 'react';
import { useUsers, User } from '../hooks/useUsers';
import { Search, User as UserIcon, Crown } from 'lucide-react';
import { format } from 'date-fns';

function UserCard({ user }: { user: User }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4 flex-1">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-lg font-light text-gray-900 truncate">
                {user.profile?.display_name || user.email}
              </h3>
              {user.role === 'admin' && (
                <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-gray-500 font-light truncate">{user.email}</p>
            
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-light">Subscription</p>
                <p className="text-sm text-gray-900 font-light capitalize">
                  {user.profile?.subscription_plan || 'free'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-light">Credits</p>
                <p className="text-sm text-gray-900 font-light">
                  {user.profile?.credits || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-light">Status</p>
                <p className={`text-sm font-light ${
                  user.profile?.subscription_active ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {user.profile?.subscription_active ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-light">Joined</p>
                <p className="text-sm text-gray-900 font-light">
                  {format(new Date(user.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const { data: users, isLoading, error } = useUsers();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');

  const filteredUsers = useMemo(() => {
    if (!users) return [];

    return users.filter(user => {
      // Search filter
      const matchesSearch = 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()));

      // Plan filter
      const matchesPlan = 
        filterPlan === 'all' || 
        (user.profile?.subscription_plan || 'free') === filterPlan;

      // Role filter
      const matchesRole = 
        filterRole === 'all' ||
        (filterRole === 'admin' && user.role === 'admin') ||
        (filterRole === 'user' && user.role !== 'admin');

      return matchesSearch && matchesPlan && matchesRole;
    });
  }, [users, searchTerm, filterPlan, filterRole]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600 font-light">Loading users...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-red-600 font-light">Error loading users</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <h2 className="text-2xl font-light text-gray-900 mb-6">User Management</h2>
        
        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email or name..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 font-light"
            />
          </div>

          <div className="flex space-x-4">
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 font-light"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="lifetime">Lifetime</option>
            </select>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 font-light"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 flex items-center space-x-6 text-sm font-light text-gray-600">
          <div>
            <span className="font-medium text-gray-900">{filteredUsers.length}</span> users found
          </div>
          <div>
            <span className="font-medium text-gray-900">{users?.length || 0}</span> total users
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map(user => (
          <UserCard key={user.id} user={user} />
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500 font-light">No users found matching your filters</p>
        </div>
      )}
    </div>
  );
}







