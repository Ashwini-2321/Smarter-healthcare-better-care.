const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const User = require("../models/User");
const { appointments } = require("../data/appointments");
const { doctors: demoDoctors } = require("../data/doctors");
const { users } = require("../data/users");
const { isDatabaseConnected } = require("../config/db");
const { formatDoctor, parseDoctorInput } = require("./doctorController");
const { formatAppointment } = require("./appointmentController");

const activeStatuses = ["Pending", "Confirmed"];
const doctorProfileFields = new Set([
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
]);
const appointmentStatuses = ["Pending", "Confirmed", "Completed", "Cancelled"];

function getLocalDateTimeKey() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return `${date}T${time}`;
}

function isUpcoming(appointment, nowKey) {
  return (
    activeStatuses.includes(appointment.status) &&
    `${appointment.date}T${appointment.time}` >= nowKey
  );
}

function sortAppointments(records, direction = 1) {
  return records.sort((first, second) => {
    const firstKey = `${first.date}T${first.time}`;
    const secondKey = `${second.date}T${second.time}`;
    return firstKey.localeCompare(secondKey) * direction;
  });
}

async function getPatientAppointments(userId) {
  if (isDatabaseConnected()) {
    return Appointment.find({ patientId: userId }).sort({ date: 1, time: 1 }).lean();
  }

  return appointments.filter(
    (appointment) => String(appointment.patientId) === String(userId)
  );
}

async function getPatientDashboard(req, res) {
  const records = await getPatientAppointments(req.auth.userId);
  const nowKey = getLocalDateTimeKey();
  const upcomingAppointments = sortAppointments(
    records.filter((appointment) => isUpcoming(appointment, nowKey))
  );

  return res.json({
    summary: {
      total: records.length,
      upcoming: upcomingAppointments.length,
      completed: records.filter((appointment) => appointment.status === "Completed").length,
      cancelled: records.filter((appointment) => appointment.status === "Cancelled").length,
    },
    upcomingAppointments: upcomingAppointments.slice(0, 5).map(formatAppointment),
  });
}

async function findDoctorForUser(userId) {
  if (isDatabaseConnected()) {
    return Doctor.findOne({ userId, isActive: { $ne: false } }).lean();
  }

  return demoDoctors.find(
    (doctor) =>
      doctor.isActive !== false &&
      doctor.userId &&
      String(doctor.userId) === String(userId)
  ) || null;
}

async function getDoctorAppointments(doctor) {
  if (isDatabaseConnected()) {
    return Appointment.find({ doctorId: doctor._id }).lean();
  }

  return appointments.filter(
    (appointment) => String(appointment.doctorId) === String(doctor.id)
  );
}

async function getDoctorDashboard(req, res) {
  const doctor = await findDoctorForUser(req.auth.userId);
  if (!doctor) {
    return res.status(404).json({
      message: "No doctor profile is linked to this account. Contact an administrator.",
    });
  }

  const records = await getDoctorAppointments(doctor);
  const nowKey = getLocalDateTimeKey();
  const todayKey = nowKey.slice(0, 10);
  const todayAppointments = sortAppointments(
    records.filter(
      (appointment) =>
        appointment.date === todayKey && appointment.status !== "Cancelled"
    )
  );
  const upcomingAppointments = sortAppointments(
    records.filter(
      (appointment) =>
        appointment.date > todayKey && activeStatuses.includes(appointment.status)
    )
  );
  const appointmentHistory = sortAppointments(
    records.filter(
      (appointment) =>
        ["Cancelled", "Completed"].includes(appointment.status) ||
        `${appointment.date}T${appointment.time}` < nowKey
    ),
    -1
  );

  return res.json({
    doctor: formatDoctor(doctor),
    summary: {
      today: todayAppointments.length,
      upcoming: upcomingAppointments.length,
      completed: records.filter((appointment) => appointment.status === "Completed").length,
      total: records.length,
    },
    todayAppointments: todayAppointments.map(formatAppointment),
    upcomingAppointments: upcomingAppointments.slice(0, 10).map(formatAppointment),
    appointmentHistory: appointmentHistory.slice(0, 10).map(formatAppointment),
  });
}

