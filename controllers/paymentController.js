const db = require("../config/db");

exports.getAll = (req, res) => {
  const sql = `
    SELECT p.*, CONCAT(s.first_name, ' ', s.last_name) as student_name, 
           s.student_code, s.phone AS student_phone, g.group_name,
           ay.year_label, sem.semester_name
    FROM payments p
    JOIN students s ON p.student_id = s.student_id
    JOIN academic_years ay ON p.academic_year_id = ay.year_id
    LEFT JOIN semesters sem ON p.semester_id = sem.semester_id
    LEFT JOIN class_groups g ON s.group_id = g.group_id
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

exports.getById = (req, res) => {
  const sql = `
    SELECT p.*, CONCAT(s.first_name, ' ', s.last_name) as student_name,
           s.student_code, ay.year_label, sem.semester_name
    FROM payments p
    JOIN students s ON p.student_id = s.student_id
    JOIN academic_years ay ON p.academic_year_id = ay.year_id
    LEFT JOIN semesters sem ON p.semester_id = sem.semester_id
    WHERE p.payment_id = ?
  `;
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0)
      return res.status(404).json({ message: "Payment not found" });
    res.json(result[0]);
  });
};

exports.getByStudent = (req, res) => {
  const sql = `
    SELECT p.*, CONCAT(s.first_name, ' ', s.last_name) as student_name,
           s.student_code, ay.year_label, sem.semester_name
    FROM payments p
    JOIN students s ON p.student_id = s.student_id
    JOIN academic_years ay ON p.academic_year_id = ay.year_id
    LEFT JOIN semesters sem ON p.semester_id = sem.semester_id
    WHERE p.student_id = ?
  `;
  db.query(sql, [req.params.id], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

exports.create = (req, res) => {
  const sql = "INSERT INTO payments SET ?";
  db.query(sql, req.body, (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(201).json({ id: result.insertId, ...req.body });
  });
};

exports.update = (req, res) => {
  const sql = "UPDATE payments SET ? WHERE payment_id = ?";
  db.query(sql, [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Payment not found" });
    res.json({ message: "Payment updated" });
  });
};

// ──────────────────────────────────────────────
// GET /api/payments/student/me — logged-in student's payments
// ──────────────────────────────────────────────
exports.getMyPayments = (req, res) => {
  const userId = req.user.user_id;

  db.query(
    `SELECT student_id FROM students WHERE user_id = ?`,
    [userId],
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (rows.length === 0)
        return res.status(404).json({ message: "Student not found" });

      const studentId = rows[0].student_id;

      const sql = `
        SELECT p.*, ay.year_label, sem.semester_name,
               p.payment_type AS fee_type,
               p.reference_code AS receipt_number,
               p.note AS remark
        FROM payments p
        JOIN academic_years ay ON p.academic_year_id = ay.year_id
        LEFT JOIN semesters sem ON p.semester_id = sem.semester_id
        WHERE p.student_id = ?
        ORDER BY p.paid_date DESC
      `;

      db.query(sql, [studentId], (err, result) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });
        res.json(result || []);
      });
    },
  );
};

exports.delete = (req, res) => {
  const sql = "DELETE FROM payments WHERE payment_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Payment not found" });
    res.json({ message: "Payment deleted" });
  });
};
