const express = require("express");
const router = express.Router();
const controller = require("../controllers/classGroupController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, controller.getAll);
router.get("/:id", verifyToken, controller.getById);
router.post("/", verifyToken, roleMiddleware("Admin"), controller.create);
router.put("/:id", verifyToken, roleMiddleware("Admin"), controller.update);
router.delete("/:id", verifyToken, roleMiddleware("Admin"), controller.delete);

module.exports = router;