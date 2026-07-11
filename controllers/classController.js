const db = require("../config/db");

// ──────────────────────────────────────────────
// GET /api/classes — with search & pagination
// ──────────────────────────────────────────────
exports.getAll = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 1000;
  const offset = (page - 1) * limit;
  const search = req.query.search || "";
  const courseId = req.query.course_id || "";
  const teacherId = req.query.teacher_id || "";
  const semesterId = req.query.semester_id || "";
  const yearId = req.query.year_id || "";

  let where = "WHERE 1=1";
  const params = [];

  if (search.trim()) {
    where +=
      " AND (c.course_name LIKE ? OR t.full_name LIKE ? OR cg.group_name LIKE ?)";
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  if (courseId) {
    where += " AND cl.course_id = ?";
    params.push(courseId);
  }

  if (teacherId) {
    where += " AND cl.teacher_id = ?";
    params.push(teacherId);
  }

  if (semesterId) {
    where += " AND cl.semester_id = ?";
    params.push(semesterId);
  }

  if (yearId) {
    where += " AND cl.year_id = ?";
    params.push(yearId);
  }

  const countSql = `
    SELECT COUNT(*) AS total
    FROM classes cl
    JOIN courses c ON cl.course_id = c.course_id
    JOIN teachers t ON cl.teacher_id = t.teacher_id
    JOIN class_groups cg ON cl.group_id = cg.group_id
    ${where}
  `;

  const dataSql = `
    SELECT cl.*,
      c.course_code, c.course_name,
      t.full_name AS teacher_name,
      cg.group_name,
      s.shift_name,
      sem.semester_name,
      ay.year_label
    FROM classes cl
    JOIN courses c ON cl.course_id = c.course_id
    JOIN teachers t ON cl.teacher_id = t.teacher_id
    JOIN class_groups cg ON cl.group_id = cg.group_id
    LEFT JOIN shifts s ON cl.shift_id = s.shift_id
    LEFT JOIN semesters sem ON cl.semester_id = sem.semester_id
    LEFT JOIN academic_years ay ON cl.year_id = ay.year_id
    ${where}
    ORDER BY cl.class_id ASC
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
// GET /api/classes/:id
// ──────────────────────────────────────────────
exports.getById = (req, res) => {
  const sql = `
    SELECT cl.*,
      c.course_code, c.course_name,
      t.full_name AS teacher_name,
      cg.group_name,
      s.shift_name,
      sem.semester_name,
      ay.year_label
    FROM classes cl
    JOIN courses c ON cl.course_id = c.course_id
    JOIN teachers t ON cl.teacher_id = t.teacher_id
    JOIN class_groups cg ON cl.group_id = cg.group_id
    LEFT JOIN shifts s ON cl.shift_id = s.shift_id
    LEFT JOIN semesters sem ON cl.semester_id = sem.semester_id
    LEFT JOIN academic_years ay ON cl.year_id = ay.year_id
    WHERE cl.class_id = ?
  `;

  db.query(sql, [req.params.id], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (rows.length === 0)
      return res.status(404).json({ message: "Class not found" });
    res.json(rows[0]);
  });
};

// ──────────────────────────────────────────────
// POST /api/classes — create
// ──────────────────────────────────────────────
exports.create = (req, res) => {
  const {
    class_code,
    course_id,
    teacher_id,
    group_id,
    shift_id,
    semester_id,
    year_id,
    room,
    schedule,
    max_students,
    start_date,
    end_date,
    status,
  } = req.body;

  if (!course_id || !teacher_id || !group_id) {
    return res.status(400).json({
      message: "Missing required fields: course_id, teacher_id, group_id",
    });
  }

  const sql = `
    INSERT INTO classes
      (class_code, course_id, teacher_id, group_id, shift_id, semester_id, year_id,
       room, schedule, max_students, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      class_code || null,
      course_id,
      teacher_id,
      group_id,
      shift_id || null,
      semester_id || null,
      year_id || null,
      room || null,
      schedule || null,
      max_students || null,
      start_date || null,
      end_date || null,
      status || "Active",
    ],
    (err, result) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      res.status(201).json({ message: "Class created", id: result.insertId });
    },
  );
};

// ──────────────────────────────────────────────
// PUT /api/classes/:id
// ──────────────────────────────────────────────
exports.update = (req, res) => {
  const allowed = [
    "class_code",
    "course_id",
    "teacher_id",
    "group_id",
    "shift_id",
    "semester_id",
    "year_id",
    "room",
    "schedule",
    "max_students",
    "start_date",
    "end_date",
    "status",
  ];

  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  values.push(req.params.id);
  const sql = `UPDATE classes SET ${fields.join(", ")} WHERE class_id = ?`;

  db.query(sql, values, (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Class not found" });
    res.json({ message: "Class updated successfully" });
  });
};

// ──────────────────────────────────────────────
// DELETE /api/classes/:id
// ──────────────────────────────────────────────
exports.delete = (req, res) => {
  const sql = "DELETE FROM classes WHERE class_id = ?";

  db.query(sql, [req.params.id], (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Class not found" });
    res.json({ message: "Class permanently deleted" });
  });
};

// ──────────────────────────────────────────────
// POST /api/classes/bulk-delete
// ──────────────────────────────────────────────
exports.bulkDelete = (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "ids must be a non-empty array" });
  }

  const placeholders = ids.map(() => "?").join(",");
  const sql = `DELETE FROM classes WHERE class_id IN (${placeholders})`;

  db.query(sql, ids, (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    res.json({
      message: `${result.affectedRows} class(es) permanently deleted`,
    });
  });
};
