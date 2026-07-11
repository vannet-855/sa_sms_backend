const db = require("../config/db");

exports.getAll = (req, res) => {
  const sql = `SELECT cr.*, CONCAT(s.first_name, ' ', s.last_name) as student_name, s.student_code, c.course_name 
    FROM course_results cr 
    JOIN students s ON cr.student_id = s.student_id 
    JOIN courses c ON cr.course_id = c.course_id`;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.getById = (req, res) => {
  const sql = `SELECT cr.*, CONCAT(s.first_name, ' ', s.last_name) as student_name, s.student_code, c.course_name 
    FROM course_results cr 
    JOIN students s ON cr.student_id = s.student_id 
    JOIN courses c ON cr.course_id = c.course_id 
    WHERE cr.result_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0)
      return res.status(404).json({ message: "Course result not found" });
    res.json(result[0]);
  });
};

exports.getByStudent = (req, res) => {
  const sql = `SELECT cr.*, CONCAT(s.first_name, ' ', s.last_name) as student_name, s.student_code, c.course_name 
    FROM course_results cr 
    JOIN students s ON cr.student_id = s.student_id 
    JOIN courses c ON cr.course_id = c.course_id 
    WHERE cr.student_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

/** Get all course results for teacher's classes */
exports.getByTeacher = (req, res) => {
  const userId = req.user.user_id;

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

      const sql = `
        SELECT cr.*, 
          CONCAT(s.first_name, ' ', s.last_name) as student_name, 
          s.student_code,
          c.course_name, c.course_code,
          cg.group_name, cl.class_code, cl.class_id
        FROM course_results cr
        JOIN students s ON cr.student_id = s.student_id
        JOIN courses c ON cr.course_id = c.course_id
        JOIN classes cl ON c.course_id = cl.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        WHERE cl.teacher_id = ?
        ORDER BY c.course_name, s.first_name ASC
      `;

      db.query(sql, [teacherId], (err, rows) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });
        res.json(rows || []);
      });
    },
  );
};

/** Get teacher's classes with course info for the course results page */
exports.getTeacherClasses = (req, res) => {
  const userId = req.user.user_id;

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

      const sql = `
        SELECT cl.class_id, cl.class_code, c.course_id, c.course_name, c.course_code,
               cg.group_id, cg.group_name
        FROM classes cl
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        WHERE cl.teacher_id = ?
        ORDER BY cg.group_name, c.course_name
      `;

      db.query(sql, [teacherId], (err, rows) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });
        res.json(rows || []);
      });
    },
  );
};

/** Get enrolled students + existing course results for a teacher's group */
exports.getGroupStudents = (req, res) => {
  const userId = req.user.user_id;
  const { groupName } = req.params;

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

      // Find teacher's class for this group
      const classSql = `
        SELECT cl.class_id, cl.course_id, c.course_name, c.course_code,
               c.midterm_max, c.final_max, cg.group_name
        FROM classes cl
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        WHERE cl.teacher_id = ? AND cg.group_name = ?
        LIMIT 1
      `;

      db.query(classSql, [teacherId, groupName], (err, classRows) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });
        if (classRows.length === 0)
          return res
            .status(404)
            .json({ message: "No class found for this group" });

        const {
          class_id: classId,
          course_id: courseId,
          course_name,
          course_code,
          midterm_max,
          final_max,
        } = classRows[0];

        const midtermMax = Number(midterm_max) || 40;
        const finalMax = Number(final_max) || 60;

        // Enrolled students
        const studentsSql = `
          SELECT st.student_id, st.first_name, st.last_name, st.student_code,
                 CONCAT(st.first_name, ' ', st.last_name) AS student_full_name
          FROM students st
          JOIN enrollments e ON st.student_id = e.student_id
          WHERE e.class_id = ?
          ORDER BY st.first_name ASC
        `;

        // Existing course results
        const resultsSql = `
          SELECT cr.result_id, cr.student_id, cr.midterm, cr.final, cr.total, cr.grade, cr.grade_point
          FROM course_results cr
          WHERE cr.course_id = ?
        `;

        db.query(studentsSql, [classId], (err, students) => {
          if (err)
            return res
              .status(500)
              .json({ message: "Server error", error: err.message });

          db.query(resultsSql, [courseId], (err, results) => {
            if (err)
              return res
                .status(500)
                .json({ message: "Server error", error: err.message });

            res.json({
              class_id: classId,
              course_id: courseId,
              course_name,
              course_code,
              midterm_max: midtermMax,
              final_max: finalMax,
              students: students || [],
              existing_results: results || [],
            });
          });
        });
      });
    },
  );
};

