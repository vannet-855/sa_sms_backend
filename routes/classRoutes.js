const express = require("express");
const router = express.Router();
const classController = require("../controllers/classController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, classController.getAll);
router.get("/:id", verifyToken, classController.getById);
router.post("/", verifyToken, roleMiddleware("Admin"), classController.create);
router.put(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  classController.update,
);
router.delete(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  classController.delete,
);
router.post(
  "/bulk-delete",
  verifyToken,
  roleMiddleware("Admin"),
  classController.bulkDelete,
);

module.exports = router;
