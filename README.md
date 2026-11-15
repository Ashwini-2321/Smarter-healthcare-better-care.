# Clinexa

Clinexa is a healthcare appointment and management web application built with React on the frontend, Node.js/Express on the backend, and a separate Python machine-learning service.

## Project goals

- Provide a responsive patient, doctor, and administrator experience.
- Support doctor discovery, appointment booking, and role-scoped care records.
- Keep synthetic ML demonstrations clearly separate from clinical advice.
- Provide a documented API with MongoDB persistence and a temporary development fallback.

## Current working features

The project currently supports:

- `GET /api/doctors`
- `GET /api/doctors/search`
- `GET /api/doctors/:id`
- Admin-only doctor create, update, and deactivate endpoints
- Authenticated, patient-scoped `GET /api/appointments`
- `POST /api/appointments`
- Appointment detail, rescheduling, and cancellation endpoints
- Patient and doctor dashboards with role-scoped appointment summaries
- Patient profile editing and doctor professional profile/availability management
- Doctor-authored prescriptions linked to a patient and appointment, with a print view
- In-app registration, appointment, reminder, and prescription notifications
- Symptom-to-specialty suggestions using a synthetic-data Random Forest model
- Doctor recommendations ranked from current directory details and user preferences
- No-show risk estimates using synthetic appointment data
- Role-protected administrator dashboard with account, doctor, and appointment analytics

The backend runs on port 5000 and the frontend runs on port 5173.

## Project structure

- `src/` — React frontend
- `backend/` — Express API, route controllers, Mongoose models, and database configuration
- `public/` — static frontend assets
- `client/` — extra demo app folder, not the active main app
- `ml-service/` — Flask API, synthetic model training, and ML tests

## Prerequisites

Install the following before running the project:

- Node.js and npm
- VS Code
- A browser such as Chrome or Edge
- Python 3.10 or later

## Step 1: Install frontend dependencies

Open a terminal in the project root and run:

```bash
npm install
```

## Step 2: Install backend dependencies

Open a terminal in the backend folder and run:

```bash
cd backend
npm install
```

## Step 3: Configure environment variables

Create a file named `.env` in the `backend` folder.

Copy the example values from `backend/.env.example`:

```bash
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/clinexa
JWT_SECRET=replace_with_your_generated_secret
JWT_EXPIRES_IN=1d
ML_SERVICE_URL=http://localhost:8000
```

Set `MONGODB_URI` to your local MongoDB or Atlas connection string. Never commit your
real `.env` file or expose database credentials in frontend code.
For production, replace `JWT_SECRET` with a generated secret of at least 32 characters.
You can generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 4: Start the backend

From the backend folder:

```bash
npm start
```

When MongoDB is available, the backend connects to it and inserts fictional demo
doctors only if the doctors collection is empty. If MongoDB is unavailable in
development, the existing doctor and appointment APIs run with temporary in-memory
data; bookings made in this mode are lost when the backend stops. Production startup
requires MongoDB.

You should see:

```bash
Clinexa Backend running on http://localhost:5000
```

## Step 5: Start the frontend

Open a new terminal in the project root and run:

```bash
npm run dev
```

Then open the local URL shown by Vite, usually:

```bash
http://localhost:5173
```

## Step 6: Start the Python ML service

Open a terminal in the project root and run:

