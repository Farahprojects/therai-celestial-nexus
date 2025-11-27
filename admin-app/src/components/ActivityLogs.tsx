import { useState } from 'react';
import { useAdminLogs, useApiUsage } from '../hooks/useActivityLogs';
import { FileText, Activity, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

type LogView = 'admin' | 'api';

export default function ActivityLogs() {
  const [view, setView] = useState<LogView>('admin');
  const { data: adminLogs, isLoading: adminLoading } = useAdminLogs();
  const { data: apiUsage, isLoading: apiLoading } = useApiUsage();

  const isLoading = view === 'admin' ? adminLoading : apiLoading;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600 font-light">Loading logs...</div>
        </div>
      </div>
    );
  }

  const totalApiCost = apiUsage?.reduce((sum, log) => sum + Number(log.total_cost_usd), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center space-x-3 mb-6">
          <FileText className="w-6 h-6 text-gray-900" />
          <h2 className="text-2xl font-light text-gray-900">Activity Logs</h2>
        </div>

        {/* View Selector */}
        <div className="flex space-x-2">
          <button
            onClick={() => setView('admin')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-light transition-colors ${
              view === 'admin'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Admin Logs</span>
            <span className="text-xs opacity-75">({adminLogs?.length || 0})</span>
          </button>
          <button
            onClick={() => setView('api')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-light transition-colors ${
              view === 'api'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>API Usage</span>
            <span className="text-xs opacity-75">({apiUsage?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* API Usage Stats */}
      {view === 'api' && (
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h3 className="text-lg font-light text-gray-900 mb-4">Usage Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-gray-50 rounded-xl">
              <p className="text-sm font-light text-gray-600 mb-1">Total API Calls</p>
              <p className="text-3xl font-light text-gray-900">{apiUsage?.length || 0}</p>
            </div>
            <div className="p-6 bg-gray-50 rounded-xl">
              <p className="text-sm font-light text-gray-600 mb-1">Total Cost</p>
              <p className="text-3xl font-light text-gray-900">${totalApiCost.toFixed(2)}</p>
            </div>
            <div className="p-6 bg-gray-50 rounded-xl">
              <p className="text-sm font-light text-gray-600 mb-1">Avg Cost per Call</p>
              <p className="text-3xl font-light text-gray-900">
                ${apiUsage && apiUsage.length > 0 ? (totalApiCost / apiUsage.length).toFixed(3) : '0.00'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                {view === 'admin' ? (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Page
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Endpoint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {view === 'admin' ? (
                adminLogs && adminLogs.length > 0 ? (
                  adminLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-light">
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-light">
                        {log.page}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-light">
                        {log.event_type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-light">
                        {log.logs || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 font-light">
                      No admin logs found
                    </td>
                  </tr>
                )
              ) : (
                apiUsage && apiUsage.length > 0 ? (
                  apiUsage.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-light">
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-light">
                        {log.endpoint}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-light">
                        {log.report_tier || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-light">
                        ${Number(log.total_cost_usd).toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 font-light">
                      No API usage logs found
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}













