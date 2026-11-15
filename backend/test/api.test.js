const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const { app } = require("../server");
const { appointments } = require("../data/appointments");
const { users } = require("../data/users");
const { doctors } = require("../data/doctors");
const { prescriptions } = require("../data/prescriptions");
const { notifications } = require("../data/notifications");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { sendUpcomingAppointmentReminders } = require("../services/appointmentReminderService");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");

let server;
let baseUrl;

before(async () => {
  appointments.length = 0;
  users.length = 0;
  prescriptions.length = 0;
  notifications.length = 0;
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  appointments.length = 0;
  users.length = 0;
  prescriptions.length = 0;
  notifications.length = 0;
});

test("GET /api/doctors returns the existing demo doctor list", async () => {
  const response = await fetch(`${baseUrl}/api/doctors`);
  const doctors = await response.json();

  assert.equal(response.status, 200);
  assert.equal(doctors.length, 4);
  assert.equal(doctors[0].name, "Dr. Priya Sharma");
  assert.equal(doctors[0].id, 1);
  assert.equal(doctors[0].timeSlots.includes("09:00"), true);

  const searchResponse = await fetch(`${baseUrl}/api/doctors/search?search=priya`);
  assert.equal((await searchResponse.json()).length, 1);

  const detailResponse = await fetch(`${baseUrl}/api/doctors/1`);
  assert.equal((await detailResponse.json()).name, "Dr. Priya Sharma");
});

test("API responses include standard security headers", async () => {
  const response = await fetch(`${baseUrl}/`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.ok(response.headers.get("content-security-policy"));
});

test("appointment routes validate slots, scope patient data, and manage bookings", async () => {
  const registrationResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Appointments Patient",
      email: "appointments@example.test",
      password: "DemoPass123!",
    }),
  });
  const { token } = await registrationResponse.json();
  const authorization = { Authorization: `Bearer ${token}` };

  const unauthorizedListResponse = await fetch(`${baseUrl}/api/appointments`);
  assert.equal(unauthorizedListResponse.status, 401);

  const initialResponse = await fetch(`${baseUrl}/api/appointments`, {
    headers: authorization,
  });
  assert.deepEqual(await initialResponse.json(), []);

  const guestBookingResponse = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientName: "Guest Patient",
      doctor: "Dr. Priya Sharma",
      date: "2099-12-03",
      time: "13:00",
    }),
  });
  assert.equal(guestBookingResponse.status, 201);

  const bookingBody = {
    patientName: "Untrusted Name",
    doctor: "Dr. Priya Sharma",
    doctorId: "1",
    date: "2099-12-01",
    time: "09:00",
  };
  const bookingResponse = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify(bookingBody),
  });
  const booking = await bookingResponse.json();

  assert.equal(bookingResponse.status, 201);
  assert.equal(booking.appointment.patientName, "Appointments Patient");
  assert.equal(booking.appointment.status, "Pending");

  const duplicateResponse = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify(bookingBody),
  });
  assert.equal(duplicateResponse.status, 409);

  const invalidSlotResponse = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ ...bookingBody, time: "11:00" }),
  });
  assert.equal(invalidSlotResponse.status, 400);

  const listResponse = await fetch(`${baseUrl}/api/appointments`, {
    headers: authorization,
  });
  const records = await listResponse.json();
  assert.equal(records.length, 1);
  assert.equal(records[0].doctor, "Dr. Priya Sharma");

  const detailResponse = await fetch(`${baseUrl}/api/appointments/${booking.appointment.id}`, {
    headers: authorization,
  });
  assert.equal(detailResponse.status, 200);

  const occupiedSlotResponse = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientName: "Guest Patient",
      doctor: "Dr. Priya Sharma",
      date: "2099-12-02",
      time: "10:30",
    }),
  });
  assert.equal(occupiedSlotResponse.status, 201);

  const rescheduleResponse = await fetch(
    `${baseUrl}/api/appointments/${booking.appointment.id}`,
    {
      method: "PUT",
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2099-12-02", time: "10:30" }),
    }
  );
  assert.equal(rescheduleResponse.status, 409);

  const availableRescheduleResponse = await fetch(
    `${baseUrl}/api/appointments/${booking.appointment.id}`,
    {
      method: "PUT",
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2099-12-02", time: "13:00" }),
    }
  );
  const rescheduled = await availableRescheduleResponse.json();
  assert.equal(availableRescheduleResponse.status, 200);
  assert.equal(rescheduled.date, "2099-12-02");
  assert.equal(rescheduled.time, "13:00");

  const cancelResponse = await fetch(
    `${baseUrl}/api/appointments/${booking.appointment.id}/cancel`,
    { method: "PATCH", headers: authorization }
  );
  assert.equal(cancelResponse.status, 200);
  assert.equal((await cancelResponse.json()).status, "Cancelled");

  const reopenedSlotResponse = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify(bookingBody),
  });
  assert.equal(reopenedSlotResponse.status, 201);

  const otherRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Other Patient",
      email: "other-patient@example.test",
      password: "DemoPass123!",
    }),
  });
  const otherPatient = await otherRegistration.json();
  const otherAuthorization = {
    Authorization: `Bearer ${otherPatient.token}`,
  };
  const otherAppointments = await fetch(`${baseUrl}/api/appointments`, {
    headers: otherAuthorization,
  });
  assert.deepEqual(await otherAppointments.json(), []);

  const privateDetail = await fetch(
    `${baseUrl}/api/appointments/${booking.appointment.id}`,
    { headers: otherAuthorization }
  );
  assert.equal(privateDetail.status, 404);
});

