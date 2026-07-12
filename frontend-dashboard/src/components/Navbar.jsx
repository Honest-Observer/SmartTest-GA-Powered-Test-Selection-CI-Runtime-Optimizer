import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Dna, LayoutDashboard, FolderGit2, Settings, LogOut, ChevronDown, User } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
  };

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/ga-tuning', label: 'GA Tuning', icon: Settings },
    { to: '/repos', label: 'Repositories', icon: FolderGit2 },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo">
            <Dna size={24} />
          </div>
          <span className="navbar-brand-text">TIA Optimizer</span>
        </Link>

        {/* Nav Links */}
        <div className="navbar-links">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`navbar-link ${location.pathname === to ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          ))}
        </div>

        {/* User Section */}
        <div className="navbar-user" ref={dropdownRef}>
          <button
            className="navbar-user-btn"
            onClick={() => setDropdownOpen((prev) => !prev)}
          >
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt=""
                className="navbar-avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="navbar-avatar-fallback">
                <User size={16} />
              </div>
            )}
            <span className="navbar-user-name">
              {currentUser?.displayName || 'User'}
            </span>
            <ChevronDown
              size={14}
              className={`navbar-chevron ${dropdownOpen ? 'rotated' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div className="navbar-dropdown">
              <div className="navbar-dropdown-header">
                <p className="navbar-dropdown-name">
                  {currentUser?.displayName}
                </p>
                <p className="navbar-dropdown-email">
                  {currentUser?.email}
                </p>
              </div>
              <div className="navbar-dropdown-divider" />
              <button className="navbar-dropdown-item" onClick={handleLogout}>
                <LogOut size={15} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
