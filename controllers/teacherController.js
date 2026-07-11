const db = require("../config/db");

// ──────────────────────────────────────────────
// GET /api/teachers — with search & pagination
// ──────────────────────────────────────────────
exports.getAll = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 1000;
  const offset = (page - 1) * limit;
  const search = req.query.search || "";

  let where = "WHERE 1=1";
  const params = [];

  if (search.trim()) {
    where += " AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)";
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  const countSql = `SELECT COUNT(*) AS total FROM teachers ${where}`;
  const dataSql = `
    SELECT t.*
    FROM teachers t
    ${where}
    ORDER BY t.teacher_id ASC
    LIMIT ? OFFSET ?
  `;

  db.query(countSql, params, (errCount, countResult) => {
    if (errCount)
      return res
        .status(500)
        .json({ message: "Server error", error: errCount.message });
    const total = countResult[0]?.total || 0;

    db.query(dataSql, [...params, limit, offset], (errData, rows) => {
      if (errData)
        return res
          .status(500)
          .json({ message: "Server error", error: errData.message });
      res.json({ data: rows, total, page, limit });
    });
  });
};

// ──────────────────────────────────────────────
// GET /api/teachers/profile — current teacher's profile (from JWT)
// ──────────────────────────────────────────────
exports.getProfile = (req, res) => {
  const userId = req.user.user_id;

  db.query(
    `SELECT t.*, u.email, d.name AS department_name
     FROM teachers t
     JOIN users u ON t.user_id = u.user_id
     LEFT JOIN departments d ON t.department_id = d.department_id
     WHERE t.user_id = ?`,
    [userId],
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      if (rows.length === 0)
        return res.status(404).json({ message: "Teacher not found" });
      res.json(rows[0]);
    },
  );
};

// ──────────────────────────────────────────────
// PUT /api/teachers/profile — update current teacher's profile
// ──────────────────────────────────────────────
exports.updateProfile = (req, res) => {
  const userId = req.user.user_id;

  const allowed = ["full_name", "phone"];
  const teacherFields = [];
  const teacherValues = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      teacherFields.push(`${key} = ?`);
      teacherValues.push(req.body[key]);
    }
  }

  // Handle password update separately (in users table)
  const passwordChanged =
    req.body.password !== undefined && req.body.password !== null;

  // If nothing to update, bail out
  if (teacherFields.length === 0 && !passwordChanged) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  let queriesDone = 0;
  const totalQueries =
    (teacherFields.length > 0 ? 1 : 0) + (passwordChanged ? 1 : 0);
  let hasError = false;

  function maybeFinish() {
    if (hasError) return;
    if (++queriesDone < totalQueries) return;

    // Return updated profile (without password)
    db.query(
      `SELECT t.*, u.email, d.name AS department_name
       FROM teachers t
       JOIN users u ON t.user_id = u.user_id
       LEFT JOIN departments d ON t.department_id = d.department_id
       WHERE t.user_id = ?`,
      [userId],
      (err, rows) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });
        res.json({
          message: "Profile updated successfully",
          teacher: rows[0],
        });
      },
    );
  }

  // Update teacher fields (name, phone)
  if (teacherFields.length > 0) {
    teacherValues.push(userId);
    const sql = `UPDATE teachers SET ${teacherFields.join(", ")} WHERE user_id = ?`;

    db.query(sql, teacherValues, (err, result) => {
      if (err) {
        hasError = true;
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }
      if (result.affectedRows === 0) {
        hasError = true;
        return res.status(404).json({ message: "Teacher not found" });
      }
      maybeFinish();
    });
  }

  // Update password in users table
  if (passwordChanged) {
    db.query(
      "UPDATE users SET password = ? WHERE user_id = ?",
      [req.body.password, userId],
      (err) => {
        if (err) {
          hasError = true;
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });
        }
        maybeFinish();
      },
    );
  }
};

