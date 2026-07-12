import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Dna, Zap, Shield, TrendingUp, GitBranch, ChevronRight } from 'lucide-react';
import './Login.css';

export default function Login() {
  const { currentUser, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await login();
    } catch (err) {
      setError('Sign-in failed. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: 'Intelligent Test Selection',
      desc: 'GA-powered analysis selects only the tests that matter for each code change.',
    },
    {
      icon: TrendingUp,
      title: '94%+ Time Reduction',
      desc: 'Dramatically reduce CI pipeline duration while maintaining coverage.',
    },
    {
      icon: Shield,
      title: 'Coverage Guaranteed',
      desc: 'Fitness function ensures critical paths are always tested.',
    },
    {
      icon: GitBranch,
      title: 'Federated Learning',
      desc: 'Models improve across your entire organization without sharing code.',
    },
  ];

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
        <div className="login-grid" />
        {/* DNA helix particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="login-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${4 + Math.random() * 6}s`,
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              opacity: 0.2 + Math.random() * 0.4,
            }}
          />
        ))}
      </div>

      <div className="login-container">
        {/* Main Card */}
        <div className="login-card">
          <div className="login-card-glow" />

          <div className="login-logo">
            <div className="login-logo-icon">
              <Dna size={32} />
            </div>
          </div>

          <h1 className="login-title">Evolve Your CI Pipeline</h1>
          <p className="login-subtitle">
            Federated Genetic Algorithm Test Impact Analysis
          </p>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            className="login-google-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <div className="spinner spinner-sm" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
            {!loading && <ChevronRight size={18} />}
          </button>

          <p className="login-terms">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        {/* Features */}
        <div className="login-features">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="login-feature">
              <div className="login-feature-icon">
                <Icon size={18} />
              </div>
              <div>
                <h3 className="login-feature-title">{title}</h3>
                <p className="login-feature-desc">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
