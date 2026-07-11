const db = require("../config/db");

// ──────────────────────────────────────────────
// GET /api/courses — with search & pagination
// ──────────────────────────────────────────────
exports.getAll = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 1000;
  const offset = (page - 1) * limit;
  const search = req.query.search || "";

  let where = "WHERE 1=1";
  const params = [];

  if (search.trim()) {
    where += " AND (course_code LIKE ? OR course_name LIKE ?)";
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }

  if (req.query.major_id) {
    where += " AND c.major_id = ?";
    params.push(parseInt(req.query.major_id));
  }

  const countSql = `SELECT COUNT(*) AS total FROM courses c ${where}`;

  const dataSql = `
    SELECT c.*, m.name AS major_name
    FROM courses c
    LEFT JOIN majors m ON c.major_id = m.major_id
    ${where}
    ORDER BY c.course_id ASC
    LIMIT ? OFFSET ?
  `;

  db.query(countSql, params, (errCount, countResult) => {
    if (errCount)
      return res
        .status(500)
        .json({ message: "Server error", error: errCount.message });

    const total = countResult[0]?.total || 0;

    db.query(dataSql, [...params, limit, offset], (errData, rows) => {
      if (errData)
        return res
          .status(500)
          .json({ message: "Server error", error: errData.message });
      res.json({ data: rows, total, page, limit });
    });
  });
};

// ──────────────────────────────────────────────
// GET /api/courses/:id
// ──────────────────────────────────────────────
exports.getById = (req, res) => {
  const sql = "SELECT * FROM courses WHERE course_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0)
      return res.status(404).json({ message: "Course not found" });
    res.json(result[0]);
  });
};

// ──────────────────────────────────────────────
// POST /api/courses
// ──────────────────────────────────────────────
exports.create = (req, res) => {
  const sql = "INSERT INTO courses SET ?";
  db.query(sql, [req.body], (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(201).json({ message: "Course created", id: result.insertId });
  });
};

// ──────────────────────────────────────────────
// PUT /api/courses/:id
// ──────────────────────────────────────────────
exports.update = (req, res) => {
  const sql = "UPDATE courses SET ? WHERE course_id = ?";
  db.query(sql, [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Course not found" });
    res.json({ message: "Course updated" });
  });
};

// ──────────────────────────────────────────────
// DELETE /api/courses/:id
// ──────────────────────────────────────────────
exports.delete = (req, res) => {
  const sql = "DELETE FROM courses WHERE course_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Course not found" });
    res.json({ message: "Course deleted" });
  });
};

// ──────────────────────────────────────────────
// POST /api/courses/bulk-delete
// ──────────────────────────────────────────────
exports.bulkDelete = (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "ids must be a non-empty array" });
  }

  const placeholders = ids.map(() => "?").join(",");
  const sql = `DELETE FROM courses WHERE course_id IN (${placeholders})`;

  db.query(sql, ids, (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    res.json({
      message: `${result.affectedRows} course(s) permanently deleted`,
    });
  });
};
