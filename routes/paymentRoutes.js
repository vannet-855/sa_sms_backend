const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, paymentController.getAll);
router.get(
  "/student/me",
  verifyToken,
  roleMiddleware("Student"),
  paymentController.getMyPayments,
);
router.get("/student/:id", verifyToken, paymentController.getByStudent);
router.get("/:id", verifyToken, paymentController.getById);
router.post(
  "/",
  verifyToken,
  roleMiddleware("Admin"),
  paymentController.create,
);
router.put(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  paymentController.update,
);
router.delete(
  "/:id",
  verifyToken,
  roleMiddleware("Admin"),
  paymentController.delete,
);

module.exports = router;
