const db = require("../config/db");
const generateToken = require("../utils/generateToken");

// LOGIN
exports.login = (req, res) => {
  const { email, password } = req.body;

  const sql = `
    SELECT u.*, r.role_name,
      CASE
        WHEN r.role_name = 'Teacher' THEN COALESCE(NULLIF(t.full_name, ''), 'Teacher')
        WHEN r.role_name = 'Student' THEN COALESCE(NULLIF(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')), ' '), 'Student')
        ELSE 'Administrator'
      END AS full_name
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    LEFT JOIN teachers t ON u.ref_id = t.teacher_id AND r.role_name = 'Teacher'
    LEFT JOIN students s ON u.ref_id = s.student_id AND r.role_name = 'Student'
    WHERE u.email = ?
  `;

  db.query(sql, [email], (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.status(401).json({ message: "Invalid email" });
    }

    const user = result[0];

    if (password !== user.password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = generateToken({
      user_id: user.user_id,
      role: user.role_name,
      email: user.email,
    });

    // Strip password from response
    const { password: _, ...safeUser } = user;

    res.json({
      message: "Login success",
      token,
      user: safeUser,
    });
  });
};
