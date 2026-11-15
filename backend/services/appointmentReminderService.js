const Appointment = require("../models/Appointment");
const { appointments } = require("../data/appointments");
const { isDatabaseConnected } = require("../config/db");
const { createNotification } = require("./notificationService");

function localDateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function sendUpcomingAppointmentReminders(now = new Date()) {
  const today = localDateAfter(0);
  const tomorrow = localDateAfter(1);
  const candidates = isDatabaseConnected()
    ? await Appointment.find({
        patientId: { $ne: null },
        status: { $in: ["Pending", "Confirmed"] },
        date: { $gte: today, $lte: tomorrow },
        reminderSent: { $ne: true },
      }).lean()
    : appointments.filter(
        (appointment) =>
          appointment.patientId &&
          ["Pending", "Confirmed"].includes(appointment.status) &&
          appointment.reminderSent !== true &&
          appointment.date >= today &&
          appointment.date <= tomorrow
      );

  const deadline = now.getTime() + 24 * 60 * 60 * 1000;
  for (const appointment of candidates) {
    const appointmentTime = new Date(`${appointment.date}T${appointment.time}:00`);
    if (
      Number.isNaN(appointmentTime.getTime()) ||
      appointmentTime <= now ||
      appointmentTime > deadline
    ) {
      continue;
    }

    await createNotification({
      userId: appointment.patientId,
      type: "appointment_reminder",
      title: "Appointment reminder",
      message: `Your appointment with ${appointment.doctor} is scheduled for ${appointment.date} at ${appointment.time}.`,
      relatedId: appointment._id || appointment.id,
      dedupeKey: `appointment-reminder-${appointment._id || appointment.id}-${appointment.date}-${appointment.time}`,
    });

    if (isDatabaseConnected()) {
      await Appointment.updateOne(
        { _id: appointment._id, reminderSent: { $ne: true } },
        { $set: { reminderSent: true } }
      );
    } else {
      appointment.reminderSent = true;
    }
  }
}

module.exports = { sendUpcomingAppointmentReminders };
