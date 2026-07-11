const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courseController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, courseController.getAll);
router.get("/:id", verifyToken, courseController.getById);
router.post("/", verifyToken, roleMiddleware("Admin"), courseController.create);
router.put(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  courseController.update,
);
router.delete(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  courseController.delete,
);
router.post(
  "/bulk-delete",
  verifyToken,
  roleMiddleware("Admin"),
  courseController.bulkDelete,
);

module.exports = router;
