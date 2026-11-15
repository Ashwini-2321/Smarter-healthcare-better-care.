import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import { useAuth } from "./context/useAuth";
import { apiRequest } from "./services/api";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const statuses = ["Pending", "Confirmed", "Completed", "Cancelled"];
const emptyDoctorForm = {
  name: "",
  specialization: "",
  qualifications: "",
  experience: "",
  consultationFee: "",
  availability: "Available",
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  timeSlots: "09:00, 10:30, 13:00, 15:30",
  clinic: "Clinexa Care Center",
  biography: "",
  image: "",
  linkedUserId: "",
};

function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function AppointmentTable({ title, appointments, emptyMessage }) {
  return (
    <section className="admin-panel">
      <div className="dashboard-panel-heading">
        <h2>{title}</h2>
      </div>
      {appointments.length === 0 ? (
        <p className="dashboard-empty">{emptyMessage}</p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Appointment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td>{appointment.patientName}</td>
                  <td>{appointment.doctor}</td>
                  <td>{appointment.date} · {appointment.time}</td>
                  <td>
                    <span className={`appointment-status status-${appointment.status.toLowerCase()}`}>
                      {appointment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdminDashboardPage() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [dashboard, setDashboard] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [doctorAccounts, setDoctorAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [userPage, setUserPage] = useState(1);
  const [userRole, setUserRole] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [userActionId, setUserActionId] = useState("");
  const [doctorForm, setDoctorForm] = useState(emptyDoctorForm);
  const [doctorFormOpen, setDoctorFormOpen] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState("");
  const [isSavingDoctor, setIsSavingDoctor] = useState(false);
  const [doctorActionId, setDoctorActionId] = useState("");
  const [doctorToDeactivate, setDoctorToDeactivate] = useState("");

  useEffect(() => {
    let isMounted = true;
    const requestHeaders = { Authorization: `Bearer ${token}` };
    Promise.all([
      apiRequest("/api/dashboard/admin", { headers: requestHeaders }),
      apiRequest("/api/dashboard/admin/doctors", { headers: requestHeaders }),
      apiRequest("/api/dashboard/admin/users?role=doctor&limit=50", {
        headers: requestHeaders,
      }),
    ])
      .then(([dashboardData, doctorRecords, doctorUserPage]) => {
        if (isMounted) {
          setDashboard(dashboardData);
          setDoctors(doctorRecords);
          setDoctorAccounts(doctorUserPage.users);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message || "Could not load the admin dashboard.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    let isMounted = true;
    const requestHeaders = { Authorization: `Bearer ${token}` };
    const query = new URLSearchParams({
      page: String(userPage),
      limit: "10",
    });
    if (userRole) {
      query.set("role", userRole);
    }
    if (userSearch.trim()) {
      query.set("search", userSearch.trim());
    }

    apiRequest(`/api/dashboard/admin/users?${query}`, { headers: requestHeaders })
      .then((result) => {
        if (isMounted) {
          setUsers(result.users);
          setPagination(result.pagination);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message || "Could not load user accounts.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsUsersLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, userPage, userRole, userSearch]);

  function openNewDoctorForm() {
    setEditingDoctorId("");
    setDoctorForm(emptyDoctorForm);
    setDoctorFormOpen(true);
    setError("");
    setMessage("");
  }

  function openEditDoctorForm(doctor) {
    setEditingDoctorId(String(doctor.id));
    setDoctorForm({
      name: doctor.name,
      specialization: doctor.specialization,
      qualifications: doctor.qualifications || "",
      experience: String(doctor.experienceYears),
      consultationFee: doctor.consultationFee == null ? "" : String(doctor.consultationFee),
      availability: doctor.availability,
      workingDays: doctor.workingDays || [],
      timeSlots: (doctor.timeSlots || []).join(", "),
      clinic: doctor.clinic || "",
      biography: doctor.biography || "",
      image: doctor.image || "",
      linkedUserId: doctor.linkedUserId || "",
    });
    setDoctorFormOpen(true);
    setError("");
    setMessage("");
  }

  function toggleWorkingDay(day) {
    setDoctorForm((current) => ({
      ...current,
      workingDays: current.workingDays.includes(day)
        ? current.workingDays.filter((item) => item !== day)
        : [...current.workingDays, day],
    }));
  }

  async function saveDoctor(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSavingDoctor(true);
    const payload = {
      name: doctorForm.name.trim(),
      specialization: doctorForm.specialization.trim(),
      qualifications: doctorForm.qualifications,
      experience: Number(doctorForm.experience),
      consultationFee: Number(doctorForm.consultationFee || 0),
      availability: doctorForm.availability,
      workingDays: doctorForm.workingDays,
      timeSlots: doctorForm.timeSlots
        .split(",")
        .map((time) => time.trim())
        .filter(Boolean),
      clinic: doctorForm.clinic,
      biography: doctorForm.biography,
      image: doctorForm.image,
      userId: doctorForm.linkedUserId || null,
      isActive: true,
    };

    try {
      const savedDoctor = await apiRequest(
        editingDoctorId
          ? `/api/doctors/${editingDoctorId}`
          : "/api/doctors",
        {
          method: editingDoctorId ? "PUT" : "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );
      const adminDoctor = {
        ...savedDoctor,
        linkedUserId: doctorForm.linkedUserId || "",
      };
      setDoctors((current) =>
        editingDoctorId
          ? current.map((doctor) =>
              String(doctor.id) === editingDoctorId ? adminDoctor : doctor
            )
          : [...current, adminDoctor]
      );
      if (!editingDoctorId) {
        setDashboard((current) => ({
          ...current,
          summary: {
            ...current.summary,
            totalDoctors: current.summary.totalDoctors + 1,
            activeDoctors: current.summary.activeDoctors + 1,
          },
        }));
      }
      setMessage(editingDoctorId ? "Doctor details updated." : "Doctor added to the directory.");
      setDoctorFormOpen(false);
    } catch (requestError) {
      setError(requestError.message || "Could not save this doctor.");
    } finally {
      setIsSavingDoctor(false);
    }
  }

  async function deactivateDoctor(doctor) {
    setError("");
    setDoctorActionId(String(doctor.id));
    try {
      const result = await apiRequest(`/api/doctors/${doctor.id}`, {
        method: "DELETE",
        headers,
      });
      setDoctors((current) =>
        current.map((item) =>
          String(item.id) === String(doctor.id)
            ? { ...result.doctor, linkedUserId: item.linkedUserId }
            : item
        )
      );
      setDashboard((current) => ({
        ...current,
        summary: {
          ...current.summary,
          activeDoctors: Math.max(0, current.summary.activeDoctors - 1),
        },
      }));
      setDoctorToDeactivate("");
      setMessage(`${doctor.name} has been deactivated.`);
    } catch (requestError) {
      setError(requestError.message || "Could not deactivate this doctor.");
    } finally {
      setDoctorActionId("");
    }
  }

  async function reactivateDoctor(doctor) {
    setError("");
    setDoctorActionId(String(doctor.id));
    try {
      const result = await apiRequest(`/api/doctors/${doctor.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ isActive: true, availability: "Available" }),
      });
      setDoctors((current) =>
        current.map((item) =>
          String(item.id) === String(doctor.id)
            ? { ...result, linkedUserId: item.linkedUserId }
            : item
        )
      );
      setDashboard((current) => ({
        ...current,
        summary: {
          ...current.summary,
          activeDoctors: current.summary.activeDoctors + 1,
        },
      }));
      setMessage(`${doctor.name} has been reactivated.`);
    } catch (requestError) {
      setError(requestError.message || "Could not reactivate this doctor.");
    } finally {
      setDoctorActionId("");
    }
  }

  async function togglePatientStatus(account) {
    setError("");
    setUserActionId(account.id);
    try {
      const result = await apiRequest(
        `/api/dashboard/admin/users/${account.id}/status`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ isActive: !account.isActive }),
        }
      );
      setUsers((current) =>
        current.map((item) => item.id === account.id ? result.user : item)
      );
      setMessage(
        result.user.isActive
          ? `${result.user.name} account reactivated.`
          : `${result.user.name} account deactivated.`
      );
    } catch (requestError) {
      setError(requestError.message || "Could not update this account.");
    } finally {
      setUserActionId("");
    }
  }

  const summary = dashboard?.summary;
  const statusCounts = dashboard?.analytics.appointmentStatusCounts || {};
  const maximumStatusCount = Math.max(1, ...statuses.map((status) => statusCounts[status] || 0));
  const monthlyBookings = dashboard?.analytics.monthlyBookings || [];
  const maximumMonthlyCount = Math.max(1, ...monthlyBookings.map((item) => item.count));

  return (
    <>
      <Navbar />
      <main className="admin-page">
        <div className="container">
          <header className="dashboard-heading">
            <span className="eyebrow">CLINEXA ADMINISTRATION</span>
            <h1>Platform overview</h1>
            <p>Monitor appointments, accounts, and doctor directory activity.</p>
            <div className="dashboard-heading-actions">
              <a className="button button-outline" href="#admin-users">Manage users</a>
              <a className="button button-outline" href="#admin-doctors">Manage doctors</a>
            </div>
          </header>

          {error && <p className="form-message form-error" role="alert">{error}</p>}
          {message && <p className="form-message form-success" role="status">{message}</p>}
          {isLoading ? (
            <p className="directory-message" role="status">Loading platform activity…</p>
          ) : dashboard && (
            <>
              <section className="admin-stats" aria-label="Platform totals">
                <article><span>Total patients</span><strong>{summary.totalPatients}</strong></article>
                <article><span>Total doctors</span><strong>{summary.totalDoctors}</strong></article>
                <article><span>Active doctors</span><strong>{summary.activeDoctors}</strong></article>
                <article><span>Total appointments</span><strong>{summary.totalAppointments}</strong></article>
                <article><span>Completed</span><strong>{summary.completedAppointments}</strong></article>
                <article><span>Cancelled</span><strong>{summary.cancelledAppointments}</strong></article>
                <article><span>Upcoming</span><strong>{summary.upcomingAppointments}</strong></article>
              </section>

              <section className="admin-analytics-grid" aria-label="Appointment analytics">
                <article className="admin-panel">
                  <div className="dashboard-panel-heading"><h2>Appointment status</h2></div>
                  <div className="admin-status-chart">
                    {statuses.map((status) => (
                      <div className="admin-chart-row" key={status}>
                        <div><span>{status}</span><strong>{statusCounts[status] || 0}</strong></div>
                        <div className="admin-chart-track">
                          <span
                            style={{ width: `${((statusCounts[status] || 0) / maximumStatusCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="admin-panel">
                  <div className="dashboard-panel-heading"><h2>Bookings by month</h2></div>
                  <div className="admin-month-chart">
                    {monthlyBookings.map((item) => (
                      <div className="admin-month-column" key={item.month}>
                        <strong>{item.count}</strong>
                        <div className="admin-month-track">
                          <span style={{ height: `${Math.max(4, (item.count / maximumMonthlyCount) * 100)}%` }} />
                        </div>
                        <span>{item.month}</span>
                      </div>
                    ))}
                  </div>
                  <p className="admin-chart-caption">Based on appointment creation date.</p>
                </article>
              </section>

              <section className="admin-appointments-grid">
                <AppointmentTable
                  title="Upcoming appointments"
                  appointments={dashboard.upcomingAppointments}
                  emptyMessage="No upcoming appointments are scheduled."
                />
                <AppointmentTable
                  title="Recent platform activity"
                  appointments={dashboard.recentAppointments}
                  emptyMessage="Recent appointments will appear here."
                />
              </section>

              <section className="admin-panel" id="admin-users">
                <div className="dashboard-panel-heading">
                  <div>
                    <h2>User directory</h2>
                    <p className="admin-section-description">
                      Patient accounts can be deactivated or restored here. Doctor access
                      is managed through the doctor directory; administrator accounts are protected.
                    </p>
                  </div>
                  <span>{pagination.total} accounts</span>
                </div>
                <div className="admin-filters">
                  <label>
                    Search users
                    <input
                      value={userSearch}
                      onChange={(event) => {
                        setUserSearch(event.target.value);
                        setUserPage(1);
                        setIsUsersLoading(true);
                      }}
                      placeholder="Name or email"
                    />
                  </label>
                  <label>
                    Role
                    <select
                      value={userRole}
                      onChange={(event) => {
                        setUserRole(event.target.value);
                        setUserPage(1);
                        setIsUsersLoading(true);
                      }}
                    >
                      <option value="">All roles</option>
                      <option value="patient">Patients</option>
                      <option value="doctor">Doctors</option>
                      <option value="admin">Administrators</option>
                    </select>
                  </label>
                </div>
                {isUsersLoading ? (
                  <p className="directory-message" role="status">Loading user accounts…</p>
                ) : users.length === 0 ? (
                  <p className="dashboard-empty">No user accounts match these filters.</p>
                ) : (
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Account</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {users.map((account) => (
                          <tr key={account.id}>
                            <td>{account.name}</td>
                            <td>{account.email}</td>
                            <td className="admin-role">{account.role}</td>
                            <td>{formatDate(account.createdAt)}</td>
                            <td>{account.isActive ? "Active" : "Inactive"}</td>
                            <td>
                              {account.role === "patient" ? (
                                <button
                                  className="text-button"
                                  disabled={userActionId === account.id}
                                  onClick={() => togglePatientStatus(account)}
                                >
                                  {userActionId === account.id
                                    ? "Saving…"
                                    : account.isActive ? "Deactivate" : "Reactivate"}
                                </button>
                              ) : (
                                <span className="admin-managed-note">
                                  {account.role === "doctor" ? "Manage in doctors" : "Protected"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="admin-pagination">
                  <span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
                  <div>
                    <button
                      className="button button-outline button-small"
                      disabled={userPage <= 1 || isUsersLoading}
                      onClick={() => {
                        setIsUsersLoading(true);
                        setUserPage((page) => page - 1);
                      }}
                    >
                      Previous
                    </button>
                    <button
                      className="button button-outline button-small"
                      disabled={userPage >= pagination.totalPages || isUsersLoading}
                      onClick={() => {
                        setIsUsersLoading(true);
                        setUserPage((page) => page + 1);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>

              <section className="admin-panel" id="admin-doctors">
                <div className="dashboard-panel-heading">
                  <div>
                    <h2>Doctor directory</h2>
                    <p className="admin-section-description">
                      Add, edit, deactivate, or restore doctor directory profiles.
                    </p>
                  </div>
                  <button className="button button-small" onClick={openNewDoctorForm}>
                    Add doctor
                  </button>
                </div>

                {doctorFormOpen && (
                  <form className="admin-doctor-form dashboard-form" onSubmit={saveDoctor}>
                    <div className="dashboard-panel-heading">
                      <h3>{editingDoctorId ? "Edit doctor" : "Add a doctor"}</h3>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setDoctorFormOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="admin-form-grid">
                      <label>
                        Doctor name
                        <input required value={doctorForm.name} onChange={(event) => setDoctorForm({ ...doctorForm, name: event.target.value })} />
                      </label>
                      <label>
                        Specialty
                        <input required value={doctorForm.specialization} onChange={(event) => setDoctorForm({ ...doctorForm, specialization: event.target.value })} />
                      </label>
                      <label>
                        Experience in years
                        <input type="number" min="0" required value={doctorForm.experience} onChange={(event) => setDoctorForm({ ...doctorForm, experience: event.target.value })} />
                      </label>
                      <label>
                        Consultation fee
                        <input type="number" min="0" value={doctorForm.consultationFee} onChange={(event) => setDoctorForm({ ...doctorForm, consultationFee: event.target.value })} />
                      </label>
                      <label>
                        Availability
                        <select value={doctorForm.availability} onChange={(event) => setDoctorForm({ ...doctorForm, availability: event.target.value })}>
                          <option>Available</option>
                          <option>Unavailable</option>
                        </select>
                      </label>
                      <label>
                        Link doctor account (optional)
                        <select value={doctorForm.linkedUserId} onChange={(event) => setDoctorForm({ ...doctorForm, linkedUserId: event.target.value })}>
                          <option value="">No linked doctor account</option>
                          {doctorAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} · {account.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Qualifications
                        <input value={doctorForm.qualifications} onChange={(event) => setDoctorForm({ ...doctorForm, qualifications: event.target.value })} />
                      </label>
                      <label>
                        Clinic
                        <input value={doctorForm.clinic} onChange={(event) => setDoctorForm({ ...doctorForm, clinic: event.target.value })} />
                      </label>
                      <label className="admin-form-full">
                        Appointment time slots
                        <input value={doctorForm.timeSlots} onChange={(event) => setDoctorForm({ ...doctorForm, timeSlots: event.target.value })} placeholder="09:00, 10:30, 13:00" />
                      </label>
                      <label className="admin-form-full">
                        Image URL
                        <input type="url" value={doctorForm.image} onChange={(event) => setDoctorForm({ ...doctorForm, image: event.target.value })} />
                      </label>
                      <label className="admin-form-full">
                        Biography
                        <textarea rows="3" value={doctorForm.biography} onChange={(event) => setDoctorForm({ ...doctorForm, biography: event.target.value })} />
                      </label>
                    </div>
                    <fieldset className="admin-working-days">
                      <legend>Working days</legend>
                      <div>
                        {weekDays.map((day) => (
                          <label key={day}>
                            <input
                              type="checkbox"
                              checked={doctorForm.workingDays.includes(day)}
                              onChange={() => toggleWorkingDay(day)}
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button className="button button-small" type="submit" disabled={isSavingDoctor}>
                      {isSavingDoctor ? "Saving…" : editingDoctorId ? "Save doctor" : "Add doctor"}
                    </button>
                  </form>
                )}

                <div className="admin-doctor-grid">
                  {doctors.map((doctor) => (
                    <article className={`admin-doctor-card${doctor.isActive ? "" : " is-inactive"}`} key={doctor.id}>
                      <div>
                        <span className={`appointment-status ${doctor.isActive ? "status-confirmed" : "status-cancelled"}`}>
                          {doctor.isActive ? doctor.availability : "Inactive"}
                        </span>
                        <h3>{doctor.name}</h3>
                        <p>{doctor.specialization} · {doctor.experienceYears} years</p>
                        <p>{doctor.linkedUserId ? "Linked doctor account" : "No linked doctor account"}</p>
                      </div>
                      <div className="admin-doctor-actions">
                        {doctor.isActive ? (
                          <>
                            <button className="button button-outline button-small" onClick={() => openEditDoctorForm(doctor)}>
                              Edit
                            </button>
                            {doctorToDeactivate === String(doctor.id) ? (
                              <>
                                <span>Deactivate this profile?</span>
                                <button
                                  className="text-button text-button-danger"
                                  disabled={doctorActionId === String(doctor.id)}
                                  onClick={() => deactivateDoctor(doctor)}
                                >
                                  Confirm
                                </button>
                                <button className="text-button" onClick={() => setDoctorToDeactivate("")}>Keep active</button>
                              </>
                            ) : (
                              <button className="text-button text-button-danger" onClick={() => setDoctorToDeactivate(String(doctor.id))}>
                                Deactivate
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            className="button button-outline button-small"
                            disabled={doctorActionId === String(doctor.id)}
                            onClick={() => reactivateDoctor(doctor)}
                          >
                            {doctorActionId === String(doctor.id) ? "Restoring…" : "Reactivate"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}

export default AdminDashboardPage;
