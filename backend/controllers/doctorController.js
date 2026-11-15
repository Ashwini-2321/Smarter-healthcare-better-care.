const mongoose = require("mongoose");
const Doctor = require("../models/Doctor");
const User = require("../models/User");
const { doctors: demoDoctors } = require("../data/doctors");
const { users } = require("../data/users");
const { isDatabaseConnected } = require("../config/db");

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const allowedWeekDays = new Set(weekDays);
const allowedDoctorFields = [
  "name",
  "specialization",
  "qualifications",
  "experience",
  "consultationFee",
  "availability",
  "workingDays",
  "timeSlots",
  "clinic",
  "biography",
  "image",
  "isActive",
  "userId",
];

function formatDoctor(doctor) {
  const experienceYears =
    typeof doctor.experience === "number"
      ? doctor.experience
      : Number.parseInt(doctor.experience, 10) || 0;

  return {
    id: doctor._id ? String(doctor._id) : doctor.id,
    name: doctor.name,
    specialization: doctor.specialization,
    experience: `${experienceYears} Years Experience`,
    experienceYears,
    qualifications: doctor.qualifications || "",
    consultationFee: doctor.consultationFee > 0 ? doctor.consultationFee : null,
    availability: doctor.availability || "Available",
    workingDays: doctor.workingDays || [],
    timeSlots: doctor.timeSlots || [],
    clinic: doctor.clinic || "",
    biography: doctor.biography || "",
    image: doctor.image || "",
    isActive: doctor.isActive !== false,
    isDemo: doctor.isDemo === true,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function filterAndSortDemoDoctors(query) {
  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const specialization =
    typeof query.specialization === "string"
      ? query.specialization.trim().toLowerCase()
      : "";
  const availability =
    typeof query.availability === "string"
      ? query.availability.trim().toLowerCase()
      : "";

  const filtered = demoDoctors.filter((doctor) => {
    const matchesSearch =
      !search ||
      doctor.name.toLowerCase().includes(search) ||
      doctor.specialization.toLowerCase().includes(search);
    const matchesSpecialization =
      !specialization || doctor.specialization.toLowerCase() === specialization;
    const matchesAvailability =
      !availability || doctor.availability.toLowerCase() === availability;

    return doctor.isActive !== false && matchesSearch && matchesSpecialization && matchesAvailability;
  });

  if (query.sort === "experience") {
    filtered.sort((first, second) => second.experience - first.experience);
  } else if (query.sort === "name") {
    filtered.sort((first, second) => first.name.localeCompare(second.name));
  }

  return filtered;
}

async function getDoctors(req, res) {
  if (!isDatabaseConnected()) {
    return res.json(filterAndSortDemoDoctors(req.query).map(formatDoctor));
  }

  const filter = { isActive: { $ne: false } };
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const specialization =
    typeof req.query.specialization === "string" ? req.query.specialization.trim() : "";
  const availability =
    typeof req.query.availability === "string" ? req.query.availability.trim() : "";

  if (search) {
    const safeSearch = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: safeSearch }, { specialization: safeSearch }];
  }
  if (specialization) {
    filter.specialization = new RegExp(`^${escapeRegex(specialization)}$`, "i");
  }
  if (availability) {
    filter.availability = new RegExp(`^${escapeRegex(availability)}$`, "i");
  }

  const sort =
    req.query.sort === "experience"
      ? { experience: -1 }
      : req.query.sort === "name"
        ? { name: 1 }
        : { createdAt: 1 };
  const records = await Doctor.find(filter).sort(sort).lean();
  return res.json(records.map(formatDoctor));
}

async function getDoctor(req, res) {
  let doctor;

  if (isDatabaseConnected()) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Doctor not found." });
    }
    doctor = await Doctor.findOne({
      _id: req.params.id,
      isActive: { $ne: false },
    }).lean();
  } else {
    doctor = demoDoctors.find(
      (record) => String(record.id) === req.params.id && record.isActive !== false
    );
  }

  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found." });
  }

  return res.json(formatDoctor(doctor));
}

function parseDoctorInput(body, partial = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide doctor details as an object." };
  }

  const updates = {};
  for (const field of allowedDoctorFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (partial && Object.keys(updates).length === 0) {
    return { error: "Provide at least one doctor field to update." };
  }

  if (!partial || updates.name !== undefined) {
    if (typeof updates.name !== "string" || !updates.name.trim()) {
      return { error: "Doctor name is required." };
    }
    updates.name = updates.name.trim();
  }

  if (!partial || updates.specialization !== undefined) {
    if (typeof updates.specialization !== "string" || !updates.specialization.trim()) {
      return { error: "Doctor specialization is required." };
    }
    updates.specialization = updates.specialization.trim();
  }

  if (!partial || updates.experience !== undefined) {
    if (
      typeof updates.experience !== "number" ||
      !Number.isFinite(updates.experience) ||
      updates.experience < 0
    ) {
      return { error: "Doctor experience must be a non-negative number." };
    }
  }

  if (
    updates.consultationFee !== undefined &&
    (typeof updates.consultationFee !== "number" ||
      !Number.isFinite(updates.consultationFee) ||
      updates.consultationFee < 0)
  ) {
    return { error: "Consultation fee must be a non-negative number." };
  }

  if (
    updates.availability !== undefined &&
    !["Available", "Unavailable"].includes(updates.availability)
  ) {
    return { error: "Availability must be Available or Unavailable." };
  }

  if (
    updates.workingDays !== undefined &&
    (!Array.isArray(updates.workingDays) ||
      updates.workingDays.some((day) => !allowedWeekDays.has(day)))
  ) {
    return { error: "Working days must contain valid weekday abbreviations." };
  }

  if (
    updates.timeSlots !== undefined &&
    (!Array.isArray(updates.timeSlots) ||
      updates.timeSlots.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))
  ) {
    return { error: "Time slots must use 24-hour HH:MM format." };
  }

  for (const field of ["qualifications", "clinic", "biography", "image"]) {
    if (updates[field] !== undefined && typeof updates[field] !== "string") {
      return { error: `${field} must be text.` };
    }
    if (typeof updates[field] === "string") {
      updates[field] = updates[field].trim();
    }
  }

  if (updates.isActive !== undefined && typeof updates.isActive !== "boolean") {
    return { error: "isActive must be a boolean." };
  }

  if (
    updates.userId !== undefined &&
    updates.userId !== null &&
    typeof updates.userId !== "string"
  ) {
    return { error: "userId must be a doctor account ID or null." };
  }

  return { updates };
}

