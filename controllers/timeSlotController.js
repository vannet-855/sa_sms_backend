const db = require("../config/db");

// ──────────────────────────────────────────────
// GET /api/time-slots — list all time slots
// Optional filter: ?shift_id=1
// ──────────────────────────────────────────────
exports.getAll = (req, res) => {
  const { shift_id } = req.query;
  let sql = `
    SELECT ts.*, s.shift_name
    FROM time_slots ts
    JOIN shifts s ON ts.shift_id = s.shift_id
  `;
  const params = [];

  if (shift_id) {
    sql += " WHERE ts.shift_id = ?";
    params.push(shift_id);
  }

  sql += " ORDER BY s.shift_id, ts.start_time ASC";

  db.query(sql, params, (err, results) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    res.json(results);
  });
};

exports.getById = (req, res) => {
  const sql = `
    SELECT ts.*, s.shift_name
    FROM time_slots ts
    JOIN shifts s ON ts.shift_id = s.shift_id
    WHERE ts.time_slot_id = ?
  `;
  db.query(sql, [req.params.id], (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (result.length === 0)
      return res.status(404).json({ message: "Time slot not found" });
    res.json(result[0]);
  });
};

// ──────────────────────────────────────────────
// GET /api/time-slots/by-shift/:shiftId
// ──────────────────────────────────────────────
exports.getByShift = (req, res) => {
  const sql = `
    SELECT ts.*, s.shift_name
    FROM time_slots ts
    JOIN shifts s ON ts.shift_id = s.shift_id
    WHERE ts.shift_id = ?
    ORDER BY ts.start_time ASC
  `;
  db.query(sql, [req.params.shiftId], (err, results) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    res.json(results);
  });
};

exports.create = (req, res) => {
  const { shift_id, period_label, start_time, end_time } = req.body;

  if (!shift_id || !period_label || !start_time || !end_time) {
    return res.status(400).json({
      message: "shift_id, period_label, start_time, and end_time are required",
    });
  }

  const sql = `
    INSERT INTO time_slots (shift_id, period_label, start_time, end_time)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    sql,
    [shift_id, period_label, start_time, end_time],
    (err, result) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      res.status(201).json({
        time_slot_id: result.insertId,
        shift_id,
        period_label,
        start_time,
        end_time,
      });
    },
  );
};

exports.update = (req, res) => {
  const { shift_id, period_label, start_time, end_time } = req.body;

  const fields = [];
  const values = [];

  if (shift_id !== undefined) {
    fields.push("shift_id = ?");
    values.push(shift_id);
  }
  if (period_label !== undefined) {
    fields.push("period_label = ?");
    values.push(period_label);
  }
  if (start_time !== undefined) {
    fields.push("start_time = ?");
    values.push(start_time);
  }
  if (end_time !== undefined) {
    fields.push("end_time = ?");
    values.push(end_time);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  values.push(req.params.id);
  const sql = `UPDATE time_slots SET ${fields.join(", ")} WHERE time_slot_id = ?`;

  db.query(sql, values, (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Time slot not found" });
    res.json({ message: "Time slot updated" });
  });
};

exports.delete = (req, res) => {
  const sql = "DELETE FROM time_slots WHERE time_slot_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Time slot not found" });
    res.json({ message: "Time slot deleted" });
  });
};
