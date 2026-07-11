const express = require("express");
const router = express.Router();
const examController = require("../controllers/examController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, examController.getAll);
router.get("/group/:id", verifyToken, examController.getByGroup);
router.get(
  "/teacher",
  verifyToken,
  roleMiddleware("Teacher"),
  examController.getByTeacher,
);
router.get("/:id", verifyToken, examController.getById);
router.post("/", verifyToken, roleMiddleware("Admin"), examController.create);
router.put("/:id", verifyToken, roleMiddleware("Admin"), examController.update);
router.delete(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  examController.delete,
);

module.exports = router;
