const express = require("express");
const router = express.Router();
const scheduleController = require("../controllers/scheduleController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, scheduleController.getAll);
router.get(
  "/teacher",
  verifyToken,
  roleMiddleware("Teacher"),
  scheduleController.getByTeacher,
);
router.get(
  "/student",
  verifyToken,
  roleMiddleware("Student"),
  scheduleController.getStudentSchedule,
);
router.get("/class/:id", verifyToken, scheduleController.getByClass);
router.get("/day/:day", verifyToken, scheduleController.getByDay);
router.get(
  "/teacher-availability",
  verifyToken,
  roleMiddleware("Admin"),
  scheduleController.getTeacherAvailability,
);
router.get(
  "/check-teacher",
  verifyToken,
  roleMiddleware("Admin"),
  scheduleController.checkTeacherAvailability,
);
router.get("/:id", verifyToken, scheduleController.getById);
router.post(
  "/",
  verifyToken,
  roleMiddleware("Admin"),
  scheduleController.create,
);
router.put(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  scheduleController.update,
);
router.delete(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  scheduleController.delete,
);

module.exports = router;
