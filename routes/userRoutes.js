const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, userController.getAll);
router.get("/:id", verifyToken, userController.getById);
router.post("/", verifyToken, roleMiddleware("Admin"), userController.create);
router.put("/:id", verifyToken, roleMiddleware("Admin"), userController.update);
router.delete("/:id", verifyToken, roleMiddleware("Admin"), userController.delete);

module.exports = router;