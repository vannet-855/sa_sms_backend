const db = require("../config/db");

// ──────────────────────────────────────────────
// GET /api/attendance — with search & pagination
// ──────────────────────────────────────────────
exports.getAll = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 1000;
  const offset = (page - 1) * limit;
  const search = req.query.search || "";
  const scheduleId = req.query.schedule_id || "";
  const studentId = req.query.student_id || "";
  const status = req.query.status || "";
  const dateFrom = req.query.date_from || "";
  const dateTo = req.query.date_to || "";

  let where = "WHERE 1=1";
  const params = [];

  if (search.trim()) {
    where +=
      " AND (st.first_name LIKE ? OR st.last_name LIKE ? OR st.student_code LIKE ?)";
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  if (scheduleId) {
    where += " AND a.schedule_id = ?";
    params.push(scheduleId);
  }

  if (studentId) {
    where += " AND a.student_id = ?";
    params.push(studentId);
  }

  if (status) {
    where += " AND a.status = ?";
    params.push(status);
  }

  if (dateFrom) {
    where += " AND a.attendance_date >= ?";
    params.push(dateFrom);
  }

  if (dateTo) {
    where += " AND a.attendance_date <= ?";
    params.push(dateTo);
  }

  const countSql = `SELECT COUNT(*) AS total FROM attendance a ${where}`;
  const dataSql = `
    SELECT a.*,
      st.first_name AS student_first_name,
      st.last_name AS student_last_name,
      st.student_code,
      s.day_of_week,
      s.start_time,
      s.end_time,
      s.room,
      cg.group_name,
      c.course_name,
      c.course_code,
      cl.class_code,
      t.full_name AS teacher_name
    FROM attendance a
    JOIN students st ON a.student_id = st.student_id
    JOIN schedules s ON a.schedule_id = s.schedule_id
    JOIN classes cl ON s.class_id = cl.class_id
    JOIN courses c ON cl.course_id = c.course_id
    JOIN class_groups cg ON cl.group_id = cg.group_id
    LEFT JOIN teachers t ON a.created_by = t.teacher_id
    ${where}
    ORDER BY a.attendance_date DESC, a.attendance_id DESC
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

      // Add computed student full_name
      const data = rows.map((r) => ({
        ...r,
        student_full_name: [r.student_first_name, r.student_last_name]
          .filter(Boolean)
          .join(" "),
      }));

      res.json({ data, total, page, limit });
    });
  });
};

// ──────────────────────────────────────────────
// GET /api/attendance/schedule/:scheduleId/date/:date
// Get attendance for a specific schedule + date (for taking attendance)
// ──────────────────────────────────────────────
exports.getByScheduleAndDate = (req, res) => {
  const { scheduleId, date } = req.params;

  const sql = `
    SELECT a.*,
      st.first_name AS student_first_name,
      st.last_name AS student_last_name,
      st.student_code
    FROM attendance a
    JOIN students st ON a.student_id = st.student_id
    WHERE a.schedule_id = ? AND a.attendance_date = ?
    ORDER BY st.first_name ASC
  `;

  db.query(sql, [scheduleId, date], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });

    const data = rows.map((r) => ({
      ...r,
      student_full_name: [r.student_first_name, r.student_last_name]
        .filter(Boolean)
        .join(" "),
    }));

    res.json(data);
  });
};

// ──────────────────────────────────────────────
// GET /api/attendance/schedule/:scheduleId/students
// Get enrolled students for a schedule's class (for taking attendance)
// ──────────────────────────────────────────────
exports.getEnrolledStudentsBySchedule = (req, res) => {
  const { scheduleId } = req.params;

  const sql = `
    SELECT st.student_id, st.first_name, st.last_name, st.student_code
    FROM students st
    JOIN enrollments e ON st.student_id = e.student_id
    WHERE e.class_id = (SELECT class_id FROM schedules WHERE schedule_id = ?)
    ORDER BY st.first_name ASC
  `;

  db.query(sql, [scheduleId], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });

    const data = rows.map((r) => ({
      ...r,
      student_full_name: [r.first_name, r.last_name].filter(Boolean).join(" "),
    }));

    res.json(data);
  });
};

// ──────────────────────────────────────────────
// GET /api/attendance/date/:date
// Get attendance for a specific date
// ──────────────────────────────────────────────
exports.getByDate = (req, res) => {
  const sql = `
    SELECT a.*,
      st.first_name AS student_first_name,
      st.last_name AS student_last_name,
      st.student_code,
      s.day_of_week,
      s.start_time,
      s.end_time,
      s.room,
      cg.group_name,
      c.course_name,
      c.course_code,
      cl.class_code
    FROM attendance a
    JOIN students st ON a.student_id = st.student_id
    JOIN schedules s ON a.schedule_id = s.schedule_id
    JOIN classes cl ON s.class_id = cl.class_id
    JOIN courses c ON cl.course_id = c.course_id
    JOIN class_groups cg ON cl.group_id = cg.group_id
    WHERE a.attendance_date = ?
    ORDER BY s.start_time ASC, st.first_name ASC
  `;

  db.query(sql, [req.params.date], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });

    const data = rows.map((r) => ({
      ...r,
      student_full_name: [r.student_first_name, r.student_last_name]
        .filter(Boolean)
        .join(" "),
    }));

    res.json(data);
  });
};

// ──────────────────────────────────────────────
// GET /api/attendance/student/:studentId
// Get attendance for a specific student
// ──────────────────────────────────────────────
exports.getByStudent = (req, res) => {
  const sql = `
    SELECT a.*,
      s.day_of_week,
      s.start_time,
      s.end_time,
      s.room,
      cg.group_name,
      c.course_name,
      c.course_code,
      cl.class_code
    FROM attendance a
    JOIN schedules s ON a.schedule_id = s.schedule_id
    JOIN classes cl ON s.class_id = cl.class_id
    JOIN courses c ON cl.course_id = c.course_id
    JOIN class_groups cg ON cl.group_id = cg.group_id
    WHERE a.student_id = ?
    ORDER BY a.attendance_date DESC, a.attendance_id DESC
  `;

  db.query(sql, [req.params.studentId], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    res.json(rows);
  });
};

// ──────────────────────────────────────────────
// GET /api/attendance/stats/student/:studentId
// Get attendance stats for a student
// ──────────────────────────────────────────────
exports.getStudentStats = (req, res) => {
  const sql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent_count,
      SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late_count,
      SUM(CASE WHEN status = 'Permission' THEN 1 ELSE 0 END) AS permission_count
    FROM attendance
    WHERE student_id = ?
  `;

  db.query(sql, [req.params.studentId], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    res.json(
      rows[0] || {
        total: 0,
        present_count: 0,
        absent_count: 0,
        late_count: 0,
        permission_count: 0,
      },
    );
  });
};

