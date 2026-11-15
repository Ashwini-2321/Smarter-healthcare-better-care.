const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { notifications } = require("../data/notifications");
const { isDatabaseConnected } = require("../config/db");

const notificationTypes = new Set([
  "registration_success",
  "appointment_request",
  "appointment_confirmation",
  "appointment_reminder",
  "appointment_rescheduled",
  "appointment_cancelled",
  "prescription_available",
]);

function formatNotification(notification) {
  const createdAt = notification.createdAt || new Date();
  return {
    id: notification._id ? String(notification._id) : notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    relatedId: notification.relatedId || "",
    read: notification.read === true,
    createdAt: new Date(createdAt).toISOString(),
  };
}

async function createNotification({
  userId,
  type,
  title,
  message,
  relatedId = "",
  dedupeKey,
}) {
  if (!userId) {
    throw new Error("A recipient is required to create a notification.");
  }
  if (!notificationTypes.has(type)) {
    throw new Error("The notification type is not supported.");
  }

  const payload = {
    userId,
    type,
    title,
    message,
    relatedId: String(relatedId || ""),
    ...(dedupeKey ? { dedupeKey } : {}),
  };

  if (isDatabaseConnected()) {
    try {
      const notification = await Notification.create(payload);
      return formatNotification(notification);
    } catch (error) {
      if (dedupeKey && error && error.code === 11000) {
        return null;
      }
      throw error;
    }
  }

  if (
    dedupeKey &&
    notifications.some((notification) => notification.dedupeKey === dedupeKey)
  ) {
    return null;
  }

  const notification = {
    id: crypto.randomUUID(),
    ...payload,
    read: false,
    createdAt: new Date(),
  };
  notifications.push(notification);
  return formatNotification(notification);
}

async function listNotifications(userId) {
  let records;
  let unreadCount;
  if (isDatabaseConnected()) {
    [records, unreadCount] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
      Notification.countDocuments({ userId, read: false }),
    ]);
  } else {
    const userNotifications = notifications
      .filter((notification) => String(notification.userId) === String(userId))
      .sort((first, second) => second.createdAt - first.createdAt);
    records = userNotifications.slice(0, 100);
    unreadCount = userNotifications.filter((notification) => !notification.read).length;
  }
  const formatted = records.map(formatNotification);
  return {
    notifications: formatted,
    unreadCount,
  };
}

async function markNotificationRead(id, userId) {
  if (isDatabaseConnected()) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { read: true } },
      { new: true }
    ).lean();
    return notification ? formatNotification(notification) : null;
  }

  const notification = notifications.find(
    (record) =>
      String(record.id) === String(id) &&
      String(record.userId) === String(userId)
  );
  if (!notification) {
    return null;
  }
  notification.read = true;
  return formatNotification(notification);
}

module.exports = {
  createNotification,
  listNotifications,
  markNotificationRead,
};
