import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../services/api";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, token, logout } = useAuth();

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let isMounted = true;
    async function refreshUnreadCount() {
      try {
        const result = await apiRequest("/api/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isMounted) {
          setUnreadCount(result.unreadCount);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Could not load the notification count.", error);
        }
      }
    }

    function handleNotificationsUpdated() {
      refreshUnreadCount();
    }

    refreshUnreadCount();
    window.addEventListener("clinexa-notifications-updated", handleNotificationsUpdated);
    const intervalId = window.setInterval(refreshUnreadCount, 60_000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("clinexa-notifications-updated", handleNotificationsUpdated);
    };
  }, [token]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <nav className="navbar container" aria-label="Main navigation">
        <Link className="brand" to="/" onClick={closeMenu} aria-label="Clinexa home">
          <span className="brand-mark" aria-hidden="true">+</span>
          <span>clinexa</span>
        </Link>

        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`nav-content${menuOpen ? " is-open" : ""}`}>
          <div className="nav-links">
            <Link to="/#about" onClick={closeMenu}>About</Link>
            <Link to="/#doctors" onClick={closeMenu}>Find doctors</Link>
            <Link to="/#services" onClick={closeMenu}>Services</Link>
            <Link to="/#ai-features" onClick={closeMenu}>AI features</Link>
            <Link to="/care-tools" onClick={closeMenu}>Care tools</Link>
            <Link to="/#contact" onClick={closeMenu}>Contact</Link>
            {["patient", "doctor", "admin"].includes(user?.role) && (
              <Link to="/dashboard" onClick={closeMenu}>Dashboard</Link>
            )}
            {user?.role === "patient" && (
              <Link to="/appointments" onClick={closeMenu}>My appointments</Link>
            )}
            {["patient", "doctor"].includes(user?.role) && (
              <>
                <Link to="/prescriptions" onClick={closeMenu}>Prescriptions</Link>
              </>
            )}
            {["patient", "doctor", "admin"].includes(user?.role) && (
              <Link
                to="/notifications"
                onClick={closeMenu}
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              >
                Notifications{unreadCount > 0 && (
                  <span className="notification-count" aria-hidden="true">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            )}
          </div>
          <div className="nav-actions">
            {user ? (
              <>
                <span className="welcome-label">Hi, {user.name.split(" ")[0]}</span>
                <button className="button button-outline button-small" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link className="login-link" to="/login" onClick={closeMenu}>Log in</Link>
                <Link className="button button-small" to="/register" onClick={closeMenu}>
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