// ──────────────────────────────────────────────
// GET /api/attendance/:id
// ──────────────────────────────────────────────
exports.getById = (req, res) => {
  const sql = `
    SELECT a.*,
      st.first_name AS student_first_name,
      st.last_name AS student_last_name,
      st.student_code,
      s.day_of_week,
      s.start_time,
      s.end_time,
      s.room,
      cg.group_name,
      c.course_name,
      c.course_code,
      cl.class_code,
      t.full_name AS teacher_name
    FROM attendance a
    JOIN students st ON a.student_id = st.student_id
    JOIN schedules s ON a.schedule_id = s.schedule_id
    JOIN classes cl ON s.class_id = cl.class_id
    JOIN courses c ON cl.course_id = c.course_id
    JOIN class_groups cg ON cl.group_id = cg.group_id
    LEFT JOIN teachers t ON a.created_by = t.teacher_id
    WHERE a.attendance_id = ?
  `;

  db.query(sql, [req.params.id], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (rows.length === 0)
      return res.status(404).json({ message: "Attendance record not found" });

    const r = rows[0];
    res.json({
      ...r,
      student_full_name: [r.student_first_name, r.student_last_name]
        .filter(Boolean)
        .join(" "),
    });
  });
};

// ──────────────────────────────────────────────
// POST /api/attendance — create single record
// ──────────────────────────────────────────────
exports.create = (req, res) => {
  const {
    schedule_id,
    student_id,
    attendance_date,
    status,
    remark,
    created_by,
  } = req.body;

  if (!schedule_id || !student_id || !attendance_date) {
    return res.status(400).json({
      message:
        "Missing required fields: schedule_id, student_id, attendance_date",
    });
  }

  const sql = `INSERT INTO attendance (schedule_id, student_id, attendance_date, status, remark, created_by)
    VALUES (?, ?, ?, ?, ?, ?)`;

  db.query(
    sql,
    [
      schedule_id,
      student_id,
      attendance_date,
      status || "Present",
      remark || null,
      created_by || null,
    ],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            message:
              "Attendance record already exists for this student on this date and schedule",
          });
        }
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }
      res.status(201).json({
        message: "Attendance record created",
        attendance_id: result.insertId,
      });
    },
  );
};

