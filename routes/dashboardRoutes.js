const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get(
  "/admin",
  verifyToken,
  roleMiddleware("Admin"),
  dashboardController.getAdminDashboard,
);

router.get(
  "/teacher",
  verifyToken,
  roleMiddleware("Teacher"),
  dashboardController.getTeacherDashboard,
);

const studentDashboardController = require("../controllers/studentDashboardController");
router.get(
  "/student",
  verifyToken,
  roleMiddleware("Student"),
  studentDashboardController.getStudentDashboard,
);

module.exports = router;
