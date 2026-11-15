const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const User = require("../models/User");
const { appointments } = require("../data/appointments");
const { doctors: demoDoctors } = require("../data/doctors");
const { users } = require("../data/users");
const { isDatabaseConnected } = require("../config/db");
const { createNotification } = require("../services/notificationService");

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatAppointment(appointment) {
  const doctorId = appointment.doctorId?._id || appointment.doctorId;

  return {
    id: appointment._id ? String(appointment._id) : appointment.id,
    doctorId: doctorId ? String(doctorId) : null,
    patientName: appointment.patientName,
    doctor: appointment.doctor,
    specialization: appointment.specialization || "General",
    date: appointment.date,
    time: appointment.time,
    status: appointment.status || "Pending",
  };
}

function getAppointmentDateError(date, time, doctor) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    return "Provide a valid appointment date and time.";
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date ||
    date < today
  ) {
    return "Appointment date must be today or a future date.";
  }
  if (
    date === today &&
    time <= `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  ) {
    return "Choose a future time for today's appointment.";
  }

  if (doctor.availability !== "Available") {
    return "This doctor is not currently available for booking.";
  }

  const weekday = weekDays[parsedDate.getUTCDay()];
  if (!Array.isArray(doctor.workingDays) || !doctor.workingDays.includes(weekday)) {
    return "This doctor is not available on the selected day.";
  }

  if (!Array.isArray(doctor.timeSlots) || !doctor.timeSlots.includes(time)) {
    return "Select one of this doctor's available time slots.";
  }

  return null;
}

async function findDoctor({ doctorId, doctorName }) {
  if (isDatabaseConnected()) {
    const filter = { isActive: { $ne: false } };
    if (doctorId && mongoose.Types.ObjectId.isValid(String(doctorId))) {
      filter._id = doctorId;
    } else if (typeof doctorName === "string" && doctorName.trim()) {
      filter.name = doctorName.trim();
    } else {
      return null;
    }

    return Doctor.findOne(filter).lean();
  }

  return demoDoctors.find(
    (doctor) =>
      doctor.isActive !== false &&
      ((doctorId && String(doctor.id) === String(doctorId)) ||
        (typeof doctorName === "string" && doctor.name === doctorName.trim()))
  );
}

async function resolvePatient(req, suppliedName) {
  if (!req.auth) {
    const patientName = typeof suppliedName === "string" ? suppliedName.trim() : "";
    return patientName
      ? { patientId: null, patientName }
      : { error: "Please provide a patient name." };
  }

  if (req.auth.role !== "patient") {
    return { status: 403, error: "Only patient accounts can book appointments." };
  }

  const user = isDatabaseConnected()
    ? await User.findById(req.auth.userId).select("name").lean()
    : users.find((existingUser) => existingUser.id === req.auth.userId);

  if (!user) {
    return { status: 404, error: "Patient account not found." };
  }

  return { patientId: req.auth.userId, patientName: user.name };
}

function hasDoctorAccess(appointment, userId) {
  const doctorId = appointment.doctorId?._id || appointment.doctorId;
  const doctor = demoDoctors.find((record) => String(record.id) === String(doctorId));
  return Boolean(doctor && doctor.userId && String(doctor.userId) === userId);
}

async function getVisibleAppointments(req) {
  if (!isDatabaseConnected()) {
    if (req.auth.role === "admin") {
      return appointments;
    }
    if (req.auth.role === "patient") {
      return appointments.filter(
        (appointment) => String(appointment.patientId) === req.auth.userId
      );
    }
    return appointments.filter((appointment) =>
      hasDoctorAccess(appointment, req.auth.userId)
    );
  }

  let filter = {};
  if (req.auth.role === "patient") {
    filter.patientId = req.auth.userId;
  } else if (req.auth.role === "doctor") {
    const doctors = await Doctor.find({ userId: req.auth.userId }).select("_id").lean();
    filter.doctorId = { $in: doctors.map((doctor) => doctor._id) };
  }

  return Appointment.find(filter).sort({ date: 1, time: 1 }).lean();
}

async function getAppointments(req, res) {
  const records = await getVisibleAppointments(req);
  return res.json(records.map(formatAppointment));
}

async function findAppointmentById(id) {
  if (isDatabaseConnected()) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return Appointment.findById(id).lean();
  }

  return appointments.find((appointment) => String(appointment.id) === id) || null;
}

async function canAccessAppointment(appointment, req) {
  if (req.auth.role === "admin") {
    return true;
  }
  if (req.auth.role === "patient") {
    return String(appointment.patientId) === req.auth.userId;
  }

  if (isDatabaseConnected()) {
    const doctorId = appointment.doctorId?._id || appointment.doctorId;
    if (!doctorId) {
      return false;
    }
    return Boolean(
      await Doctor.exists({ _id: doctorId, userId: req.auth.userId })
    );
  }

  return hasDoctorAccess(appointment, req.auth.userId);
}

async function getAppointment(req, res) {
  const appointment = await findAppointmentById(req.params.id);
  if (!appointment || !(await canAccessAppointment(appointment, req))) {
    return res.status(404).json({ message: "Appointment not found." });
  }

  return res.json(formatAppointment(appointment));
}

function hasTimeConflict(doctor, date, time, ignoredId) {
  return appointments.some(
    (appointment) =>
      String(appointment.id) !== String(ignoredId) &&
      appointment.status !== "Cancelled" &&
      String(appointment.doctorId) === String(doctor.id) &&
      appointment.date === date &&
      appointment.time === time
  );
}

function isDuplicateSlotError(error) {
  return error && error.code === 11000;
}

async function createAppointment(req, res) {
  const { patientName: suppliedPatientName, doctor: doctorName, doctorId, date, time } =
    req.body || {};
  if ((!doctorName && !doctorId) || !date || !time) {
    return res.status(400).json({
      message: "Please provide all appointment details.",
    });
  }

  const patient = await resolvePatient(req, suppliedPatientName);
  if (patient.error) {
    return res.status(patient.status || 400).json({ message: patient.error });
  }

  const doctor = await findDoctor({ doctorId, doctorName });
  if (!doctor) {
    return res.status(404).json({ message: "Choose an available doctor." });
  }

  const dateError = getAppointmentDateError(date, time, doctor);
  if (dateError) {
    return res.status(400).json({ message: dateError });
  }

  const databaseConnected = isDatabaseConnected();
  let appointment;

  if (databaseConnected) {
    const resolvedDoctorId = String(doctor._id);
    const existingAppointment = await Appointment.findOne({
      $or: [{ doctorId: doctor._id }, { doctor: doctor.name }],
      date,
      time,
      status: { $ne: "Cancelled" },
    }).select("_id");
    if (existingAppointment) {
      return res.status(409).json({ message: "That appointment time is already booked." });
    }

    try {
      appointment = await Appointment.create({
        patientId: patient.patientId,
        doctorId: doctor._id,
        patientName: patient.patientName,
        doctor: doctor.name,
        specialization: doctor.specialization,
        date,
        time,
        slotKey: `${resolvedDoctorId}:${date}:${time}`,
      });
    } catch (error) {
      if (isDuplicateSlotError(error)) {
        return res.status(409).json({ message: "That appointment time is already booked." });
      }
      throw error;
    }
  } else {
    if (hasTimeConflict(doctor, date, time)) {
      return res.status(409).json({ message: "That appointment time is already booked." });
    }

    appointment = {
      id: appointments.length + 1,
      patientId: patient.patientId,
      doctorId: doctor.id,
      patientName: patient.patientName,
      doctor: doctor.name,
      specialization: doctor.specialization,
      date,
      time,
      status: "Pending",
      reminderSent: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    appointments.push(appointment);
  }

  if (appointment.patientId) {
    await createNotification({
      userId: appointment.patientId,
      type: "appointment_request",
      title: "Appointment request received",
      message: `Your appointment request with ${appointment.doctor} for ${appointment.date} at ${appointment.time} is pending confirmation.`,
      relatedId: appointment._id || appointment.id,
    });
  }

  return res.status(201).json({
    message: "Appointment booked successfully!",
    appointment: formatAppointment(appointment),
  });
}

async function getAppointmentDoctor(appointment) {
  const doctorId = appointment.doctorId?._id || appointment.doctorId;
  if (isDatabaseConnected()) {
    if (doctorId && mongoose.Types.ObjectId.isValid(String(doctorId))) {
      return Doctor.findOne({ _id: doctorId, isActive: { $ne: false } }).lean();
    }
    return Doctor.findOne({ name: appointment.doctor, isActive: { $ne: false } }).lean();
  }

  return (
    demoDoctors.find(
      (doctor) =>
        doctor.isActive !== false &&
        ((doctorId && String(doctor.id) === String(doctorId)) ||
          doctor.name === appointment.doctor)
    ) || null
  );
}

async function rescheduleAppointment(req, res) {
  const appointment = await findAppointmentById(req.params.id);
  if (!appointment || !(await canAccessAppointment(appointment, req))) {
    return res.status(404).json({ message: "Appointment not found." });
  }
  if (["Cancelled", "Completed"].includes(appointment.status)) {
    return res.status(409).json({ message: "This appointment can no longer be rescheduled." });
  }

  const { date, time } = req.body || {};
  const doctor = await getAppointmentDoctor(appointment);
  if (!doctor) {
    return res.status(404).json({ message: "The doctor is no longer available." });
  }

  const dateError = getAppointmentDateError(date, time, doctor);
  if (dateError) {
    return res.status(400).json({ message: dateError });
  }

  const databaseConnected = isDatabaseConnected();
  if (databaseConnected) {
    const doctorId = String(doctor._id);
    const conflictingAppointment = await Appointment.findOne({
      _id: { $ne: appointment._id },
      $or: [{ doctorId: doctor._id }, { doctor: doctor.name }],
      date,
      time,
      status: { $ne: "Cancelled" },
    }).select("_id");
    if (conflictingAppointment) {
      return res.status(409).json({ message: "That appointment time is already booked." });
    }

    try {
      const updatedAppointment = await Appointment.findOneAndUpdate(
        { _id: appointment._id, status: { $in: ["Pending", "Confirmed"] } },
        {
          $set: {
            date,
            time,
            slotKey: `${doctorId}:${date}:${time}`,
            reminderSent: false,
          },
        },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedAppointment) {
        return res.status(409).json({ message: "This appointment can no longer be rescheduled." });
      }
      if (appointment.patientId) {
        await createNotification({
          userId: appointment.patientId,
          type: "appointment_rescheduled",
          title: "Appointment rescheduled",
          message: `Your appointment with ${appointment.doctor} is now scheduled for ${date} at ${time}.`,
          relatedId: appointment._id || appointment.id,
        });
      }
      return res.json(formatAppointment(updatedAppointment));
    } catch (error) {
      if (isDuplicateSlotError(error)) {
        return res.status(409).json({ message: "That appointment time is already booked." });
      }
      throw error;
    }
  }

  if (hasTimeConflict(doctor, date, time, appointment.id)) {
    return res.status(409).json({ message: "That appointment time is already booked." });
  }
  appointment.date = date;
  appointment.time = time;
  appointment.reminderSent = false;
  if (appointment.patientId) {
    await createNotification({
      userId: appointment.patientId,
      type: "appointment_rescheduled",
      title: "Appointment rescheduled",
      message: `Your appointment with ${appointment.doctor} is now scheduled for ${date} at ${time}.`,
      relatedId: appointment.id,
    });
  }
  return res.json(formatAppointment(appointment));
}

async function cancelAppointment(req, res) {
  const appointment = await findAppointmentById(req.params.id);
  if (!appointment || !(await canAccessAppointment(appointment, req))) {
    return res.status(404).json({ message: "Appointment not found." });
  }
  if (["Cancelled", "Completed"].includes(appointment.status)) {
    return res.status(409).json({ message: "This appointment can no longer be cancelled." });
  }

  if (isDatabaseConnected()) {
    const updatedAppointment = await Appointment.findOneAndUpdate(
      { _id: appointment._id, status: { $in: ["Pending", "Confirmed"] } },
      { $set: { status: "Cancelled" }, $unset: { slotKey: 1 } },
      { new: true }
    ).lean();

    if (!updatedAppointment) {
      return res.status(409).json({ message: "This appointment can no longer be cancelled." });
    }
    if (appointment.patientId) {
      await createNotification({
        userId: appointment.patientId,
        type: "appointment_cancelled",
        title: "Appointment cancelled",
        message: `Your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} was cancelled.`,
        relatedId: appointment._id || appointment.id,
      });
    }
    return res.json(formatAppointment(updatedAppointment));
  }

  appointment.status = "Cancelled";
  if (appointment.patientId) {
    await createNotification({
      userId: appointment.patientId,
      type: "appointment_cancelled",
      title: "Appointment cancelled",
      message: `Your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} was cancelled.`,
      relatedId: appointment.id,
    });
  }
  return res.json(formatAppointment(appointment));
}

async function updateAppointmentStatus(req, res) {
  const appointment = await findAppointmentById(req.params.id);
  if (!appointment || !(await canAccessAppointment(appointment, req))) {
    return res.status(404).json({ message: "Appointment not found." });
  }

  const nextStatus = req.body?.status;
  const expectedStatus = nextStatus === "Confirmed" ? "Pending" : "Confirmed";
  if (!["Confirmed", "Completed"].includes(nextStatus)) {
    return res.status(400).json({ message: "Choose Confirmed or Completed status." });
  }
  if (appointment.status !== expectedStatus) {
    return res.status(409).json({
      message: `Only a ${expectedStatus.toLowerCase()} appointment can be changed to ${nextStatus.toLowerCase()}.`,
    });
  }

  let updatedAppointment;
  if (isDatabaseConnected()) {
    updatedAppointment = await Appointment.findOneAndUpdate(
      { _id: appointment._id, status: expectedStatus },
      { $set: { status: nextStatus } },
      { new: true, runValidators: true }
    ).lean();
    if (!updatedAppointment) {
      return res.status(409).json({ message: "This appointment status has already changed." });
    }
  } else {
    appointment.status = nextStatus;
    updatedAppointment = appointment;
  }

  if (nextStatus === "Confirmed" && appointment.patientId) {
    await createNotification({
      userId: appointment.patientId,
      type: "appointment_confirmation",
      title: "Appointment confirmed",
      message: `Your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} is confirmed.`,
      relatedId: appointment._id || appointment.id,
    });
  }
  return res.json(formatAppointment(updatedAppointment));
}

module.exports = {
  getAppointments,
  getAppointment,
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  updateAppointmentStatus,
  formatAppointment,
};
