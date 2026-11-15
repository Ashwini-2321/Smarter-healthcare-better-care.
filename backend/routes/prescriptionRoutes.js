const express = require("express");
const {
  listPrescriptions,
  getPrescription,
  createPrescription,
  updatePrescription,
} = require("../controllers/prescriptionController");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticate, authorizeRoles("patient", "doctor"));
router.get("/", listPrescriptions);
router.post("/", authorizeRoles("doctor"), createPrescription);
router.get("/:id", getPrescription);
router.put("/:id", authorizeRoles("doctor"), updatePrescription);

module.exports = router;
