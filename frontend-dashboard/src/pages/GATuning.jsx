import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Settings, Play, Pause, SkipForward, SkipBack, RotateCcw, Save,
  Dna, FlaskConical, Zap, Layers, ChevronDown, CheckCircle2, AlertTriangle, RefreshCw, Loader2
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import './GATuning.css';

// Default parameters for reset
const GA_DEFAULTS = {
  populationSize: 100,
  maxGenerations: 100,
  mutationRate: 0.02,
  timeLimitMs: 3000,
  stagnationLimit: 15,
  elitismRate: 0.05,
  tournamentSize: 5,
  alpha: 0.7,
  beta: 0.3,
  coveragePenalty: -1000,
};

function formatRunTime(dateVal) {
  if (!dateVal) return 'Unknown';
  const d = dateVal._seconds ? new Date(dateVal._seconds * 1000)
    : dateVal.seconds ? new Date(dateVal.seconds * 1000)
    : new Date(dateVal);
  if (isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function GATuning() {
  const { get, put } = useApi();

  // Repo state
  const [repos, setRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [repoLoading, setRepoLoading] = useState(true);

  // GA Config state
  const [config, setConfig] = useState(GA_DEFAULTS);
  const [configLoading, setConfigLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Runs state for Evolution Replay
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [runLoading, setRunLoading] = useState(false);
  const [evolutionData, setEvolutionData] = useState([]);
  const [runMetadata, setRunMetadata] = useState(null);

  // Animation/Playback state
  const [currentGenIdx, setCurrentGenIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // multiplier
  const playbackIntervalRef = useRef(null);

  // Fetch initial repositories
  useEffect(() => {
    async function fetchRepos() {
      try {
        const data = await get('/repos');
        if (data?.repositories?.length > 0) {
          setRepos(data.repositories);
          setSelectedRepoId(data.repositories[0].repoId);
        }
      } catch (err) {
        console.error('Failed to load repositories:', err);
      } finally {
        setRepoLoading(false);
      }
    }
    fetchRepos();
  }, [get]);

  // Fetch GA configuration when repository changes
  useEffect(() => {
    if (!selectedRepoId) return;
    async function fetchGaConfig() {
      setConfigLoading(true);
      try {
        const data = await get(`/ga-config/${selectedRepoId}`);
        if (data) {
          setConfig(data);
        }
      } catch (err) {
        console.error('Failed to load GA config:', err);
      } finally {
        setConfigLoading(false);
      }
    }
    fetchGaConfig();
  }, [selectedRepoId, get]);

  // Fetch runs for the selected repository for replay
  useEffect(() => {
    if (!selectedRepoId) return;
    async function fetchRuns() {
      setRunLoading(true);
      try {
        // Query recent runs across all, then filter by repo or directly
        const data = await get('/dashboard/recent?limit=50');
        if (data?.runs) {
          const filteredRuns = data.runs.filter(r => r.repoId === selectedRepoId);
          setRuns(filteredRuns);
          if (filteredRuns.length > 0) {
            setSelectedRunId(filteredRuns[0].runId);
          } else {
            setSelectedRunId('');
            setEvolutionData([]);
            setRunMetadata(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch runs:', err);
      } finally {
        setRunLoading(false);
      }
    }
    fetchRuns();
  }, [selectedRepoId, get]);

  // Fetch specific evolution data when a run is selected
  useEffect(() => {
    if (!selectedRepoId || !selectedRunId) return;
    async function fetchEvolution() {
      try {
        const data = await get(`/ga-config/${selectedRepoId}/evolution/${selectedRunId}`);
        if (data) {
          setEvolutionData(data.evolutionData || []);
          setRunMetadata(data);
          setCurrentGenIdx(0);
          setIsPlaying(false);
        }
      } catch (err) {
        console.error('Failed to load evolution data:', err);
      }
    }
    fetchEvolution();
  }, [selectedRepoId, selectedRunId, get]);

  // Animation loop management
  useEffect(() => {
    if (isPlaying && evolutionData.length > 0) {
      const intervalMs = 300 / playbackSpeed;
      playbackIntervalRef.current = setInterval(() => {
        setCurrentGenIdx((prevIdx) => {
          if (prevIdx >= evolutionData.length - 1) {
            setIsPlaying(false);
            return prevIdx;
          }
          return prevIdx + 1;
        });
      }, intervalMs);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, evolutionData, playbackSpeed]);

  // Save config changes
  const handleSaveConfig = async () => {
    setSaveError('');
    setSaveSuccess(false);
    try {
      const res = await put(`/ga-config/${selectedRepoId}`, config);
      if (res?.config) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      setSaveError(err.message || 'Failed to save configuration');
    }
  };

  // Reset to defaults helper
  const handleResetDefaults = () => {
    setConfig({
      ...GA_DEFAULTS,
      isCustom: false,
    });
  };

  // Safe handler to update single config keys
  const updateConfigKey = (key, val) => {
    setConfig(prev => ({
      ...prev,
      [key]: val,
    }));
  };

  // Replay helpers
  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleStop = () => {
    setIsPlaying(false);
    setCurrentGenIdx(0);
  };
  const handleStepForward = () => {
    if (currentGenIdx < evolutionData.length - 1) {
      setCurrentGenIdx(prev => prev + 1);
    }
  };
  const handleStepBackward = () => {
    if (currentGenIdx > 0) {
      setCurrentGenIdx(prev => prev - 1);
    }
  };

  // Current chromosome view state
  const currentGenData = evolutionData[currentGenIdx] || null;
  const currentChromosome = currentGenData?.bestChromosome || [];

  // Limit of display for graph overlay
  const replayChartData = useMemo(() => {
    return evolutionData.slice(0, currentGenIdx + 1);
  }, [evolutionData, currentGenIdx]);

  if (repoLoading) {
    return (
      <div className="ga-tuning-loading">
        <Loader2 size={32} className="spinning text-cyan" />
        <p>Loading repositories...</p>
      </div>
    );
  }

  return (
    <div className="ga-tuning-page">
      {/* ─── Header ─── */}
      <div className="ga-tuning-header">
        <div>
          <h1 className="ga-tuning-title">
            <Dna size={28} />
            GA Parameter Tuning
          </h1>
          <p className="ga-tuning-subtitle">
            Optimize execution parameters and inspect chromosome propagation
          </p>
        </div>

        {repos.length > 0 && (
          <div className="repo-select-container">
            <label htmlFor="repoSelect" className="text-secondary font-xs">Select Repository:</label>
            <div className="select-wrapper">
              <select
                id="repoSelect"
                className="repo-selector"
                value={selectedRepoId}
                onChange={e => setSelectedRepoId(e.target.value)}
              >
                {repos.map(r => (
                  <option key={r.repoId} value={r.repoId}>{r.repoName}</option>
                ))}
              </select>
              <ChevronDown size={14} className="select-chevron" />
            </div>
          </div>
        )}
      </div>

      {repos.length === 0 ? (
        <div className="ga-tuning-empty glass-card">
          <FlaskConical size={48} className="text-cyan" />
          <h2>No Connected Repositories</h2>
          <p>
            You must initialize the CLI in at least one repository to access genetic parameter tuning.
          </p>
        </div>
      ) : (
        <div className="ga-tuning-grid">
          
          {/* ─── COLUMN 1: PARAMETER CONTROLS ─── */}
          <div className="ga-column-controls glass-card">
            <div className="panel-header">
              <h3><Settings size={18} className="text-purple" /> Algorithm Parameters</h3>
              {config.isCustom && <span className="custom-badge">Custom</span>}
            </div>

            {configLoading ? (
              <div className="panel-loading">
                <Loader2 size={24} className="spinning" />
              </div>
            ) : (
              <div className="sliders-container">
                {/* Population Size */}
                <div className="ga-slider-group">
                  <div className="slider-label-row">
                    <span>Population Size</span>
                    <span className="slider-value">{config.populationSize}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={config.populationSize}
                    onChange={e => updateConfigKey('populationSize', parseInt(e.target.value))}
                  />
                  <span className="slider-hint">Number of candidate test suites per generation.</span>
                </div>

                {/* Max Generations */}
                <div className="ga-slider-group">
                  <div className="slider-label-row">
                    <span>Max Generations</span>
                    <span className="slider-value">{config.maxGenerations}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={config.maxGenerations}
                    onChange={e => updateConfigKey('maxGenerations', parseInt(e.target.value))}
                  />
                  <span className="slider-hint">Max cycles before returning best solution.</span>
                </div>

                {/* Mutation Rate */}
                <div className="ga-slider-group">
                  <div className="slider-label-row">
                    <span>Mutation Rate</span>
                    <span className="slider-value">{(config.mutationRate * 100).toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.001"
                    max="0.10"
                    step="0.001"
                    value={config.mutationRate}
                    onChange={e => updateConfigKey('mutationRate', parseFloat(e.target.value))}
                  />
                  <span className="slider-hint">Probability of flipping a test selection bit.</span>
                </div>

                {/* Elitism Rate */}
                <div className="ga-slider-group">
                  <div className="slider-label-row">
                    <span>Elitism Rate</span>
                    <span className="slider-value">{(config.elitismRate * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.20"
                    step="0.01"
                    value={config.elitismRate}
                    onChange={e => updateConfigKey('elitismRate', parseFloat(e.target.value))}
                  />
                  <span className="slider-hint">Top-performing suites carried over unmodified.</span>
                </div>

                {/* Tournament Size */}
                <div className="ga-slider-group">
                  <div className="slider-label-row">
                    <span>Tournament Size</span>
                    <span className="slider-value">{config.tournamentSize}</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="20"
                    step="1"
                    value={config.tournamentSize}
                    onChange={e => updateConfigKey('tournamentSize', parseInt(e.target.value))}
                  />
                  <span className="slider-hint">Reproducing parents selection bracket size.</span>
                </div>

                {/* Alpha Weight */}
                <div className="ga-slider-group">
                  <div className="slider-label-row">
                    <span className="text-cyan">Coverage Weight (α)</span>
                    <span className="slider-value text-cyan">{config.alpha}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={config.alpha}
                    onChange={e => updateConfigKey('alpha', parseFloat(e.target.value))}
                  />
                  <span className="slider-hint">Importance of code execution coverage.</span>
                </div>

                {/* Beta Weight */}
                <div className="ga-slider-group">
                  <div className="slider-label-row">
                    <span className="text-purple">Time Weight (β)</span>
                    <span className="slider-value text-purple">{config.beta}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={config.beta}
                    onChange={e => updateConfigKey('beta', parseFloat(e.target.value))}
                  />
                  <span className="slider-hint">Importance of minimizing execution time.</span>
                </div>

                {/* Coverage Penalty */}
                <div className="ga-slider-group">
                  <div className="slider-label-row">
                    <span className="text-red">Coverage Deficit Penalty</span>
                    <span className="slider-value text-red">{config.coveragePenalty}</span>
                  </div>
                  <input
                    type="range"
                    min="-10000"
                    max="-10"
                    step="50"
                    value={config.coveragePenalty}
                    onChange={e => updateConfigKey('coveragePenalty', parseInt(e.target.value))}
                  />
                  <span className="slider-hint">Penalty applied if covered lines drop below 100%.</span>
                </div>

                {/* Time Limit */}
                <div className="ga-slider-group">
                  <div className="slider-label-row">
                    <span>Server Run Timeout</span>
                    <span className="slider-value">{config.timeLimitMs}ms</span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="10000"
                    step="250"
                    value={config.timeLimitMs}
                    onChange={e => updateConfigKey('timeLimitMs', parseInt(e.target.value))}
                  />
                  <span className="slider-hint">Max server execution window before fallback.</span>
                </div>

                {/* Stagnation Limit */}
                <div className="ga-slider-group">
                  <div className="slider-label-row">
                    <span>Stagnation Limit</span>
                    <span className="slider-value">{config.stagnationLimit}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={config.stagnationLimit}
                    onChange={e => updateConfigKey('stagnationLimit', parseInt(e.target.value))}
                  />
                  <span className="slider-hint">Generations without optimization updates before halt.</span>
                </div>

                {/* Controls action row */}
                <div className="config-actions">
                  <button className="btn btn-secondary" onClick={handleResetDefaults}>
                    Reset Defaults
                  </button>
                  <button className="btn btn-primary btn-save" onClick={handleSaveConfig}>
                    <Save size={14} /> Save Config
                  </button>
                </div>

                {saveSuccess && (
                  <div className="ga-save-toast text-green">
                    <CheckCircle2 size={14} /> Parameter profile updated in Firestore!
                  </div>
                )}
                {saveError && (
                  <div className="ga-save-toast text-red">
                    <AlertTriangle size={14} /> {saveError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── COLUMN 2: REPLAY & FORMULA ─── */}
          <div className="ga-column-replay">
            {/* Fitness Function Card */}
            <div className="glass-card fitness-card">
              <div className="panel-header">
                <h3><Zap size={18} className="text-amber" /> Fitness Function Optimization</h3>
              </div>
              <div className="fitness-formula-container">
                <div className="fitness-formula">
                  F(chromosome) = <span className="formula-part text-cyan">{config.alpha}</span> • Coverage(c) 
                  - <span className="formula-part text-purple">{config.beta}</span> • Time(c) 
                  {currentChromosome.length > 0 && (
                    <span> + <span className="formula-part text-red">({config.coveragePenalty})</span> • Deficit(c)</span>
                  )}
                </div>
                <p className="text-secondary font-sm">
                  The genetic engine selects candidate test suites that maximize coverage of modified source lines 
                  while actively minimizing total suite execution time. If code changes are uncovered, a significant 
                  penalty is applied, eliminating the chromosome.
                </p>
              </div>
            </div>

            {/* Replay Panel */}
            <div className="glass-card replay-panel">
              <div className="panel-header-row">
                <div className="panel-header">
                  <Layers size={18} className="text-cyan" />
                  <h3>Evolutionary Replay</h3>
                </div>
                {runs.length > 0 && (
                  <div className="select-wrapper">
                    <select
                      className="run-selector"
                      value={selectedRunId}
                      onChange={e => setSelectedRunId(e.target.value)}
                    >
                      {runs.map((r, i) => (
                        <option key={r.runId} value={r.runId}>
                          Run {runs.length - i} ({formatRunTime(r.timestamp)})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="select-chevron" />
                  </div>
                )}
              </div>

              {runLoading ? (
                <div className="panel-loading">
                  <Loader2 size={24} className="spinning" />
                </div>
              ) : runs.length === 0 ? (
                <div className="replay-empty">
                  <FlaskConical size={32} className="text-tertiary" />
                  <p>No historical runs found for this repository.</p>
                  <span className="font-xs text-secondary">
                    Run the optimizer CLI (<code>smart-test run</code>) to produce genetic histories.
                  </span>
                </div>
              ) : (
                <div className="replay-content">
                  {/* Replay graph */}
                  <div className="replay-chart-container" style={{ height: 200, minHeight: 200 }}>
                    {replayChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={replayChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis
                            dataKey="generation"
                            domain={[0, runMetadata?.gaGenerations || 100]}
                            stroke="rgba(255,255,255,0.1)"
                            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                          />
                          <YAxis
                            stroke="rgba(255,255,255,0.1)"
                            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="bestFitness"
                            name="Best Fitness"
                            stroke="#00d4ff"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="avgFitness"
                            name="Avg Fitness"
                            stroke="#a855f7"
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Awaiting run evolution history...</p>
                      </div>
                    )}
                  </div>

                  {/* Playback bar */}
                  <div className="playback-controls-container">
                    <div className="playback-buttons">
                      <button className="btn btn-ghost btn-icon" onClick={handleStop} title="Restart">
                        <RotateCcw size={16} />
                      </button>
                      <button className="btn btn-ghost btn-icon" onClick={handleStepBackward} disabled={currentGenIdx === 0}>
                        <SkipBack size={16} />
                      </button>
                      <button className="btn btn-primary btn-icon btn-round" onClick={handlePlayPause}>
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button className="btn btn-ghost btn-icon" onClick={handleStepForward} disabled={currentGenIdx >= evolutionData.length - 1}>
                        <SkipForward size={16} />
                      </button>
                    </div>

                    <div className="generation-badge">
                      Generation: <span>{currentGenIdx}</span> / {evolutionData.length - 1}
                    </div>

                    <div className="speed-buttons">
                      {[1, 2, 5].map(s => (
                        <button
                          key={s}
                          className={`btn btn-ghost btn-sm speed-btn ${playbackSpeed === s ? 'active-speed' : ''}`}
                          onClick={() => setPlaybackSpeed(s)}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Telemetry metadata */}
                  {runMetadata && (
                    <div className="run-telemetry-row">
                      <div className="telemetry-item">
                        <span className="telemetry-label">Reason</span>
                        <span className="telemetry-value text-amber">{runMetadata.convergenceReason}</span>
                      </div>
                      <div className="telemetry-item">
                        <span className="telemetry-label">Fittest</span>
                        <span className="telemetry-value text-cyan">{currentGenData?.bestFitness?.toFixed(3) || '—'}</span>
                      </div>
                      <div className="telemetry-item">
                        <span className="telemetry-label">Avg F</span>
                        <span className="telemetry-value text-purple">{currentGenData?.avgFitness?.toFixed(3) || '—'}</span>
                      </div>
                      <div className="telemetry-item">
                        <span className="telemetry-label">Selected</span>
                        <span className="telemetry-value text-green">
                          {currentChromosome.filter(g => g === 1).length} / {currentChromosome.length} tests
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Chromosome representation grid */}
                  <div className="chromosome-section">
                    <h4 className="section-title-sm">Fittest Chromosome Structure (Gen {currentGenIdx})</h4>
                    {currentChromosome.length > 0 ? (
                      <div className="chromosome-grid">
                        {currentChromosome.map((val, idx) => (
                          <div
                            key={idx}
                            className={`chromosome-cell ${val === 1 ? 'selected' : 'omitted'}`}
                            title={`Test Index: ${idx} | Status: ${val === 1 ? 'Selected' : 'Omitted'}`}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="replay-empty">
                        <p className="font-xs text-secondary">No chromosome data stored in this run record.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
