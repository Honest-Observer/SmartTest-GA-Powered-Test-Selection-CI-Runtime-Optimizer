import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import {
  ArrowLeft, GitBranch, Clock, Zap, FlaskConical,
  TrendingUp, CheckCircle2, XCircle, Calendar, FileCode, Loader2, AlertTriangle
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import './RepoDetail.css';

/* ─── Helper Functions ─── */
function formatRelativeTime(dateVal) {
  if (!dateVal) return 'Unknown';
  const d = dateVal._seconds ? new Date(dateVal._seconds * 1000)
    : dateVal.seconds ? new Date(dateVal.seconds * 1000)
    : new Date(dateVal);
  if (isNaN(d.getTime())) return 'Unknown';
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(0);
  return `${m}m ${s}s`;
}

export default function RepoDetail() {
  const { repoId } = useParams();
  const { get } = useApi();

  // Component State
  const [repo, setRepo] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunIndex, setSelectedRunIndex] = useState(null);

  // Fetch telemetry and repository detail
  const fetchRepoData = useCallback(async () => {
    try {
      const [repoData, telemetryData] = await Promise.all([
        get(`/repos/${repoId}`),
        get(`/dashboard/telemetry/${repoId}`),
      ]);

      if (repoData) setRepo(repoData);
      if (telemetryData?.telemetry) {
        setTelemetry(telemetryData.telemetry);
        if (telemetryData.telemetry.length > 0) {
          // Select most recent run by default (it's the last in chronological order)
          setSelectedRunIndex(telemetryData.telemetry.length - 1);
        }
      }
    } catch (err) {
      console.error('Failed to load repository details:', err);
    } finally {
      setLoading(false);
    }
  }, [repoId, get]);

  useEffect(() => {
    fetchRepoData();
  }, [fetchRepoData]);

  // Transform telemetry array into LineChart data
  const chartData = useMemo(() => {
    return telemetry.map((t) => {
      const date = t.timestamp?._seconds ? new Date(t.timestamp._seconds * 1000)
        : t.timestamp?.seconds ? new Date(t.timestamp.seconds * 1000)
        : new Date(t.timestamp);
      return {
        date: isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        naive: t.naiveTimeSec,
        optimized: t.gaTimeSec,
        saved: t.timeSaved,
        tests: t.testsSelected,
      };
    });
  }, [telemetry]);

  // Derived statistics summaries
  const stats = useMemo(() => {
    if (telemetry.length === 0) {
      return { totalRuns: 0, totalSaved: '0.0', avgReduction: '0.0', successRate: '0.0' };
    }
    const totalSaved = telemetry.reduce((sum, t) => sum + t.timeSaved, 0);
    const avgReduction = telemetry.reduce((sum, t) => sum + (t.timeSaved / Math.max(t.naiveTimeSec, 1)), 0) / telemetry.length * 100;
    const successRate = telemetry.filter(t => t.exitCode === 0).length / telemetry.length * 100;

    return {
      totalRuns: telemetry.length,
      totalSaved: (totalSaved / 60).toFixed(1),
      avgReduction: avgReduction.toFixed(1),
      successRate: successRate.toFixed(1),
    };
  }, [telemetry]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="repo-chart-tooltip glass-card-static">
        <p className="tooltip-label">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: {entry.value.toFixed(1)}s
          </p>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="repo-detail-page-loading">
        <Loader2 size={32} className="spinning text-cyan" />
        <p>Loading repository details...</p>
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="repo-detail-page">
        <div className="glass-card text-center" style={{ padding: 'var(--space-2xl)' }}>
          <AlertTriangle size={48} className="text-red" style={{ margin: '0 auto var(--space-md)' }} />
          <h2>Repository Not Found</h2>
          <p className="text-secondary" style={{ marginBottom: 'var(--space-md)' }}>
            The requested repository either does not exist or you do not have permission to view it.
          </p>
          <Link to="/repos" className="btn btn-secondary">
            Back to Repositories
          </Link>
        </div>
      </div>
    );
  }

  const activeRun = selectedRunIndex !== null ? telemetry[selectedRunIndex] : null;

  return (
    <div className="repo-detail-page">
      {/* Header */}
      <div className="repo-header">
        <Link to="/repos" className="back-link">
          <ArrowLeft size={18} />
          <span>Back to Repositories</span>
        </Link>

        <div className="repo-title-section">
          <div className="repo-icon-wrapper">
            <GitBranch size={28} />
          </div>
          <div>
            <h1 className="repo-name">{repo.repoName}</h1>
            <p className="repo-meta">
              <span><FlaskConical size={14} /> {repo.totalTests?.toLocaleString() || 0} tests</span>
              <span className="meta-divider">•</span>
              <span><Calendar size={14} /> Connected {new Date(repo.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>
      </div>

      {telemetry.length === 0 ? (
        <div className="glass-card text-center" style={{ padding: 'var(--space-3xl)' }}>
          <FlaskConical size={48} className="text-tertiary" style={{ margin: '0 auto var(--space-md)' }} />
          <h2>No Optimization Telemetry</h2>
          <p className="text-secondary">
            This repository has been initialized but no optimization runs have been executed yet.
          </p>
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <code className="code-block" style={{ display: 'inline-block', padding: '10px 20px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
              smart-test run
            </code>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Summary */}
          <section className="stats-summary">
            {[
              { label: 'Total Executions', value: stats.totalRuns, icon: GitBranch, color: 'purple' },
              { label: 'Total Saved Time', value: `${stats.totalSaved}m`, icon: Clock, color: 'cyan' },
              { label: 'Avg Speedup Ratio', value: `${stats.avgReduction}%`, icon: TrendingUp, color: 'green' },
              { label: 'Suite Stability', value: `${stats.successRate}%`, icon: Zap, color: 'amber' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="stat-card glass-card">
                <span className={`stat-icon text-${color}`}>
                  <Icon size={20} />
                </span>
                <div className="stat-info">
                  <span className="stat-label">{label}</span>
                  <span className="stat-value">{value}</span>
                </div>
              </div>
            ))}
          </section>

          {/* Evolution Chart */}
          <section className="chart-section glass-card">
            <h3>Optimization Trends</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="naiveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff4466" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ff4466" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="optimizedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff88" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.2)" />
                  <YAxis stroke="rgba(255, 255, 255, 0.2)" label={{ value: 'Seconds', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.4)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="naive" name="Naive Run Time" stroke="#ff4466" fill="url(#naiveGrad)" />
                  <Area type="monotone" dataKey="optimized" name="GA Optimized Time" stroke="#00ff88" fill="url(#optimizedGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Details Row */}
          <div className="detail-row">
            {/* History Table */}
            <div className="history-table-container glass-card">
              <h3>Execution History</h3>
              <div className="table-scroll">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Selected</th>
                      <th>Time Saved</th>
                      <th>Coverage</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {telemetry.map((run, idx) => (
                      <tr
                        key={run.runId}
                        className={selectedRunIndex === idx ? 'selected' : ''}
                        onClick={() => setSelectedRunIndex(idx)}
                      >
                        <td>{run.testsSelected} / {run.totalTests}</td>
                        <td className="text-green">-{formatDuration(run.timeSaved)}</td>
                        <td>{((run.coverageRatio || 0) * 100).toFixed(1)}%</td>
                        <td>
                          {run.exitCode === 0 ? (
                            <span className="text-green font-bold">PASS</span>
                          ) : (
                            <span className="text-red font-bold">FAIL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Run Inspector Card */}
            {activeRun && (
              <div className="run-details glass-card">
                <div className="details-header">
                  <h3>Inspection Panel</h3>
                  <span className="text-secondary font-xs">{formatRelativeTime(activeRun.timestamp)}</span>
                </div>

                <div className="details-grid">
                  <div className="detail-item">
                    <span className="item-label">GA Generations</span>
                    <span className="item-value">{activeRun.gaGenerations}</span>
                  </div>
                  <div className="detail-item">
                    <span className="item-label">Convergence Fitness</span>
                    <span className="item-value text-cyan">{(activeRun.gaBestFitness || 0).toFixed(4)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="item-label">Exit Code</span>
                    <span className="item-value">{activeRun.exitCode}</span>
                  </div>
                  <div className="detail-item">
                    <span className="item-label">Lines Modified</span>
                    <span className="item-value">{activeRun.diffSummary?.linesChanged || 0}</span>
                  </div>
                </div>

                {/* Selected test list */}
                <div className="selected-tests-section">
                  <h4>Selected Test Suites</h4>
                  <div className="selected-tests-list">
                    {activeRun.selectedTests?.map((t, idx) => (
                      <div key={idx} className="test-item font-sm">
                        <FileCode size={14} className="text-purple" />
                        <span>{t}</span>
                      </div>
                    )) || <p className="text-secondary font-xs">No explicit test suite selected (Greedy fallback / dry run).</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