/** Teacher grades course results (bulk upsert with auto-calculate) */
exports.gradeCourse = (req, res) => {
  const userId = req.user.user_id;
  const { course_id, records } = req.body;

  if (!course_id) {
    return res.status(400).json({ message: "course_id is required" });
  }

  if (!Array.isArray(records) || records.length === 0) {
    return res
      .status(400)
      .json({ message: "records must be a non-empty array" });
  }

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

      // Get course max limits first
      db.query(
        `SELECT midterm_max, final_max FROM courses WHERE course_id = ?`,
        [course_id],
        (err, courseRows) => {
          if (err)
            return res
              .status(500)
              .json({ message: "Server error", error: err.message });
          if (courseRows.length === 0)
            return res.status(404).json({ message: "Course not found" });

          const midtermMax = Number(courseRows[0]?.midterm_max ?? 40);
          const finalMax = Number(courseRows[0]?.final_max ?? 60);

          // Verify teacher has a class with this course_id
          db.query(
            `SELECT 1 FROM classes WHERE course_id = ? AND teacher_id = ? LIMIT 1`,
            [course_id, teacherId],
            (err, classRows) => {
              if (err)
                return res
                  .status(500)
                  .json({ message: "Server error", error: err.message });
              if (classRows.length === 0)
                return res
                  .status(403)
                  .json({ message: "Course not assigned to you" });

              let successCount = 0;
              let errorCount = 0;
              let processed = 0;

              for (const r of records) {
                if (!r.student_id) {
                  errorCount++;
                  processed++;
                  if (processed === records.length) finish();
                  continue;
                }

                const midterm = r.midterm !== undefined ? r.midterm : null;
                const final = r.final !== undefined ? r.final : null;

                // Validate against course max limits
                if (midterm !== null && Number(midterm) > midtermMax) {
                  errorCount++;
                  processed++;
                  if (processed === records.length) finish();
                  continue;
                }

                if (final !== null && Number(final) > finalMax) {
                  errorCount++;
                  processed++;
                  if (processed === records.length) finish();
                  continue;
                }

                // Calculate grade: total = mid + fin (raw scores)
                const mid = Number(midterm) || 0;
                const fin = Number(final) || 0;
                const total =
                  Math.round((mid + fin + Number.EPSILON) * 100) / 100;

                let grade, grade_point;
                if (total >= 85) {
                  grade = "A";
                  grade_point = 4.0;
                } else if (total >= 70) {
                  grade = "B";
                  grade_point = 3.0;
                } else if (total >= 50) {
                  grade = "C";
                  grade_point = 2.0;
                } else if (total >= 40) {
                  grade = "D";
                  grade_point = 1.0;
                } else {
                  grade = "F";
                  grade_point = 0.0;
                }

                const sql = `INSERT INTO course_results (course_id, student_id, midterm, final, total, grade, grade_point)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE 
                    midterm = VALUES(midterm),
                    final = VALUES(final),
                    total = VALUES(total),
                    grade = VALUES(grade),
                    grade_point = VALUES(grade_point)`;

                db.query(
                  sql,
                  [
                    course_id,
                    r.student_id,
                    midterm,
                    final,
                    total,
                    grade,
                    grade_point,
                  ],
                  (err) => {
                    if (err) {
                      errorCount++;
                    } else {
                      successCount++;
                    }
                    processed++;
                    if (processed === records.length) finish();
                  },
                );
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
        },
      );
    },
  );
};

exports.getByCourse = (req, res) => {
  const sql = `SELECT cr.*, CONCAT(s.first_name, ' ', s.last_name) as student_name, s.student_code, c.course_name 
    FROM course_results cr 
    JOIN students s ON cr.student_id = s.student_id 
    JOIN courses c ON cr.course_id = c.course_id 
    WHERE cr.course_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

/** Calculate total, grade, and grade_point from midterm and final scores */
function calculateGrade(midterm, final) {
  const mid = Number(midterm) || 0;
  const fin = Number(final) || 0;
  const total = Math.round((mid + fin + Number.EPSILON) * 100) / 100;

  let grade, grade_point;
  if (total >= 85) {
    grade = "A";
    grade_point = 4.0;
  } else if (total >= 70) {
    grade = "B";
    grade_point = 3.0;
  } else if (total >= 50) {
    grade = "C";
    grade_point = 2.0;
  } else if (total >= 40) {
    grade = "D";
    grade_point = 1.0;
  } else {
    grade = "F";
    grade_point = 0.0;
  }

  return { total, grade, grade_point };
}

exports.create = (req, res) => {
  const { midterm, final } = req.body;
  const calculated = calculateGrade(midterm, final);

  const data = {
    ...req.body,
    total: calculated.total,
    grade: calculated.grade,
    grade_point: calculated.grade_point,
  };

  const sql = "INSERT INTO course_results SET ?";
  db.query(sql, data, (err, result) => {
    if (err) return res.status(500).json(err);
    res
      .status(201)
      .json({ message: "Course result created", id: result.insertId });
  });
};

exports.update = (req, res) => {
  // Recalculate if midterm or final changed
  const { midterm, final } = req.body;
  if (midterm !== undefined || final !== undefined) {
    const existing = req.body;
    const calculated = calculateGrade(
      existing.midterm !== undefined ? existing.midterm : undefined,
      existing.final !== undefined ? existing.final : undefined,
    );
    req.body.total = calculated.total;
    req.body.grade = calculated.grade;
    req.body.grade_point = calculated.grade_point;
  }

  const sql = "UPDATE course_results SET ? WHERE result_id = ?";
  db.query(sql, [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Course result not found" });
    res.json({ message: "Course result updated" });
  });
};

// ──────────────────────────────────────────────
// POST /api/course-results/group
// Bulk create results for all students in a group for a given course
// ──────────────────────────────────────────────
exports.createGroupResults = (req, res) => {
  const { group_id, course_id, course_code, midterm, final } = req.body;

  if (!group_id) {
    return res.status(400).json({ message: "group_id is required" });
  }

  // Find a class for this group
  const classSql = course_code
    ? `SELECT cl.class_id, cl.course_id FROM classes cl JOIN courses c ON cl.course_id = c.course_id JOIN class_groups cg ON cl.group_id = cg.group_id WHERE cg.group_id = ? AND c.course_code = ? LIMIT 1`
    : `SELECT cl.class_id, cl.course_id FROM classes cl JOIN class_groups cg ON cl.group_id = cg.group_id WHERE cg.group_id = ? LIMIT 1`;

  const classParams = course_code ? [group_id, course_code] : [group_id];

  db.query(classSql, classParams, (err, classRows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (classRows.length === 0) {
      // Fallback: use course_id if provided directly
      if (!course_id)
        return res
          .status(404)
          .json({ message: "No class found for this group" });
      doBulkCreate(course_id, group_id, midterm, final, res);
      return;
    }
    doBulkCreate(classRows[0].course_id, group_id, midterm, final, res);
  });
};

function doBulkCreate(courseId, groupId, midterm, final, res) {
  const studentsSql = `
    SELECT DISTINCT st.student_id
    FROM students st
    JOIN enrollments enr ON st.student_id = enr.student_id
    JOIN classes cl ON enr.class_id = cl.class_id
    WHERE cl.group_id = ?
  `;

  db.query(studentsSql, [groupId], (err, students) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (students.length === 0) {
      return res
        .status(200)
        .json({ message: "No students found in group", count: 0 });
    }

    const mid = Number(midterm) || 0;
    const fin = Number(final) || 0;
    const total = Math.round((mid + fin + Number.EPSILON) * 100) / 100;

    let grade, grade_point;
    if (total >= 85) {
      grade = "A";
      grade_point = 4.0;
    } else if (total >= 70) {
      grade = "B";
      grade_point = 3.0;
    } else if (total >= 50) {
      grade = "C";
      grade_point = 2.0;
    } else if (total >= 40) {
      grade = "D";
      grade_point = 1.0;
    } else {
      grade = "F";
      grade_point = 0.0;
    }

    let done = 0;
    let ok = 0;
    let fail = 0;

    for (const s of students) {
      const sql = `INSERT INTO course_results (course_id, student_id, midterm, final, total, grade, grade_point)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          midterm = VALUES(midterm),
          final = VALUES(final),
          total = VALUES(total),
          grade = VALUES(grade),
          grade_point = VALUES(grade_point)`;

      db.query(
        sql,
        [courseId, s.student_id, midterm, final, total, grade, grade_point],
        (err) => {
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
        },
      );
    }
  });
}

// ──────────────────────────────────────────────
// GET /api/course-results/student/me — logged-in student's course results
// ──────────────────────────────────────────────
exports.getMyCourseResults = (req, res) => {
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
        SELECT cr.result_id, cr.midterm, cr.final, cr.total, cr.grade, cr.grade_point,
               c.course_id, c.course_name, c.course_code,
               cg.group_name
        FROM course_results cr
        JOIN courses c ON cr.course_id = c.course_id
        JOIN classes cl ON c.course_id = cl.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        JOIN enrollments e ON e.class_id = cl.class_id AND e.student_id = cr.student_id
        WHERE cr.student_id = ?
        GROUP BY cr.result_id, cr.midterm, cr.final, cr.total, cr.grade, cr.grade_point,
                 c.course_id, c.course_name, c.course_code, cg.group_name
        ORDER BY c.course_name ASC
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
  const sql = "DELETE FROM course_results WHERE result_id = ?";

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Course result not found" });
    res.json({ message: "Course result deleted" });
  });
};
