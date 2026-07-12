import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  Clock, Activity, FolderGit2, TrendingUp, ArrowUpRight,
  Dna, TestTubes, Flame, ChevronDown, ChevronRight, ChevronUp,
  CheckCircle2, Loader2, X, Eye, AlertTriangle, FileCode,
  GitCommit, Layers, Zap, FlaskConical, Terminal,
} from 'lucide-react';
import ApiKeyManager from '../components/ApiKeyManager';
import { useApi } from '../hooks/useApi';
import './Dashboard.css';

/* ─── Utility Functions ─── */
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
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(0);
  return `${m}m ${s}s`;
}

/* ─── Animated Counter ─── */
function AnimatedValue({ value, suffix = '', prefix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const steps = 40;
    const stepTime = duration / steps;
    const increment = value / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(current);
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <span>
      {prefix}{typeof display === 'number' ? display.toFixed(decimals) : display}{suffix}
    </span>
  );
}

/* ─── Empty State Component ─── */
function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={32} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-subtitle">{subtitle}</p>
    </div>
  );
}

/* ─── Test Detail Modal ─── */
function TestDetailModal({ test, onClose }) {
  if (!test) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><FileCode size={18} /> {test}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p className="text-secondary">
            This test was selected by the Genetic Algorithm as part of the optimal
            test subset for the most recent optimization run.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Custom Tooltip for Charts ─── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip glass-card-static">
      <p className="chart-tooltip-label">Gen {label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(4)}
        </p>
      ))}
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function Dashboard() {
  const { get } = useApi();
  const navigate = useNavigate();

  // Data state
  const [metrics, setMetrics] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState(null);
  const [expandedRun, setExpandedRun] = useState(null);
  
  // Errors state
  const [metricsError, setMetricsError] = useState('');
  const [runsError, setRunsError] = useState('');
  const [reposError, setReposError] = useState('');

  // Fetch all dashboard data independently
  const fetchData = useCallback(async () => {
    // 1. Fetch metrics
    try {
      const data = await get('/dashboard/metrics');
      if (data) {
        setMetrics(data);
        setMetricsError('');
      }
    } catch (err) {
      setMetricsError(err.message || 'Failed to fetch metrics');
      console.error('Metrics fetch error:', err);
    }

    // 2. Fetch recent runs
    try {
      const data = await get('/dashboard/recent?limit=10');
      if (data?.runs) {
        setRecentRuns(data.runs);
        setRunsError('');
      }
    } catch (err) {
      setRunsError(err.message || 'Failed to fetch recent runs');
      console.error('Recent runs fetch error:', err);
    }

    // 3. Fetch repos
    try {
      const data = await get('/repos');
      if (data?.repositories) {
        setRepos(data.repositories);
        setReposError('');
      }
    } catch (err) {
      setReposError(err.message || 'Failed to fetch repositories');
      console.error('Repos fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [get]);

  // Initial load + 30s polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Derived data from latest run
  const latestRun = recentRuns[0] || null;

  const evolutionData = useMemo(() => {
    if (!latestRun?.evolutionData?.length) return [];
    return latestRun.evolutionData;
  }, [latestRun]);

  if (loading) {
    return (
      <div className="dashboard" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={36} className="spinning" style={{ color: 'var(--accent-cyan)' }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-md)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const hasData = metrics && metrics.totalRuns > 0;

  return (
    <div className="dashboard">
      {/* ─── Index Error Alert ─── */}
      {(metricsError.toLowerCase().includes('index') || runsError.toLowerCase().includes('index') || reposError.toLowerCase().includes('index')) && (
        <div className="index-warning-banner glass-card" style={{ display: 'flex', gap: 'var(--space-md)', padding: 'var(--space-md)', borderColor: 'rgba(255, 170, 0, 0.2)', marginBottom: 'var(--space-lg)', animation: 'fadeIn 0.3s ease' }}>
          <AlertTriangle size={24} className="text-amber" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: 0, fontWeight: 700 }}>Firestore Index Required</h4>
            <p className="text-secondary" style={{ fontSize: 'var(--font-sm)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
              Firestore requires composite indexes to support dashboard sorting and telemetry queries.
              Please check your **backend terminal logs** — Firestore has printed a direct Google Cloud Console URL. 
              Clicking that link will configure the index automatically in seconds.
            </p>
          </div>
        </div>
      )}

      {/* ─── Metrics Header ─── */}
      <section className="metrics-grid" style={{ animation: 'fadeInUp 0.5s ease both' }}>
        {[
          {
            label: 'Time Saved',
            value: metrics?.totalTimeSavedHours || 0,
            suffix: 'h',
            icon: Clock,
            color: 'cyan',
            decimals: 1,
          },
          {
            label: 'Optimization Runs',
            value: metrics?.totalRuns || 0,
            suffix: '',
            icon: Activity,
            color: 'green',
            decimals: 0,
          },
          {
            label: 'Active Repos',
            value: metrics?.activeRepos || 0,
            suffix: '',
            icon: FolderGit2,
            color: 'purple',
            decimals: 0,
          },
          {
            label: 'Avg Optimization',
            value: metrics?.avgOptimization || 0,
            suffix: '%',
            icon: TrendingUp,
            color: 'amber',
            decimals: 1,
          },
        ].map(({ label, value, suffix, icon: Icon, color, decimals }) => (
          <div key={label} className="stat-card">
            <span className={`stat-icon text-${color}`} style={{ background: `var(--accent-${color}-dim)` }}>
              <Icon size={20} />
            </span>
            <div className="stat-label">{label}</div>
            <div className="stat-value">
              <AnimatedValue value={value} suffix={suffix} decimals={decimals} />
            </div>
          </div>
        ))}
      </section>

      {/* ─── Performance Comparison ─── */}
      <section className="mt-xl" style={{ animation: 'fadeInUp 0.5s ease 0.1s both' }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <Flame size={20} className="text-amber" />
              Performance Comparison
            </h2>
            <p className="section-subtitle">Latest optimization run: naive vs GA-optimized</p>
          </div>
        </div>

        {latestRun ? (
          <div className="comparison-grid">
            <div className="comparison-card glass-card">
              <span className="comparison-label">Naive (All Tests)</span>
              <span className="comparison-value text-red">
                {formatDuration(latestRun.naiveTimeSec)}
              </span>
              <span className="comparison-detail">
                {latestRun.totalTests} tests
              </span>
            </div>
            <div className="comparison-card glass-card comparison-highlight">
              <span className="comparison-label">GA Optimized</span>
              <span className="comparison-value text-green">
                {formatDuration(latestRun.gaTimeSec)}
              </span>
              <span className="comparison-detail">
                {latestRun.testsSelected} tests selected
              </span>
            </div>
            <div className="comparison-card glass-card">
              <span className="comparison-label">Time Saved</span>
              <span className="comparison-value text-cyan">
                {formatDuration(latestRun.timeSaved)}
              </span>
              <span className="comparison-detail">
                {latestRun.naiveTimeSec > 0
                  ? `${((latestRun.timeSaved / latestRun.naiveTimeSec) * 100).toFixed(1)}% reduction`
                  : '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="glass-card">
            <EmptyState
              icon={FlaskConical}
              title="No optimization data yet"
              subtitle="Run `smart-test run` in your project to see the first performance comparison."
            />
          </div>
        )}
      </section>

      {/* ─── GA Evolution Chart ─── */}
      <section className="mt-xl" style={{ animation: 'fadeInUp 0.5s ease 0.2s both' }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <Dna size={20} className="text-cyan" />
              GA Convergence
            </h2>
            <p className="section-subtitle">
              {latestRun
                ? `${latestRun.gaGenerations || 0} generations • Best fitness: ${(latestRun.gaBestFitness || 0).toFixed(4)}`
                : 'Fitness evolution across generations'}
            </p>
          </div>
        </div>

        <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
          {evolutionData.length > 0 ? (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionData}>
                  <defs>
                    <linearGradient id="bestGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="generation"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="bestFitness"
                    name="Best Fitness"
                    stroke="#00d4ff"
                    strokeWidth={2}
                    fill="url(#bestGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="avgFitness"
                    name="Avg Fitness"
                    stroke="#a855f7"
                    strokeWidth={1.5}
                    fill="url(#avgGrad)"
                    strokeDasharray="4 4"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={Dna}
              title="No evolution data yet"
              subtitle="GA convergence graphs appear after your first optimization run with 6+ intersecting tests."
            />
          )}
        </div>
      </section>

      {/* ─── Recent Runs ─── */}
      <section className="mt-xl" style={{ animation: 'fadeInUp 0.5s ease 0.3s both' }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <Layers size={20} className="text-green" />
              Recent Runs
            </h2>
            <p className="section-subtitle">Latest optimization executions across all repositories</p>
          </div>
        </div>

        {recentRuns.length > 0 ? (
          <div className="runs-table-container glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="runs-table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Tests</th>
                  <th>Time Saved</th>
                  <th>Coverage</th>
                  <th>Status</th>
                  <th>When</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run, idx) => (
                  <tr
                    key={run.runId || idx}
                    className={expandedRun === idx ? 'row-expanded' : ''}
                    onClick={() => setExpandedRun(expandedRun === idx ? null : idx)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="run-repo-name">
                        <FolderGit2 size={14} />
                        {run.repoName || 'Unknown'}
                      </span>
                    </td>
                    <td>
                      <span className="run-tests">
                        {run.testsSelected}/{run.totalTests}
                      </span>
                    </td>
                    <td>
                      <span className="text-green">{formatDuration(run.timeSaved)}</span>
                    </td>
                    <td>
                      <span className={run.coverageRatio >= 0.99 ? 'text-green' : 'text-amber'}>
                        {((run.coverageRatio || 0) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      {run.exitCode === 0 ? (
                        <span className="badge badge-green"><CheckCircle2 size={12} /> Pass</span>
                      ) : (
                        <span className="badge badge-red"><AlertTriangle size={12} /> Fail</span>
                      )}
                    </td>
                    <td className="text-secondary">
                      {formatRelativeTime(run.timestamp)}
                    </td>
                    <td>
                      {expandedRun === idx ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="glass-card">
            <EmptyState
              icon={Terminal}
              title="No optimization runs yet"
              subtitle="Run `smart-test init <API_KEY>` in a Git repo, then `smart-test run` after making code changes."
            />
          </div>
        )}
      </section>

      {/* ─── Selected Tests from Latest Run ─── */}
      <section className="mt-xl" style={{ animation: 'fadeInUp 0.5s ease 0.4s both' }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <TestTubes size={20} className="text-purple" />
              Test Selection — Latest Run
            </h2>
            <p className="section-subtitle">
              {latestRun?.selectedTests?.length
                ? `${latestRun.selectedTests.length} tests selected by the GA optimizer`
                : 'Tests selected by the genetic algorithm'}
            </p>
          </div>
        </div>

        {latestRun?.selectedTests?.length > 0 ? (
          <div className="test-grid">
            {latestRun.selectedTests.map((test, i) => (
              <div
                key={i}
                className="test-chip glass-card"
                onClick={() => setSelectedTest(test)}
              >
                <FileCode size={14} />
                <span className="test-chip-name">{test}</span>
                <Eye size={12} className="test-chip-eye" />
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card">
            <EmptyState
              icon={TestTubes}
              title="No test selection data"
              subtitle="After running `smart-test run`, the GA-selected tests will appear here."
            />
          </div>
        )}
      </section>

      {/* ─── API Key Manager ─── */}
      <section className="mt-xl" style={{ animation: 'fadeInUp 0.5s ease 0.5s both' }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <Zap size={20} className="text-amber" />
              Integration
            </h2>
            <p className="section-subtitle">Connect your CI/CD pipeline to TIA Optimizer</p>
          </div>
        </div>
        <ApiKeyManager />
      </section>

      {/* Test Detail Modal */}
      {selectedTest && (
        <TestDetailModal test={selectedTest} onClose={() => setSelectedTest(null)} />
      )}
    </div>
  );
}
