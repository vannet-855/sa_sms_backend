const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, teacherController.getAll);
router.get(
  "/profile",
  verifyToken,
  roleMiddleware("Teacher"),
  teacherController.getProfile,
);
router.put(
  "/profile",
  verifyToken,
  roleMiddleware("Teacher"),
  teacherController.updateProfile,
);
router.get(
  "/my-classes",
  verifyToken,
  roleMiddleware("Teacher"),
  teacherController.getMyClasses,
);
router.get("/:id", verifyToken, teacherController.getById);
router.post(
  "/",
  verifyToken,
  roleMiddleware("Admin"),
  teacherController.create,
);
router.put(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  teacherController.update,
);
router.delete(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  teacherController.delete,
);
router.post(
  "/bulk-delete",
  verifyToken,
  roleMiddleware("Admin"),
  teacherController.bulkDelete,
);

module.exports = router;