async function updateDoctorProfile(req, res) {
  const body = req.body || {};
  const unsupportedField = Object.keys(body).find(
    (field) => !doctorProfileFields.has(field)
  );
  if (unsupportedField) {
    return res.status(400).json({ message: `${unsupportedField} cannot be changed here.` });
  }

  const parsed = parseDoctorInput(body, true);
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }

  const doctor = await findDoctorForUser(req.auth.userId);
  if (!doctor) {
    return res.status(404).json({
      message: "No doctor profile is linked to this account. Contact an administrator.",
    });
  }

  let updatedDoctor;
  if (isDatabaseConnected()) {
    if (!mongoose.Types.ObjectId.isValid(String(doctor._id))) {
      return res.status(404).json({ message: "Doctor profile not found." });
    }
    updatedDoctor = await Doctor.findOneAndUpdate(
      { _id: doctor._id, userId: req.auth.userId },
      parsed.updates,
      { new: true, runValidators: true }
    ).lean();
  } else {
    updatedDoctor = demoDoctors.find(
      (record) => String(record.id) === String(doctor.id)
    );
    if (updatedDoctor) {
      Object.assign(updatedDoctor, parsed.updates);
    }
  }

  if (!updatedDoctor) {
    return res.status(404).json({ message: "Doctor profile not found." });
  }

  return res.json(formatDoctor(updatedDoctor));
}

function getMonthRange(now) {
  const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const months = [];
  for (let month = 0; month < 6; month += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + month, 1));
    months.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return { firstMonth, nextMonth, months };
}

