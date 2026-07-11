const db = require("../config/db");

exports.getAdminDashboard = (req, res) => {
  const queries = {
    totalStudents: `SELECT COUNT(*) AS count FROM students WHERE status != 'Dropped'`,
    totalTeachers: `SELECT COUNT(*) AS count FROM teachers`,
    totalSubjects: `SELECT COUNT(*) AS count FROM courses`,
    totalRevenue: `SELECT COALESCE(SUM(amount), 0) AS total FROM payments`,
    totalClasses: `SELECT COUNT(*) AS count FROM classes`,
    totalEnrollments: `SELECT COUNT(*) AS count FROM enrollments`,
  };

  const recentStudentsSQL = `
    SELECT s.student_id, s.first_name, s.last_name, s.student_code, s.status,
           m.name AS major_name
    FROM students s
    LEFT JOIN majors m ON s.major_id = m.major_id
    ORDER BY s.student_id DESC
    LIMIT 5
  `;

  const upcomingExamsSQL = `
    SELECT e.exam_id, e.exam_date,
           cg.group_name, et.name AS exam_type_name
    FROM exams e
    JOIN class_groups cg ON e.group_id = cg.group_id
    JOIN exam_types et ON e.exam_type_id = et.exam_type_id
    WHERE e.exam_date >= CURDATE()
    ORDER BY e.exam_date ASC
    LIMIT 5
  `;

  const attendanceStatsSQL = `
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END), 0) AS present_count,
      COALESCE(SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END), 0) AS absent_count,
      COALESCE(SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END), 0) AS late_count,
      COALESCE(SUM(CASE WHEN status = 'Permission' THEN 1 ELSE 0 END), 0) AS permission_count
    FROM attendance
    WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  `;

  const keys = Object.keys(queries);
  let pending = keys.length + 3; // +3 for the three extra queries
  const result = {};
  let hasError = false;

  const checkDone = () => {
    if (pending === 0 && !hasError) {
      res.json({
        totalStudents: Number(result.totalStudents) || 0,
        totalTeachers: Number(result.totalTeachers) || 0,
        totalSubjects: Number(result.totalSubjects) || 0,
        totalRevenue: Number(result.totalRevenue) || 0,
        totalClasses: Number(result.totalClasses) || 0,
        totalEnrollments: Number(result.totalEnrollments) || 0,
        recentStudents: result.recentStudents || [],
        upcomingExams: result.upcomingExams || [],
        attendanceStats: result.attendanceStats || {
          total: 0,
          present_count: 0,
          absent_count: 0,
          late_count: 0,
          permission_count: 0,
        },
      });
    }
  };

  // Run aggregate queries in parallel
  keys.forEach((key) => {
    db.query(queries[key], (err, rows) => {
      if (hasError) return;
      if (err) {
        hasError = true;
        return res
          .status(500)
          .json({ message: "Dashboard error", error: err.message });
      }
      result[key] = rows[0]?.count ?? rows[0]?.total ?? 0;
      pending--;
      checkDone();
    });
  });

  // Recent students
  db.query(recentStudentsSQL, (err, rows) => {
    if (hasError) return;
    if (err) {
      hasError = true;
      return res
        .status(500)
        .json({ message: "Dashboard error", error: err.message });
    }
    result.recentStudents = rows.map((r) => ({
      ...r,
      full_name: [r.first_name, r.last_name].filter(Boolean).join(" "),
    }));
    pending--;
    checkDone();
  });

  // Upcoming exams
  db.query(upcomingExamsSQL, (err, rows) => {
    if (hasError) return;
    if (err) {
      hasError = true;
      return res
        .status(500)
        .json({ message: "Dashboard error", error: err.message });
    }
    result.upcomingExams = rows;
    pending--;
    checkDone();
  });

  // Attendance stats (last 30 days)
  db.query(attendanceStatsSQL, (err, rows) => {
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
};

// ──────────────────────────────────────────────
// GET /api/dashboard/teacher
// Requires verifyToken + roleMiddleware("Teacher")
// Returns teacher-specific dashboard data based on JWT user_id
// ──────────────────────────────────────────────
exports.getTeacherDashboard = (req, res) => {
  const userId = req.user.user_id;

  // Look up teacher record from the authenticated user
  db.query(
    `SELECT teacher_id, full_name FROM teachers WHERE user_id = ?`,
    [userId],
    (err, teacherRows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (teacherRows.length === 0)
        return res.status(404).json({ message: "Teacher record not found" });

      const teacherId = teacherRows[0].teacher_id;
      const teacherName = teacherRows[0].full_name;

      // Resolve today's short day name
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const todayDayName = days[new Date().getDay()];

      // ── Queries ────────────────────────────────────────
      const totalClassesSQL = `SELECT COUNT(*) AS count FROM classes WHERE teacher_id = ?`;

      const totalStudentsSQL = `
        SELECT COUNT(DISTINCT e.student_id) AS count
        FROM enrollments e
        JOIN classes cl ON e.class_id = cl.class_id
        WHERE cl.teacher_id = ?
      `;

      const todaySchedulesSQL = `
        SELECT s.schedule_id, s.day_of_week, s.start_time, s.end_time, s.room,
               c.course_name, cg.group_name, cl.class_code
        FROM schedules s
        JOIN classes cl ON s.class_id = cl.class_id
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        WHERE cl.teacher_id = ?
        AND s.day_of_week = ?
        ORDER BY s.start_time ASC
      `;

      const myClassesSQL = `
        SELECT cl.class_id, cl.class_code, c.course_name, cg.group_name,
          (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = cl.class_id) AS student_count
        FROM classes cl
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        WHERE cl.teacher_id = ?
        ORDER BY c.course_name ASC
      `;

      const recentAttendanceSQL = `
        SELECT a.attendance_id, a.attendance_date, a.status,
          CONCAT(st.first_name, ' ', st.last_name) AS student_full_name,
          st.student_code, c.course_name, cg.group_name
        FROM attendance a
        JOIN students st ON a.student_id = st.student_id
        JOIN schedules s ON a.schedule_id = s.schedule_id
        JOIN classes cl ON s.class_id = cl.class_id
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        WHERE cl.teacher_id = ?
        ORDER BY a.attendance_date DESC, a.attendance_id DESC
        LIMIT 5
      `;

      const upcomingExamsSQL = `
        SELECT e.exam_id, e.exam_date, cg.group_name, et.name AS exam_type_name
        FROM exams e
        JOIN class_groups cg ON e.group_id = cg.group_id
        JOIN exam_types et ON e.exam_type_id = et.exam_type_id
        JOIN classes cl ON cl.group_id = cg.group_id
        WHERE cl.teacher_id = ?
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
        JOIN schedules s ON a.schedule_id = s.schedule_id
        JOIN classes cl ON s.class_id = cl.class_id
        WHERE cl.teacher_id = ?
        AND a.attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `;

      // ── Parallel execution ─────────────────────────────
      let pending = 7;
      const result = { teacherName };
      let hasError = false;

      const checkDone = () => {
        if (pending === 0 && !hasError) {
          res.json({
            teacherName: result.teacherName,
            totalClasses: Number(result.totalClasses) || 0,
            totalStudents: Number(result.totalStudents) || 0,
            todaySchedules: result.todaySchedules || [],
            todayScheduleCount: (result.todaySchedules || []).length,
            myClasses: result.myClasses || [],
            recentAttendance: result.recentAttendance || [],
            upcomingExams: result.upcomingExams || [],
            attendanceStats: result.attendanceStats || {
              total: 0,
              present_count: 0,
              absent_count: 0,
              late_count: 0,
              permission_count: 0,
            },
          });
        }
      };

      db.query(totalClassesSQL, [teacherId], (err, rows) => {
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

      db.query(totalStudentsSQL, [teacherId], (err, rows) => {
        if (hasError) return;
        if (err) {
          hasError = true;
          return res
            .status(500)
            .json({ message: "Dashboard error", error: err.message });
        }
        result.totalStudents = rows[0]?.count ?? 0;
        pending--;
        checkDone();
      });

      db.query(todaySchedulesSQL, [teacherId, todayDayName], (err, rows) => {
        if (hasError) return;
        if (err) {
          hasError = true;
          return res
            .status(500)
            .json({ message: "Dashboard error", error: err.message });
        }
        result.todaySchedules = rows || [];
        pending--;
        checkDone();
      });

      db.query(myClassesSQL, [teacherId], (err, rows) => {
        if (hasError) return;
        if (err) {
          hasError = true;
          return res
            .status(500)
            .json({ message: "Dashboard error", error: err.message });
        }
        result.myClasses = rows || [];
        pending--;
        checkDone();
      });

      db.query(recentAttendanceSQL, [teacherId], (err, rows) => {
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

      db.query(upcomingExamsSQL, [teacherId], (err, rows) => {
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

      db.query(attendanceStatsSQL, [teacherId], (err, rows) => {
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
    },
  );
};
