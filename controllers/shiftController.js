const db = require("../config/db");

exports.getAll = (req, res) => {
  const sql = "SELECT * FROM shifts";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

exports.getById = (req, res) => {
  const sql = "SELECT * FROM shifts WHERE shift_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0)
      return res.status(404).json({ message: "Not found" });
    res.json(result[0]);
  });
};

exports.create = (req, res) => {
  const sql = "INSERT INTO shifts SET ?";
  db.query(sql, req.body, (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(201).json({ id: result.insertId, ...req.body });
  });
};

exports.update = (req, res) => {
  const sql = "UPDATE shifts SET ? WHERE shift_id = ?";
  db.query(sql, [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Updated" });
  });
};

exports.delete = (req, res) => {
  const sql = "DELETE FROM shifts WHERE shift_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Deleted" });
  });
};