test("POST /api/appointments rejects incomplete bookings", async () => {
  const response = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientName: "Phase Two Test" }),
  });

  assert.equal(response.status, 400);
  assert.equal(
    (await response.json()).message,
    "Please provide all appointment details."
  );
});

test("patient registration, login, and profile routes protect account data", async () => {
  const registrationResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Phase Three Test",
      email: "phase-three@example.test",
      password: "DemoPass123!",
      role: "admin",
    }),
  });
  const registration = await registrationResponse.json();

  assert.equal(registrationResponse.status, 201);
  assert.equal(registration.user.role, "patient");
  assert.equal("password" in registration.user, false);
  assert.equal(typeof registration.token, "string");

  const duplicateResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Duplicate Test",
      email: "phase-three@example.test",
      password: "DemoPass123!",
    }),
  });
  assert.equal(duplicateResponse.status, 409);

  const wrongPasswordResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "phase-three@example.test",
      password: "WrongPass123!",
    }),
  });
  assert.equal(wrongPasswordResponse.status, 401);

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "phase-three@example.test",
      password: "DemoPass123!",
    }),
  });
  const login = await loginResponse.json();
  assert.equal(loginResponse.status, 200);
  assert.equal(login.user.role, "patient");
  assert.equal("password" in login.user, false);

  const profileResponse = await fetch(`${baseUrl}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${registration.token}` },
  });
  assert.equal(profileResponse.status, 200);
  assert.equal((await profileResponse.json()).user.email, "phase-three@example.test");

  const updateResponse = await fetch(`${baseUrl}/api/auth/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${registration.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Updated Test", role: "admin" }),
  });
  const update = await updateResponse.json();
  assert.equal(updateResponse.status, 200);
  assert.equal(update.user.name, "Updated Test");
  assert.equal(update.user.role, "patient");

  const unauthenticatedResponse = await fetch(`${baseUrl}/api/auth/profile`);
  assert.equal(unauthenticatedResponse.status, 401);
});

test("role middleware rejects users without an allowed role", () => {
  const response = {
    statusCode: 0,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;

  authorizeRoles("admin")(
    { auth: { role: "patient" } },
    response,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test("doctor changes require admin and soft-deactivation hides records", async () => {
  const patientResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Directory Patient",
      email: "directory@example.test",
      password: "DemoPass123!",
    }),
  });
  const patient = await patientResponse.json();
  const deniedResponse = await fetch(`${baseUrl}/api/doctors`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${patient.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Dr. Example",
      specialization: "General",
      experience: 5,
    }),
  });
  assert.equal(deniedResponse.status, 403);

  const adminToken = jwt.sign(
    { sub: "admin-test-id", role: "admin" },
    JWT_SECRET
  );
  const adminUser = {
    id: "admin-test-id",
    name: "Test Administrator",
    email: "admin-test@example.test",
    role: "admin",
  };
  users.push(adminUser);
  const createResponse = await fetch(`${baseUrl}/api/doctors`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Dr. Example",
      specialization: "General",
      experience: 5,
      timeSlots: ["09:00", "12:00"],
    }),
  });
  const createdDoctor = await createResponse.json();
  assert.equal(createResponse.status, 201);

  const updateResponse = await fetch(`${baseUrl}/api/doctors/${createdDoctor.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ experience: 6 }),
  });
  assert.equal((await updateResponse.json()).experienceYears, 6);

  const linkedDoctorUser = { id: "linked-doctor-account", role: "doctor" };
  users.push(linkedDoctorUser);
  const linkResponse = await fetch(`${baseUrl}/api/doctors/${createdDoctor.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: linkedDoctorUser.id }),
  });
  const linkedDoctor = await linkResponse.json();
  assert.equal(linkResponse.status, 200);
  assert.equal("userId" in linkedDoctor, false);

  const doctorToken = jwt.sign(
    { sub: linkedDoctorUser.id, role: "doctor" },
    JWT_SECRET
  );
  const dashboardResponse = await fetch(`${baseUrl}/api/dashboard/doctor`, {
    headers: { Authorization: `Bearer ${doctorToken}` },
  });
  assert.equal(dashboardResponse.status, 200);

  const invalidLinkResponse = await fetch(`${baseUrl}/api/doctors/${createdDoctor.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: patient.user.id }),
  });
  assert.equal(invalidLinkResponse.status, 400);

  const deleteResponse = await fetch(`${baseUrl}/api/doctors/${createdDoctor.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteResponse.status, 200);
  assert.equal(
    (await fetch(`${baseUrl}/api/doctors/${createdDoctor.id}`)).status,
    404
  );
  const reactivateResponse = await fetch(`${baseUrl}/api/doctors/${createdDoctor.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isActive: true, availability: "Available" }),
  });
  assert.equal(reactivateResponse.status, 200);
  assert.equal((await reactivateResponse.json()).isActive, true);
  assert.equal(
    (await fetch(`${baseUrl}/api/doctors/${createdDoctor.id}`)).status,
    200
  );
  users.splice(users.indexOf(adminUser), 1);
});

