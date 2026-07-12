import { useState, useCallback, useEffect } from 'react';
import { Key, Copy, RefreshCw, CheckCircle2, Terminal, Shield, AlertTriangle } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import './ApiKeyManager.css';

const SESSION_KEY = 'tia_api_key_plaintext';

export default function ApiKeyManager() {
  const { get, post } = useApi();
  const [apiKey, setApiKey] = useState(null);
  const [keyPrefix, setKeyPrefix] = useState(null);
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [error, setError] = useState('');

  // Load API key status on mount
  useEffect(() => {
    async function loadKeyStatus() {
      setLoading(true);
      try {
        const data = await get('/auth/api-key');
        if (data?.hasKey) {
          setHasKey(true);
          setKeyPrefix(data.keyPrefix);
          // Check sessionStorage for plaintext key from this session
          const stored = sessionStorage.getItem(SESSION_KEY);
          if (stored) {
            setApiKey(stored);
          }
        } else {
          setHasKey(false);
          setKeyPrefix(null);
        }
      } catch {
        // Backend unreachable
        setHasKey(false);
      } finally {
        setLoading(false);
      }
    }
    loadKeyStatus();
  }, [get]);

  const generateNewKey = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await post('/auth/api-key');
      if (data?.apiKey) {
        setApiKey(data.apiKey);
        setHasKey(true);
        setKeyPrefix(data.apiKey.substring(0, 12) + '...');
        setJustGenerated(true);
        // Persist in sessionStorage so it survives page refresh within same tab
        sessionStorage.setItem(SESSION_KEY, data.apiKey);
        setTimeout(() => setJustGenerated(false), 5000);
      }
    } catch (err) {
      setError('Failed to generate API key. Is the backend running?');
      console.error('Generate key error:', err);
    } finally {
      setLoading(false);
    }
  }, [post]);

  const copyToClipboard = useCallback(async () => {
    const textToCopy = apiKey || keyPrefix;
    if (!textToCopy || textToCopy.includes('•')) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [apiKey, keyPrefix]);

  // Determine what to display
  let displayKey;
  if (apiKey) {
    displayKey = apiKey; // Plaintext available
  } else if (keyPrefix) {
    displayKey = keyPrefix; // Masked prefix from server
  } else {
    displayKey = null; // No key at all
  }

  return (
    <div className="api-key-manager glass-card-static">
      <div className="akm-header">
        <div className="akm-icon">
          <Key size={20} />
        </div>
        <div>
          <h3 className="akm-title">API Key</h3>
          <p className="akm-subtitle">Use this key to authenticate CLI and CI/CD integrations</p>
        </div>
      </div>

      <div className="akm-key-display">
        <div className="akm-key-box">
          <code className="akm-key-value">
            {displayKey || '••••••••••••••••••••••••••••••••'}
          </code>
          <div className="akm-key-actions">
            {apiKey && (
              <button
                className="btn btn-ghost btn-icon"
                onClick={copyToClipboard}
                title="Copy to clipboard"
              >
                {copied ? <CheckCircle2 size={16} className="text-green" /> : <Copy size={16} />}
              </button>
            )}
          </div>
        </div>
        {copied && <span className="akm-copied-toast">Copied!</span>}
        {justGenerated && (
          <div className="akm-warning-toast">
            <AlertTriangle size={14} />
            <span>Copy this key now — it won't be shown again after you close this tab</span>
          </div>
        )}
        {hasKey && !apiKey && (
          <p className="akm-info-text">
            <Shield size={12} />
            Your key is active but masked for security. Generate a new key if you need to copy it.
          </p>
        )}
      </div>

      {error && <p className="akm-error">{error}</p>}

      <button
        className="btn btn-secondary"
        onClick={generateNewKey}
        disabled={loading}
        style={{ marginTop: 'var(--space-md)' }}
      >
        <RefreshCw size={14} className={loading ? 'spinning' : ''} />
        {loading ? 'Generating…' : hasKey ? 'Regenerate Key' : 'Generate API Key'}
      </button>
      {hasKey && (
        <p className="akm-revoke-note">Generating a new key will revoke the previous one.</p>
      )}

      <div className="akm-instructions">
        <h4 className="akm-instructions-title">
          <Terminal size={16} />
          Quick Setup
        </h4>
        <p className="akm-instructions-text">
          Install the TIA Optimizer CLI and initialize it with your API key:
        </p>
        <div className="code-block">
          <code>
            npm install -g smart-test-tia && smart-test init {apiKey ? apiKey : '<YOUR_KEY>'}
          </code>
        </div>
        <p className="akm-instructions-note">
          Then run <code>smart-test run</code> in your project to start optimizing test selection.
        </p>
      </div>
    </div>
  );
}