// ──────────────────────────────────────────────
// POST /api/attendance/bulk — create/update multiple records
// ──────────────────────────────────────────────
exports.bulkUpsert = (req, res) => {
  const { records } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res
      .status(400)
      .json({ message: "records must be a non-empty array" });
  }

  let successCount = 0;
  let errorCount = 0;
  let processed = 0;

  for (const r of records) {
    if (!r.schedule_id || !r.student_id || !r.attendance_date) {
      errorCount++;
      processed++;
      if (processed === records.length) finish();
      continue;
    }

    // Upsert: INSERT ... ON DUPLICATE KEY UPDATE
    const sql = `INSERT INTO attendance (schedule_id, student_id, attendance_date, status, remark, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE status = VALUES(status), remark = VALUES(remark), created_by = VALUES(created_by)`;

    db.query(
      sql,
      [
        r.schedule_id,
        r.student_id,
        r.attendance_date,
        r.status || "Present",
        r.remark || null,
        r.created_by || null,
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
      message: `${successCount} record(s) saved, ${errorCount} error(s)`,
      success_count: successCount,
      error_count: errorCount,
    });
  }
};

// ──────────────────────────────────────────────
// POST /api/attendance/take — Teacher takes attendance
// Resolves teacher_id from JWT, validates schedule ownership
// ──────────────────────────────────────────────
exports.takeAttendance = (req, res) => {
  const userId = req.user.user_id;
  const { schedule_id, attendance_date, records } = req.body;

  if (!schedule_id || !attendance_date) {
    return res
      .status(400)
      .json({ message: "schedule_id and attendance_date are required" });
  }

  if (!Array.isArray(records) || records.length === 0) {
    return res
      .status(400)
      .json({ message: "records must be a non-empty array" });
  }

  // Resolve teacher_id from JWT user_id
  db.query(
    `SELECT teacher_id FROM teachers WHERE user_id = ?`,
    [userId],
    (err, teacherRows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (teacherRows.length === 0)
        return res.status(404).json({ message: "Teacher record not found" });

      const teacherId = teacherRows[0].teacher_id;

      // Verify schedule belongs to one of this teacher's classes
      db.query(
        `SELECT 1 FROM schedules s
         JOIN classes cl ON s.class_id = cl.class_id
         WHERE s.schedule_id = ? AND cl.teacher_id = ?`,
        [schedule_id, teacherId],
        (err, scheduleRows) => {
          if (err)
            return res
              .status(500)
              .json({ message: "Server error", error: err.message });
          if (scheduleRows.length === 0)
            return res
              .status(403)
              .json({ message: "Schedule not found or not assigned to you" });

          // Bulk upsert attendance records
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

            const sql = `INSERT INTO attendance (schedule_id, student_id, attendance_date, status, remark, created_by)
              VALUES (?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE status = VALUES(status), remark = VALUES(remark), created_by = VALUES(created_by)`;

            db.query(
              sql,
              [
                schedule_id,
                r.student_id,
                attendance_date,
                r.status || "Present",
                r.remark || null,
                teacherId,
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
              message: `${successCount} record(s) saved, ${errorCount} error(s)`,
              success_count: successCount,
              error_count: errorCount,
            });
          }
        },
      );
    },
  );
};

