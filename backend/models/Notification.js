const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    type: {
      type: String,
      required: true,
      enum: [
        "registration_success",
        "appointment_request",
        "appointment_confirmation",
        "appointment_reminder",
        "appointment_rescheduled",
        "appointment_cancelled",
        "prescription_available",
      ],
    },
    relatedId: { type: String, default: "" },
    dedupeKey: { type: String, default: undefined, unique: true, sparse: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
