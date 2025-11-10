import { useHealthCheck } from '../hooks/useHealthCheck';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

function ProgressBar({ percent, status }: { percent: number; status: string }) {
  const color = status === 'warning' || status === 'critical' 
    ? 'bg-red-500' 
    : 'bg-green-500';

  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className={`${color} h-2 rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'healthy') {
    return <CheckCircle className="w-5 h-5 text-green-600" />;
  }
  if (status === 'warning') {
    return <AlertCircle className="w-5 h-5 text-yellow-600" />;
  }
  return <XCircle className="w-5 h-5 text-red-600" />;
}

export default function ResourceMonitor() {
  const { data, isLoading, error, refetch, isFetching } = useHealthCheck();

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600 font-light">Loading health metrics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-red-600 font-light">Error loading health metrics</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { status, timestamp, metrics } = data;

  return (
    <div className="space-y-6">
      {/* Overall Status Card */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <StatusIcon status={status} />
            <div>
              <h2 className="text-2xl font-light text-gray-900">System Health</h2>
              <p className="text-sm text-gray-500 font-light">
                Last checked: {format(new Date(timestamp), 'PPpp')}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-light hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-light capitalize" 
          style={{
            backgroundColor: status === 'healthy' ? '#dcfce7' : status === 'warning' ? '#fef3c7' : '#fee2e2',
            color: status === 'healthy' ? '#166534' : status === 'warning' ? '#92400e' : '#991b1b'
          }}
        >
          {status}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Database Size */}
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-light text-gray-900">Database Size</h3>
            <StatusIcon status={metrics.database.status} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-light">
              <span className="text-gray-600">Usage</span>
              <span className="text-gray-900">{metrics.database.sizeGB} GB / 8 GB</span>
            </div>
            <ProgressBar percent={metrics.database.percentUsed} status={metrics.database.status} />
            <p className="text-xs text-gray-500 font-light">
              {metrics.database.percentUsed.toFixed(1)}% used
            </p>
          </div>
        </div>

        {/* Storage Size */}
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-light text-gray-900">Storage Size</h3>
            <StatusIcon status={metrics.storage.status} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-light">
              <span className="text-gray-600">Usage</span>
              <span className="text-gray-900">{metrics.storage.sizeGB} GB / 100 GB</span>
            </div>
            <ProgressBar percent={metrics.storage.percentUsed} status={metrics.storage.status} />
            <p className="text-xs text-gray-500 font-light">
              {metrics.storage.percentUsed.toFixed(1)}% used
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {metrics.alerts.length > 0 && (
        <div className="bg-red-50 rounded-xl shadow-sm p-8">
          <h3 className="text-lg font-light text-red-900 mb-4 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5" />
            <span>Active Alerts</span>
          </h3>
          <ul className="space-y-2">
            {metrics.alerts.map((alert, index) => (
              <li key={index} className="text-sm text-red-700 font-light flex items-start space-x-2">
                <span className="text-red-500">•</span>
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}



