const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Student profile routes (must be BEFORE /:id wildcard)
router.get(
  "/profile",
  verifyToken,
  roleMiddleware("Student"),
  studentController.getMyProfile,
);
router.put(
  "/profile",
  verifyToken,
  roleMiddleware("Student"),
  studentController.updateMyProfile,
);

// Public (require auth) routes
router.get("/search", verifyToken, studentController.searchLight);
router.get("/", verifyToken, studentController.getAll);
router.get("/:id", verifyToken, studentController.getById);

// Admin-only routes
router.post(
  "/bulk-delete",
  verifyToken,
  roleMiddleware("Admin"),
  studentController.bulkDelete,
);
router.post(
  "/",
  verifyToken,
  roleMiddleware("Admin"),
  studentController.create,
);
router.put(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  studentController.update,
);
router.delete(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  studentController.delete,
);

module.exports = router;
