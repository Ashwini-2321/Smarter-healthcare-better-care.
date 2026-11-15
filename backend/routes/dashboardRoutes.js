const express = require("express");
const {
  getPatientDashboard,
  getDoctorDashboard,
  updateDoctorProfile,
  getAdminDashboard,
  getAdminDoctors,
  getAdminUsers,
  updateAdminPatientStatus,
} = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/patient", authenticate, authorizeRoles("patient"), getPatientDashboard);
router.get("/doctor", authenticate, authorizeRoles("doctor"), getDoctorDashboard);
router.put(
  "/doctor/profile",
  authenticate,
  authorizeRoles("doctor"),
  updateDoctorProfile
);
router.get("/admin", authenticate, authorizeRoles("admin"), getAdminDashboard);
router.get("/admin/doctors", authenticate, authorizeRoles("admin"), getAdminDoctors);
router.get("/admin/users", authenticate, authorizeRoles("admin"), getAdminUsers);
router.patch(
  "/admin/users/:id/status",
  authenticate,
  authorizeRoles("admin"),
  updateAdminPatientStatus
);

module.exports = router;