```powershell
cd ml-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Keep this terminal open while using the care tools. The Node backend proxies all ML
requests through `ML_SERVICE_URL`; the React app does not contact Python directly.
If the ML service is stopped, its backend routes return a clear service-unavailable
error instead of a placeholder recommendation.

## Step 7: Test the API

You can test the backend with your browser or a tool like Postman.

Example requests:

```bash
GET http://localhost:5000/api/doctors
POST http://localhost:5000/api/appointments
```

`GET /api/appointments`, `GET /api/appointments/:id`, `PUT /api/appointments/:id`,
and `PATCH /api/appointments/:id/cancel` require an
`Authorization: Bearer <token>` header. Appointment listing is scoped to the signed-in
patient. Doctor create/update/deactivate routes require an admin token; public signup
cannot create doctor or admin accounts.

Example JSON body for booking:

```json
{
  "patientName": "Test User",
  "doctor": "Dr. Priya Sharma",
  "date": "2026-11-20",
  "time": "10:30"
}
```

Appointments use each doctor's configured working days and time slots. Duplicate active
bookings for the same doctor and time are rejected. Public guest booking remains
available, but appointment lists and management actions require authentication; only
appointments linked to the signed-in patient are returned.

Run the backend, frontend, and ML tests from the project root with:

```bash
npm --prefix backend test
npm run lint
npm run build
npm audit --prefix backend
npm audit
```

```powershell
cd ml-service
.\.venv\Scripts\python.exe -m unittest discover -s . -p "test_*.py"
```

Authentication endpoints:

- `POST /api/auth/register` — public registration; always creates a patient account.
- `POST /api/auth/login` — returns a JWT and safe user profile.
- `GET /api/auth/profile` — requires `Authorization: Bearer <token>`.
- `PUT /api/auth/profile` — updates the authenticated user's profile.

Passwords are hashed before storage, and API responses never include password hashes.
Public registration ignores any submitted role so users cannot self-assign doctor or
admin access. Development-only in-memory accounts are temporary and disappear when
the backend stops.

The API uses Helmet security headers, restricts browser origins through `CORS_ORIGIN`,
and limits login attempts to 10 per IP per 15 minutes and registrations to 20 per IP
per hour. These controls are application-level safeguards, not a substitute for
production infrastructure, HTTPS, monitoring, backups, or a security review.
When deploying behind a reverse proxy, trust only the known proxy hops so clients
cannot spoof their IP address in forwarded headers and bypass request limits.

The frontend provides `/login` and `/register` pages and stores the returned JWT in
the browser so it can show the signed-in patient state. The API base URL defaults to
`http://localhost:5000`; set `VITE_API_URL` in the frontend environment to override it.

Dashboard endpoints:

- `GET /api/dashboard/patient` — patient appointment counts and upcoming visits.
- `GET /api/dashboard/doctor` — doctor's schedule and appointment history.
- `GET /api/dashboard/admin` — platform totals, appointment status counts, monthly bookings, recent and upcoming appointments.
- `GET /api/dashboard/admin/users` — paginated, searchable user directory (admin only).
- `PATCH /api/dashboard/admin/users/:id/status` — activate or deactivate a patient account.
- `GET /api/dashboard/admin/doctors` — doctor profiles, including inactive records (admin only).
- `PUT /api/dashboard/doctor/profile` — update the signed-in doctor's profile and availability.
- `PATCH /api/appointments/:id/status` — linked doctors confirm or complete appointments.
- `GET /api/prescriptions` and `GET /api/prescriptions/:id` — view role-scoped prescription records.
- `POST /api/prescriptions` and `PUT /api/prescriptions/:id` — linked doctors create or update prescriptions.
- `GET /api/notifications` — read the latest 100 notifications and the total unread count.
- `PATCH /api/notifications/:id/read` — mark one of the signed-in user's notifications as read.

The patient dashboard is available at `/dashboard` for signed-in patient accounts.
Doctor dashboards require an administrator-provisioned doctor account linked to a
doctor profile. Public registration intentionally creates patient accounts only.
Admin-only doctor create/update endpoints accept a `userId` to link an existing
doctor-role account; doctor dashboards and profile updates are scoped to that link.
Administrator accounts must be provisioned directly in MongoDB or in the development
user store; public registration cannot create administrator accounts. Deactivated
patient accounts are blocked from login and their existing JWT sessions are rejected.

## Phase 8: Prescriptions and notifications

The `/prescriptions` page is available to signed-in patients and doctors. Linked
doctors can create one prescription per appointment and update their own records;
patients can only view records linked to their account. Creating a prescription
requires an appointment with a registered patient account. Prescription medicines,
dosages, notes, and instructions must be entered by the clinician; Clinexa does not
generate or recommend treatment. The page includes a print-friendly layout.

The `/notifications` page shows the signed-in user's newest 100 in-app notifications,
their total unread count, and a mark-as-read action. Registration, appointment
requests, doctor confirmations, rescheduling, cancellations, prescription availability,
and upcoming appointment reminders create notifications. The backend checks for
appointments within the next 24 hours every 15 minutes; reminders are sent once per
appointment while the backend is running. Appointment date/time reminders use the
backend server's local timezone.

Notification events are routed through a dedicated backend service, separate from
their in-app storage. This is the extension point for a future optional email delivery
adapter; email sending is not enabled and no email credentials are required.

