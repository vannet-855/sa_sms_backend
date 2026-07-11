const express = require("express");
const router = express.Router();
const enrollmentController = require("../controllers/enrollmentController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, enrollmentController.getAll);
router.get(
  "/student/me",
  verifyToken,
  roleMiddleware("Student"),
  enrollmentController.getMyEnrollments,
);
router.get(
  "/students/:groupId/:classId",
  verifyToken,
  enrollmentController.getStudentsByGroupAndClass,
);
router.get("/group/:id", verifyToken, enrollmentController.getByGroup);
router.get("/class/:id", verifyToken, enrollmentController.getByClass);
router.get(
  "/teacher/class/:classId/students",
  verifyToken,
  roleMiddleware(["Teacher", "Admin"]),
  enrollmentController.getTeacherClassStudents,
);
router.get("/:id", verifyToken, enrollmentController.getById);
router.delete(
  "/bulk/:groupId/:classId",
  verifyToken,
  roleMiddleware("Admin"),
  enrollmentController.bulkDelete,
);
router.post(
  "/bulk",
  verifyToken,
  roleMiddleware("Admin"),
  enrollmentController.bulkCreate,
);
router.post(
  "/",
  verifyToken,
  roleMiddleware("Admin"),
  enrollmentController.create,
);
router.put(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  enrollmentController.update,
);
router.delete(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  enrollmentController.delete,
);

module.exports = router;
