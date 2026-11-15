const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    qualifications: {
      type: String,
      default: "",
    },
    experience: {
      type: Number,
      required: true,
      min: 0,
    },
    consultationFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    availability: {
      type: String,
      default: "Available",
      enum: ["Available", "Unavailable"],
    },
    workingDays: {
      type: [{ type: String, enum: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] }],
      default: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    timeSlots: {
      type: [String],
      default: ["09:00", "10:30", "13:00", "15:30"],
      validate: {
        validator: (slots) =>
          slots.every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)),
        message: "Time slots must use 24-hour HH:MM format.",
      },
    },
    clinic: {
      type: String,
      default: "Clinexa Care Center",
    },
    biography: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDemo: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Doctor", doctorSchema);
