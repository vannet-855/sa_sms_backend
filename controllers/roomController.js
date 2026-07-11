const db = require("../config/db");

exports.getAll = (req, res) => {
  const sql = "SELECT * FROM rooms ORDER BY room_name ASC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

exports.getById = (req, res) => {
  const sql = "SELECT * FROM rooms WHERE room_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0)
      return res.status(404).json({ message: "Room not found" });
    res.json(result[0]);
  });
};

exports.create = (req, res) => {
  const sql = "INSERT INTO rooms SET ?";
  db.query(sql, req.body, (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(201).json({ room_id: result.insertId, ...req.body });
  });
};

exports.update = (req, res) => {
  const sql = "UPDATE rooms SET ? WHERE room_id = ?";
  db.query(sql, [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Room updated" });
  });
};

exports.delete = (req, res) => {
  const sql = "DELETE FROM rooms WHERE room_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Room deleted" });
  });
};

// ──────────────────────────────────────────────
// GET /api/rooms/availability?day=Mon&start_time=08:00&end_time=09:00
// Returns all rooms with busy/free status for a given time window
// ──────────────────────────────────────────────
exports.getAvailability = (req, res) => {
  const { day, start_time, end_time } = req.query;

  if (!day) {
    return res.status(400).json({ message: "day is required (Mon, Tue, ...)" });
  }

  let timeFilter = "";
  const params = [day];

  if (start_time && end_time) {
    timeFilter = "AND s.start_time < ? AND s.end_time > ?";
    params.push(end_time, start_time);
  }

  const roomSql = "SELECT * FROM rooms ORDER BY room_name ASC";

  db.query(roomSql, (errRooms, rooms) => {
    if (errRooms)
      return res
        .status(500)
        .json({ message: "Server error", error: errRooms.message });
    if (rooms.length === 0) return res.json([]);

    const busySql = `
      SELECT DISTINCT s.room,
        s.schedule_id, s.day_of_week, s.start_time, s.end_time,
        cl.class_id, cl.class_code,
        c.course_code, c.course_name,
        cg.group_name,
        t.full_name AS teacher_name
      FROM schedules s
      JOIN classes cl ON s.class_id = cl.class_id
      JOIN courses c ON cl.course_id = c.course_id
      JOIN class_groups cg ON cl.group_id = cg.group_id
      JOIN teachers t ON cl.teacher_id = t.teacher_id
      WHERE s.day_of_week = ? AND s.room IS NOT NULL AND s.room != '' ${timeFilter}
      ORDER BY s.start_time ASC
    `;

    db.query(busySql, params, (errBusy, busySlots) => {
      if (errBusy)
        return res
          .status(500)
          .json({ message: "Server error", error: errBusy.message });

      const busyMap = new Map();
      for (const slot of busySlots || []) {
        const roomName = slot.room;
        if (!busyMap.has(roomName)) busyMap.set(roomName, []);
        busyMap.get(roomName).push({
          schedule_id: slot.schedule_id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          class_id: slot.class_id,
          class_code: slot.class_code,
          course_code: slot.course_code,
          course_name: slot.course_name,
          group_name: slot.group_name,
          teacher_name: slot.teacher_name,
        });
      }

      const result = rooms.map((r) => {
        const busySlotsList = busyMap.get(r.room_name) || [];
        return {
          room_id: r.room_id,
          room_name: r.room_name,
          room_type: r.room_type,
          capacity: r.capacity,
          building: r.building,
          floor: r.floor,
          is_busy: busySlotsList.length > 0,
          busy_count: busySlotsList.length,
          busy_slots: busySlotsList,
        };
      });

      result.sort((a, b) => {
        if (a.is_busy !== b.is_busy) return a.is_busy ? -1 : 1;
        return a.room_name.localeCompare(b.room_name);
      });

      res.json({
        day,
        start_time: start_time || null,
        end_time: end_time || null,
        total_rooms: result.length,
        busy_rooms: result.filter((r) => r.is_busy).length,
        free_rooms: result.filter((r) => !r.is_busy).length,
        rooms: result,
      });
    });
  });
};