// ──────────────────────────────────────────────
// GET /api/attendance/teacher/schedules — Get teacher's schedules for attendance taking
// ──────────────────────────────────────────────
exports.getTeacherSchedules = (req, res) => {
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
        SELECT s.schedule_id, s.day_of_week, s.start_time, s.end_time, s.room,
               c.course_name, c.course_code, cg.group_name, cl.class_code, cl.class_id
        FROM schedules s
        JOIN classes cl ON s.class_id = cl.class_id
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        WHERE cl.teacher_id = ?
        ORDER BY FIELD(s.day_of_week, 'Mon','Tue','Wed','Thu','Fri','Sat'), s.start_time ASC
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

// ──────────────────────────────────────────────
// PUT /api/attendance/:id
// ──────────────────────────────────────────────
exports.update = (req, res) => {
  const allowed = [
    "schedule_id",
    "student_id",
    "attendance_date",
    "status",
    "remark",
    "created_by",
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
  const sql = `UPDATE attendance SET ${fields.join(", ")} WHERE attendance_id = ?`;

  db.query(sql, values, (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message: "Duplicate attendance record exists",
        });
      }
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Attendance record not found" });
    res.json({ message: "Attendance record updated successfully" });
  });
};

// ──────────────────────────────────────────────
// DELETE /api/attendance/:id
// ──────────────────────────────────────────────
exports.delete = (req, res) => {
  const sql = "DELETE FROM attendance WHERE attendance_id = ?";

  db.query(sql, [req.params.id], (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Attendance record not found" });
    res.json({ message: "Attendance record deleted" });
  });
};

// ──────────────────────────────────────────────
// POST /api/attendance/bulk-delete
// ──────────────────────────────────────────────
exports.bulkDelete = (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "ids must be a non-empty array" });
  }

  const placeholders = ids.map(() => "?").join(",");
  const sql = `DELETE FROM attendance WHERE attendance_id IN (${placeholders})`;

  db.query(sql, ids, (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    res.json({
      message: `${result.affectedRows} attendance record(s) deleted`,
    });
  });
};

// ──────────────────────────────────────────────
// GET /api/attendance/student/me
// Get current student's attendance records (resolves from JWT)
// ──────────────────────────────────────────────
exports.getMyAttendance = (req, res) => {
  const userId = req.user.user_id;

  db.query(
    `SELECT student_id FROM students WHERE user_id = ?`,
    [userId],
    (err, studentRows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (studentRows.length === 0)
        return res.status(404).json({ message: "Student not found" });

      const studentId = studentRows[0].student_id;

      const sql = `
        SELECT a.*,
          s.day_of_week,
          s.start_time,
          s.end_time,
          s.room,
          cg.group_name,
          c.course_name,
          c.course_code,
          cl.class_code
        FROM attendance a
        JOIN schedules s ON a.schedule_id = s.schedule_id
        JOIN classes cl ON s.class_id = cl.class_id
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        WHERE a.student_id = ?
        ORDER BY a.attendance_date DESC, a.attendance_id DESC
      `;

      db.query(sql, [studentId], (err, rows) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });
        res.json(rows || []);
      });
    },
  );
};

