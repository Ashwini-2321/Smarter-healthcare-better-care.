const express = require("express");
const {
  getAppointments,
  getAppointment,
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  updateAppointmentStatus,
} = require("../controllers/appointmentController");
const {
  authenticate,
  optionalAuthenticate,
} = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", authenticate, getAppointments);
router.post("/", optionalAuthenticate, createAppointment);
router.get("/:id", authenticate, getAppointment);
router.put("/:id", authenticate, rescheduleAppointment);
router.patch("/:id/cancel", authenticate, cancelAppointment);
router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("doctor", "admin"),
  updateAppointmentStatus
);

module.exports = router;
