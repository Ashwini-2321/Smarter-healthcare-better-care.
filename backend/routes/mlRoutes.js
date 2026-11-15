const express = require("express");
const {
  getSymptoms,
  recommendSpecialty,
  recommendDoctors,
  predictNoShow,
} = require("../controllers/mlController");

const router = express.Router();

router.get("/symptoms", getSymptoms);
router.post("/symptom-recommendation", recommendSpecialty);
router.post("/doctor-recommendation", recommendDoctors);
router.post("/no-show-prediction", predictNoShow);

module.exports = router;
