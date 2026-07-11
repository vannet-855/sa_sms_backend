const express = require("express");
const router = express.Router();
const examResultController = require("../controllers/examResultController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, examResultController.getAll);
router.post(
  "/group",
  verifyToken,
  roleMiddleware("Admin"),
  examResultController.createGroupResults,
);
router.get(
  "/group/:groupId/students",
  verifyToken,
  examResultController.getStudentsByGroup,
);
router.get(
  "/student/me",
  verifyToken,
  roleMiddleware("Student"),
  examResultController.getMyExamResults,
);
router.get("/student/:id", verifyToken, examResultController.getByStudent);
router.get("/exam/:id", verifyToken, examResultController.getByExam);

// ─── Teacher routes (must be BEFORE /:id) ───
router.get(
  "/teacher/exams",
  verifyToken,
  roleMiddleware("Teacher"),
  examResultController.getTeacherExams,
);
router.get(
  "/teacher/exam/:examId/students",
  verifyToken,
  roleMiddleware("Teacher"),
  examResultController.getExamStudents,
);
router.post(
  "/grade",
  verifyToken,
  roleMiddleware("Teacher"),
  examResultController.gradeExam,
);

router.get("/:id", verifyToken, examResultController.getById);
router.post(
  "/",
  verifyToken,
  roleMiddleware("Admin"),
  examResultController.create,
);
router.put(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  examResultController.update,
);
router.delete(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  examResultController.delete,
);

module.exports = router;
