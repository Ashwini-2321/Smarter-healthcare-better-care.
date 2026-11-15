const express = require("express");
const { getNotifications, markRead } = require("../controllers/notificationController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);
router.get("/", getNotifications);
router.patch("/:id/read", markRead);

module.exports = router;
