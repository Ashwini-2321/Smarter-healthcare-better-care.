import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import Appointment from "./Appointment";
import Doctors from "./Doctors";
import { useAuth } from "./context/useAuth";
import { apiRequest } from "./services/api";
import Navbar from "./components/Navbar";
import AppointmentsPage from "./AppointmentsPage";
import DashboardPage from "./DashboardPage";
import CareToolsPage from "./CareToolsPage";
import PrescriptionsPage from "./PrescriptionsPage";
import NotificationsPage from "./NotificationsPage";
import AdminDashboardPage from "./AdminDashboardPage";

const services = [
  {
    number: "01",
    title: "Doctor discovery",
    description: "Explore care professionals by specialty and find the right next step.",
  },
  {
    number: "02",
    title: "Simple booking",
    description: "Request an appointment in a few clear steps, all in one place.",
  },
  {
    number: "03",
    title: "Care, connected",
    description: "Keep appointments and future care tools together in your Clinexa account.",
  },
];

const aiFeatures = [
  {
    label: "01 / SYMPTOMS",
    title: "Explore a specialty",
    description: "Select general symptoms to explore an educational specialty suggestion.",
    target: "symptoms",
  },
  {
    label: "02 / PREFERENCES",
    title: "Find a doctor to explore",
    description: "Rank doctors using specialty, availability, time, fee, and experience preferences.",
    target: "doctor-recommendations",
  },
  {
    label: "03 / REMINDERS",
    title: "Plan helpful reminders",
    description: "Explore an unvalidated, synthetic-data estimate with practical reminder ideas.",
    target: "no-show-estimate",
  },
];

function ScrollToHash() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const target = document.querySelector(hash);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hash, pathname]);

  return null;
}

