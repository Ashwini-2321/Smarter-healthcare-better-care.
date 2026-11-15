const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const Prescription = require("../models/Prescription");
const { appointments } = require("../data/appointments");
const { prescriptions } = require("../data/prescriptions");
const { doctors } = require("../data/doctors");
const { isDatabaseConnected } = require("../config/db");
const { createNotification } = require("../services/notificationService");

const editableFields = new Set(["notes", "medicines", "instructions", "followUp"]);
const medicineFields = new Set(["name", "dosage", "instructions"]);

function formatPrescription(prescription) {
  return {
    id: prescription._id ? String(prescription._id) : prescription.id,
    prescriptionId: prescription.prescriptionId,
    patientName: prescription.patientName,
    doctorName: prescription.doctorName,
    appointmentId: String(prescription.appointmentId),
    appointmentReference: prescription.appointmentReference || "",
    appointmentDate: prescription.appointmentDate,
    date: new Date(prescription.date).toISOString(),
    notes: prescription.notes || "",
    medicines: prescription.medicines || [],
    instructions: prescription.instructions || "",
    followUp: prescription.followUp || "",
  };
}

function parsePrescriptionFields(body, { creating = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide prescription details as an object." };
  }
  if (Object.keys(body).some((field) => !editableFields.has(field) && field !== "appointmentId")) {
    return { error: "One or more prescription fields are not supported." };
  }
  if (!creating && body.appointmentId !== undefined) {
    return { error: "An existing prescription cannot be moved to another appointment." };
  }

  const updates = {};
  for (const field of editableFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (creating && (typeof body.appointmentId !== "string" || !body.appointmentId.trim())) {
    return { error: "Choose an appointment for this prescription." };
  }
  if (!creating && Object.keys(updates).length === 0) {
    return { error: "Provide at least one prescription field to update." };
  }

  for (const field of ["notes", "instructions", "followUp"]) {
    const limits = { notes: 2000, instructions: 2000, followUp: 500 };
    if (
      updates[field] !== undefined &&
      (typeof updates[field] !== "string" || updates[field].trim().length > limits[field])
    ) {
      return { error: `${field} must be text no longer than ${limits[field]} characters.` };
    }
    if (typeof updates[field] === "string") {
      updates[field] = updates[field].trim();
    }
  }

  if (updates.medicines !== undefined) {
    if (
      !Array.isArray(updates.medicines) ||
      updates.medicines.length > 20 ||
      updates.medicines.some(
        (medicine) =>
          !medicine ||
          typeof medicine !== "object" ||
          Array.isArray(medicine) ||
          Object.keys(medicine).some((field) => !medicineFields.has(field)) ||
          typeof medicine.name !== "string" ||
          !medicine.name.trim() ||
          medicine.name.trim().length > 120 ||
          typeof medicine.dosage !== "string" ||
          !medicine.dosage.trim() ||
          medicine.dosage.trim().length > 120 ||
          (medicine.instructions !== undefined &&
            (typeof medicine.instructions !== "string" ||
              medicine.instructions.trim().length > 500))
      )
    ) {
      return {
        error: "Medicines must include a name and dosage, with instructions up to 500 characters.",
      };
    }
    updates.medicines = updates.medicines.map((medicine) => ({
      name: medicine.name.trim(),
      dosage: medicine.dosage.trim(),
      instructions: (medicine.instructions || "").trim(),
    }));
  }

  return { updates };
}

async function getLinkedDoctor(userId) {
  if (isDatabaseConnected()) {
    return Doctor.findOne({ userId }).lean();
  }
  return doctors.find((doctor) => String(doctor.userId) === String(userId)) || null;
}

async function getAppointment(id) {
  if (isDatabaseConnected()) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return Appointment.findById(id).lean();
  }
  return appointments.find((appointment) => String(appointment.id) === id) || null;
}

function doctorOwnsAppointment(doctor, appointment) {
  const appointmentDoctorId = appointment.doctorId?._id || appointment.doctorId;
  return (
    String(appointmentDoctorId || "") === String(doctor._id || doctor.id) ||
    (appointment.doctor === doctor.name && !appointmentDoctorId)
  );
}

async function canReadPrescription(prescription, userId, role) {
  if (role === "patient") {
    return String(prescription.patientId) === String(userId);
  }
  if (role === "doctor") {
    const doctor = await getLinkedDoctor(userId);
    return Boolean(
      doctor && String(prescription.doctorId) === String(doctor._id || doctor.id)
    );
  }
  return false;
}