// ──────────────────────────────────────────────
// GET /api/attendance/student/me/stats
// Get current student's attendance stats (resolves from JWT)
// ──────────────────────────────────────────────
exports.getMyStats = (req, res) => {
  const userId = req.user.user_id;

  db.query(
    `SELECT student_id FROM students WHERE user_id = ?`,
    [userId],
    (err, studentRows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (studentRows.length === 0)
        return res.status(404).json({ message: "Student not found" });

      const studentId = studentRows[0].student_id;

      const sql = `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present_count,
          SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent_count,
          SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late_count,
          SUM(CASE WHEN status = 'Permission' THEN 1 ELSE 0 END) AS permission_count
        FROM attendance
        WHERE student_id = ?
      `;

      db.query(sql, [studentId], (err, rows) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });
        res.json(
          rows[0] || {
            total: 0,
            present_count: 0,
            absent_count: 0,
            late_count: 0,
            permission_count: 0,
          },
        );
      });
    },
  );
};

// ──────────────────────────────────────────────
// GET /api/attendance/student/my-schedules
// Get enrolled schedules for current student (resolves from JWT)
// ──────────────────────────────────────────────
exports.getStudentSchedules = (req, res) => {
  const userId = req.user.user_id;

  db.query(
    `SELECT student_id FROM students WHERE user_id = ?`,
    [userId],
    (err, studentRows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (studentRows.length === 0)
        return res.status(404).json({ message: "Student not found" });

      const studentId = studentRows[0].student_id;

      const sql = `
        SELECT DISTINCT s.schedule_id, s.day_of_week, s.start_time, s.end_time, s.room,
               c.course_name, c.course_code, cg.group_name, cl.class_code, cl.class_id
        FROM schedules s
        JOIN classes cl ON s.class_id = cl.class_id
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        JOIN enrollments e ON e.class_id = cl.class_id
        WHERE e.student_id = ?
        ORDER BY FIELD(s.day_of_week, 'Mon','Tue','Wed','Thu','Fri','Sat'), s.start_time ASC
      `;

      db.query(sql, [studentId], (err, rows) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });
        res.json(rows || []);
      });
    },
  );
};

// ──────────────────────────────────────────────
// POST /api/attendance/student/permission
// Student submits a permission request (status = 'Permission')
// Teacher will see this status when taking attendance
// ──────────────────────────────────────────────
exports.submitPermission = (req, res) => {
  const userId = req.user.user_id;
  const { schedule_id, attendance_date, remark } = req.body;

  if (!schedule_id || !attendance_date) {
    return res
      .status(400)
      .json({ message: "schedule_id and attendance_date are required" });
  }

  db.query(
    `SELECT student_id FROM students WHERE user_id = ?`,
    [userId],
    (err, studentRows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (studentRows.length === 0)
        return res.status(404).json({ message: "Student not found" });

      const studentId = studentRows[0].student_id;

      // Upsert: set status to 'Permission' so teacher sees it
      const sql = `INSERT INTO attendance (schedule_id, student_id, attendance_date, status, remark)
        VALUES (?, ?, ?, 'Permission', ?)
        ON DUPLICATE KEY UPDATE status = 'Permission', remark = VALUES(remark)`;

      db.query(
        sql,
        [schedule_id, studentId, attendance_date, remark || null],
        (err, result) => {
          if (err)
            return res
              .status(500)
              .json({ message: "Server error", error: err.message });

          res.status(201).json({
            message: "Permission submitted successfully",
            attendance_id: result.insertId || 0,
          });
        },
      );
    },
  );
};

// ──────────────────────────────────────────────
// DELETE /api/attendance/student/permission/:scheduleId/:date
// Student cancels their permission request (reverts to Present)
// ──────────────────────────────────────────────
exports.cancelPermission = (req, res) => {
  const userId = req.user.user_id;
  const { scheduleId, date } = req.params;

  db.query(
    `SELECT student_id FROM students WHERE user_id = ?`,
    [userId],
    (err, studentRows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (studentRows.length === 0)
        return res.status(404).json({ message: "Student not found" });

      const studentId = studentRows[0].student_id;

      const sql = `DELETE FROM attendance WHERE schedule_id = ? AND student_id = ? AND attendance_date = ? AND status = 'Permission'`;

      db.query(sql, [scheduleId, studentId, date], (err, result) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });
        res.json({ message: "Permission request cancelled" });
      });
    },
  );
};
