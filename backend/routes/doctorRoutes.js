const express = require("express");
const {
  getDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deactivateDoctor,
} = require("../controllers/doctorController");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", getDoctors);
router.get("/search", getDoctors);
router.get("/:id", getDoctor);
router.post("/", authenticate, authorizeRoles("admin"), createDoctor);
router.put("/:id", authenticate, authorizeRoles("admin"), updateDoctor);
router.delete("/:id", authenticate, authorizeRoles("admin"), deactivateDoctor);

module.exports = router;
