import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { AnalyticsData, DailyStats } from '../../types';

type TimeRange = 'all' | 'today' | 'week' | 'month';

interface DashboardTabProps {
  isActive?: boolean;
  theme?: 'dark' | 'light';
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format seconds to human readable time
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

// Format speed (bytes per second)
function formatSpeed(bytesPerSec: number): string {
  return formatBytes(bytesPerSec) + '/s';
}

// Trend indicator component
function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 || current === previous) {
    return <span className="trend-neutral">--</span>;
  }

  const percentChange = ((current - previous) / previous) * 100;
  const isUp = percentChange > 0;

  return (
    <span className={`trend-indicator ${isUp ? 'trend-up' : 'trend-down'}`}>
      {isUp ? '^' : 'v'} {Math.abs(percentChange).toFixed(1)}%
    </span>
  );
}

// Simple Stat Card component
function StatCard({
  title,
  value,
  subtitle,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: { current: number; previous: number };
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {trend && <TrendIndicator current={trend.current} previous={trend.previous} />}
      </div>
      <div className="stat-card-value">{value}</div>
      {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
    </div>
  );
}

// Chart colors
const CHART_COLORS = ['#00ff88', '#ff3366', '#ffaa00', '#00d4ff', '#ff6b9d', '#88ff00', '#ff8800', '#00ffcc'];

export function DashboardTab({ isActive, theme }: DashboardTabProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [comparisonData, setComparisonData] = useState<{ current: AnalyticsData; previous: AnalyticsData } | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const comparison = await window.electronAPI.getAnalyticsRange(timeRange);
      setComparisonData(comparison);
      setAnalytics(comparison.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    if (isActive) {
      loadAnalytics();
    }
  }, [isActive, loadAnalytics]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-frame">
          <div className="spinner-frame">
            <div className="spinner"></div>
          </div>
          <p className="loading-text">// LOADING</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <div className="error-frame">
          <div className="error-icon">[!]</div>
          <p className="error-title">// ERROR</p>
          <p className="error-message">{error}</p>
          <button type="button" onClick={loadAnalytics} className="btn-brutal btn-brutal-primary">
            RETRY
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="dashboard-empty">
        <div className="empty-frame">
          <div className="empty-icon">
            <span className="empty-icon-brackets">[ ]</span>
          </div>
          <h3 className="empty-title">// NO DATA</h3>
          <p className="empty-subtitle">Download videos to initialize analytics</p>
        </div>
      </div>
    );
  }

  const successRate = analytics.totalDownloads > 0
    ? ((analytics.successCount / analytics.totalDownloads) * 100).toFixed(1)
    : '0';

  // Prepare chart data
  const chartData = analytics.dailyStats.slice(0, 30).reverse().map((stat: DailyStats) => ({
    date: new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    downloads: stat.downloads,
    bytes: stat.bytes,
    success: stat.successCount,
    failed: stat.failCount,
  }));

  // Format breakdown for pie chart
  const formatData = Object.entries(analytics.formatBreakdown)
    .map(([format, count]) => ({ name: format.toUpperCase(), value: count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Top channels
  const topChannels = analytics.topChannels.slice(0, 10);

  return (
    <div className="dashboard-container">
      {/* Header with time range selector */}
      <div className="dashboard-header">
        <div className="header-title-group">
          <h2 className="dashboard-title">
            <span className="title-prefix">//</span>
            <span className="title-text">ANALYTICS</span>
          </h2>
        </div>
        <div className="time-range-selector">
          {(['all', 'today', 'week', 'month'] as TimeRange[]).map((range) => (
            <button
              key={range}
              type="button"
              className={`filter-tab ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range === 'all' ? 'ALL' : range === 'today' ? 'TODAY' : range === 'week' ? 'WEEK' : 'MONTH'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="stat-cards-grid">
        <StatCard
          title="DOWNLOADS"
          value={analytics.totalDownloads.toString()}
          subtitle={`${analytics.successCount} OK / ${analytics.failCount} FAIL`}
          trend={comparisonData ? { current: comparisonData.current.totalDownloads, previous: comparisonData.previous.totalDownloads } : undefined}
        />
        <StatCard
          title="DATA SIZE"
          value={formatBytes(analytics.totalBytes)}
          subtitle="DOWNLOADED"
          trend={comparisonData ? { current: comparisonData.current.totalBytes, previous: comparisonData.previous.totalBytes } : undefined}
        />
        <StatCard
          title="BANDWIDTH"
          value={formatBytes(analytics.totalBandwidth)}
          subtitle="NETWORK TRAFFIC"
          trend={comparisonData ? { current: comparisonData.current.totalBandwidth, previous: comparisonData.previous.totalBandwidth } : undefined}
        />
        <StatCard
          title="TIME SAVED"
          value={formatTime(analytics.timeSavedSeconds)}
          subtitle="WATCH TIME"
          trend={comparisonData ? { current: comparisonData.current.timeSavedSeconds, previous: comparisonData.previous.timeSavedSeconds } : undefined}
        />
        <StatCard
          title="SUCCESS RATE"
          value={`${successRate}%`}
          subtitle="COMPLETION"
        />
        <StatCard
          title="AVG SPEED"
          value={formatSpeed(analytics.avgSpeed)}
          subtitle="THROUGHPUT"
        />
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Downloads Over Time Chart */}
        <div className="chart-container large">
          <div className="chart-header">
            <h3 className="chart-title">
              <span className="title-prefix">//</span> DOWNLOADS_OVER_TIME
            </h3>
          </div>
          <div className="chart-body">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff88" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#00ff88" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke={theme === 'dark' ? '#2d3748' : '#cbd5e0'} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke={theme === 'dark' ? '#718096' : '#a0aec0'}
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: theme === 'dark' ? '#4a5568' : '#e2e8f0', strokeWidth: 2 }}
                  />
                  <YAxis
                    stroke={theme === 'dark' ? '#718096' : '#a0aec0'}
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: theme === 'dark' ? '#4a5568' : '#e2e8f0', strokeWidth: 2 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#1a202c' : '#ffffff',
                      border: '2px solid ' + (theme === 'dark' ? '#00ff88' : '#00ff88'),
                      borderRadius: '0px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      boxShadow: '4px 4px 0 rgba(0, 255, 136, 0.3)',
                    }}
                    labelStyle={{ color: theme === 'dark' ? '#00ff88' : '#00ff88', fontWeight: 'bold' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="downloads"
                    stroke="#00ff88"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorDownloads)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">
                <span className="empty-text">// NO DATA</span>
              </div>
            )}
          </div>
        </div>

        {/* Success/Fail Stats */}
        <div className="chart-container small">
          <div className="chart-header">
            <h3 className="chart-title">
              <span className="title-prefix">//</span> STATUS
            </h3>
          </div>
          <div className="chart-body">
            <div className="status-stats">
              <div className="status-stat">
                <span className="status-stat-label">SUCCESS</span>
                <span className="status-stat-value" style={{ color: 'var(--success)' }}>{analytics.successCount}</span>
                <span className="status-stat-percent">{successRate}%</span>
              </div>
              <div className="status-stat">
                <span className="status-stat-label">FAILED</span>
                <span className="status-stat-value" style={{ color: 'var(--error)' }}>{analytics.failCount}</span>
                <span className="status-stat-percent">{analytics.totalDownloads > 0 ? ((analytics.failCount / analytics.totalDownloads) * 100).toFixed(1) : '0'}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="charts-row">
        {/* Format Breakdown Pie Chart */}
        <div className="chart-container medium">
          <div className="chart-header">
            <h3 className="chart-title">
              <span className="title-prefix">//</span> FORMAT_DIST
            </h3>
          </div>
          <div className="chart-body">
            {formatData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={formatData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    stroke={theme === 'dark' ? '#1a202c' : '#ffffff'}
                    strokeWidth={2}
                  >
                    {formatData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#1a202c' : '#ffffff',
                      border: '2px solid ' + (theme === 'dark' ? '#00ff88' : '#00ff88'),
                      borderRadius: '0px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">
                <span className="empty-text">// NO FORMAT DATA</span>
              </div>
            )}
            {formatData.length > 0 && (
              <div className="format-legend">
                {formatData.map((item, index) => (
                  <div key={item.name} className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span className="legend-name">{item.name}</span>
                    <span className="legend-value">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Channels */}
        <div className="chart-container medium">
          <div className="chart-header">
            <h3 className="chart-title">
              <span className="title-prefix">//</span> TOP_CHANNELS
            </h3>
            <span className="channel-count-badge">{topChannels.length} FOUND</span>
          </div>
          <div className="chart-body">
            {topChannels.length > 0 ? (
              <div className="top-channels-list">
                {topChannels.map((channel, index) => (
                  <div key={channel.name} className="channel-item">
                    <span className="channel-rank">{String(index + 1).padStart(2, '0')}</span>
                    <span className="channel-name">{channel.name}</span>
                    <span className="channel-count">{channel.count} DL</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="chart-empty">
                <span className="empty-text">// NO CHANNELS</span>
              </div>
            )}
          </div>
        </div>

        {/* Data Size Bar Chart */}
        <div className="chart-container medium">
          <div className="chart-header">
            <h3 className="chart-title">
              <span className="title-prefix">//</span> DATA_7D
            </h3>
          </div>
          <div className="chart-body">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData.slice(-7)}>
                  <CartesianGrid strokeDasharray="4 4" stroke={theme === 'dark' ? '#2d3748' : '#cbd5e0'} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke={theme === 'dark' ? '#718096' : '#a0aec0'}
                    fontSize={9}
                    tickLine={false}
                    axisLine={{ stroke: theme === 'dark' ? '#4a5568' : '#e2e8f0', strokeWidth: 2 }}
                  />
                  <YAxis
                    stroke={theme === 'dark' ? '#718096' : '#a0aec0'}
                    fontSize={9}
                    tickLine={false}
                    tickFormatter={(v) => formatBytes(v ?? 0)}
                    axisLine={{ stroke: theme === 'dark' ? '#4a5568' : '#e2e8f0', strokeWidth: 2 }}
                  />
                  <Tooltip
                    formatter={(value: number | undefined) => [formatBytes(value ?? 0), 'SIZE']}
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#1a202c' : '#ffffff',
                      border: '2px solid #00d4ff',
                      borderRadius: '0px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      boxShadow: '4px 4px 0 rgba(0, 212, 255, 0.3)',
                    }}
                  />
                  <Bar dataKey="bytes" fill="#00d4ff" stroke={theme === 'dark' ? '#1a202c' : '#ffffff'} strokeWidth={1} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">
                <span className="empty-text">// NO DATA</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="dashboard-footer">
        <div className="footer-section footer-meta">
          {analytics.firstDownloadDate && (
            <span className="meta-item">
              <span className="meta-label">FIRST:</span>
              <span className="meta-value">{new Date(analytics.firstDownloadDate).toLocaleDateString()}</span>
            </span>
          )}
          <span className="meta-item">
            <span className="meta-label">UPDATED:</span>
            <span className="meta-value">{new Date(analytics.lastUpdated).toLocaleString()}</span>
          </span>
        </div>
        <div className="footer-section footer-actions">
          <button type="button" onClick={loadAnalytics} className="btn-brutal btn-brutal-secondary">
            REFRESH
          </button>
        </div>
      </div>
    </div>
  );
}
