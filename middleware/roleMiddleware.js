// Usage: roleMiddleware("Admin")  or  roleMiddleware("Admin", "Teacher")
// Must run AFTER verifyToken (relies on req.user.role set by the JWT payload)
function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Forbidden: insufficient permissions" });
    }

    next();
  };
}

module.exports = roleMiddleware;
