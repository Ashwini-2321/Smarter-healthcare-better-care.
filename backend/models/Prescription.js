const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    dosage: { type: String, required: true, trim: true, maxlength: 120 },
    instructions: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionId: {
      type: String,
      required: true,
      unique: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },
    patientName: { type: String, required: true, trim: true },
    doctorName: { type: String, required: true, trim: true },
    appointmentReference: { type: String, default: "" },
    appointmentDate: { type: String, required: true },
    date: {
      type: Date,
      required: true,
    },
    notes: { type: String, default: "", trim: true, maxlength: 2000 },
    medicines: {
      type: [medicineSchema],
      default: [],
      validate: (medicines) => medicines.length <= 20,
    },
    instructions: { type: String, default: "", trim: true, maxlength: 2000 },
    followUp: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ doctorId: 1, createdAt: -1 });

module.exports = mongoose.model("Prescription", prescriptionSchema);
