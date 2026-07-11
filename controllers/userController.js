const db = require("../config/db");

const getAll = (req, res) => {
  const sql = `
    SELECT u.user_id, u.email, u.role_id, u.ref_id, u.created_at,
           r.role_name
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

const getById = (req, res) => {
  const sql = `
    SELECT u.user_id, u.email, u.role_id, u.ref_id, u.created_at,
           r.role_name
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    WHERE u.user_id = ?
  `;
  db.query(sql, [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(404).json({ message: "User not found" });
    res.json(results[0]);
  });
};

const create = (req, res) => {
  const sql = `INSERT INTO users SET ?`;
  db.query(sql, [req.body], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    const { password, ...safeData } = req.body;
    res.status(201).json({ id: result.insertId, ...safeData });
  });
};

const update = (req, res) => {
  const sql = `UPDATE users SET ? WHERE user_id = ?`;
  db.query(sql, [req.body, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "User not found" });
    res.json({ message: "User updated successfully" });
  });
};

const deleteUser = (req, res) => {
  const sql = `DELETE FROM users WHERE user_id = ?`;
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully" });
  });
};

module.exports = { getAll, getById, create, update, delete: deleteUser };
