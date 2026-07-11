const express = require("express");
const router = express.Router();
const controller = require("../controllers/majorController");
const verifyToken = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get("/", verifyToken, controller.getAll);
router.get("/by-department/:departmentId", verifyToken, controller.getByDepartment);
router.get("/:id", verifyToken, controller.getById);
router.post("/", verifyToken, roleMiddleware("Admin"), controller.create);
router.put("/:id", verifyToken, roleMiddleware("Admin"), controller.update);
router.delete("/:id", verifyToken, roleMiddleware("Admin"), controller.delete);

module.exports = router;