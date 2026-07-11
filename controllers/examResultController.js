const db = require("../config/db");

exports.getAll = (req, res) => {
  const sql = `SELECT er.*, CONCAT(s.first_name, ' ', s.last_name) as student_name, s.student_code, e.exam_date, et.name as exam_type, cg.group_name
    FROM exam_results er 
    JOIN students s ON er.student_id = s.student_id 
    JOIN exams e ON er.exam_id = e.exam_id 
    JOIN exam_types et ON e.exam_type_id = et.exam_type_id 
    JOIN class_groups cg ON e.group_id = cg.group_id`;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.getById = (req, res) => {
  const sql = `SELECT er.*, CONCAT(s.first_name, ' ', s.last_name) as student_name, s.student_code, e.exam_date, et.name as exam_type, cg.group_name
    FROM exam_results er 
    JOIN students s ON er.student_id = s.student_id 
    JOIN exams e ON er.exam_id = e.exam_id 
    JOIN exam_types et ON e.exam_type_id = et.exam_type_id 
    JOIN class_groups cg ON e.group_id = cg.group_id 
    WHERE er.result_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0)
      return res.status(404).json({ message: "Exam result not found" });
    res.json(result[0]);
  });
};

exports.getByStudent = (req, res) => {
  const sql = `SELECT er.*, CONCAT(s.first_name, ' ', s.last_name) as student_name, s.student_code, e.exam_date, et.name as exam_type, cg.group_name
    FROM exam_results er 
    JOIN students s ON er.student_id = s.student_id 
    JOIN exams e ON er.exam_id = e.exam_id 
    JOIN exam_types et ON e.exam_type_id = et.exam_type_id 
    JOIN class_groups cg ON e.group_id = cg.group_id 
    WHERE er.student_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.getByExam = (req, res) => {
  const sql = `SELECT er.*, CONCAT(s.first_name, ' ', s.last_name) as student_name, s.student_code, e.exam_date, et.name as exam_type, cg.group_name
    FROM exam_results er 
    JOIN students s ON er.student_id = s.student_id 
    JOIN exams e ON er.exam_id = e.exam_id 
    JOIN exam_types et ON e.exam_type_id = et.exam_type_id 
    JOIN class_groups cg ON e.group_id = cg.group_id 
    WHERE er.exam_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.create = (req, res) => {
  const sql = "INSERT INTO exam_results SET ?";
  db.query(sql, req.body, (err, result) => {
    if (err) return res.status(500).json(err);
    res
      .status(201)
      .json({ message: "Exam result created", id: result.insertId });
  });
};

exports.update = (req, res) => {
  const sql = "UPDATE exam_results SET ? WHERE result_id = ?";
  db.query(sql, [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Exam result not found" });
    res.json({ message: "Exam result updated" });
  });
};

// ──────────────────────────────────────────────
// POST /api/exam-results/group
// Bulk create exam results for all students in a group
// ──────────────────────────────────────────────
exports.createGroupResults = (req, res) => {
  const { group_id, exam_id, score } = req.body;

  if (!group_id || !exam_id) {
    return res
      .status(400)
      .json({ message: "group_id and exam_id are required" });
  }

  const studentsSql = `
    SELECT DISTINCT st.student_id
    FROM students st
    JOIN enrollments enr ON st.student_id = enr.student_id
    JOIN classes cl ON enr.class_id = cl.class_id
    WHERE cl.group_id = ?
  `;

  db.query(studentsSql, [group_id], (err, students) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (students.length === 0) {
      return res
        .status(200)
        .json({ message: "No students found in group", count: 0 });
    }

    let done = 0;
    let ok = 0;
    let fail = 0;

    for (const s of students) {
      const sql = `INSERT INTO exam_results (exam_id, student_id, score)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE score = VALUES(score)`;

      db.query(sql, [exam_id, s.student_id, score ?? null], (err) => {
        if (err) fail++;
        else ok++;
        done++;
        if (done === students.length) {
          res.json({
            message: `${ok} result(s) created`,
            count: ok,
            errors: fail,
          });
        }
      });
    }
  });
};

// ──────────────────────────────────────────────
// GET /api/exam-results/group/:groupId/students
// Get students enrolled in a group (for cascaded Group → Student dropdown)
// ──────────────────────────────────────────────
exports.getStudentsByGroup = (req, res) => {
  const { groupId } = req.params;

  const sql = `
    SELECT DISTINCT st.student_id, st.first_name, st.last_name, st.student_code
    FROM students st
    JOIN enrollments enr ON st.student_id = enr.student_id
    JOIN classes cl ON enr.class_id = cl.class_id
    WHERE cl.group_id = ?
    ORDER BY st.first_name ASC
  `;

  db.query(sql, [groupId], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    res.json({ students: rows || [] });
  });
};

// ──────────────────────────────────────────────
// POST /api/exam-results/grade — Teacher grades an exam (bulk upsert)
// ──────────────────────────────────────────────
exports.gradeExam = (req, res) => {
  const userId = req.user.user_id;
  const { exam_id, results } = req.body;

  if (!exam_id) {
    return res.status(400).json({ message: "exam_id is required" });
  }

  if (!Array.isArray(results) || results.length === 0) {
    return res
      .status(400)
      .json({ message: "results must be a non-empty array" });
  }

  // Verify the exam exists
  db.query(
    `SELECT 1 FROM exams e WHERE e.exam_id = ?`,
    [exam_id],
    (err, examRows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (examRows.length === 0)
        return res.status(404).json({ message: "Exam not found" });

      // Bulk upsert exam results
      let successCount = 0;
      let errorCount = 0;
      let processed = 0;

      for (const r of results) {
        if (!r.student_id) {
          errorCount++;
          processed++;
          if (processed === results.length) finish();
          continue;
        }

        const sql = `INSERT INTO exam_results (exam_id, student_id, score)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE score = VALUES(score)`;

        db.query(sql, [exam_id, r.student_id, r.score ?? null], (err) => {
          if (err) {
            errorCount++;
          } else {
            successCount++;
          }
          processed++;
          if (processed === results.length) finish();
        });
      }

      function finish() {
        res.json({
          message: `${successCount} result(s) saved, ${errorCount} error(s)`,
          success_count: successCount,
          error_count: errorCount,
        });
      }
    },
  );
};

// ──────────────────────────────────────────────
// GET /api/exam-results/teacher/exams — Get teacher's exams for grading
// ──────────────────────────────────────────────
exports.getTeacherExams = (req, res) => {
  const sql = `
    SELECT e.exam_id, e.exam_date, e.group_id,
           et.name as exam_type_name, cg.group_name
    FROM exams e
    JOIN exam_types et ON e.exam_type_id = et.exam_type_id
    JOIN class_groups cg ON e.group_id = cg.group_id
    ORDER BY cg.group_name ASC, e.exam_date DESC
  `;

  db.query(sql, (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    res.json(rows || []);
  });
};

// ──────────────────────────────────────────────
// GET /api/exam-results/teacher/exam/:examId/students
// Get enrolled students + existing results for an exam
// ──────────────────────────────────────────────
exports.getExamStudents = (req, res) => {
  const { examId } = req.params;

  // Get group_id from the exam
  db.query(
    `SELECT e.group_id FROM exams e WHERE e.exam_id = ?`,
    [examId],
    (err, examRows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (examRows.length === 0)
        return res.status(404).json({ message: "Exam not found" });

      const groupId = examRows[0].group_id;

      // Get enrolled students via classes in this group
      const studentsSql = `
        SELECT st.student_id, st.first_name, st.last_name, st.student_code,
               CONCAT(st.first_name, ' ', st.last_name) AS student_full_name
        FROM students st
        JOIN enrollments enr ON st.student_id = enr.student_id
        JOIN classes cl ON enr.class_id = cl.class_id
        WHERE cl.group_id = ?
        ORDER BY st.first_name ASC
      `;

      // Get existing results for this exam
      const resultsSql = `
        SELECT er.result_id, er.student_id, er.score
        FROM exam_results er
        WHERE er.exam_id = ?
      `;

      db.query(studentsSql, [groupId], (err, students) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });

        db.query(resultsSql, [examId], (err, existingResults) => {
          if (err)
            return res
              .status(500)
              .json({ message: "Server error", error: err.message });

          res.json({
            students: students || [],
            existing_results: existingResults || [],
          });
        });
      });
    },
  );
};

// ──────────────────────────────────────────────
// GET /api/exam-results/student/me — logged-in student's exam results
// ──────────────────────────────────────────────
exports.getMyExamResults = (req, res) => {
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
        SELECT er.result_id, er.score, e.exam_id, e.exam_date,
               et.name AS exam_type_name, cg.group_name
        FROM exam_results er
        JOIN exams e ON er.exam_id = e.exam_id
        JOIN exam_types et ON e.exam_type_id = et.exam_type_id
        JOIN class_groups cg ON e.group_id = cg.group_id
        WHERE er.student_id = ?
        ORDER BY e.exam_date DESC
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
  const sql = "DELETE FROM exam_results WHERE result_id = ?";

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Exam result not found" });
    res.json({ message: "Exam result deleted" });
  });
};
