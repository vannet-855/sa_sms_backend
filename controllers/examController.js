const db = require("../config/db");

exports.getAll = (req, res) => {
  const sql = `SELECT e.*, et.name as exam_type_name, cg.group_name
    FROM exams e 
    JOIN exam_types et ON e.exam_type_id = et.exam_type_id 
    JOIN class_groups cg ON e.group_id = cg.group_id`;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.getById = (req, res) => {
  const sql = `SELECT e.*, et.name as exam_type_name, cg.group_name
    FROM exams e 
    JOIN exam_types et ON e.exam_type_id = et.exam_type_id 
    JOIN class_groups cg ON e.group_id = cg.group_id 
    WHERE e.exam_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0)
      return res.status(404).json({ message: "Exam not found" });
    res.json(result[0]);
  });
};

exports.getByGroup = (req, res) => {
  const sql = `SELECT e.*, et.name as exam_type_name, cg.group_name
    FROM exams e 
    JOIN exam_types et ON e.exam_type_id = et.exam_type_id 
    JOIN class_groups cg ON e.group_id = cg.group_id 
    WHERE e.group_id = ?`;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};

exports.create = (req, res) => {
  const sql = "INSERT INTO exams SET ?";
  db.query(sql, req.body, (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(201).json({ message: "Exam created", id: result.insertId });
  });
};

exports.update = (req, res) => {
  const sql = "UPDATE exams SET ? WHERE exam_id = ?";
  db.query(sql, [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Exam not found" });
    res.json({ message: "Exam updated" });
  });
};

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
        SELECT e.*, et.name as exam_type_name, cg.group_name
        FROM exams e
        JOIN exam_types et ON e.exam_type_id = et.exam_type_id
        JOIN class_groups cg ON e.group_id = cg.group_id
        WHERE e.group_id IN (
          SELECT cl.group_id FROM classes cl WHERE cl.teacher_id = ?
        )
        ORDER BY e.exam_date DESC
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

exports.delete = (req, res) => {
  const sql = "DELETE FROM exams WHERE exam_id = ?";

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Exam not found" });
    res.json({ message: "Exam deleted" });
  });
};
