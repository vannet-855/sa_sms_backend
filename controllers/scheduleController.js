const db = require("../config/db");

exports.getAll = (req, res) => {
  const sql = `SELECT s.*, cg.group_name, c.course_name, cl.class_id, cl.class_code
    FROM schedules s 
    JOIN classes cl ON s.class_id = cl.class_id 
    JOIN courses c ON cl.course_id = c.course_id 
    JOIN class_groups cg ON cl.group_id = cg.group_id`;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.getById = (req, res) => {
  const sql = `SELECT s.*, cg.group_name, c.course_name, cl.class_id 
    FROM schedules s 
    JOIN classes cl ON s.class_id = cl.class_id 
    JOIN courses c ON cl.course_id = c.course_id 
    JOIN class_groups cg ON cl.group_id = cg.group_id 
    WHERE s.schedule_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0)
      return res.status(404).json({ message: "Schedule not found" });
    res.json(result[0]);
  });
};

exports.getByClass = (req, res) => {
  const sql = `SELECT s.*, cg.group_name, c.course_name, cl.class_id 
    FROM schedules s 
    JOIN classes cl ON s.class_id = cl.class_id 
    JOIN courses c ON cl.course_id = c.course_id 
    JOIN class_groups cg ON cl.group_id = cg.group_id 
    WHERE s.class_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.getByDay = (req, res) => {
  const sql = `SELECT s.*, cg.group_name, c.course_name, cl.class_id 
    FROM schedules s 
    JOIN classes cl ON s.class_id = cl.class_id 
    JOIN courses c ON cl.course_id = c.course_id 
    JOIN class_groups cg ON cl.group_id = cg.group_id 
    WHERE s.day_of_week = ?`;

  db.query(sql, [req.params.day], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.create = (req, res) => {
  const { class_id, day_of_week, start_time, end_time, room } = req.body;
  const sql =
    "INSERT INTO schedules (class_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?)";

  db.query(
    sql,
    [class_id, day_of_week, start_time, end_time, room],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res
        .status(201)
        .json({ message: "Schedule created", id: result.insertId });
    },
  );
};

exports.update = (req, res) => {
  const { class_id, day_of_week, start_time, end_time, room } = req.body;
  const sql =
    "UPDATE schedules SET class_id = ?, day_of_week = ?, start_time = ?, end_time = ?, room = ? WHERE schedule_id = ?";

  db.query(
    sql,
    [class_id, day_of_week, start_time, end_time, room, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Schedule not found" });
      res.json({ message: "Schedule updated" });
    },
  );
};

// ──────────────────────────────────────────────
// GET /api/schedules/teacher — get all schedules for the logged-in teacher
// Uses JWT user_id to resolve teacher_id, then filters by teacher's classes
// ──────────────────────────────────────────────
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
        SELECT s.*, cg.group_name, c.course_name, c.course_code, cl.class_code,
               cl.class_id
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
// GET /api/schedules/student — get student's own schedule
// ──────────────────────────────────────────────
exports.getStudentSchedule = (req, res) => {
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
        SELECT s.*, cg.group_name, c.course_name, c.course_code, cl.class_code
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
// GET /api/schedules/teacher-availability?day=Mon&start_time=08:00&end_time=10:00
// Returns ALL teachers with busy/free status for a given time window
// ──────────────────────────────────────────────
exports.getTeacherAvailability = (req, res) => {
  const { day, start_time, end_time } = req.query;

  if (!day)
    return res.status(400).json({ message: "day is required (Mon, Tue, ...)" });

  // Build time overlap condition (optional: full day view if no times given)
  let timeFilter = "";
  const params = [day];

  if (start_time && end_time) {
    timeFilter = "AND s.start_time < ? AND s.end_time > ?";
    params.push(end_time, start_time);
  }

  // Get ALL teachers
  const teacherSql = `SELECT teacher_id, full_name, phone, email FROM teachers ORDER BY full_name ASC`;

  db.query(teacherSql, (errTeachers, teachers) => {
    if (errTeachers)
      return res
        .status(500)
        .json({ message: "Server error", error: errTeachers.message });

    if (teachers.length === 0) return res.json([]);

    // Get all busy teachers in the time window
    const busySql = `
      SELECT DISTINCT cl.teacher_id,
        s.schedule_id, s.day_of_week, s.start_time, s.end_time, s.room,
        cl.class_id, cl.class_code,
        c.course_code, c.course_name,
        cg.group_name
      FROM schedules s
      JOIN classes cl ON s.class_id = cl.class_id
      JOIN courses c ON cl.course_id = c.course_id
      JOIN class_groups cg ON cl.group_id = cg.group_id
      WHERE s.day_of_week = ? ${timeFilter}
      ORDER BY s.start_time ASC
    `;

    db.query(busySql, params, (errBusy, busySlots) => {
      if (errBusy)
        return res
          .status(500)
          .json({ message: "Server error", error: errBusy.message });

      // Build a Map: teacher_id → array of busy slots
      const busyMap = new Map();
      for (const slot of busySlots || []) {
        const tid = slot.teacher_id;
        if (!busyMap.has(tid)) busyMap.set(tid, []);
        busyMap.get(tid).push({
          schedule_id: slot.schedule_id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          room: slot.room,
          class_id: slot.class_id,
          class_code: slot.class_code,
          course_code: slot.course_code,
          course_name: slot.course_name,
          group_name: slot.group_name,
        });
      }

      // Map each teacher to availability status
      const result = teachers.map((t) => {
        const busySlotsList = busyMap.get(t.teacher_id) || [];
        return {
          teacher_id: t.teacher_id,
          full_name: t.full_name,
          phone: t.phone,
          email: t.email,
          is_busy: busySlotsList.length > 0,
          busy_count: busySlotsList.length,
          busy_slots: busySlotsList,
        };
      });

      // Sort: busy first, then by name
      result.sort((a, b) => {
        if (a.is_busy !== b.is_busy) return a.is_busy ? -1 : 1;
        return a.full_name.localeCompare(b.full_name);
      });

      res.json({
        day,
        start_time: start_time || null,
        end_time: end_time || null,
        total_teachers: result.length,
        busy_teachers: result.filter((r) => r.is_busy).length,
        free_teachers: result.filter((r) => !r.is_busy).length,
        teachers: result,
      });
    });
  });
};

// ──────────────────────────────────────────────
// GET /api/schedules/check-teacher?teacher_id=1&day=Mon&start_time=08:00&end_time=09:00
// Returns whether a specific teacher is available (true = available, false = busy)
// ──────────────────────────────────────────────
exports.checkTeacherAvailability = (req, res) => {
  const { teacher_id, day, start_time, end_time } = req.query;

  if (!teacher_id || !day) {
    return res.status(400).json({ message: "teacher_id and day are required" });
  }

  let timeFilter = "";
  const params = [teacher_id, day];

  if (start_time && end_time) {
    timeFilter = "AND s.start_time < ? AND s.end_time > ?";
    params.push(end_time, start_time);
  }

  const sql = `
    SELECT s.schedule_id, s.day_of_week, s.start_time, s.end_time, s.room,
           cl.class_id, cl.class_code,
           c.course_code, c.course_name,
           cg.group_name
    FROM schedules s
    JOIN classes cl ON s.class_id = cl.class_id
    JOIN courses c ON cl.course_id = c.course_id
    JOIN class_groups cg ON cl.group_id = cg.group_id
    WHERE cl.teacher_id = ? AND s.day_of_week = ? ${timeFilter}
    ORDER BY s.start_time ASC
  `;

  db.query(sql, params, (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });

    const is_available = (rows || []).length === 0;
    res.json({
      teacher_id: parseInt(teacher_id),
      day,
      start_time: start_time || null,
      end_time: end_time || null,
      is_available,
      conflict_count: (rows || []).length,
      conflicts: rows || [],
    });
  });
};

exports.delete = (req, res) => {
  const sql = "DELETE FROM schedules WHERE schedule_id = ?";

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Schedule not found" });
    res.json({ message: "Schedule deleted" });
  });
};
