const Doctor = require("../models/Doctor");
const { doctors } = require("../data/doctors");

async function seedDemoDoctors() {
  const doctorCount = await Doctor.countDocuments();

  if (doctorCount > 0) {
    return;
  }

  const demoDoctors = doctors.map((doctor) => ({
    ...doctor,
    experience: Number.parseInt(doctor.experience, 10),
  }));

  await Doctor.insertMany(demoDoctors);
  console.log(`Seeded ${demoDoctors.length} fictional demo doctors.`);
}

module.exports = { seedDemoDoctors };
