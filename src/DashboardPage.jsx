import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useAuth } from "./context/useAuth";
import { apiRequest } from "./services/api";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDoctorProfileForm(doctor) {
  return {
    name: doctor.name,
    specialization: doctor.specialization,
    qualifications: doctor.qualifications,
    experience: doctor.experienceYears,
    consultationFee: doctor.consultationFee || 0,
    availability: doctor.availability,
    workingDays: doctor.workingDays,
    timeSlots: doctor.timeSlots.join(", "),
    clinic: doctor.clinic,
    biography: doctor.biography,
  };
}

function AppointmentList({ title, appointments, emptyMessage }) {
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <h2>{title}</h2>
        {title === "Upcoming appointments" && (
          <Link to="/appointments">Manage appointments</Link>
        )}
      </div>
      {appointments.length === 0 ? (
        <p className="dashboard-empty">{emptyMessage}</p>
      ) : (
        <div className="dashboard-appointment-list">
          {appointments.map((appointment) => (
            <article className="dashboard-appointment" key={appointment.id}>
              <div>
                <span className="dashboard-appointment-date">
                  {appointment.date} · {appointment.time}
                </span>
                <h3>{appointment.doctor}</h3>
                <p>{appointment.specialization}</p>
              </div>
              <span className={`appointment-status status-${appointment.status.toLowerCase()}`}>
                {appointment.status}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PatientDashboard({ user, token, updateProfile }) {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({});
  const [profileMessage, setProfileMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    apiRequest("/api/dashboard/patient", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((result) => {
        if (isMounted) {
          setDashboard(result);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message || "Could not load your dashboard.");
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

  async function saveProfile(event) {
    event.preventDefault();
    setProfileMessage("");
    setError("");
    setIsSaving(true);
    try {
      const updatedUser = await updateProfile({
        name: profile.name ?? user.name,
        email: profile.email ?? user.email,
        phone: profile.phone ?? user.phone ?? "",
        profile: profile.profile ?? user.profile ?? "",
      });
      setProfile({
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone || "",
        profile: updatedUser.profile || "",
      });
      setProfileMessage("Your profile has been updated.");
    } catch (requestError) {
      setError(requestError.message || "Could not update your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  const summary = dashboard?.summary;

  return (
    <main className="dashboard-page">
      <div className="container">
        <header className="dashboard-heading">
          <span className="eyebrow">YOUR CARE, IN ONE PLACE</span>
          <h1>Welcome, {user.name.split(" ")[0]}.</h1>
          <p>Keep track of appointments and your Clinexa profile.</p>
          <div className="dashboard-heading-actions">
            <Link className="button" to="/#doctors">Find a doctor</Link>
            <Link className="button button-outline" to="/appointments">My appointments</Link>
          </div>
        </header>

        {error && <p className="form-message form-error" role="alert">{error}</p>}
        {isLoading ? (
          <p className="directory-message" role="status">Loading your dashboard…</p>
        ) : dashboard && (
          <>
            <section className="dashboard-stats" aria-label="Appointment overview">
              <article><span>Total appointments</span><strong>{summary.total}</strong></article>
              <article><span>Upcoming</span><strong>{summary.upcoming}</strong></article>
              <article><span>Completed</span><strong>{summary.completed}</strong></article>
              <article><span>Cancelled</span><strong>{summary.cancelled}</strong></article>
            </section>

            <div className="dashboard-content-grid">
              <AppointmentList
                title="Upcoming appointments"
                appointments={dashboard.upcomingAppointments}
                emptyMessage="No upcoming appointments. Find a doctor when you are ready."
              />

              <section className="dashboard-panel">
                <div className="dashboard-panel-heading">
                  <h2>My profile</h2>
                </div>
                <form className="dashboard-form" onSubmit={saveProfile}>
                  <label>
                    Name
                    <input
                      value={profile.name ?? user.name}
                      onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={profile.email ?? user.email}
                      onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      type="tel"
                      value={profile.phone ?? user.phone ?? ""}
                      onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                    />
                  </label>
                  <label>
                    Profile information
                    <textarea
                      rows="3"
                      value={profile.profile ?? user.profile ?? ""}
                      onChange={(event) => setProfile({ ...profile, profile: event.target.value })}
                      placeholder="Optional information for your account"
                    />
                  </label>
                  {profileMessage && (
                    <p className="form-message form-success" role="status">{profileMessage}</p>
                  )}
                  <button className="button button-small" type="submit" disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save profile"}
                  </button>
                </form>
              </section>
            </div>
            <div className="dashboard-heading-actions">
              <Link className="button button-outline" to="/prescriptions">My prescriptions</Link>
              <Link className="button button-outline" to="/notifications">Notifications</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function DoctorDashboard({ user, token }) {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [appointmentStatusError, setAppointmentStatusError] = useState("");

  useEffect(() => {
    let isMounted = true;
    apiRequest("/api/dashboard/doctor", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((result) => {
        if (isMounted) {
          setDashboard(result);
          setProfile(getDoctorProfileForm(result.doctor));
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message || "Could not load your doctor dashboard.");
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

  function updateProfileField(field, value) {
    setProfile((currentProfile) => ({ ...currentProfile, [field]: value }));
  }

  async function saveDoctorProfile(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);
    const updates = {
      ...profile,
      experience: Number(profile.experience),
      consultationFee: Number(profile.consultationFee),
      timeSlots: profile.timeSlots
        .split(",")
        .map((time) => time.trim())
        .filter(Boolean),
    };

    try {
      const updatedDoctor = await apiRequest("/api/dashboard/doctor/profile", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      setDashboard((currentDashboard) => ({
        ...currentDashboard,
        doctor: updatedDoctor,
      }));
      setProfile(getDoctorProfileForm(updatedDoctor));
      setMessage("Your professional profile and availability are saved.");
    } catch (requestError) {
      setError(requestError.message || "Could not update your doctor profile.");
    } finally {
      setIsSaving(false);
    }
  }

  function toggleWorkingDay(day) {
    const workingDays = profile.workingDays.includes(day)
      ? profile.workingDays.filter((currentDay) => currentDay !== day)
      : [...profile.workingDays, day];
    updateProfileField("workingDays", workingDays);
  }

  async function changeAppointmentStatus(appointment, status) {
    setAppointmentStatusError("");
    try {
      await apiRequest(`/api/appointments/${appointment.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const refreshedDashboard = await apiRequest("/api/dashboard/doctor", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDashboard(refreshedDashboard);
    } catch (requestError) {
      setAppointmentStatusError(
        requestError.message || "Could not update this appointment."
      );
    }
  }

  return (
    <main className="dashboard-page">
      <div className="container">
        <header className="dashboard-heading">
          <span className="eyebrow">DOCTOR WORKSPACE</span>
          <h1>Welcome, Dr. {user.name.split(" ").slice(-1)[0]}.</h1>
          <p>Review your schedule and keep your professional information current.</p>
          <div className="dashboard-heading-actions">
            <Link className="button button-outline" to="/prescriptions">Prescriptions</Link>
            <Link className="button button-outline" to="/notifications">Notifications</Link>
          </div>
        </header>

        {error && <p className="form-message form-error" role="alert">{error}</p>}
        {isLoading ? (
          <p className="directory-message" role="status">Loading your doctor dashboard…</p>
        ) : dashboard?.doctor ? (
          <>
            <section className="dashboard-stats" aria-label="Doctor appointment overview">
              <article><span>Today's appointments</span><strong>{dashboard.summary.today}</strong></article>
              <article><span>Upcoming</span><strong>{dashboard.summary.upcoming}</strong></article>
              <article><span>Completed</span><strong>{dashboard.summary.completed}</strong></article>
              <article><span>All appointments</span><strong>{dashboard.summary.total}</strong></article>
            </section>

            <div className="dashboard-content-grid">
              <div className="dashboard-appointment-sections">
                {appointmentStatusError && (
                  <p className="form-message form-error" role="alert">
                    {appointmentStatusError}
                  </p>
                )}
                <DoctorAppointmentList
                  title="Today's appointments"
                  appointments={dashboard.todayAppointments}
                  emptyMessage="You have no appointments scheduled for today."
                  onStatusChange={changeAppointmentStatus}
                />
                <DoctorAppointmentList
                  title="Upcoming appointments"
                  appointments={dashboard.upcomingAppointments}
                  emptyMessage="There are no upcoming appointments."
                  onStatusChange={changeAppointmentStatus}
                />
                <DoctorAppointmentList
                  title="Appointment history"
                  appointments={dashboard.appointmentHistory}
                  emptyMessage="Your completed and past appointments will appear here."
                />
              </div>

              {profile && (
                <section className="dashboard-panel">
                  <div className="dashboard-panel-heading"><h2>Profile & availability</h2></div>
                  <form className="dashboard-form" onSubmit={saveDoctorProfile}>
                    <label>
                      Name
                      <input value={profile.name} onChange={(event) => updateProfileField("name", event.target.value)} required />
                    </label>
                    <label>
                      Specialization
                      <input value={profile.specialization} onChange={(event) => updateProfileField("specialization", event.target.value)} required />
                    </label>
                    <label>
                      Qualifications
                      <input value={profile.qualifications} onChange={(event) => updateProfileField("qualifications", event.target.value)} />
                    </label>
                    <div className="dashboard-form-row">
                      <label>
                        Experience (years)
                        <input type="number" min="0" value={profile.experience} onChange={(event) => updateProfileField("experience", event.target.value)} required />
                      </label>
                      <label>
                        Consultation fee
                        <input type="number" min="0" value={profile.consultationFee} onChange={(event) => updateProfileField("consultationFee", event.target.value)} />
                      </label>
                    </div>
                    <label>
                      Clinic
                      <input value={profile.clinic} onChange={(event) => updateProfileField("clinic", event.target.value)} />
                    </label>
                    <label>
                      Availability
                      <select value={profile.availability} onChange={(event) => updateProfileField("availability", event.target.value)}>
                        <option>Available</option>
                        <option>Unavailable</option>
                      </select>
                    </label>
                    <fieldset className="working-days-field">
                      <legend>Working days</legend>
                      <div>
                        {weekDays.map((day) => (
                          <label key={day}>
                            <input
                              type="checkbox"
                              checked={profile.workingDays.includes(day)}
                              onChange={() => toggleWorkingDay(day)}
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label>
                      Appointment time slots
                      <input
                        value={profile.timeSlots}
                        onChange={(event) => updateProfileField("timeSlots", event.target.value)}
                        placeholder="09:00, 10:30, 13:00"
                      />
                    </label>
                    <label>
                      Professional biography
                      <textarea rows="4" value={profile.biography} onChange={(event) => updateProfileField("biography", event.target.value)} />
                    </label>
                    {message && <p className="form-message form-success" role="status">{message}</p>}
                    <button className="button button-small" type="submit" disabled={isSaving}>
                      {isSaving ? "Saving…" : "Save profile & availability"}
                    </button>
                  </form>
                </section>
              )}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

function DoctorAppointmentList({ title, appointments, emptyMessage, onStatusChange }) {
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading"><h2>{title}</h2></div>
      {appointments.length === 0 ? (
        <p className="dashboard-empty">{emptyMessage}</p>
      ) : (
        <div className="dashboard-appointment-list">
          {appointments.map((appointment) => (
            <article className="dashboard-appointment" key={appointment.id}>
              <div>
                <span className="dashboard-appointment-date">
                  {appointment.date} · {appointment.time}
                </span>
                <h3>{appointment.patientName}</h3>
                <p>{appointment.specialization}</p>
              </div>
              <span className={`appointment-status status-${appointment.status.toLowerCase()}`}>
                {appointment.status}
              </span>
              {onStatusChange && appointment.status === "Pending" && (
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => onStatusChange(appointment, "Confirmed")}
                >
                  Confirm appointment
                </button>
              )}
              {onStatusChange && appointment.status === "Confirmed" && (
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => onStatusChange(appointment, "Completed")}
                >
                  Mark completed
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardPage() {
  const { user, token, updateProfile } = useAuth();

  return (
    <>
      <Navbar />
      {user.role === "doctor" ? (
        <DoctorDashboard user={user} token={token} />
      ) : (
        <PatientDashboard user={user} token={token} updateProfile={updateProfile} />
      )}
    </>
  );
}

export default DashboardPage;
