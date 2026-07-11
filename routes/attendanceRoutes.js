const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// ─── Open routes (require auth) ───
router.get("/", verifyToken, attendanceController.getAll);
router.get("/date/:date", verifyToken, attendanceController.getByDate);

// ─── Specific student routes (MUST be BEFORE /student/:studentId) ───
router.get(
  "/student/me",
  verifyToken,
  roleMiddleware("Student"),
  attendanceController.getMyAttendance,
);
router.get(
  "/student/me/stats",
  verifyToken,
  roleMiddleware("Student"),
  attendanceController.getMyStats,
);
router.get(
  "/student/my-schedules",
  verifyToken,
  roleMiddleware("Student"),
  attendanceController.getStudentSchedules,
);
router.post(
  "/student/permission",
  verifyToken,
  roleMiddleware("Student"),
  attendanceController.submitPermission,
);
router.delete(
  "/student/permission/:scheduleId/:date",
  verifyToken,
  roleMiddleware("Student"),
  attendanceController.cancelPermission,
);
router.get(
  "/student/:studentId",
  verifyToken,
  attendanceController.getByStudent,
);
router.get(
  "/stats/student/:studentId",
  verifyToken,
  attendanceController.getStudentStats,
);

// ─── Schedule-based routes (before /:id wildcard) ───
router.get(
  "/schedule/:scheduleId/date/:date",
  verifyToken,
  attendanceController.getByScheduleAndDate,
);
router.get(
  "/schedule/:scheduleId/students",
  verifyToken,
  attendanceController.getEnrolledStudentsBySchedule,
);

// ─── Teacher routes (must be BEFORE /:id to avoid wildcard catch) ───
router.get(
  "/teacher/schedules",
  verifyToken,
  roleMiddleware("Teacher"),
  attendanceController.getTeacherSchedules,
);
router.post(
  "/take",
  verifyToken,
  roleMiddleware("Teacher"),
  attendanceController.takeAttendance,
);

router.get("/:id", verifyToken, attendanceController.getById);

// ─── Admin-only routes ───
router.post(
  "/bulk",
  verifyToken,
  roleMiddleware("Admin"),
  attendanceController.bulkUpsert,
);
router.post(
  "/bulk-delete",
  verifyToken,
  roleMiddleware("Admin"),
  attendanceController.bulkDelete,
);
router.post(
  "/",
  verifyToken,
  roleMiddleware("Admin"),
  attendanceController.create,
);
router.put(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  attendanceController.update,
);
router.delete(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  attendanceController.delete,
);

module.exports = router;