test("patient dashboard summarizes only the signed-in patient's appointments", async () => {
  const patientResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Dashboard Patient",
      email: "dashboard-patient@example.test",
      password: "DemoPass123!",
    }),
  });
  const patient = await patientResponse.json();
  const authorization = { Authorization: `Bearer ${patient.token}` };
  const bookingBody = {
    doctorId: "2",
    date: "2099-12-01",
    time: "09:00",
  };
  const firstBooking = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify(bookingBody),
  });
  const firstAppointment = await firstBooking.json();
  assert.equal(firstBooking.status, 201);

  const secondBooking = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ ...bookingBody, date: "2099-12-02", time: "10:30" }),
  });
  assert.equal(secondBooking.status, 201);

  const cancelResponse = await fetch(
    `${baseUrl}/api/appointments/${firstAppointment.appointment.id}/cancel`,
    { method: "PATCH", headers: authorization }
  );
  assert.equal(cancelResponse.status, 200);

  const otherPatientResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Another Dashboard Patient",
      email: "another-dashboard-patient@example.test",
      password: "DemoPass123!",
    }),
  });
  const otherPatient = await otherPatientResponse.json();
  const otherBooking = await fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${otherPatient.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...bookingBody, date: "2099-12-03", time: "13:00" }),
  });
  assert.equal(otherBooking.status, 201);

  const dashboardResponse = await fetch(`${baseUrl}/api/dashboard/patient`, {
    headers: authorization,
  });
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboardResponse.status, 200);
  assert.deepEqual(dashboard.summary, {
    total: 2,
    upcoming: 1,
    completed: 0,
    cancelled: 1,
  });
  assert.equal(dashboard.upcomingAppointments.length, 1);
  assert.equal(dashboard.upcomingAppointments[0].date, "2099-12-02");
  assert.equal("email" in dashboard.upcomingAppointments[0], false);
  assert.equal(
    (await fetch(`${baseUrl}/api/dashboard/doctor`, { headers: authorization })).status,
    403
  );
});

