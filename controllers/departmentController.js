const db = require("../config/db");

exports.getAll = (req, res) => {
  const sql =
    "SELECT d.*, f.faculty_name FROM departments d JOIN faculties f ON d.faculty_id = f.faculty_id";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

exports.getById = (req, res) => {
  const sql =
    "SELECT d.*, f.faculty_name FROM departments d JOIN faculties f ON d.faculty_id = f.faculty_id WHERE d.department_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0)
      return res.status(404).json({ message: "Not found" });
    res.json(result[0]);
  });
};

exports.getByFaculty = (req, res) => {
  const sql =
    "SELECT d.*, f.faculty_name FROM departments d JOIN faculties f ON d.faculty_id = f.faculty_id WHERE d.faculty_id = ?";
  db.query(sql, [req.params.facultyId], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

exports.create = (req, res) => {
  const sql = "INSERT INTO departments SET ?";
  db.query(sql, req.body, (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(201).json({ id: result.insertId, ...req.body });
  });
};

exports.update = (req, res) => {
  const sql = "UPDATE departments SET ? WHERE department_id = ?";
  db.query(sql, [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Updated" });
  });
};

exports.delete = (req, res) => {
  const sql = "DELETE FROM departments WHERE department_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Deleted" });
  });
};