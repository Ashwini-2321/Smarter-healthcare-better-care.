const {
  listNotifications,
  markNotificationRead,
} = require("../services/notificationService");

async function getNotifications(req, res) {
  return res.json(await listNotifications(req.auth.userId));
}

async function markRead(req, res) {
  const notification = await markNotificationRead(req.params.id, req.auth.userId);
  if (!notification) {
    return res.status(404).json({ message: "Notification not found." });
  }
  return res.json(notification);
}

module.exports = { getNotifications, markRead };
