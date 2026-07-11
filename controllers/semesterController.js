const db = require("../config/db");

exports.getAll = (req, res) => {
  const sql =
    "SELECT s.*, ay.year_label FROM semesters s JOIN academic_years ay ON s.year_id = ay.year_id";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

exports.getById = (req, res) => {
  const sql = "SELECT s.*, ay.year_label FROM semesters s JOIN academic_years ay ON s.year_id = ay.year_id WHERE s.semester_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0)
      return res.status(404).json({ message: "Not found" });
    res.json(result[0]);
  });
};

exports.getByYear = (req, res) => {
  const sql = "SELECT s.*, ay.year_label FROM semesters s JOIN academic_years ay ON s.year_id = ay.year_id WHERE s.year_id = ?";
  db.query(sql, [req.params.yearId], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

exports.create = (req, res) => {
  const sql = "INSERT INTO semesters SET ?";
  db.query(sql, req.body, (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(201).json({ id: result.insertId, ...req.body });
  });
};

exports.update = (req, res) => {
  const sql = "UPDATE semesters SET ? WHERE semester_id = ?";
  db.query(sql, [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Updated" });
  });
};

exports.delete = (req, res) => {
  const sql = "DELETE FROM semesters WHERE semester_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Deleted" });
  });
};