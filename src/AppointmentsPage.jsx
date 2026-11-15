import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useAuth } from "./context/useAuth";
import { apiRequest } from "./services/api";

function AppointmentCard({ appointment, doctor, token, onUpdate }) {
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [date, setDate] = useState(appointment.date);
  const [time, setTime] = useState(appointment.time);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const today = new Date();
  const minimumDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const canManage = ["Pending", "Confirmed"].includes(appointment.status);

  async function handleCancel() {
    setError("");
    setIsSaving(true);
    try {
      const updatedAppointment = await apiRequest(
        `/api/appointments/${appointment.id}/cancel`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      onUpdate(updatedAppointment);
    } catch (requestError) {
      setError(requestError.message || "Could not cancel this appointment.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReschedule(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const updatedAppointment = await apiRequest(
        `/api/appointments/${appointment.id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ date, time }),
        }
      );
      onUpdate(updatedAppointment);
      setIsRescheduling(false);
    } catch (requestError) {
      setError(requestError.message || "Could not reschedule this appointment.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="appointment-card">
      <div className="appointment-card-heading">
        <div>
          <span className="appointment-card-date">{appointment.date}</span>
          <h2>{appointment.doctor}</h2>
          <p>{appointment.specialization}</p>
        </div>
        <span className={`appointment-status status-${appointment.status.toLowerCase()}`}>
          {appointment.status}
        </span>
      </div>
      <div className="appointment-card-details">
        <span><strong>Time</strong>{appointment.time}</span>
        <span><strong>Patient</strong>{appointment.patientName}</span>
        {doctor && <span><strong>Clinic</strong>{doctor.clinic}</span>}
      </div>

      {canManage && (
        <div className="appointment-card-actions">
          <button
            type="button"
            className="button button-outline button-small"
            disabled={isSaving}
            onClick={() => {
              setError("");
              setIsRescheduling(!isRescheduling);
            }}
          >
            {isRescheduling ? "Close reschedule" : "Reschedule"}
          </button>
          <button
            type="button"
            className="text-button text-button-danger"
            disabled={isSaving}
            onClick={handleCancel}
          >
            {isSaving && !isRescheduling ? "Cancelling…" : "Cancel appointment"}
          </button>
        </div>
      )}

      {isRescheduling && canManage && (
        <form className="reschedule-form" onSubmit={handleReschedule}>
          <label>
            New date
            <input
              type="date"
              min={minimumDate}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label>
            Available time
            <select value={time} onChange={(event) => setTime(event.target.value)} required>
              <option value="">Choose a time</option>
              {(doctor?.timeSlots || []).map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </label>
          {doctor && (
            <p className="availability-note">
              Available days: {doctor.workingDays.join(", ")}
            </p>
          )}
          {error && <p className="form-message form-error" role="alert">{error}</p>}
          <button className="button button-small" type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save new time"}
          </button>
        </form>
      )}

      {!isRescheduling && error && <p className="form-message form-error" role="alert">{error}</p>}
    </article>
  );
}

function AppointmentsPage() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      apiRequest("/api/appointments", { headers }),
      apiRequest("/api/doctors"),
    ])
      .then(([records, doctorRecords]) => {
        if (isMounted) {
          setAppointments(records);
          setDoctors(doctorRecords);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message || "Could not load your appointments.");
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

  function updateAppointment(updatedAppointment) {
    setAppointments((records) =>
      records.map((appointment) =>
        appointment.id === updatedAppointment.id ? updatedAppointment : appointment
      )
    );
  }

  return (
    <>
      <Navbar />
      <main className="appointments-page">
        <div className="container">
          <div className="appointments-page-heading">
            <span className="eyebrow">YOUR CARE, IN ONE PLACE</span>
            <h1>My appointments</h1>
            <p>Review your bookings and update an appointment when plans change.</p>
          </div>

          {isLoading && <p className="directory-message" role="status">Loading your appointments…</p>}
          {error && <p className="directory-message form-error" role="alert">{error}</p>}
          {!isLoading && !error && appointments.length === 0 && (
            <div className="appointments-empty">
              <span className="empty-calendar" aria-hidden="true">▦</span>
              <h2>No appointments yet</h2>
              <p>When you book a visit, it will appear here.</p>
              <Link className="button" to="/#doctors">Find a doctor</Link>
            </div>
          )}

          {!isLoading && !error && appointments.length > 0 && (
            <div className="appointments-list">
              {appointments.map((appointment) => {
                const doctor = doctors.find(
                  (record) =>
                    record.id === appointment.doctorId ||
                    record.name === appointment.doctor
                );
                return (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    doctor={doctor}
                    token={token}
                    onUpdate={updateAppointment}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default AppointmentsPage;
