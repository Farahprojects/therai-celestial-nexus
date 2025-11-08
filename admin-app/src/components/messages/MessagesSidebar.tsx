import { Mail, Send, ArrowDownToDot, ArrowUpFromDot, Search } from 'lucide-react';

type Filter = 'all' | 'incoming' | 'outgoing';

interface MessagesSidebarProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  stats: {
    total: number;
    inbound: number;
    outbound: number;
    unread: number;
  };
}

export function MessagesSidebar({
  searchTerm,
  onSearchTermChange,
  filter,
  onFilterChange,
  stats,
}: MessagesSidebarProps) {
  return (
    <aside className="w-72 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-6 border-b border-gray-200 space-y-4">
        <div className="flex items-center space-x-3">
          <Mail className="w-5 h-5 text-gray-900" />
          <div>
            <h2 className="text-lg font-light text-gray-900">Messages</h2>
            <p className="text-xs text-gray-500 font-light">Monitor user conversations</p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search conversations"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 font-light"
          />
        </div>

        <div className="space-y-2 text-sm font-light text-gray-600">
          <div className="flex items-center justify-between">
            <span>Total conversations</span>
            <span className="font-medium text-gray-900">{stats.total}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Inbound unread</span>
            <span className="font-medium text-gray-900">{stats.unread}</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-2 border-b border-gray-200 text-sm text-gray-600 font-light">
        <button
          className={`flex items-center space-x-2 w-full px-2 py-2 rounded-xl transition-colors ${
            filter === 'all' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-700'
          }`}
          onClick={() => onFilterChange('all')}
        >
          <Mail className="w-4 h-4" />
          <span>All</span>
          <span className="ml-auto text-xs">{stats.total}</span>
        </button>
        <button
          className={`flex items-center space-x-2 w-full px-2 py-2 rounded-xl transition-colors ${
            filter === 'incoming' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-700'
          }`}
          onClick={() => onFilterChange('incoming')}
        >
          <ArrowDownToDot className="w-4 h-4" />
          <span>Inbound</span>
          <span className="ml-auto text-xs">{stats.inbound}</span>
        </button>
        <button
          className={`flex items-center space-x-2 w-full px-2 py-2 rounded-xl transition-colors ${
            filter === 'outgoing' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-700'
          }`}
          onClick={() => onFilterChange('outgoing')}
        >
          <ArrowUpFromDot className="w-4 h-4" />
          <span>Outbound</span>
          <span className="ml-auto text-xs">{stats.outbound}</span>
        </button>
        <div className="flex items-center space-x-2 text-gray-500">
          <Send className="w-4 h-4" />
          <span className="text-xs">Sent via email, sms, etc.</span>
        </div>
      </div>
    </aside>
  );
}