async function listPrescriptions(req, res) {
  let records;
  if (isDatabaseConnected()) {
    const filter =
      req.auth.role === "patient"
        ? { patientId: req.auth.userId }
        : { doctorId: (await getLinkedDoctor(req.auth.userId))?._id };
    if (req.auth.role === "doctor" && !filter.doctorId) {
      return res.status(404).json({ message: "No doctor profile is linked to this account." });
    }
    records = await Prescription.find(filter).sort({ date: -1 }).lean();
  } else {
    const doctor = req.auth.role === "doctor"
      ? await getLinkedDoctor(req.auth.userId)
      : null;
    if (req.auth.role === "doctor" && !doctor) {
      return res.status(404).json({ message: "No doctor profile is linked to this account." });
    }
    records = prescriptions.filter((prescription) =>
      req.auth.role === "patient"
        ? String(prescription.patientId) === String(req.auth.userId)
        : String(prescription.doctorId) === String(doctor.id)
    );
    records.sort((first, second) => second.date - first.date);
  }
  return res.json(records.map(formatPrescription));
}

async function getPrescriptionById(id) {
  if (isDatabaseConnected()) {
    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { prescriptionId: id };
    return Prescription.findOne(filter).lean();
  }
  return prescriptions.find(
    (prescription) =>
      String(prescription.id) === id || prescription.prescriptionId === id
  ) || null;
}

async function getPrescription(req, res) {
  const prescription = await getPrescriptionById(req.params.id);
  if (
    !prescription ||
    !(await canReadPrescription(prescription, req.auth.userId, req.auth.role))
  ) {
    return res.status(404).json({ message: "Prescription not found." });
  }
  return res.json(formatPrescription(prescription));
}

async function createPrescription(req, res) {
  if (req.auth.role !== "doctor") {
    return res.status(403).json({ message: "Only an authorized doctor can create prescriptions." });
  }
  const parsed = parsePrescriptionFields(req.body, { creating: true });
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }
  const doctor = await getLinkedDoctor(req.auth.userId);
  if (!doctor) {
    return res.status(404).json({ message: "No doctor profile is linked to this account." });
  }
  const appointment = await getAppointment(req.body.appointmentId);
  if (!appointment || !doctorOwnsAppointment(doctor, appointment)) {
    return res.status(404).json({ message: "Appointment not found for this doctor." });
  }
  if (!appointment.patientId) {
    return res.status(400).json({
      message: "Prescriptions require an appointment linked to a registered patient account.",
    });
  }
  if (
    !parsed.updates.notes &&
    !parsed.updates.instructions &&
    !(parsed.updates.medicines || []).length
  ) {
    return res.status(400).json({
      message: "Enter clinician notes, instructions, or at least one medicine.",
    });
  }

  const now = new Date();
  const record = {
    prescriptionId: `RX-${crypto.randomUUID().toUpperCase()}`,
    patientId: appointment.patientId,
    doctorId: doctor._id || doctor.id,
    appointmentId: appointment._id || appointment.id,
    patientName: appointment.patientName,
    doctorName: appointment.doctor,
    appointmentReference: String(appointment._id || appointment.id),
    appointmentDate: appointment.date,
    date: now,
    notes: "",
    medicines: [],
    instructions: "",
    followUp: "",
    ...parsed.updates,
  };

  let prescription;
  if (isDatabaseConnected()) {
    try {
      prescription = await Prescription.create(record);
    } catch (error) {
      if (error && error.code === 11000) {
        return res.status(409).json({
          message: "A prescription already exists for this appointment.",
        });
      }
      throw error;
    }
  } else {
    if (
      prescriptions.some(
        (existing) => String(existing.appointmentId) === String(record.appointmentId)
      )
    ) {
      return res.status(409).json({
        message: "A prescription already exists for this appointment.",
      });
    }
    prescription = { id: crypto.randomUUID(), ...record };
    prescriptions.push(prescription);
  }

  await createNotification({
    userId: appointment.patientId,
    type: "prescription_available",
    title: "A prescription is available",
    message: `A clinician-entered prescription is ready for your appointment on ${appointment.date}.`,
    relatedId: prescription.prescriptionId,
  });
  return res.status(201).json(formatPrescription(prescription));
}

async function updatePrescription(req, res) {
  if (req.auth.role !== "doctor") {
    return res.status(403).json({ message: "Only the prescribing doctor can update prescriptions." });
  }
  const parsed = parsePrescriptionFields(req.body);
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }
  const prescription = await getPrescriptionById(req.params.id);
  if (
    !prescription ||
    !(await canReadPrescription(prescription, req.auth.userId, req.auth.role))
  ) {
    return res.status(404).json({ message: "Prescription not found." });
  }

  let updated;
  if (isDatabaseConnected()) {
    updated = await Prescription.findByIdAndUpdate(
      prescription._id,
      { $set: parsed.updates },
      { new: true, runValidators: true }
    ).lean();
  } else {
    Object.assign(prescription, parsed.updates);
    updated = prescription;
  }
  return res.json(formatPrescription(updated));
}

module.exports = {
  listPrescriptions,
  getPrescription,
  createPrescription,
  updatePrescription,
};
