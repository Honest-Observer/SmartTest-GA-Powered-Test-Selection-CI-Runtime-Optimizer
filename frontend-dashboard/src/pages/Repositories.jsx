import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderGit2, Clock, TrendingUp, FlaskConical,
  ArrowUpRight, Trash2, Loader2, Terminal, Dna,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import './Repositories.css';

function formatDate(dateVal) {
  if (!dateVal) return 'Never';
  const d = dateVal._seconds ? new Date(dateVal._seconds * 1000)
    : dateVal.seconds ? new Date(dateVal.seconds * 1000)
    : new Date(dateVal);
  if (isNaN(d.getTime())) return 'Unknown';
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Repositories() {
  const { get, del } = useApi();
  const navigate = useNavigate();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const fetchRepos = useCallback(async () => {
    try {
      const data = await get('/repos');
      if (data?.repositories) {
        setRepos(data.repositories);
      }
    } catch (err) {
      console.error('Failed to fetch repos:', err);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  const handleDelete = async (e, repoId, repoName) => {
    e.stopPropagation();
    if (!confirm(`Delete repository "${repoName}"? This will remove all associated data.`)) return;
    setDeleting(repoId);
    try {
      await del(`/repos/${repoId}`);
      setRepos(prev => prev.filter(r => r.repoId !== repoId));
    } catch (err) {
      console.error('Failed to delete repo:', err);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="repos-page">
        <div className="repos-loading">
          <Loader2 size={32} className="spinning" />
          <p>Loading repositories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="repos-page">
      <div className="repos-header">
        <div>
          <h1 className="repos-title">
            <FolderGit2 size={28} />
            Repositories
          </h1>
          <p className="repos-subtitle">
            {repos.length > 0
              ? `${repos.length} connected repositor${repos.length === 1 ? 'y' : 'ies'}`
              : 'No repositories connected yet'}
          </p>
        </div>
      </div>

      {repos.length === 0 ? (
        <div className="repos-empty glass-card">
          <div className="repos-empty-icon">
            <Dna size={48} />
          </div>
          <h2>No Repositories Connected</h2>
          <p>
            Repositories are automatically registered when you initialize the CLI tool
            in a Git repository.
          </p>
          <div className="repos-empty-steps">
            <div className="step-card">
              <span className="step-number">1</span>
              <div>
                <h4>Install the CLI</h4>
                <code>npm link</code> (from cli-tool directory)
              </div>
            </div>
            <div className="step-card">
              <span className="step-number">2</span>
              <div>
                <h4>Initialize in your project</h4>
                <code>smart-test init &lt;YOUR_API_KEY&gt;</code>
              </div>
            </div>
            <div className="step-card">
              <span className="step-number">3</span>
              <div>
                <h4>Run optimization</h4>
                <code>smart-test run</code>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="repos-grid">
          {repos.map(repo => (
            <div
              key={repo.repoId}
              className="repo-card glass-card"
              onClick={() => navigate(`/repos/${repo.repoId}`)}
            >
              <div className="repo-card-header">
                <div className="repo-card-icon">
                  <FolderGit2 size={20} />
                </div>
                <h3 className="repo-card-name">{repo.repoName}</h3>
                <div className="repo-card-actions">
                  <button
                    className="btn btn-ghost btn-icon btn-danger-hover"
                    onClick={(e) => handleDelete(e, repo.repoId, repo.repoName)}
                    disabled={deleting === repo.repoId}
                    title="Delete repository"
                  >
                    {deleting === repo.repoId
                      ? <Loader2 size={14} className="spinning" />
                      : <Trash2 size={14} />}
                  </button>
                  <ArrowUpRight size={16} className="repo-card-arrow" />
                </div>
              </div>

              <div className="repo-card-stats">
                <div className="repo-stat">
                  <FlaskConical size={14} />
                  <span className="repo-stat-value">{repo.totalTests?.toLocaleString() || 0}</span>
                  <span className="repo-stat-label">tests</span>
                </div>
                <div className="repo-stat">
                  <TrendingUp size={14} />
                  <span className="repo-stat-value">{repo.totalRuns || 0}</span>
                  <span className="repo-stat-label">runs</span>
                </div>
                <div className="repo-stat">
                  <Clock size={14} />
                  <span className="repo-stat-value">
                    {repo.totalTimeSaved ? `${(repo.totalTimeSaved / 60).toFixed(1)}m` : '0s'}
                  </span>
                  <span className="repo-stat-label">saved</span>
                </div>
              </div>

              {repo.avgOptimization > 0 && (
                <div className="repo-card-optimization">
                  <div className="optimization-bar">
                    <div
                      className="optimization-fill"
                      style={{ width: `${Math.min(repo.avgOptimization, 100)}%` }}
                    />
                  </div>
                  <span className="optimization-label">
                    {repo.avgOptimization.toFixed(1)}% avg optimization
                  </span>
                </div>
              )}

              <div className="repo-card-footer">
                <span className="repo-card-coverage">
                  {repo.hasCoverageMap ? '✅ Coverage map active' : '⏳ Awaiting init'}
                </span>
                <span className="repo-card-date">
                  {repo.lastRunAt ? `Last run ${formatDate(repo.lastRunAt)}` : 'No runs yet'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
