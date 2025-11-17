import type { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import ResourceMonitor from './ResourceMonitor';
import UserManagement from './UserManagement';
import SubscriptionPanel from './SubscriptionPanel';
import CreditManagement from './CreditManagement';
import RoleManagement from './RoleManagement';
import ActivityLogs from './ActivityLogs';
import { MessagesView } from './messages/MessagesView';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Coins,
  Shield,
  FileText,
  LogOut,
  Menu,
  X,
  Mail,
} from 'lucide-react';

type View = 'dashboard' | 'users' | 'subscriptions' | 'credits' | 'roles' | 'logs' | 'messages';

interface DashboardProps {
  session: Session;
  onLogout: () => void;
}


export default function Dashboard({ session, onLogout }: DashboardProps) {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigation = [
    { id: 'dashboard' as View, name: 'Dashboard', icon: LayoutDashboard },
    { id: 'users' as View, name: 'Users', icon: Users },
    { id: 'subscriptions' as View, name: 'Subscriptions', icon: CreditCard },
    { id: 'credits' as View, name: 'Credits', icon: Coins },
    { id: 'roles' as View, name: 'Roles', icon: Shield },
    { id: 'messages' as View, name: 'Messages', icon: Mail },
    { id: 'logs' as View, name: 'Activity Logs', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h1 className="text-xl font-light text-gray-900 italic">Admin Dashboard</h1>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-6 border-b border-gray-200">
            <p className="text-sm font-light text-gray-600">Signed in as</p>
            <p className="text-sm font-medium text-gray-900 truncate">{session.user.email}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id);
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-light transition-colors ${
                    isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-light text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg">
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-right">
              <p className="text-sm font-light text-gray-600">TherAI Admin</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8 space-y-8">
          {currentView === 'dashboard' && <ResourceMonitor />}
          {currentView === 'users' && <UserManagement />}
          {currentView === 'subscriptions' && <SubscriptionPanel />}
          {currentView === 'credits' && <CreditManagement />}
          {currentView === 'roles' && <RoleManagement />}
          {currentView === 'messages' && <MessagesView />}
          {currentView === 'logs' && <ActivityLogs />}
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}








