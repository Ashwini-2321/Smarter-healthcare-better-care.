import { useState } from "react";
import { apiRequest } from "./services/api";
import { useAuth } from "./context/useAuth";

function Appointment({ selectedDoctor, onDoctorChange, doctors }) {
  const { token, user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date();
  const minimumDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const chosenDoctor = doctors.find(
    (doctor) => String(doctor.id) === String(selectedDoctor)
  );
  const availableTimes = chosenDoctor?.timeSlots || [];
  const selectedTime = availableTimes.includes(time) ? time : "";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setConfirmation(null);
    setIsSubmitting(true);

    if (!chosenDoctor) {
      setError("Choose an available doctor to continue.");
      setIsSubmitting(false);
      return;
    }

    const appointmentData = {
      patientName: name,
      doctor: chosenDoctor.name,
      doctorId: chosenDoctor.id,
      date,
      time: selectedTime,
    };

    try {
      const data = await apiRequest("/api/appointments", {
        method: "POST",
        body: JSON.stringify(appointmentData),
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      setConfirmation(data.appointment);
      setName(user?.name || "");
      onDoctorChange("");
      setDate("");
      setTime("");
    } catch (requestError) {
      setError(requestError.message || "We couldn't book your appointment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="appointment-section" id="appointment">
      <div className="appointment-heading">
        <span className="eyebrow">A SIMPLE NEXT STEP</span>
        <h2>Book an appointment.</h2>
      </div>

      <p>Fill in the details to book your appointment.</p>

      <form className="appointment-form" onSubmit={handleSubmit}>
        <label htmlFor="patient-name">Patient name</label>
        <input
          id="patient-name"
          type="text"
          autoComplete="name"
          placeholder="Enter your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          readOnly={Boolean(user)}
          required
        />

        <label htmlFor="appointment-doctor">Select doctor</label>
        <select
          id="appointment-doctor"
          value={selectedDoctor}
          onChange={(event) => onDoctorChange(event.target.value)}
          required
        >
          <option value="">Choose a doctor</option>
          {doctors
            .filter((doctor) => doctor.availability === "Available")
            .map((doctor) => (
              <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
            ))}
        </select>

        <label htmlFor="appointment-date">Appointment date</label>
        <input
          id="appointment-date"
          type="date"
          min={minimumDate}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />

        <label htmlFor="appointment-time">Available time</label>
        <select
          id="appointment-time"
          value={selectedTime}
          onChange={(event) => setTime(event.target.value)}
          disabled={!chosenDoctor}
          required
        >
          <option value="">
            {chosenDoctor ? "Choose an available time" : "Choose a doctor first"}
          </option>
          {availableTimes.map((slot) => (
            <option key={slot} value={slot}>{slot}</option>
          ))}
        </select>

        {chosenDoctor && (
          <p className="availability-note">
            Available days: {chosenDoctor.workingDays.join(", ")}
          </p>
        )}

        {error && <p className="form-message form-error" role="alert">{error}</p>}
        {confirmation && (
          <p className="form-message form-success" role="status">
            Appointment requested for {confirmation.patientName} with {confirmation.doctor}
            {" "}on {confirmation.date} at {confirmation.time}.
            {!user && " Sign in to manage appointments in your account."}
          </p>
        )}

        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Booking..." : "Book appointment"}
          {!isSubmitting && <span aria-hidden="true">↗</span>}
        </button>
      </form>
    </section>
  );
}

export default Appointment;