## Phase 9: Admin dashboard and analytics

The `/dashboard` route shows a separate view for administrator accounts. It reports
patient, doctor, and appointment totals; completed, cancelled, and upcoming counts;
appointment status breakdowns; six months of booking activity; and recent/upcoming
appointments. Administrators can search and page through user accounts, deactivate or
restore patient accounts, and add, edit, deactivate, or reactivate doctor profiles.
Doctor profiles can be linked to an existing doctor-role account. Doctor accounts are
managed through their linked directory profiles; administrator accounts cannot be
deactivated in the user directory.

The admin analytics and user-management endpoints require a valid administrator JWT.
User records returned to the dashboard exclude password hashes. Disabling a patient
account also invalidates existing authenticated requests; public signup cannot assign
privileged roles.

## Phase 10: final checks and security

The API sends standard security headers, allows only configured browser origins, and
throttles authentication attempts. Passwords are hashed, JWTs are checked against the
current account and role, and patient/doctor records are scoped to their authorized
accounts. The backend tests cover these access controls and the frontend production
build and ML service tests are included above.

Clinexa is a demonstration project, not a certified clinical system. Do not enter
real patient or health information. MongoDB-backed behavior must be tested with a
configured MongoDB instance; without one, development uses temporary in-memory data.

ML API endpoints:

- `GET /api/ml/symptoms` — return the controlled symptom list.
- `POST /api/ml/symptom-recommendation` — recommend a specialty from selected symptoms.
- `POST /api/ml/doctor-recommendation` — rank current doctors by preferences.
- `POST /api/ml/no-show-prediction` — return an appointment reminder estimate.

## Phase 5 status

Doctor and appointment endpoints use separate routers and controllers, with Mongoose
persistence when MongoDB is available and a clearly logged temporary fallback in
development. The frontend now loads and filters doctors from the API, shows doctor
profiles, books only configured appointment slots, and provides a protected
appointment page for details, rescheduling, and cancellation. The backend enforces
patient-scoped access, validates availability, blocks duplicate active slots, and
restricts doctor changes to administrators.

## Phase 6 status

The patient dashboard shows appointment totals and upcoming visits, and lets patients
edit their account profile. The doctor dashboard shows today's and upcoming
appointments plus appointment history, and lets linked doctors update their public
professional profile, working days, time slots, and availability. Dashboard APIs
enforce patient/doctor roles and return only appointment information needed by the
authorized account. Prescriptions and notifications were added in Phase 8.

## Phase 7 status

The `/care-tools` page connects to three working Python-backed demonstrations. The
symptom tool uses a Random Forest trained on generated symptom/specialty examples,
shows a plain-language explanation, and gives emergency guidance for selected urgent
symptoms. It never diagnoses or suggests treatment. The doctor recommender considers
specialty, availability, preferred time, configured fee, and experience; it does not
invent ratings or qualifications. The no-show estimate uses appointment timing,
reminder status, booking lead time, and an optional attendance choice. That estimate
is never saved or used to restrict care.

Train and evaluate the reproducible synthetic demonstrations with:

```powershell
cd ml-service
.\.venv\Scripts\python.exe train.py
.\.venv\Scripts\python.exe -m unittest discover -s . -p "test_*.py"
```

The current synthetic holdout scores are 0.970 for specialty suggestions and 0.570
for no-show estimates. These scores only measure agreement with generated labels;
they are not real-world accuracy or evidence of clinical usefulness. No validated
clinical data was used. `train.py` creates the synthetic CSVs under `ml-service/datasets/`.

## Important notes for beginners

- Do not delete the current working code.
- Preserve the existing API routes.
- Keep the frontend on port 5173.
- Keep the backend on port 5000.
- If you change a file, test it before moving to the next step.

## Project status

Phases 1–10 are complete. The ML predictions use synthetic demonstration data, and
MongoDB integration should be verified against the deployment's own database.

## Troubleshooting

If the backend does not start:

- Make sure you are inside the `backend` folder.
- Make sure `npm install` has already been run.
- Check that the `.env` file exists and matches the example values.

If the frontend cannot connect to the backend:

- Confirm the backend is running on port 5000.
- Confirm the frontend is running on port 5173.
- Check that CORS is configured correctly.

## License

This project is for educational and college project use.
