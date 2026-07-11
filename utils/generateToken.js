const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "SECRET_KEY";

const generateToken = (user) => {
  return jwt.sign(
    {
      user_id: user.user_id, // Fixed: was 'id', now 'user_id' for consistency
      role: user.role,
      email: user.email,
    },
    SECRET,
    { expiresIn: "1d" },
  );
};

module.exports = generateToken;