// ──────────────────────────────────────────────
// GET /api/teachers/:id
// ──────────────────────────────────────────────
exports.getById = (req, res) => {
  const sql = `
    SELECT t.*
    FROM teachers t
    WHERE t.teacher_id = ?
  `;
  db.query(sql, [req.params.id], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (rows.length === 0)
      return res.status(404).json({ message: "Teacher not found" });
    res.json(rows[0]);
  });
};

// ──────────────────────────────────────────────
// POST /api/teachers — create teacher + user account
// Uses the teacher's personal email for login
// Password auto-generated from email prefix
// ──────────────────────────────────────────────
exports.create = (req, res) => {
  const { full_name, phone, email } = req.body;

  if (!full_name) {
    return res
      .status(400)
      .json({ message: "Missing required field: full_name" });
  }

  if (!email) {
    return res.status(400).json({ message: "Missing required field: email" });
  }

  db.getConnection((errConn, connection) => {
    if (errConn)
      return res
        .status(500)
        .json({ message: "DB connection error", error: errConn.message });

    connection.beginTransaction((errTx) => {
      if (errTx) {
        connection.release();
        return res.status(500).json({ message: errTx.message });
      }

      // Insert teacher
      connection.query(
        "INSERT INTO teachers (full_name, phone, email) VALUES (?, ?, ?)",
        [full_name, phone || null, email],
        (errIns, result) => {
          if (errIns) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json(errIns);
            });
          }

          const teacherId = result.insertId;

          // Auto-generate password from email prefix (before @)
          const cleanEmail = email.trim().toLowerCase();
          const emailPrefix = cleanEmail.split("@")[0];
          const password = emailPrefix;

          // Get Teacher role_id
          connection.query(
            "SELECT role_id FROM roles WHERE role_name = 'Teacher'",
            (errRole, roleRows) => {
              if (errRole || roleRows.length === 0) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ message: "Teacher role not found" });
                });
              }

              const roleId = roleRows[0].role_id;

              // Insert user with the teacher's personal email
              connection.query(
                "INSERT INTO users (email, password, role_id, ref_id) VALUES (?, ?, ?, ?)",
                [email, password, roleId, teacherId],
                (errUser, userResult) => {
                  if (errUser) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json(errUser);
                    });
                  }

                  const userId = userResult.insertId;

                  // Link user_id back to teacher
                  connection.query(
                    "UPDATE teachers SET user_id = ? WHERE teacher_id = ?",
                    [userId, teacherId],
                    (errUpdate) => {
                      if (errUpdate) {
                        return connection.rollback(() => {
                          connection.release();
                          res.status(500).json(errUpdate);
                        });
                      }

                      connection.commit((errCommit) => {
                        if (errCommit) {
                          return connection.rollback(() => {
                            connection.release();
                            res.status(500).json(errCommit);
                          });
                        }
                        connection.release();
                        res.status(201).json({
                          message: "Teacher created successfully",
                          teacher_id: teacherId,
                          email,
                          password,
                        });
                      });
                    },
                  );
                },
              );
            },
          );
        },
      );
    });
  });
};

// ──────────────────────────────────────────────
// PUT /api/teachers/:id
// ──────────────────────────────────────────────
exports.update = (req, res) => {
  const allowed = ["full_name", "phone", "email"];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  values.push(req.params.id);
  const sql = `UPDATE teachers SET ${fields.join(", ")} WHERE teacher_id = ?`;

  db.query(sql, values, (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Teacher not found" });
    res.json({ message: "Teacher updated successfully" });
  });
};