test("doctor dashboard scopes appointments and updates only its linked profile", async () => {
  const doctor = doctors[0];
  const originalDoctor = {
    ...doctor,
    workingDays: [...doctor.workingDays],
    timeSlots: [...doctor.timeSlots],
  };
  const previousAppointments = appointments.splice(0, appointments.length);
  const doctorUserId = "dashboard-doctor-user";
  const doctorUser = {
    id: doctorUserId,
    name: "Dashboard Doctor",
    email: "dashboard-doctor@example.test",
    role: "doctor",
  };
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const token = jwt.sign({ sub: doctorUserId, role: "doctor" }, JWT_SECRET);

  users.push(doctorUser);
  doctor.userId = doctorUserId;
  appointments.push(
    {
      id: "doctor-today",
      doctorId: doctor.id,
      patientId: "today-patient",
      patientName: "Today Patient",
      doctor: doctor.name,
      specialization: doctor.specialization,
      date: today,
      time: "23:59",
      status: "Confirmed",
    },
    {
      id: "doctor-upcoming",
      doctorId: doctor.id,
      patientId: "upcoming-patient",
      patientName: "Upcoming Patient",
      doctor: doctor.name,
      specialization: doctor.specialization,
      date: "2099-12-01",
      time: "09:00",
      status: "Pending",
    },
    {
      id: "doctor-history",
      doctorId: doctor.id,
      patientId: "history-patient",
      patientName: "History Patient",
      doctor: doctor.name,
      specialization: doctor.specialization,
      date: "2000-01-03",
      time: "09:00",
      status: "Completed",
    }
  );

  try {
    const authorization = { Authorization: `Bearer ${token}` };
    const dashboardResponse = await fetch(`${baseUrl}/api/dashboard/doctor`, {
      headers: authorization,
    });
    const dashboard = await dashboardResponse.json();
    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboard.summary.today, 1);
    assert.equal(dashboard.summary.upcoming, 1);
    assert.equal(dashboard.summary.completed, 1);
    assert.equal(dashboard.todayAppointments[0].patientName, "Today Patient");
    assert.equal("email" in dashboard.todayAppointments[0], false);

    const updateResponse = await fetch(`${baseUrl}/api/dashboard/doctor/profile`, {
      method: "PUT",
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        availability: "Unavailable",
        workingDays: ["Tue", "Thu"],
        timeSlots: ["11:00", "14:00"],
      }),
    });
    const updatedDoctor = await updateResponse.json();
    assert.equal(updateResponse.status, 200);
    assert.equal(updatedDoctor.availability, "Unavailable");
    assert.deepEqual(updatedDoctor.workingDays, ["Tue", "Thu"]);
    assert.deepEqual(updatedDoctor.timeSlots, ["11:00", "14:00"]);

    const protectedUpdate = await fetch(`${baseUrl}/api/dashboard/doctor/profile`, {
      method: "PUT",
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(protectedUpdate.status, 400);
  } finally {
    Object.assign(doctor, originalDoctor);
    if (!Object.prototype.hasOwnProperty.call(originalDoctor, "userId")) {
      delete doctor.userId;
    }
    appointments.push(...previousAppointments);
    users.splice(users.indexOf(doctorUser), 1);
  }
});