function HomePage() {
  const [searchParams] = useSearchParams();
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState("");

  useEffect(() => {
    let isMounted = true;

    apiRequest("/api/doctors")
      .then((records) => {
        if (isMounted) {
          setDoctors(records);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setDoctorsError(requestError.message || "Could not load doctors.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setDoctorsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function handleBookAppointment(doctor) {
    setSelectedDoctor(String(doctor.id));
    document.getElementById("appointment")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <>
      <Navbar />
      <main>
        <section className="hero-section">
          <div className="hero-grid container">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-dot" /> CARE THAT MOVES WITH YOU</span>
              <h1>Smarter healthcare,<br /><span>better care.</span></h1>
              <p>
                Find a doctor, book an appointment, and keep your next step in care
                simple with Clinexa.
              </p>
              <div className="hero-actions">
                <Link className="button" to="/#appointment">
                  Book an appointment <span aria-hidden="true">↗</span>
                </Link>
                <Link className="button button-outline" to="/#doctors">
                  Explore doctors
                </Link>
              </div>
              <div className="hero-note">
                <span className="note-icon" aria-hidden="true">i</span>
                <span>Simple tools to help you connect with healthcare professionals.</span>
              </div>
            </div>

            <div className="hero-art" aria-label="Clinexa care overview">
              <div className="art-orbit orbit-one" />
              <div className="art-orbit orbit-two" />
              <div className="care-card care-card-main">
                <div className="care-card-top">
                  <span className="care-icon" aria-hidden="true">+</span>
                  <span className="live-indicator">YOUR CARE, IN ONE PLACE</span>
                </div>
                <h2>Make time for<br />what matters.</h2>
                <p>Find care that fits your day.</p>
                <div className="care-card-bottom">
                  <span className="care-avatar">C</span>
                  <span>Start with a doctor</span>
                  <span className="arrow-circle" aria-hidden="true">↗</span>
                </div>
              </div>
              <div className="floating-card floating-card-top">
                <span className="floating-check" aria-hidden="true">✓</span>
                <span><strong>Easy to book</strong><small>Appointments made simple</small></span>
              </div>
              <div className="floating-card floating-card-bottom">
                <span className="floating-calendar" aria-hidden="true">▦</span>
                <span><strong>Care, connected</strong><small>Keep your next step close</small></span>
              </div>
              <span className="art-spark spark-one" aria-hidden="true">✳</span>
              <span className="art-spark spark-two" aria-hidden="true">✦</span>
            </div>
          </div>
          <div className="hero-bottom container">
            <span>YOUR HEALTH JOURNEY, MADE CLEARER</span>
            <div className="hero-proof">
              <span><b>01</b> Find your doctor</span>
              <span><b>02</b> Choose a time</span>
              <span><b>03</b> Feel prepared</span>
            </div>
          </div>
        </section>

        <section className="intro-section section-space" id="about">
          <div className="container intro-grid">
            <div>
              <span className="eyebrow">ABOUT CLINEXA</span>
              <h2 className="section-title">A little more clarity<br />in your care journey.</h2>
            </div>
            <div className="intro-copy">
              <p>
                Healthcare can feel complicated. Clinexa brings doctor discovery
                and appointment booking together in a calmer, more approachable
                experience.
              </p>
              <Link className="text-link" to="/#services">
                See how it works <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="services-section section-space" id="services">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CARE, WITHOUT THE CLUTTER</span>
                <h2 className="section-title">Everything starts<br />with a simple step.</h2>
              </div>
              <p>Tools designed to make finding and arranging care feel more manageable.</p>
            </div>
            <div className="service-grid">
              {services.map((service) => (
                <article className="service-card" key={service.number}>
                  <span className="service-number">{service.number}</span>
                  <div className="service-card-icon" aria-hidden="true">
                    {service.number === "01" ? "⌕" : service.number === "02" ? "▦" : "↗"}
                  </div>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <Doctors
          doctors={doctors}
          isLoading={doctorsLoading}
          error={doctorsError}
          initialSpecialization={searchParams.get("specialization") || ""}
          onBookAppointment={handleBookAppointment}
        />
        <Appointment
          selectedDoctor={selectedDoctor}
          onDoctorChange={setSelectedDoctor}
          doctors={doctors}
        />

        <section className="ai-section section-space" id="ai-features">
          <div className="container">
            <div className="ai-heading">
              <div>
                <span className="eyebrow eyebrow-light">A MORE THOUGHTFUL NEXT STEP</span>
                <h2 className="section-title">Helpful ideas.<br />Human care.</h2>
              </div>
              <p>
                Explore educational demonstrations designed to help you browse care
                options. They are not medical advice or a substitute for a qualified
                healthcare professional.
              </p>
            </div>
            <div className="ai-card-grid">
              {aiFeatures.map((feature) => (
                <article className="ai-card" key={feature.label}>
                  <span>{feature.label}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <Link to={`/care-tools#${feature.target}`}>Explore tool <span aria-hidden="true">↗</span></Link>
                </article>
              ))}
            </div>
            <p className="ai-disclaimer">
              Clinexa does not diagnose conditions or recommend treatment. For urgent
              or emergency concerns, contact local emergency services or a qualified
              healthcare professional.
            </p>
          </div>
        </section>

        <section className="contact-section section-space" id="contact">
          <div className="container contact-panel">
            <div>
              <span className="eyebrow">HERE WHEN YOU NEED US</span>
              <h2 className="section-title">Let’s make your<br />next step easier.</h2>
            </div>
            <div className="contact-copy">
              <p>Questions about using Clinexa? Our team is here to help you find your way.</p>
              <a className="text-link" href="mailto:hello@clinexa.example">
                hello@clinexa.example <span aria-hidden="true">↗</span>
              </a>
              <small>Demo contact address for this project</small>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Link className="brand brand-footer" to="/">
            <span className="brand-mark" aria-hidden="true">+</span>
            <span>clinexa</span>
          </Link>
          <p>Care starts with a clear next step.</p>
          <span className="footer-copy">© {new Date().getFullYear()} Clinexa · Demo project</span>
        </div>
      </footer>
    </>
  );
}

function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const { user, login, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const credentials = isRegister
        ? { name, email, password, phone }
        : { email, password };
      await (isRegister ? register(credentials) : login(credentials));
      navigate("/");
    } catch (requestError) {
      setError(requestError.message || "We couldn't complete your request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="auth-page">
        <div className="auth-layout container">
          <section className="auth-aside">
            <span className="eyebrow eyebrow-light">WELCOME TO CLINEXA</span>
            <h1>{isRegister ? "Start with a little more clarity." : "Good to see you again."}</h1>
            <p>
              {isRegister
                ? "Create your patient account to make arranging care feel simpler."
                : "Sign in to continue your Clinexa experience."}
            </p>
            <div className="auth-aside-note">
              <span aria-hidden="true">+</span>
              <span>Thoughtful tools for your healthcare journey.</span>
            </div>
          </section>

          <section className="auth-form-panel">
            <span className="eyebrow">{isRegister ? "CREATE YOUR ACCOUNT" : "PATIENT PORTAL"}</span>
            <h2>{isRegister ? "Create an account" : "Welcome back"}</h2>
            <p className="auth-form-intro">
              {isRegister ? "A few details to get started." : "Enter your details to sign in."}
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              {isRegister && (
                <label>
                  Full name
                  <input
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    required
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              {isRegister && (
                <label>
                  Phone number <span className="optional-label">Optional</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Your phone number"
                  />
                </label>
              )}
              <label>
                Password
                <input
                  type="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  minLength={isRegister ? 8 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isRegister ? "At least 8 characters" : "Enter your password"}
                  required
                />
              </label>

              {error && <p className="form-message form-error" role="alert">{error}</p>}

              <button className="button auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Please wait..."
                  : isRegister
                    ? "Create patient account"
                    : "Sign in"}
                {!isSubmitting && <span aria-hidden="true">↗</span>}
              </button>
              {isRegister && (
                <p className="auth-privacy-note">
                  New public accounts are created with the patient role.
                </p>
              )}
            </form>

            <p className="auth-switch">
              {isRegister ? "Already have an account?" : "New to Clinexa?"}{" "}
              <Link to={isRegister ? "/login" : "/register"}>
                {isRegister ? "Log in" : "Create an account"}
              </Link>
            </p>
            <Link className="auth-home-link" to="/">← Back to Clinexa</Link>
          </section>
        </div>
      </main>
      <footer className="auth-footer">
        <span>Clinexa is a healthcare appointment demo. It is not an emergency service.</span>
      </footer>
    </>
  );
}

function NotFoundPage() {
  return (
    <main className="not-found-page">
      <span className="eyebrow">PAGE NOT FOUND</span>
      <h1>Let’s get you back on track.</h1>
      <Link className="button" to="/">Return home</Link>
    </main>
  );
}

function App() {
  const { user } = useAuth();

  return (
    <>
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/care-tools" element={<CareToolsPage />} />
        <Route
          path="/appointments"
          element={
            user?.role === "patient"
              ? <AppointmentsPage />
              : <Navigate to={user ? "/dashboard" : "/login"} replace />
          }
        />
        <Route
          path="/prescriptions"
          element={
            ["patient", "doctor"].includes(user?.role)
              ? <PrescriptionsPage />
              : <Navigate to={user ? "/" : "/login"} replace />
          }
        />
        <Route
          path="/notifications"
          element={
            ["patient", "doctor", "admin"].includes(user?.role)
              ? <NotificationsPage />
              : <Navigate to={user ? "/" : "/login"} replace />
          }
        />
        <Route
          path="/dashboard"
          element={
            user?.role === "admin"
              ? <AdminDashboardPage />
              : user && ["patient", "doctor"].includes(user.role)
                ? <DashboardPage />
              : <Navigate to={user ? "/" : "/login"} replace />
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default App;