// ──────────────────────────────────────────────
// DELETE /api/teachers/:id
// ──────────────────────────────────────────────
exports.delete = (req, res) => {
  db.getConnection((errConn, connection) => {
    if (errConn) return res.status(500).json({ message: errConn.message });

    connection.beginTransaction((errTx) => {
      if (errTx) {
        connection.release();
        return res.status(500).json({ message: errTx.message });
      }

      connection.query(
        "SELECT user_id FROM teachers WHERE teacher_id = ?",
        [req.params.id],
        (errSelect, rows) => {
          if (errSelect)
            return connection.rollback(() => {
              connection.release();
              res.status(500).json(errSelect);
            });
          if (rows.length === 0)
            return connection.rollback(() => {
              connection.release();
              res.status(404).json({ message: "Teacher not found" });
            });

          const userId = rows[0].user_id;

          connection.query(
            "DELETE FROM teachers WHERE teacher_id = ?",
            [req.params.id],
            (errDel) => {
              if (errDel)
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json(errDel);
                });

              if (userId) {
                connection.query(
                  "DELETE FROM users WHERE user_id = ?",
                  [userId],
                  (errDelUser) => {
                    if (errDelUser)
                      return connection.rollback(() => {
                        connection.release();
                        res.status(500).json(errDelUser);
                      });
                    finishDelete(connection);
                  },
                );
              } else {
                finishDelete(connection);
              }
            },
          );
        },
      );

      function finishDelete(conn) {
        conn.commit((errCommit) => {
          if (errCommit)
            return conn.rollback(() => {
              conn.release();
              res.status(500).json(errCommit);
            });
          conn.release();
          res.json({ message: "Teacher permanently deleted" });
        });
      }
    });
  });
};

// ──────────────────────────────────────────────
// GET /api/teachers/my-classes
// ──────────────────────────────────────────────
exports.getMyClasses = (req, res) => {
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
        SELECT cl.*,
          c.course_code, c.course_name,
          cg.group_name,
          s.shift_name,
          sem.semester_name,
          ay.year_label,
          (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = cl.class_id) AS student_count
        FROM classes cl
        JOIN courses c ON cl.course_id = c.course_id
        JOIN class_groups cg ON cl.group_id = cg.group_id
        LEFT JOIN shifts s ON cl.shift_id = s.shift_id
        LEFT JOIN semesters sem ON cl.semester_id = sem.semester_id
        LEFT JOIN academic_years ay ON cl.year_id = ay.year_id
        WHERE cl.teacher_id = ?
        ORDER BY cl.class_id ASC
      `;

      db.query(sql, [teacherId], (err, rows) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });

        res.json({ data: rows || [], total: (rows || []).length });
      });
    },
  );
};

// ──────────────────────────────────────────────
// POST /api/teachers/bulk-delete
// ──────────────────────────────────────────────
exports.bulkDelete = (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "ids must be a non-empty array" });
  }

  db.getConnection((errConn, connection) => {
    if (errConn)
      return res
        .status(500)
        .json({ message: "DB connection error", error: errConn.message });

    connection.beginTransaction((errTx) => {
      if (errTx) {
        connection.release();
        return res.status(500).json({ message: errTx.message });
      }

      const placeholders = ids.map(() => "?").join(",");

      connection.query(
        `DELETE FROM users WHERE ref_id IN (${placeholders}) AND role_id = (SELECT role_id FROM roles WHERE role_name = 'Teacher')`,
        ids,
        (errDelUsers) => {
          if (errDelUsers) {
            return connection.rollback(() => {
              connection.release();
              res
                .status(500)
                .json({ message: "Server error", error: errDelUsers.message });
            });
          }

          connection.query(
            `DELETE FROM teachers WHERE teacher_id IN (${placeholders})`,
            ids,
            (errDelTeachers, result) => {
              if (errDelTeachers) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({
                    message: "Server error",
                    error: errDelTeachers.message,
                  });
                });
              }

              connection.commit((errCommit) => {
                if (errCommit) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json(errCommit);
                  });
                }
                connection.release();
                res.json({
                  message: `${result.affectedRows} teacher(s) permanently deleted`,
                });
              });
            },
          );
        },
      );
    });
  });
};
