const {
  ML_SERVICE_URL,
} = require("../config/env");
const Doctor = require("../models/Doctor");
const { doctors: demoDoctors } = require("../data/doctors");
const { isDatabaseConnected } = require("../config/db");
const { formatDoctor } = require("./doctorController");

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const doctorPreferenceFields = new Set([
  "specialization",
  "availability",
  "preferredTime",
  "maxFee",
  "minExperience",
]);
const attendanceOptions = new Set(["unknown", "attended", "missed"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function forwardToMl(req, res, path, body) {
  const serviceUrl = `${ML_SERVICE_URL.replace(/\/+$/, "")}${path}`;
  let upstream;
  try {
    upstream = await fetch(serviceUrl, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error("Could not reach the Clinexa ML service.", error.message);
    return res.status(503).json({
      message: "The ML service is unavailable. Start it from the ml-service folder and try again.",
    });
  }

  let result;
  try {
    result = await upstream.json();
  } catch (error) {
    console.error("The Clinexa ML service returned an invalid response.", error.message);
    return res.status(502).json({ message: "The ML service returned an invalid response." });
  }
  return res.status(upstream.status).json(result);
}

async function getSymptoms(req, res) {
  return forwardToMl(req, res, "/symptoms");
}

async function recommendSpecialty(req, res) {
  const body = req.body;
  if (!isObject(body) || !Array.isArray(body.symptoms)) {
    return res.status(400).json({ message: "Select symptoms from the provided list." });
  }
  if (body.symptoms.length === 0 || body.symptoms.length > 8) {
    return res.status(400).json({ message: "Select between 1 and 8 symptoms." });
  }
  return forwardToMl(req, res, "/symptom-recommendation", {
    symptoms: body.symptoms,
  });
}

function validateDoctorPreferences(body) {
  if (!isObject(body)) {
    return "Provide doctor preferences as an object.";
  }
  if (Object.keys(body).some((field) => !doctorPreferenceFields.has(field))) {
    return "One or more doctor preference fields are not supported.";
  }
  if (
    body.specialization !== undefined &&
    typeof body.specialization !== "string"
  ) {
    return "Specialization must be text.";
  }
  if (
    body.availability !== undefined &&
    !["Any", "Available", "Unavailable"].includes(body.availability)
  ) {
    return "Choose Any, Available, or Unavailable availability.";
  }
  if (
    body.preferredTime !== undefined &&
    body.preferredTime !== "" &&
    (typeof body.preferredTime !== "string" ||
      !timePattern.test(body.preferredTime))
  ) {
    return "Preferred time must use 24-hour HH:MM format.";
  }
  for (const field of ["maxFee", "minExperience"]) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      (typeof body[field] !== "number" ||
        !Number.isFinite(body[field]) ||
        body[field] < 0)
    ) {
      return `${field} must be a non-negative number.`;
    }
  }
  return null;
}

async function getRecommendationDoctors() {
  const records = isDatabaseConnected()
    ? await Doctor.find({ isActive: { $ne: false } }).lean()
    : demoDoctors.filter((doctor) => doctor.isActive !== false);
  return records.map(formatDoctor);
}

async function recommendDoctors(req, res) {
  const preferences = req.body;
  const validationError = validateDoctorPreferences(preferences);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const doctors = await getRecommendationDoctors();
  return forwardToMl(req, res, "/doctor-recommendation", {
    doctors,
    preferences,
  });
}

function validateNoShowInput(body) {
  if (!isObject(body)) {
    return "Provide appointment details as an object.";
  }
  const allowedFields = new Set([
    "appointmentDate",
    "appointmentTime",
    "bookingLeadDays",
    "reminderSent",
    "previousAttendance",
  ]);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    return "One or more appointment fields are not supported.";
  }

  const date = body.appointmentDate;
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime()) ||
    new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date
  ) {
    return "Appointment date must use a valid YYYY-MM-DD date.";
  }
  if (typeof body.appointmentTime !== "string" || !timePattern.test(body.appointmentTime)) {
    return "Appointment time must use 24-hour HH:MM format.";
  }
  if (
    !Number.isInteger(body.bookingLeadDays) ||
    body.bookingLeadDays < 0 ||
    body.bookingLeadDays > 365
  ) {
    return "Booking lead time must be a whole number from 0 to 365 days.";
  }
  if (typeof body.reminderSent !== "boolean") {
    return "Reminder status must be true or false.";
  }
  if (
    body.previousAttendance !== undefined &&
    !attendanceOptions.has(body.previousAttendance)
  ) {
    return "Previous attendance must be unknown, attended, or missed.";
  }
  return null;
}

async function predictNoShow(req, res) {
  const validationError = validateNoShowInput(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }
  return forwardToMl(req, res, "/no-show-prediction", {
    appointmentDate: req.body.appointmentDate,
    appointmentTime: req.body.appointmentTime,
    bookingLeadDays: req.body.bookingLeadDays,
    reminderSent: req.body.reminderSent,
    previousAttendance: req.body.previousAttendance || "unknown",
  });
}

module.exports = {
  getSymptoms,
  recommendSpecialty,
  recommendDoctors,
  predictNoShow,
};