function getMonthlyBookings(records, months) {
  const counts = new Map(months.map((month) => [month, 0]));
  for (const appointment of records) {
    const createdAt = appointment.createdAt ? new Date(appointment.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      continue;
    }
    const month = `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    if (counts.has(month)) {
      counts.set(month, counts.get(month) + 1);
    }
  }
  return months.map((month) => ({ month, count: counts.get(month) }));
}

async function getAdminDashboard(req, res) {
  const now = new Date();
  const nowKey = getLocalDateTimeKey();
  const todayKey = nowKey.slice(0, 10);
  const currentTime = nowKey.slice(11);
  const { firstMonth, nextMonth, months } = getMonthRange(now);
  let totalPatients;
  let totalDoctors;
  let activeDoctors;
  let totalAppointments;
  let completedAppointments;
  let cancelledAppointments;
  let upcomingCount;
  let statusCounts = Object.fromEntries(appointmentStatuses.map((status) => [status, 0]));
  let monthlyBookings;
  let recentAppointments;
  let upcomingAppointments;

  if (isDatabaseConnected()) {
    const upcomingFilter = {
      status: { $in: activeStatuses },
      $or: [
        { date: { $gt: todayKey } },
        { date: todayKey, time: { $gte: currentTime } },
      ],
    };
    const [
      patientCount,
      doctorCount,
      activeDoctorCount,
      appointmentCount,
      completedCount,
      cancelledCount,
      upcomingAppointmentCount,
      statusRows,
      monthlyRows,
      recentRecords,
      upcomingRecords,
    ] = await Promise.all([
      User.countDocuments({ role: "patient" }),
      Doctor.countDocuments({}),
      Doctor.countDocuments({ isActive: { $ne: false } }),
      Appointment.countDocuments({}),
      Appointment.countDocuments({ status: "Completed" }),
      Appointment.countDocuments({ status: "Cancelled" }),
      Appointment.countDocuments(upcomingFilter),
      Appointment.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Appointment.aggregate([
        { $match: { createdAt: { $gte: firstMonth, $lt: nextMonth } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Appointment.find({}).sort({ createdAt: -1, _id: -1 }).limit(10).lean(),
      Appointment.find(upcomingFilter).sort({ date: 1, time: 1 }).limit(10).lean(),
    ]);

    totalPatients = patientCount;
    totalDoctors = doctorCount;
    activeDoctors = activeDoctorCount;
    totalAppointments = appointmentCount;
    completedAppointments = completedCount;
    cancelledAppointments = cancelledCount;
    upcomingCount = upcomingAppointmentCount;
    for (const row of statusRows) {
      if (Object.prototype.hasOwnProperty.call(statusCounts, row._id)) {
        statusCounts[row._id] = row.count;
      }
    }
    const monthlyCounts = new Map(monthlyRows.map((row) => [row._id, row.count]));
    monthlyBookings = months.map((month) => ({
      month,
      count: monthlyCounts.get(month) || 0,
    }));
    recentAppointments = recentRecords;
    upcomingAppointments = upcomingRecords;
  } else {
    const activeAppointmentRecords = appointments;
    totalPatients = users.filter((user) => user.role === "patient").length;
    totalDoctors = demoDoctors.length;
    activeDoctors = demoDoctors.filter((doctor) => doctor.isActive !== false).length;
    totalAppointments = activeAppointmentRecords.length;
    completedAppointments = activeAppointmentRecords.filter(
      (appointment) => appointment.status === "Completed"
    ).length;
    cancelledAppointments = activeAppointmentRecords.filter(
      (appointment) => appointment.status === "Cancelled"
    ).length;
    for (const appointment of activeAppointmentRecords) {
      if (Object.prototype.hasOwnProperty.call(statusCounts, appointment.status)) {
        statusCounts[appointment.status] += 1;
      }
    }
    upcomingAppointments = sortAppointments(
      activeAppointmentRecords.filter((appointment) => isUpcoming(appointment, nowKey))
    );
    upcomingCount = upcomingAppointments.length;
    recentAppointments = [...activeAppointmentRecords].sort((first, second) => {
      const firstDate = new Date(first.createdAt || `${first.date}T${first.time || "00:00"}`);
      const secondDate = new Date(second.createdAt || `${second.date}T${second.time || "00:00"}`);
      return secondDate - firstDate;
    }).slice(0, 10);
    monthlyBookings = getMonthlyBookings(activeAppointmentRecords, months);
  }

  return res.json({
    summary: {
      totalPatients,
      totalDoctors,
      activeDoctors,
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      upcomingAppointments: upcomingCount,
    },
    analytics: {
      appointmentStatusCounts: statusCounts,
      monthlyBookings,
    },
    upcomingAppointments: upcomingAppointments.map(formatAppointment),
    recentAppointments: recentAppointments.map(formatAppointment),
  });
}

async function getAdminDoctors(req, res) {
  const records = isDatabaseConnected()
    ? await Doctor.find({}).sort({ createdAt: 1, _id: 1 }).lean()
    : demoDoctors;
  return res.json(
    records.map((doctor) => ({
      ...formatDoctor(doctor),
      linkedUserId: doctor.userId ? String(doctor.userId) : "",
    }))
  );
}

function formatAdminUser(user) {
  return {
    id: user._id ? String(user._id) : user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    isActive: user.isActive !== false,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
  };
}

function parsePageParameter(value, fallback, maximum) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getAdminUsers(req, res) {
  const role = req.query.role;
  const search = req.query.search;
  const page = parsePageParameter(req.query.page, 1, 1_000_000);
  const limit = parsePageParameter(req.query.limit, 10, 50);
  if (
    (role !== undefined &&
      (typeof role !== "string" || !["patient", "doctor", "admin"].includes(role))) ||
    (search !== undefined &&
      (typeof search !== "string" || search.trim().length > 100)) ||
    page === null ||
    limit === null
  ) {
    return res.status(400).json({ message: "Provide valid user filters and pagination." });
  }

  let records;
  let total;
  if (isDatabaseConnected()) {
    const filter = {};
    if (role) {
      filter.role = role;
    }
    if (search && search.trim()) {
      const expression = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [{ name: expression }, { email: expression }];
    }
    [total, records] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("name email phone role isActive createdAt")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
  } else {
    const expression = search && search.trim()
      ? new RegExp(escapeRegex(search.trim()), "i")
      : null;
    const filtered = users.filter(
      (user) =>
        (!role || user.role === role) &&
        (!expression || expression.test(`${user.name || ""} ${user.email || ""}`))
    );
    filtered.sort((first, second) => {
      const firstDate = first.createdAt ? new Date(first.createdAt).getTime() : 0;
      const secondDate = second.createdAt ? new Date(second.createdAt).getTime() : 0;
      return secondDate - firstDate;
    });
    total = filtered.length;
    records = filtered.slice((page - 1) * limit, page * limit);
  }

  return res.json({
    users: records.map(formatAdminUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

async function updateAdminPatientStatus(req, res) {
  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    typeof body.isActive !== "boolean"
  ) {
    return res.status(400).json({ message: "Provide only an isActive boolean." });
  }

  let user;
  if (isDatabaseConnected()) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Patient account not found." });
    }
    user = await User.findById(req.params.id).select("role");
    if (!user || user.role !== "patient") {
      return res.status(404).json({ message: "Patient account not found." });
    }
    user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: body.isActive } },
      { new: true, runValidators: true }
    ).select("name email phone role isActive createdAt").lean();
  } else {
    user = users.find((record) => String(record.id) === req.params.id);
    if (!user || user.role !== "patient") {
      return res.status(404).json({ message: "Patient account not found." });
    }
    user.isActive = body.isActive;
  }

  return res.json({ user: formatAdminUser(user) });
}

module.exports = {
  getPatientDashboard,
  getDoctorDashboard,
  updateDoctorProfile,
  getAdminDashboard,
  getAdminDoctors,
  getAdminUsers,
  updateAdminPatientStatus,
};
