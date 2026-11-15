import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useAuth } from "./context/useAuth";
import { apiRequest } from "./services/api";

function NotificationsPage() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    apiRequest("/api/notifications", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((result) => {
        if (isMounted) {
          setNotifications(result.notifications);
          setUnreadCount(result.unreadCount);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message || "Could not load notifications.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function markAsRead(notification) {
    if (notification.read) {
      return;
    }
    setError("");
    try {
      await apiRequest(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item
        )
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      window.dispatchEvent(new Event("clinexa-notifications-updated"));
    } catch (requestError) {
      setError(requestError.message || "Could not update this notification.");
    }
  }

  return (
    <>
      <Navbar />
      <main className="notifications-page">
        <div className="container">
          <header className="prescriptions-page-heading">
            <span className="eyebrow">STAY IN THE LOOP</span>
            <h1>Notifications</h1>
            <p>
              {unreadCount === 1
                ? "1 unread notification"
                : `${unreadCount} unread notifications`}
            </p>
            <Link to="/dashboard">Back to your dashboard</Link>
          </header>

          {error && <p className="form-message form-error" role="alert">{error}</p>}
          {isLoading && <p className="directory-message" role="status">Loading notifications…</p>}
          {!isLoading && notifications.length === 0 && !error && (
            <section className="notifications-empty">
              <h2>You’re all caught up</h2>
              <p>Appointment updates and prescription availability will appear here.</p>
            </section>
          )}
          <div className="notifications-list">
            {notifications.map((notification) => (
              <article
                className={`notification-card${notification.read ? " is-read" : " is-unread"}`}
                key={notification.id}
              >
                <div>
                  <span className="notification-timestamp">
                    {new Date(notification.createdAt).toLocaleString()}
                  </span>
                  <h2>{notification.title}</h2>
                  <p>{notification.message}</p>
                </div>
                {!notification.read && (
                  <button
                    className="button button-outline button-small"
                    onClick={() => markAsRead(notification)}
                  >
                    Mark as read
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

export default NotificationsPage;