test("ML routes validate requests and proxy to the configured Python service", async () => {
  const actualFetch = global.fetch;
  const upstreamRequests = [];
  global.fetch = async (input, options = {}) => {
    if (String(input).startsWith(baseUrl)) {
      return actualFetch(input, options);
    }

    const url = new URL(input);
    upstreamRequests.push({
      path: url.pathname,
      method: options.method,
      body: options.body ? JSON.parse(options.body) : null,
    });
    const payload = url.pathname.endsWith("/symptoms")
      ? { symptoms: [{ value: "headache", label: "Headache" }] }
      : url.pathname.endsWith("/symptom-recommendation")
        ? { suggestedSpecialty: "Neurology" }
        : url.pathname.endsWith("/doctor-recommendation")
          ? { recommendations: [] }
          : {
              estimatedRisk: "Low",
              estimatedProbability: 0.2,
              disclaimer: "Synthetic demonstration only.",
            };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const symptomListResponse = await fetch(`${baseUrl}/api/ml/symptoms`);
    assert.equal(symptomListResponse.status, 200);
    assert.equal(upstreamRequests[0].path, "/symptoms");

    const invalidSymptomsResponse = await fetch(
      `${baseUrl}/api/ml/symptom-recommendation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: [] }),
      }
    );
    assert.equal(invalidSymptomsResponse.status, 400);
    assert.equal(upstreamRequests.length, 1);

    const symptomResponse = await fetch(`${baseUrl}/api/ml/symptom-recommendation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms: ["headache"] }),
    });
    assert.equal((await symptomResponse.json()).suggestedSpecialty, "Neurology");

    const doctorResponse = await fetch(`${baseUrl}/api/ml/doctor-recommendation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ specialization: "Cardiologist", availability: "Available" }),
    });
    assert.equal(doctorResponse.status, 200);
    const doctorRequest = upstreamRequests.find(
      (request) => request.path === "/doctor-recommendation"
    );
    assert.ok(doctorRequest.body.doctors.length >= 4);
    assert.ok(doctorRequest.body.doctors.every((doctor) => doctor.isActive));
    assert.deepEqual(doctorRequest.body.preferences, {
      specialization: "Cardiologist",
      availability: "Available",
    });

    const invalidPredictionResponse = await fetch(
      `${baseUrl}/api/ml/no-show-prediction`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentDate: "2026-11-20",
          appointmentTime: "10:30",
          bookingLeadDays: -1,
          reminderSent: false,
        }),
      }
    );
    assert.equal(invalidPredictionResponse.status, 400);

    const predictionResponse = await fetch(`${baseUrl}/api/ml/no-show-prediction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentDate: "2026-11-20",
        appointmentTime: "10:30",
        bookingLeadDays: 5,
        reminderSent: true,
        previousAttendance: "unknown",
      }),
    });
    assert.equal((await predictionResponse.json()).estimatedRisk, "Low");
  } finally {
    global.fetch = actualFetch;
  }
});

