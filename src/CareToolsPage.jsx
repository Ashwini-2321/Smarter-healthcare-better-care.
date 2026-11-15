import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import { apiRequest } from "./services/api";

const doctorDirectorySpecialties = {
  Cardiology: "Cardiologist",
  Dermatology: "Dermatologist",
  Neurology: "Neurologist",
};

function localDateAfterDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function SymptomTool({ symptoms, error: serviceError }) {
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleSymptom(value) {
    setSelectedSymptoms((current) =>
      current.includes(value)
        ? current.filter((symptom) => symptom !== value)
        : [...current, value]
    );
  }

  async function submitSymptoms(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);
    try {
      const recommendation = await apiRequest("/api/ml/symptom-recommendation", {
        method: "POST",
        body: JSON.stringify({ symptoms: selectedSymptoms }),
      });
      setResult(recommendation);
    } catch (requestError) {
      setError(requestError.message || "Could not provide a specialty suggestion.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="care-tool-card" id="symptoms">
      <span className="eyebrow">01 / SPECIALTY SUGGESTION</span>
      <h2>Explore a specialty</h2>
      <p className="care-tool-intro">
        Choose general symptoms to see an educational starting point. This does not
        diagnose a condition.
      </p>
      {serviceError ? (
        <p className="form-message form-error" role="alert">{serviceError}</p>
      ) : (
        <form onSubmit={submitSymptoms}>
          <fieldset className="symptom-options">
            <legend>Select one or more symptoms</legend>
            <div>
              {symptoms.map((symptom) => (
                <label key={symptom.value}>
                  <input
                    type="checkbox"
                    checked={selectedSymptoms.includes(symptom.value)}
                    onChange={() => toggleSymptom(symptom.value)}
                  />
                  {symptom.label}
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="form-message form-error" role="alert">{error}</p>}
          <button
            className="button button-small"
            type="submit"
            disabled={isSubmitting || selectedSymptoms.length === 0 || selectedSymptoms.length > 8}
          >
            {isSubmitting ? "Checking…" : "Suggest a specialty"}
          </button>
        </form>
      )}
      {result && (
        <div className="care-tool-result" role="status">
          <span className="eyebrow">SUGGESTED STARTING POINT</span>
          <h3>{result.suggestedSpecialty}</h3>
          <p>{result.explanation}</p>
          <p className="care-tool-disclaimer">{result.disclaimer}</p>
          {result.urgentGuidance && (
            <p className="form-message form-error">{result.urgentGuidance}</p>
          )}
          <Link
            className="button button-small"
            to={`/?specialization=${encodeURIComponent(
              doctorDirectorySpecialties[result.suggestedSpecialty] ||
                result.suggestedSpecialty
            )}#doctors`}
          >
            Browse {result.suggestedSpecialty} doctors
          </Link>
        </div>
      )}
    </section>
  );
}

function DoctorRecommendationTool({ doctors, error: serviceError }) {
  const specializations = [...new Set(doctors.map((doctor) => doctor.specialization))].sort();
  const [preferences, setPreferences] = useState({
    specialization: "",
    availability: "Available",
    preferredTime: "",
    maxFee: "",
    minExperience: "",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updatePreference(field, value) {
    setPreferences((current) => ({ ...current, [field]: value }));
  }

  async function submitPreferences(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);
    const request = {
      specialization: preferences.specialization,
      availability: preferences.availability,
      preferredTime: preferences.preferredTime,
    };
    if (preferences.maxFee !== "") {
      request.maxFee = Number(preferences.maxFee);
    }
    if (preferences.minExperience !== "") {
      request.minExperience = Number(preferences.minExperience);
    }

    try {
      const recommendations = await apiRequest("/api/ml/doctor-recommendation", {
        method: "POST",
        body: JSON.stringify(request),
      });
      setResult(recommendations);
    } catch (requestError) {
      setError(requestError.message || "Could not recommend doctors.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="care-tool-card" id="doctor-recommendations">
      <span className="eyebrow">02 / PREFERENCE MATCH</span>
      <h2>Find a doctor to explore</h2>
      <p className="care-tool-intro">
        Recommendations use the current doctor directory and the preferences you
        choose. No ratings are added.
      </p>
      {serviceError ? (
        <p className="form-message form-error" role="alert">{serviceError}</p>
      ) : (
        <form className="care-tool-form" onSubmit={submitPreferences}>
          <label>
            Specialty
            <select
              value={preferences.specialization}
              onChange={(event) => updatePreference("specialization", event.target.value)}
            >
              <option value="">Any specialty</option>
              {specializations.map((specialization) => (
                <option key={specialization} value={specialization}>{specialization}</option>
              ))}
            </select>
          </label>
          <label>
            Availability
            <select
              value={preferences.availability}
              onChange={(event) => updatePreference("availability", event.target.value)}
            >
              <option value="Any">Any</option>
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
            </select>
          </label>
          <label>
            Preferred appointment time
            <input
              type="time"
              value={preferences.preferredTime}
              onChange={(event) => updatePreference("preferredTime", event.target.value)}
            />
          </label>
          <label>
            Maximum consultation fee (optional)
            <input
              type="number"
              min="0"
              value={preferences.maxFee}
              onChange={(event) => updatePreference("maxFee", event.target.value)}
            />
          </label>
          <label>
            Minimum experience in years (optional)
            <input
              type="number"
              min="0"
              value={preferences.minExperience}
              onChange={(event) => updatePreference("minExperience", event.target.value)}
            />
          </label>
          {error && <p className="form-message form-error" role="alert">{error}</p>}
          <button className="button button-small" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Finding matches…" : "Recommend doctors"}
          </button>
        </form>
      )}
      {result && (
        <div className="recommendation-results" role="status">
          {result.recommendations.length === 0 ? (
            <p className="dashboard-empty">There are no doctors to recommend right now.</p>
          ) : result.recommendations.map((doctor) => (
            <article key={doctor.id}>
              <div>
                <span className="availability-badge">{doctor.availability}</span>
                <h3>{doctor.name}</h3>
                <p>{doctor.specialization} · {doctor.experienceYears} years experience</p>
                <p>{doctor.consultationFee === null
                  ? "Consultation fee not configured"
                  : `Consultation fee: ${doctor.consultationFee}`}
                </p>
                <small>{doctor.explanation}</small>
              </div>
              <Link
                className="text-link"
                to={`/?specialization=${encodeURIComponent(doctor.specialization)}#doctors`}
              >
                Browse specialty
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function NoShowTool() {
  const [form, setForm] = useState({
    appointmentDate: localDateAfterDays(1),
    appointmentTime: "10:30",
    bookingLeadDays: "1",
    reminderSent: false,
    previousAttendance: "unknown",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const minimumDate = localDateAfterDays(0);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitPrediction(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);
    try {
      const prediction = await apiRequest("/api/ml/no-show-prediction", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          bookingLeadDays: Number(form.bookingLeadDays),
        }),
      });
      setResult(prediction);
    } catch (requestError) {
      setError(requestError.message || "Could not estimate appointment risk.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="care-tool-card no-show-tool" id="no-show-estimate">
      <span className="eyebrow">03 / APPOINTMENT ESTIMATE</span>
      <h2>Explore a reminder estimate</h2>
      <p className="care-tool-intro">
        Try a synthetic-data demonstration using appointment timing. Your answers
        are not saved and this estimate cannot affect access to care.
      </p>
      <form className="care-tool-form" onSubmit={submitPrediction}>
        <label>
          Appointment date
          <input
            type="date"
            min={minimumDate}
            value={form.appointmentDate}
            onChange={(event) => updateField("appointmentDate", event.target.value)}
            required
          />
        </label>
        <label>
          Appointment time
          <input
            type="time"
            value={form.appointmentTime}
            onChange={(event) => updateField("appointmentTime", event.target.value)}
            required
          />
        </label>
        <label>
          Days between booking and appointment
          <input
            type="number"
            min="0"
            max="365"
            value={form.bookingLeadDays}
            onChange={(event) => updateField("bookingLeadDays", event.target.value)}
            required
          />
        </label>
        <label>
          Reminder already set?
          <select
            value={String(form.reminderSent)}
            onChange={(event) => updateField("reminderSent", event.target.value === "true")}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>
        <label>
          Previous appointment attendance (optional)
          <select
            value={form.previousAttendance}
            onChange={(event) => updateField("previousAttendance", event.target.value)}
          >
            <option value="unknown">Prefer not to use this</option>
            <option value="attended">Previously attended</option>
            <option value="missed">Previously missed</option>
          </select>
        </label>
        {error && <p className="form-message form-error" role="alert">{error}</p>}
        <button className="button button-small" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Estimating…" : "Show reminder estimate"}
        </button>
      </form>
      {result && (
        <div className="care-tool-result" role="status">
          <span className="eyebrow">ESTIMATED DEMONSTRATION RISK</span>
          <h3>{result.estimatedRisk} · {Math.round(result.estimatedProbability * 100)}%</h3>
          <p>{result.explanation}</p>
          <ul>
            {result.suggestedReminderActions.map((action) => <li key={action}>{action}</li>)}
          </ul>
          <p className="care-tool-disclaimer">{result.disclaimer}</p>
        </div>
      )}
    </section>
  );
}

function CareToolsPage() {
  const [symptoms, setSymptoms] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([apiRequest("/api/ml/symptoms"), apiRequest("/api/doctors")])
      .then(([symptomResponse, doctorRecords]) => {
        if (isMounted) {
          setSymptoms(symptomResponse.symptoms);
          setDoctors(doctorRecords);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message || "Could not load the care tools.");
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
  }, []);

  return (
    <>
      <Navbar />
      <main className="care-tools-page">
        <div className="container">
          <header className="care-tools-heading">
            <span className="eyebrow">CLINEXA CARE TOOLS</span>
            <h1>Helpful starting points.<br />Human care.</h1>
            <p>
              These educational demonstrations can help you explore care options.
              They are not medical advice or a substitute for a qualified professional.
            </p>
            <p className="care-tool-emergency">
              For urgent symptoms or an emergency, contact local emergency services
              or seek immediate medical care.
            </p>
          </header>
          {isLoading ? (
            <p className="directory-message" role="status">Loading care tools…</p>
          ) : error ? (
            <p className="form-message form-error" role="alert">{error}</p>
          ) : (
            <div className="care-tools-grid">
              <SymptomTool symptoms={symptoms} />
              <DoctorRecommendationTool doctors={doctors} />
              <NoShowTool />
            </div>
          )}
          <Link className="auth-home-link" to="/">← Back to Clinexa</Link>
        </div>
      </main>
    </>
  );
}

export default CareToolsPage;
