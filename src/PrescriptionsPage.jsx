import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import { useAuth } from "./context/useAuth";
import { apiRequest } from "./services/api";

function PrescriptionCard({ prescription }) {
  return (
    <article className="prescription-card">
      <header className="prescription-card-heading">
        <div>
          <span className="eyebrow">PRESCRIPTION {prescription.prescriptionId}</span>
          <h2>{prescription.patientName}</h2>
        </div>
        <time dateTime={prescription.date}>
          {new Date(prescription.date).toLocaleDateString()}
        </time>
      </header>
      <div className="prescription-meta">
        <span><strong>Clinician</strong>{prescription.doctorName}</span>
        <span><strong>Appointment</strong>{prescription.appointmentDate}</span>
      </div>
      {prescription.notes && (
        <section>
          <h3>Clinician notes</h3>
          <p>{prescription.notes}</p>
        </section>
      )}
      {prescription.medicines.length > 0 && (
        <section>
          <h3>Clinician-entered medicines</h3>
          <ul className="prescription-medicines">
            {prescription.medicines.map((medicine, index) => (
              <li key={`${medicine.name}-${index}`}>
                <strong>{medicine.name}</strong> · {medicine.dosage}
                {medicine.instructions && <p>{medicine.instructions}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {prescription.instructions && (
        <section>
          <h3>Instructions</h3>
          <p>{prescription.instructions}</p>
        </section>
      )}
      {prescription.followUp && (
        <section>
          <h3>Follow-up</h3>
          <p>{prescription.followUp}</p>
        </section>
      )}
      <p className="prescription-safety-note">
        This prescription was entered by your clinician. Clinexa does not generate
        medicines or treatment instructions.
      </p>
      <div className="prescription-actions">
        <button className="button button-outline button-small" onClick={() => window.print()}>
          Print prescription
        </button>
      </div>
    </article>
  );
}

function PrescriptionsPage() {
  const { token, user } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [appointmentId, setAppointmentId] = useState("");
  const [notes, setNotes] = useState("");
  const [instructions, setInstructions] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [medicines, setMedicines] = useState([{ name: "", dosage: "", instructions: "" }]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    const headers = { Authorization: `Bearer ${token}` };
    const requests = [apiRequest("/api/prescriptions", { headers })];
    if (user.role === "doctor") {
      requests.push(apiRequest("/api/appointments", { headers }));
    }

    Promise.all(requests)
      .then(([prescriptionRecords, appointmentRecords = []]) => {
        if (isMounted) {
          setPrescriptions(prescriptionRecords);
          setAppointments(appointmentRecords);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message || "Could not load prescriptions.");
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
  }, [token, user.role]);

  const existingAppointmentIds = new Set(
    prescriptions.map((prescription) => prescription.appointmentId)
  );
  const eligibleAppointments = appointments.filter(
    (appointment) =>
      appointment.status !== "Cancelled" &&
      !existingAppointmentIds.has(String(appointment.id))
  );

  function updateMedicine(index, field, value) {
    setMedicines((current) =>
      current.map((medicine, medicineIndex) =>
        medicineIndex === index ? { ...medicine, [field]: value } : medicine
      )
    );
  }

  async function createPrescription(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);
    const cleanedMedicines = medicines.filter(
      (medicine) => medicine.name.trim() || medicine.dosage.trim()
    );

    try {
      const prescription = await apiRequest("/api/prescriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          appointmentId,
          notes,
          instructions,
          followUp,
          medicines: cleanedMedicines,
        }),
      });
      setPrescriptions((current) => [prescription, ...current]);
      setAppointmentId("");
      setNotes("");
      setInstructions("");
      setFollowUp("");
      setMedicines([{ name: "", dosage: "", instructions: "" }]);
      setMessage("The prescription was saved and the patient was notified.");
    } catch (requestError) {
      setError(requestError.message || "Could not save this prescription.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="prescriptions-page">
        <div className="container">
          <header className="prescriptions-page-heading">
            <span className="eyebrow">CARE, DOCUMENTED</span>
            <h1>Prescriptions</h1>
            <p>
              {user.role === "doctor"
                ? "Create and review clinician-entered prescriptions for your appointments."
                : "View prescriptions shared with your patient account."}
            </p>
            <Link to="/notifications">View notifications</Link>
          </header>

          {error && <p className="form-message form-error" role="alert">{error}</p>}
          {message && <p className="form-message form-success" role="status">{message}</p>}
          {user.role === "doctor" && (
            <section className="prescription-form-panel">
              <div className="dashboard-panel-heading">
                <h2>Create a prescription</h2>
              </div>
              <p className="prescription-safety-note">
                Enter all notes, medicines, and instructions yourself. Clinexa does not
                generate or recommend treatment.
              </p>
              <form className="dashboard-form" onSubmit={createPrescription}>
                <label>
                  Patient appointment
                  <select
                    value={appointmentId}
                    onChange={(event) => setAppointmentId(event.target.value)}
                    required
                  >
                    <option value="">Choose an appointment</option>
                    {eligibleAppointments.map((appointment) => (
                      <option key={appointment.id} value={appointment.id}>
                        {appointment.patientName} · {appointment.date} at {appointment.time}
                      </option>
                    ))}
                  </select>
                </label>
                {eligibleAppointments.length === 0 && (
                  <p className="dashboard-empty">
                    No eligible appointments are available for a new prescription.
                  </p>
                )}
                <label>
                  Clinician notes
                  <textarea rows="3" maxLength="2000" value={notes} onChange={(event) => setNotes(event.target.value)} />
                </label>
                <fieldset className="prescription-medicine-fields">
                  <legend>Medicines and dosage (entered by clinician)</legend>
                  {medicines.map((medicine, index) => (
                    <div className="prescription-medicine-row" key={index}>
                      <label>
                        Medicine name
                        <input
                          maxLength="120"
                          value={medicine.name}
                          onChange={(event) => updateMedicine(index, "name", event.target.value)}
                        />
                      </label>
                      <label>
                        Dosage
                        <input
                          maxLength="120"
                          value={medicine.dosage}
                          onChange={(event) => updateMedicine(index, "dosage", event.target.value)}
                        />
                      </label>
                      <label>
                        Instructions
                        <input
                          maxLength="500"
                          value={medicine.instructions}
                          onChange={(event) => updateMedicine(index, "instructions", event.target.value)}
                        />
                      </label>
                      {medicines.length > 1 && (
                        <button
                          type="button"
                          className="text-button text-button-danger"
                          onClick={() => setMedicines((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          Remove medicine
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="button button-outline button-small"
                    disabled={medicines.length >= 20}
                    onClick={() => setMedicines((current) => [...current, { name: "", dosage: "", instructions: "" }])}
                  >
                    Add medicine
                  </button>
                </fieldset>
                <label>
                  Additional instructions
                  <textarea rows="3" maxLength="2000" value={instructions} onChange={(event) => setInstructions(event.target.value)} />
                </label>
                <label>
                  Follow-up
                  <input maxLength="500" value={followUp} onChange={(event) => setFollowUp(event.target.value)} />
                </label>
                <button className="button button-small" type="submit" disabled={isSaving || !eligibleAppointments.length}>
                  {isSaving ? "Saving…" : "Save prescription"}
                </button>
              </form>
            </section>
          )}

          <section className="prescriptions-list" aria-live="polite">
            <div className="dashboard-panel-heading">
              <h2>{user.role === "doctor" ? "Your prescription history" : "Your prescriptions"}</h2>
            </div>
            {isLoading && <p className="directory-message" role="status">Loading prescriptions…</p>}
            {!isLoading && prescriptions.length === 0 && !error && (
              <p className="dashboard-empty">Prescriptions shared with this account will appear here.</p>
            )}
            {prescriptions.map((prescription) => (
              <PrescriptionCard key={prescription.id} prescription={prescription} />
            ))}
          </section>
        </div>
      </main>
    </>
  );
}

export default PrescriptionsPage;
