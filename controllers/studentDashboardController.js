const db = require("../config/db");

/**
 * GET /api/dashboard/student
 * Student-specific dashboard data based on JWT user_id
 */
exports.getStudentDashboard = (req, res) => {
  const userId = req.user.user_id;

  db.query(
    `SELECT student_id, first_name, last_name, group_id FROM students WHERE user_id = ?`,
    [userId],
    (err, studentRows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (studentRows.length === 0)
        return res.status(404).json({ message: "Student not found" });

      const studentId = studentRows[0].student_id;
      const groupId = studentRows[0].group_id;
      const studentName = `${studentRows[0].first_name} ${studentRows[0].last_name}`;

      // ── Queries ────────────────────────────────────────
      const totalClassesSQL = `
        SELECT COUNT(DISTINCT e.class_id) AS count
        FROM enrollments e
        WHERE e.student_id = ?
      `;

      const todayScheduleSQL = `
        SELECT s.schedule_id, s.day_of_week, s.start_time, s.end_time, s.room,
               c.course_name, c.course_code, cg.group_name, cl.class_code
        FROM schedules s
        JOIN classes cl ON s.class_id = cl.class_id
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        JOIN enrollments e ON e.class_id = cl.class_id
        WHERE e.student_id = ?
        AND s.day_of_week = ?
        ORDER BY s.start_time ASC
      `;

      const recentAttendanceSQL = `
        SELECT a.attendance_id, a.attendance_date, a.status,
               c.course_name, cg.group_name
        FROM attendance a
        JOIN schedules s ON a.schedule_id = s.schedule_id
        JOIN classes cl ON s.class_id = cl.class_id
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        WHERE a.student_id = ?
        ORDER BY a.attendance_date DESC, a.attendance_id DESC
        LIMIT 5
      `;

      const upcomingExamsSQL = `
        SELECT e.exam_id, e.exam_date, cg.group_name, et.name AS exam_type_name
        FROM exams e
        JOIN class_groups cg ON e.group_id = cg.group_id
        JOIN exam_types et ON e.exam_type_id = et.exam_type_id
        JOIN classes cl ON cl.group_id = cg.group_id
        JOIN enrollments en ON en.class_id = cl.class_id
        WHERE en.student_id = ?
        AND e.exam_date >= CURDATE()
        ORDER BY e.exam_date ASC
        LIMIT 5
      `;

      const attendanceStatsSQL = `
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0) AS present_count,
          COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0) AS absent_count,
          COALESCE(SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END), 0) AS late_count,
          COALESCE(SUM(CASE WHEN a.status = 'Permission' THEN 1 ELSE 0 END), 0) AS permission_count
        FROM attendance a
        WHERE a.student_id = ?
        AND a.attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `;

      const paymentSummarySQL = `
        SELECT
          COALESCE(SUM(p.amount), 0) AS total_paid,
          COALESCE(SUM(p.amount), 0) AS paid_amount,
          0 AS pending_amount
        FROM payments p
        WHERE p.student_id = ?
      `;

      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const todayDayName = days[new Date().getDay()];

      // ── Parallel execution ─────────────────────────────
      let pending = 6;
      const result = { studentName, studentId };
      let hasError = false;

      const checkDone = () => {
        if (pending === 0 && !hasError) {
          res.json(result);
        }
      };

      db.query(totalClassesSQL, [studentId], (err, rows) => {
        if (hasError) return;
        if (err) {
          hasError = true;
          return res
            .status(500)
            .json({ message: "Dashboard error", error: err.message });
        }
        result.totalClasses = rows[0]?.count ?? 0;
        pending--;
        checkDone();
      });

      db.query(todayScheduleSQL, [studentId, todayDayName], (err, rows) => {
        if (hasError) return;
        if (err) {
          hasError = true;
          return res
            .status(500)
            .json({ message: "Dashboard error", error: err.message });
        }
        result.todaySchedules = rows || [];
        result.todayScheduleCount = (rows || []).length;
        pending--;
        checkDone();
      });

      db.query(recentAttendanceSQL, [studentId], (err, rows) => {
        if (hasError) return;
        if (err) {
          hasError = true;
          return res
            .status(500)
            .json({ message: "Dashboard error", error: err.message });
        }
        result.recentAttendance = rows || [];
        pending--;
        checkDone();
      });

      db.query(upcomingExamsSQL, [studentId], (err, rows) => {
        if (hasError) return;
        if (err) {
          hasError = true;
          return res
            .status(500)
            .json({ message: "Dashboard error", error: err.message });
        }
        result.upcomingExams = rows || [];
        pending--;
        checkDone();
      });

      db.query(attendanceStatsSQL, [studentId], (err, rows) => {
        if (hasError) return;
        if (err) {
          hasError = true;
          return res
            .status(500)
            .json({ message: "Dashboard error", error: err.message });
        }
        result.attendanceStats = rows[0] || {
          total: 0,
          present_count: 0,
          absent_count: 0,
          late_count: 0,
          permission_count: 0,
        };
        pending--;
        checkDone();
      });

      db.query(paymentSummarySQL, [studentId], (err, rows) => {
        if (hasError) return;
        if (err) {
          hasError = true;
          return res
            .status(500)
            .json({ message: "Dashboard error", error: err.message });
        }
        result.paymentSummary = rows[0] || {
          total_paid: 0,
          paid_amount: 0,
          pending_amount: 0,
        };
        pending--;
        checkDone();
      });
    },
  );
};
