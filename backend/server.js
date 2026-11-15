const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const {
  PORT,
  NODE_ENV,
  CORS_ORIGIN,
  JWT_SECRET,
} = require("./config/env");
const { connectDB } = require("./config/db");
const { seedDemoDoctors } = require("./config/seed");
const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const mlRoutes = require("./routes/mlRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const errorMiddleware = require("./middleware/errorMiddleware");
const User = require("./models/User");
const Appointment = require("./models/Appointment");
const Prescription = require("./models/Prescription");
const Notification = require("./models/Notification");
const { sendUpcomingAppointmentReminders } = require("./services/appointmentReminderService");

const app = express();
const allowedOrigins = (CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS policy: this origin is not allowed."));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Clinexa Backend is running!",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use(errorMiddleware);

async function startServer() {
  if (
    NODE_ENV === "production" &&
    (JWT_SECRET === "replace_with_your_generated_secret" || JWT_SECRET.length < 32)
  ) {
    throw new Error("Set a generated JWT_SECRET of at least 32 characters in production.");
  }

  const databaseConnected = await connectDB();

  if (!databaseConnected && NODE_ENV === "production") {
    throw new Error("MongoDB is required to start the backend in production.");
  }

  if (databaseConnected) {
    await Promise.all([
      User.init(),
      Appointment.init(),
      Prescription.init(),
      Notification.init(),
    ]);
    await seedDemoDoctors();
  } else {
    console.warn("Backend is running with temporary in-memory demo data.");
  }

  const reminderInterval = setInterval(() => {
    sendUpcomingAppointmentReminders().catch((error) => {
      console.error("Could not send upcoming appointment reminders:", error.message);
    });
  }, 15 * 60 * 1000);
  reminderInterval.unref();
  sendUpcomingAppointmentReminders().catch((error) => {
    console.error("Could not send upcoming appointment reminders:", error.message);
  });

  const server = app.listen(PORT, () => {
    console.log(`Clinexa Backend running on http://localhost:${PORT}`);
  });
  server.on("close", () => clearInterval(reminderInterval));
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Backend startup failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
