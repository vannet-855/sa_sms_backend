const db = require("../config/db");

exports.getAll = (req, res) => {
  const sql = `
    SELECT e.group_id, e.class_id,
           cg.group_name,
           cl.class_code,
           c.course_name,
           t.full_name AS teacher_name,
           COUNT(e.student_id) AS student_count
    FROM enrollments e
    JOIN class_groups cg ON e.group_id = cg.group_id
    JOIN classes cl ON e.class_id = cl.class_id
    JOIN courses c ON cl.course_id = c.course_id
    LEFT JOIN teachers t ON cl.teacher_id = t.teacher_id
    GROUP BY e.group_id, e.class_id, cg.group_name, cl.class_code, c.course_name, t.full_name
    ORDER BY cg.group_name ASC
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.getById = (req, res) => {
  const sql = `SELECT e.*, cg.group_name, c.course_name, cl.class_code
    FROM enrollments e 
    JOIN class_groups cg ON e.group_id = cg.group_id
    JOIN classes cl ON e.class_id = cl.class_id 
    JOIN courses c ON cl.course_id = c.course_id 
    WHERE e.enrollment_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0)
      return res.status(404).json({ message: "Enrollment not found" });
    res.json(result[0]);
  });
};

exports.getByGroup = (req, res) => {
  const sql = `SELECT e.*, cg.group_name, c.course_name, cl.class_code
    FROM enrollments e 
    JOIN class_groups cg ON e.group_id = cg.group_id
    JOIN classes cl ON e.class_id = cl.class_id 
    JOIN courses c ON cl.course_id = c.course_id 
    WHERE e.group_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.getByClass = (req, res) => {
  const sql = `SELECT e.*, cg.group_name, c.course_name, cl.class_code
    FROM enrollments e 
    JOIN class_groups cg ON e.group_id = cg.group_id
    JOIN classes cl ON e.class_id = cl.class_id 
    JOIN courses c ON cl.course_id = c.course_id 
    WHERE e.class_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.create = (req, res) => {
  const sql = "INSERT INTO enrollments SET ?";
  db.query(sql, req.body, (err, result) => {
    if (err) return res.status(500).json(err);
    res
      .status(201)
      .json({ message: "Enrollment created", id: result.insertId });
  });
};

exports.update = (req, res) => {
  const sql = "UPDATE enrollments SET ? WHERE enrollment_id = ?";
  db.query(sql, [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Enrollment not found" });
    res.json({ message: "Enrollment updated" });
  });
};

// ──────────────────────────────────────────────
// GET /api/enrollments/student/me — logged-in student's enrollments
// ──────────────────────────────────────────────
exports.getMyEnrollments = (req, res) => {
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
        SELECT e.enrollment_id, e.class_id,
               cl.class_code, c.course_id, c.course_name, c.course_code,
               cg.group_name, sem.semester_name, ay.year_label,
               sh.shift_name,
               (SELECT COUNT(*) FROM schedules s WHERE s.class_id = cl.class_id) AS schedule_count,
               t.full_name AS teacher_name
        FROM enrollments e
        JOIN classes cl ON e.class_id = cl.class_id
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        LEFT JOIN semesters sem ON cl.semester_id = sem.semester_id
        LEFT JOIN academic_years ay ON cl.year_id = ay.year_id
        LEFT JOIN shifts sh ON cl.shift_id = sh.shift_id
        LEFT JOIN teachers t ON cl.teacher_id = t.teacher_id
        WHERE e.student_id = ?
        ORDER BY e.enrollment_id DESC
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

// ──────────────────────────────────────────────
// GET /api/enrollments/students/:groupId/:classId – students in a group+class
// ──────────────────────────────────────────────
exports.getStudentsByGroupAndClass = (req, res) => {
  const { groupId, classId } = req.params;
  const sql = `
    SELECT s.student_id, s.student_code, s.first_name, s.last_name, s.gender,
           s.phone, s.status,
           e.enrollment_id
    FROM enrollments e
    JOIN students s ON e.student_id = s.student_id
    WHERE e.group_id = ? AND e.class_id = ?
    ORDER BY s.first_name ASC
  `;
  db.query(sql, [groupId, classId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.bulkCreate = (req, res) => {
  const { group_id, class_id } = req.body;

  if (!group_id || !class_id) {
    return res
      .status(400)
      .json({ message: "group_id and class_id are required" });
  }

  // 1. Get all students in the group
  const studentSql = `SELECT student_id FROM students WHERE group_id = ?`;

  db.query(studentSql, [group_id], (err, students) => {
    if (err) return res.status(500).json(err);
    if (students.length === 0) {
      return res
        .status(400)
        .json({ message: "No students found in the selected group" });
    }

    // 2. Get existing enrollments for this class to avoid duplicates
    const existingSql = `SELECT student_id FROM enrollments WHERE class_id = ?`;
    db.query(existingSql, [class_id], (err2, existing) => {
      if (err2) return res.status(500).json(err2);

      const existingStudentIds = new Set(existing.map((r) => r.student_id));

      // 3. Filter out already-enrolled students
      const newStudents = students.filter(
        (s) => !existingStudentIds.has(s.student_id),
      );

      if (newStudents.length === 0) {
        return res.status(400).json({
          message:
            "All students in this group are already enrolled in this class",
        });
      }

      // 4. Bulk insert
      const values = newStudents.map((s) => [group_id, class_id, s.student_id]);
      const insertSql = `INSERT INTO enrollments (group_id, class_id, student_id) VALUES ?`;

      db.query(insertSql, [values], (err3, result) => {
        if (err3) return res.status(500).json(err3);
        res.status(201).json({
          message: `${result.affectedRows} student(s) enrolled successfully`,
          enrolled: result.affectedRows,
          skipped: existingStudentIds.size,
        });
      });
    });
  });
};

// ──────────────────────────────────────────────
// DELETE /api/enrollments/bulk/:groupId/:classId — delete all enrollments for a group+class
// ──────────────────────────────────────────────
exports.bulkDelete = (req, res) => {
  const { groupId, classId } = req.params;
  const sql = "DELETE FROM enrollments WHERE group_id = ? AND class_id = ?";
  db.query(sql, [groupId, classId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({
      message: `${result.affectedRows} enrollment(s) deleted`,
      deleted: result.affectedRows,
    });
  });
};

// ──────────────────────────────────────────────
// GET /api/enrollments/teacher/class/:classId/students
// Teacher views students enrolled in their own class
// ──────────────────────────────────────────────
exports.getTeacherClassStudents = (req, res) => {
  const userId = req.user.user_id;
  const classId = req.params.classId;

  db.query(
    `SELECT teacher_id FROM teachers WHERE user_id = ?`,
    [userId],
    (err, teacherRows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (teacherRows.length === 0)
        return res.status(404).json({ message: "Teacher not found" });

      const teacherId = teacherRows[0].teacher_id;

      db.query(
        `SELECT 1 FROM classes WHERE class_id = ? AND teacher_id = ?`,
        [classId, teacherId],
        (err, classRows) => {
          if (err)
            return res
              .status(500)
              .json({ message: "Server error", error: err.message });
          if (classRows.length === 0)
            return res
              .status(403)
              .json({ message: "You are not assigned to this class" });

          const sql = `
            SELECT s.student_id, s.student_code, s.first_name, s.last_name,
                   s.gender, s.phone, s.status
            FROM enrollments e
            JOIN students s ON e.student_id = s.student_id
            WHERE e.class_id = ?
            ORDER BY s.first_name ASC
          `;
          db.query(sql, [classId], (err, students) => {
            if (err)
              return res
                .status(500)
                .json({ message: "Server error", error: err.message });
            res.json(students || []);
          });
        },
      );
    },
  );
};

exports.delete = (req, res) => {
  const sql = "DELETE FROM enrollments WHERE enrollment_id = ?";

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Enrollment not found" });
    res.json({ message: "Enrollment deleted" });
  });
};
