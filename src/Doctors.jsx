import { useMemo, useState } from "react";

function Doctors({
  doctors,
  isLoading,
  error,
  initialSpecialization = "",
  onBookAppointment,
}) {
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState(initialSpecialization);
  const [availability, setAvailability] = useState("");
  const [sort, setSort] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);

  const specializations = useMemo(
    () => [...new Set(doctors.map((doctor) => doctor.specialization))].sort(),
    [doctors]
  );

  const filteredDoctors = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return doctors
      .filter((doctor) => {
        const matchesSearch =
          !searchTerm ||
          doctor.name.toLowerCase().includes(searchTerm) ||
          doctor.specialization.toLowerCase().includes(searchTerm);
        const matchesSpecialization =
          !specialization || doctor.specialization === specialization;
        const matchesAvailability =
          !availability || doctor.availability === availability;
        return matchesSearch && matchesSpecialization && matchesAvailability;
      })
      .sort((first, second) => {
        if (sort === "experience") {
          return second.experienceYears - first.experienceYears;
        }
        return first.name.localeCompare(second.name);
      });
  }, [availability, doctors, search, sort, specialization]);

  return (
    <section className="doctors-page" id="doctors">
      <div className="doctors-heading">
        <span className="eyebrow">MEET YOUR CARE TEAM</span>
        <h2>Find a doctor who fits.</h2>
      </div>

      <p>Explore the available specialties and choose where you’d like to start.</p>

      <div className="doctor-filters">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search doctors"
            placeholder="Search by doctor or specialty"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span className="visually-hidden">Specialization</span>
          <select
            aria-label="Filter by specialization"
            value={specialization}
            onChange={(event) => setSpecialization(event.target.value)}
          >
            <option value="">All specialties</option>
            {specializations.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="visually-hidden">Availability</span>
          <select
            aria-label="Filter by availability"
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
          >
            <option value="">Any availability</option>
            <option value="Available">Available</option>
            <option value="Unavailable">Unavailable</option>
          </select>
        </label>
        <label>
          <span className="visually-hidden">Sort doctors</span>
          <select
            aria-label="Sort doctors"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="">Sort by name</option>
            <option value="experience">Most experience</option>
          </select>
        </label>
      </div>

      {isLoading && <p className="directory-message" role="status">Loading doctors…</p>}
      {error && <p className="directory-message form-error" role="alert">{error}</p>}
      {!isLoading && !error && doctors.length === 0 && (
        <p className="directory-message">No doctors are listed yet.</p>
      )}
      {!isLoading && !error && doctors.length > 0 && filteredDoctors.length === 0 && (
        <p className="directory-message">No doctors match those filters. Try another search.</p>
      )}

      <div className="doctor-container">
        {filteredDoctors.map((doctor) => (
          <article className="doctor-card" key={doctor.id}>
            <div className="doctor-card-top">
              <div className="doctor-image" aria-hidden="true">+</div>
              <span className={`availability-badge${doctor.availability === "Available" ? " is-available" : ""}`}>
                {doctor.availability}
              </span>
            </div>
            <h3>{doctor.name}</h3>
            <p className="doctor-specialization">{doctor.specialization}</p>
            <p className="doctor-experience">{doctor.experience}</p>
            {doctor.consultationFee !== null && (
              <p className="doctor-fee">Consultation · {doctor.consultationFee}</p>
            )}
            <div className="doctor-actions">
              <button
                className="doctor-profile-button"
                type="button"
                onClick={() => setSelectedProfile(doctor)}
              >
                View profile
              </button>
              <button
                className="doctor-book-button"
                type="button"
                disabled={doctor.availability !== "Available"}
                onClick={() => onBookAppointment(doctor)}
              >
                Book appointment
              </button>
            </div>
          </article>
        ))}
      </div>

      {selectedProfile && (
        <div
          className="doctor-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedProfile(null);
            }
          }}
        >
          <section
            className="doctor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="doctor-profile-title"
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close doctor profile"
              onClick={() => setSelectedProfile(null)}
            >
              ×
            </button>
            <span className="eyebrow">DOCTOR PROFILE</span>
            <h2 id="doctor-profile-title">{selectedProfile.name}</h2>
            <p className="doctor-specialization">{selectedProfile.specialization}</p>
            <div className="profile-details">
              <p><strong>Experience</strong><span>{selectedProfile.experience}</span></p>
              <p><strong>Availability</strong><span>{selectedProfile.availability}</span></p>
              {selectedProfile.qualifications && (
                <p><strong>Qualifications</strong><span>{selectedProfile.qualifications}</span></p>
              )}
              {selectedProfile.clinic && (
                <p><strong>Clinic</strong><span>{selectedProfile.clinic}</span></p>
              )}
              {selectedProfile.workingDays.length > 0 && (
                <p><strong>Working days</strong><span>{selectedProfile.workingDays.join(", ")}</span></p>
              )}
              {selectedProfile.timeSlots.length > 0 && (
                <p><strong>Available times</strong><span>{selectedProfile.timeSlots.join(", ")}</span></p>
              )}
            </div>
            {selectedProfile.biography && <p className="profile-biography">{selectedProfile.biography}</p>}
            <button
              className="button"
              type="button"
              disabled={selectedProfile.availability !== "Available"}
              onClick={() => {
                onBookAppointment(selectedProfile);
                setSelectedProfile(null);
              }}
            >
              Book an appointment <span aria-hidden="true">↗</span>
            </button>
          </section>
        </div>
      )}
    </section>
  );
}

export default Doctors;
