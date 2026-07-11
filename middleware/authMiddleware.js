const jwt = require("jsonwebtoken");

// Verifies "Authorization: Bearer <token>" and attaches { user_id, email, role } to req.user
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = decoded; // { user_id, email, role }
    next();
  });
}

module.exports = verifyToken;