test("prescriptions and notifications are linked and scoped to authorized accounts", async () => {
  const savedAppointments = appointments.splice(0, appointments.length);
  const savedPrescriptions = prescriptions.splice(0, prescriptions.length);
  const savedNotifications = notifications.splice(0, notifications.length);
  const doctor = doctors[0];
  const originalDoctorUserId = doctor.userId;
  const doctorUser = {
    id: "prescribing-doctor-user",
    name: "Prescribing Doctor",
    email: "prescribing-doctor@example.test",
    role: "doctor",
  };
  users.push(doctorUser);
  doctor.userId = doctorUser.id;

  try {
    const patientResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Prescription Patient",
        email: "prescription-patient@example.test",
        password: "DemoPass123!",
      }),
    });
    const patient = await patientResponse.json();
    const patientHeaders = { Authorization: `Bearer ${patient.token}` };
    const doctorToken = jwt.sign(
      { sub: doctorUser.id, role: "doctor" },
      JWT_SECRET
    );
    const doctorHeaders = { Authorization: `Bearer ${doctorToken}` };

    const patientCreationDenied = await fetch(`${baseUrl}/api/prescriptions`, {
      method: "POST",
      headers: { ...patientHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: "not-an-appointment" }),
    });
    assert.equal(patientCreationDenied.status, 403);

    const bookingResponse = await fetch(`${baseUrl}/api/appointments`, {
      method: "POST",
      headers: { ...patientHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorId: String(doctor.id),
        date: "2099-12-10",
        time: "13:00",
      }),
    });
    const booking = await bookingResponse.json();
    assert.equal(bookingResponse.status, 201);
    assert.equal(booking.appointment.status, "Pending");

    const confirmationResponse = await fetch(
      `${baseUrl}/api/appointments/${booking.appointment.id}/status`,
      {
        method: "PATCH",
        headers: { ...doctorHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Confirmed" }),
      }
    );
    assert.equal(confirmationResponse.status, 200);
    assert.equal((await confirmationResponse.json()).status, "Confirmed");

    const prescriptionBody = {
      appointmentId: String(booking.appointment.id),
      notes: "Clinician-entered notes.",
      medicines: [
        { name: "Example medicine", dosage: "One tablet", instructions: "As directed." },
      ],
    };
    const unsupportedFieldResponse = await fetch(`${baseUrl}/api/prescriptions`, {
      method: "POST",
      headers: { ...doctorHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ...prescriptionBody, patientId: "another-patient" }),
    });
    assert.equal(unsupportedFieldResponse.status, 400);

    const createResponse = await fetch(`${baseUrl}/api/prescriptions`, {
      method: "POST",
      headers: { ...doctorHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(prescriptionBody),
    });
    const prescription = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(prescription.patientName, "Prescription Patient");
    assert.equal(prescription.doctorName, doctor.name);
    assert.equal(prescription.medicines[0].name, "Example medicine");

    const duplicateResponse = await fetch(`${baseUrl}/api/prescriptions`, {
      method: "POST",
      headers: { ...doctorHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(prescriptionBody),
    });
    assert.equal(duplicateResponse.status, 409);

    const patientListResponse = await fetch(`${baseUrl}/api/prescriptions`, {
      headers: patientHeaders,
    });
    assert.equal((await patientListResponse.json()).length, 1);
    const doctorListResponse = await fetch(`${baseUrl}/api/prescriptions`, {
      headers: doctorHeaders,
    });
    assert.equal((await doctorListResponse.json()).length, 1);

    const otherPatientResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Other Prescription Patient",
        email: "other-prescription-patient@example.test",
        password: "DemoPass123!",
      }),
    });
    const otherPatient = await otherPatientResponse.json();
    const privatePrescription = await fetch(
      `${baseUrl}/api/prescriptions/${prescription.id}`,
      { headers: { Authorization: `Bearer ${otherPatient.token}` } }
    );
    assert.equal(privatePrescription.status, 404);
    const unrelatedDoctorToken = jwt.sign(
      { sub: "unlinked-doctor-user", role: "doctor" },
      JWT_SECRET
    );
    const privateDoctorPrescription = await fetch(
      `${baseUrl}/api/prescriptions/${prescription.id}`,
      { headers: { Authorization: `Bearer ${unrelatedDoctorToken}` } }
    );
    assert.equal(privateDoctorPrescription.status, 401);

    const updateResponse = await fetch(
      `${baseUrl}/api/prescriptions/${prescription.id}`,
      {
        method: "PUT",
        headers: { ...doctorHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Updated clinician notes." }),
      }
    );
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).notes, "Updated clinician notes.");

    const notificationResponse = await fetch(`${baseUrl}/api/notifications`, {
      headers: patientHeaders,
    });
    const notificationList = await notificationResponse.json();
    assert.equal(notificationResponse.status, 200);
    assert.equal(notificationList.unreadCount, 4);
    assert.deepEqual(
      notificationList.notifications.map((notification) => notification.type).sort(),
      [
        "appointment_confirmation",
        "appointment_request",
        "prescription_available",
        "registration_success",
      ].sort()
    );

    const rescheduleResponse = await fetch(
      `${baseUrl}/api/appointments/${booking.appointment.id}`,
      {
        method: "PUT",
        headers: { ...patientHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2099-12-11", time: "13:00" }),
      }
    );
    assert.equal(rescheduleResponse.status, 200);
    const cancellationResponse = await fetch(
      `${baseUrl}/api/appointments/${booking.appointment.id}/cancel`,
      { method: "PATCH", headers: patientHeaders }
    );
    assert.equal(cancellationResponse.status, 200);

    const updateNotificationsResponse = await fetch(`${baseUrl}/api/notifications`, {
      headers: patientHeaders,
    });
    const updateNotifications = await updateNotificationsResponse.json();
    assert.equal(updateNotifications.unreadCount, 6);
    assert.ok(
      updateNotifications.notifications.some(
        (notification) => notification.type === "appointment_rescheduled"
      )
    );
    assert.ok(
      updateNotifications.notifications.some(
        (notification) => notification.type === "appointment_cancelled"
      )
    );

    const prescriptionNotice = notificationList.notifications.find(
      (notification) => notification.type === "prescription_available"
    );
    const markReadResponse = await fetch(
      `${baseUrl}/api/notifications/${prescriptionNotice.id}/read`,
      { method: "PATCH", headers: patientHeaders }
    );
    assert.equal(markReadResponse.status, 200);
    assert.equal((await markReadResponse.json()).read, true);

    const otherPatientMarkRead = await fetch(
      `${baseUrl}/api/notifications/${prescriptionNotice.id}/read`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${otherPatient.token}` },
      }
    );
    assert.equal(otherPatientMarkRead.status, 404);
    const unreadResponse = await fetch(`${baseUrl}/api/notifications`, {
      headers: patientHeaders,
    });
    assert.equal((await unreadResponse.json()).unreadCount, 5);

    const now = new Date();
    const reminderTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const reminderDate = `${reminderTime.getFullYear()}-${String(reminderTime.getMonth() + 1).padStart(2, "0")}-${String(reminderTime.getDate()).padStart(2, "0")}`;
    const reminderClock = `${String(reminderTime.getHours()).padStart(2, "0")}:${String(reminderTime.getMinutes()).padStart(2, "0")}`;
    appointments.push({
      id: "reminder-test-appointment",
      patientId: patient.user.id,
      doctorId: doctor.id,
      patientName: patient.user.name,
      doctor: doctor.name,
      date: reminderDate,
      time: reminderClock,
      status: "Confirmed",
    });
    await sendUpcomingAppointmentReminders(now);
    await sendUpcomingAppointmentReminders(now);
    const reminders = notifications.filter(
      (notification) => notification.type === "appointment_reminder"
    );
    assert.equal(reminders.length, 1);
  } finally {
    Object.assign(doctor, { userId: originalDoctorUserId });
    if (originalDoctorUserId === undefined) {
      delete doctor.userId;
    }
    users.splice(users.indexOf(doctorUser), 1);
    appointments.splice(0, appointments.length, ...savedAppointments);
    prescriptions.splice(0, prescriptions.length, ...savedPrescriptions);
    notifications.splice(0, notifications.length, ...savedNotifications);
  }
});

test("admin analytics and user management require an active administrator", async () => {
  const savedUsers = users.splice(0, users.length);
  const savedAppointments = appointments.splice(0, appointments.length);
  const savedDoctors = doctors.splice(0, doctors.length);
  const savedNotifications = notifications.splice(0, notifications.length);
  const savedPrescriptions = prescriptions.splice(0, prescriptions.length);
  const adminUser = {
    id: "phase9-admin-user",
    name: "Phase Nine Admin",
    email: "phase9-admin@example.test",
    role: "admin",
    isActive: true,
  };
  const doctorUser = {
    id: "phase9-doctor-user",
    name: "Phase Nine Doctor",
    email: "phase9-doctor@example.test",
    role: "doctor",
    isActive: true,
    createdAt: new Date(),
  };
  users.push(adminUser, doctorUser);
  doctors.push(
    { id: 11, name: "Active Doctor", specialization: "Cardiologist", isActive: true },
    { id: 12, name: "Inactive Doctor", specialization: "Neurologist", isActive: false }
  );
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const createdAt = new Date(now.getTime() - 60 * 60 * 1000);
  appointments.push(
    {
      id: "phase9-completed",
      patientId: "completed-patient",
      patientName: "Completed Patient",
      doctorId: 11,
      doctor: "Active Doctor",
      date: "2020-01-02",
      time: "09:00",
      status: "Completed",
      createdAt,
    },
    {
      id: "phase9-cancelled",
      patientId: "cancelled-patient",
      patientName: "Cancelled Patient",
      doctorId: 11,
      doctor: "Active Doctor",
      date: "2020-01-03",
      time: "10:00",
      status: "Cancelled",
      createdAt,
    },
    {
      id: "phase9-upcoming",
      patientId: "upcoming-patient",
      patientName: "Upcoming Patient",
      doctorId: 11,
      doctor: "Active Doctor",
      date: tomorrowDate,
      time: "09:00",
      status: "Confirmed",
      createdAt,
    }
  );

  try {
    const adminToken = jwt.sign(
      { sub: adminUser.id, role: adminUser.role },
      JWT_SECRET
    );
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    const patientResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Managed Patient",
        email: "managed-patient@example.test",
        password: "DemoPass123!",
      }),
    });
    const patient = await patientResponse.json();
    const anotherPatientResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Second Managed Patient",
        email: "second-managed-patient@example.test",
        password: "DemoPass123!",
      }),
    });
    const anotherPatient = await anotherPatientResponse.json();

    const deniedDashboard = await fetch(`${baseUrl}/api/dashboard/admin`, {
      headers: { Authorization: `Bearer ${patient.token}` },
    });
    assert.equal(deniedDashboard.status, 403);

    const dashboardResponse = await fetch(`${baseUrl}/api/dashboard/admin`, {
      headers: adminHeaders,
    });
    const dashboard = await dashboardResponse.json();
    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboard.summary.totalPatients, 2);
    assert.equal(dashboard.summary.totalDoctors, 2);
    assert.equal(dashboard.summary.activeDoctors, 1);
    assert.equal(dashboard.summary.totalAppointments, 3);
    assert.equal(dashboard.summary.completedAppointments, 1);
    assert.equal(dashboard.summary.cancelledAppointments, 1);
    assert.equal(dashboard.summary.upcomingAppointments, 1);
    assert.deepEqual(dashboard.analytics.appointmentStatusCounts, {
      Pending: 0,
      Confirmed: 1,
      Completed: 1,
      Cancelled: 1,
    });
    assert.equal(dashboard.upcomingAppointments[0].id, "phase9-upcoming");
    assert.equal(dashboard.analytics.monthlyBookings.at(-1).count, 3);

    const usersResponse = await fetch(
      `${baseUrl}/api/dashboard/admin/users?role=patient&limit=1`,
      { headers: adminHeaders }
    );
    const userPage = await usersResponse.json();
    assert.equal(usersResponse.status, 200);
    assert.equal(userPage.users.length, 1);
    assert.equal(userPage.pagination.total, 2);
    assert.equal("passwordHash" in userPage.users[0], false);

    const invalidPagination = await fetch(
      `${baseUrl}/api/dashboard/admin/users?page=1x`,
      { headers: adminHeaders }
    );
    assert.equal(invalidPagination.status, 400);

    const deactivateResponse = await fetch(
      `${baseUrl}/api/dashboard/admin/users/${patient.user.id}/status`,
      {
        method: "PATCH",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }
    );
    assert.equal(deactivateResponse.status, 200);
    assert.equal((await deactivateResponse.json()).user.isActive, false);

    const disabledSessionResponse = await fetch(
      `${baseUrl}/api/dashboard/patient`,
      { headers: { Authorization: `Bearer ${patient.token}` } }
    );
    assert.equal(disabledSessionResponse.status, 401);
    const disabledLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "managed-patient@example.test",
        password: "DemoPass123!",
      }),
    });
    assert.equal(disabledLoginResponse.status, 401);

    const invalidDeactivate = await fetch(
      `${baseUrl}/api/dashboard/admin/users/${doctorUser.id}/status`,
      {
        method: "PATCH",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }
    );
    assert.equal(invalidDeactivate.status, 404);

    const reenableResponse = await fetch(
      `${baseUrl}/api/dashboard/admin/users/${patient.user.id}/status`,
      {
        method: "PATCH",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      }
    );
    assert.equal(reenableResponse.status, 200);
    const restoredSessionResponse = await fetch(
      `${baseUrl}/api/dashboard/patient`,
      { headers: { Authorization: `Bearer ${patient.token}` } }
    );
    assert.equal(restoredSessionResponse.status, 200);
    assert.equal(anotherPatient.user.role, "patient");
  } finally {
    users.splice(0, users.length, ...savedUsers);
    appointments.splice(0, appointments.length, ...savedAppointments);
    doctors.splice(0, doctors.length, ...savedDoctors);
    notifications.splice(0, notifications.length, ...savedNotifications);
    prescriptions.splice(0, prescriptions.length, ...savedPrescriptions);
  }
});