async function validateDoctorUserId(userId, currentDoctorId) {
  if (userId === null || userId === "") {
    return { userId: null };
  }

  if (isDatabaseConnected()) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { error: "userId must reference an existing doctor account." };
    }

    const user = await User.findOne({ _id: userId, role: "doctor" }).select("_id").lean();
    if (!user) {
      return { error: "userId must reference an existing doctor account." };
    }

    const assignedDoctor = await Doctor.exists({
      userId: user._id,
      ...(currentDoctorId ? { _id: { $ne: currentDoctorId } } : {}),
    });
    if (assignedDoctor) {
      return { error: "This doctor account is already linked to another profile." };
    }
    return { userId: user._id };
  }

  const user = users.find(
    (record) => record.id === userId && record.role === "doctor"
  );
  if (!user) {
    return { error: "userId must reference an existing doctor account." };
  }

  const assignedDoctor = demoDoctors.find(
    (record) =>
      String(record.userId) === String(user.id) &&
      String(record.id) !== String(currentDoctorId)
  );
  if (assignedDoctor) {
    return { error: "This doctor account is already linked to another profile." };
  }
  return { userId: user.id };
}

async function createDoctor(req, res) {
  const parsed = parseDoctorInput(req.body);
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }

  if (parsed.updates.userId !== undefined) {
    const link = await validateDoctorUserId(parsed.updates.userId);
    if (link.error) {
      return res.status(400).json({ message: link.error });
    }
    parsed.updates.userId = link.userId;
  }

  const databaseConnected = isDatabaseConnected();
  const doctor = databaseConnected
    ? await Doctor.create({ ...parsed.updates, isDemo: false })
    : {
        id: Math.max(0, ...demoDoctors.map((record) => Number(record.id) || 0)) + 1,
        ...parsed.updates,
        availability: parsed.updates.availability || "Available",
        workingDays: parsed.updates.workingDays || ["Mon", "Tue", "Wed", "Thu", "Fri"],
        timeSlots: parsed.updates.timeSlots || ["09:00", "10:30", "13:00", "15:30"],
        clinic: parsed.updates.clinic || "Clinexa Care Center",
        qualifications: parsed.updates.qualifications || "",
        biography: parsed.updates.biography || "",
        image: parsed.updates.image || "",
        isActive: true,
        isDemo: false,
      };

  if (!databaseConnected) {
    demoDoctors.push(doctor);
  }

  return res.status(201).json(formatDoctor(doctor));
}

async function updateDoctor(req, res) {
  const parsed = parseDoctorInput(req.body, true);
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }

  if (parsed.updates.userId !== undefined) {
    const link = await validateDoctorUserId(parsed.updates.userId, req.params.id);
    if (link.error) {
      return res.status(400).json({ message: link.error });
    }
    parsed.updates.userId = link.userId;
  }

  let doctor;
  if (isDatabaseConnected()) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Doctor not found." });
    }
    doctor = await Doctor.findOneAndUpdate(
      {
        _id: req.params.id,
        ...(parsed.updates.isActive === true ? {} : { isActive: { $ne: false } }),
      },
      parsed.updates,
      { new: true, runValidators: true }
    ).lean();
  } else {
    doctor = demoDoctors.find(
      (record) =>
        String(record.id) === req.params.id &&
        (parsed.updates.isActive === true || record.isActive !== false)
    );
    if (doctor) {
      Object.assign(doctor, parsed.updates);
    }
  }

  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found." });
  }

  return res.json(formatDoctor(doctor));
}

async function deactivateDoctor(req, res) {
  let doctor;
  if (isDatabaseConnected()) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Doctor not found." });
    }
    doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { isActive: false, availability: "Unavailable" },
      { new: true }
    ).lean();
  } else {
    doctor = demoDoctors.find((record) => String(record.id) === req.params.id);
    if (doctor) {
      doctor.isActive = false;
      doctor.availability = "Unavailable";
    }
  }

  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found." });
  }

  return res.json({ message: "Doctor deactivated.", doctor: formatDoctor(doctor) });
}

module.exports = {
  getDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deactivateDoctor,
  formatDoctor,
  parseDoctorInput,
};
