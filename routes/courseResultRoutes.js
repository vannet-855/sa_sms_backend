const express = require("express");
const router = express.Router();
const courseResultController = require("../controllers/courseResultController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, courseResultController.getAll);
router.get(
  "/student/me",
  verifyToken,
  roleMiddleware("Student"),
  courseResultController.getMyCourseResults,
);
router.get("/student/:id", verifyToken, courseResultController.getByStudent);
router.get("/course/:id", verifyToken, courseResultController.getByCourse);

// ─── Teacher routes ───
router.get(
  "/teacher/classes",
  verifyToken,
  roleMiddleware("Teacher"),
  courseResultController.getTeacherClasses,
);
router.get(
  "/teacher/group/:groupName/students",
  verifyToken,
  roleMiddleware("Teacher"),
  courseResultController.getGroupStudents,
);
router.post(
  "/grade",
  verifyToken,
  roleMiddleware("Teacher"),
  courseResultController.gradeCourse,
);

router.get("/:id", verifyToken, courseResultController.getById);
router.post(
  "/",
  verifyToken,
  roleMiddleware("Admin"),
  courseResultController.create,
);
router.put(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  courseResultController.update,
);
router.delete(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  courseResultController.delete,
);

module.exports = router;
