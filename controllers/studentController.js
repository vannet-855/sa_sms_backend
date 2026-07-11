const db = require("../config/db");

// Helper: format Date object -> ddmmyyyy string (for default password)
function formatPassword(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const dd = String(dob.getDate()).padStart(2, "0");
  const mm = String(dob.getMonth() + 1).padStart(2, "0");
  const yyyy = dob.getFullYear();
  return `${dd}${mm}${yyyy}`;
}

// ──────────────────────────────────────────────
// GET /api/students — with search & pagination
// ──────────────────────────────────────────────
exports.getAll = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 1000;
  const offset = (page - 1) * limit;
  const search = req.query.search || "";
  const majorId = req.query.major_id || "";
  const groupId = req.query.group_id || "";

  let where = "WHERE 1=1";
  const params = [];

  if (search.trim()) {
    where +=
      " AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_code LIKE ? OR s.phone LIKE ? OR g.group_name LIKE ?)";
    const like = `%${search.trim()}%`;
    params.push(like, like, like, like, like);
  }

  if (majorId) {
    where += " AND s.major_id = ?";
    params.push(majorId);
  }

  if (groupId) {
    where += " AND s.group_id = ?";
    params.push(groupId);
  }

  const countSql = `SELECT COUNT(*) AS total FROM students s LEFT JOIN class_groups g ON s.group_id = g.group_id ${where}`;
  const dataSql = `
    SELECT s.*, m.name AS major_name, g.group_name AS group_name
    FROM students s
    LEFT JOIN majors m ON s.major_id = m.major_id
    LEFT JOIN class_groups g ON s.group_id = g.group_id
    ${where}
    ORDER BY s.student_id ASC
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
// GET /api/students/:id
// ──────────────────────────────────────────────
exports.getById = (req, res) => {
  const sql = `
    SELECT s.*, m.name AS major_name, g.group_name AS group_name
    FROM students s
    LEFT JOIN majors m ON s.major_id = m.major_id
    LEFT JOIN class_groups g ON s.group_id = g.group_id
    WHERE s.student_id = ?
  `;
  db.query(sql, [req.params.id], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (rows.length === 0)
      return res.status(404).json({ message: "Student not found" });
    res.json(rows[0]);
  });
};

// ──────────────────────────────────────────────
// POST /api/students — create student + user account
// ──────────────────────────────────────────────
exports.create = (req, res) => {
  const {
    student_code,
    first_name,
    last_name,
    gender,
    date_of_birth,
    phone,
    address,
    guardian_name,
    guardian_phone,
    department_id,
    major_id,
    degree_level,
    academic_year,
    group_id,
  } = req.body;

  if (!first_name || !last_name || !gender || !date_of_birth || !degree_level) {
    return res.status(400).json({
      message:
        "Missing required fields: first_name, last_name, gender, date_of_birth, degree_level",
    });
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

      // Step 1: Insert student
      const insertStudent = `
        INSERT INTO students (student_code, first_name, last_name, gender, date_of_birth,
          phone, address, guardian_name, guardian_phone, department_id, major_id, degree_level, academic_year, group_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      connection.query(
        insertStudent,
        [
          student_code || null,
          first_name,
          last_name,
          gender,
          date_of_birth,
          phone || null,
          address || null,
          guardian_name || null,
          guardian_phone || null,
          department_id || null,
          major_id || null,
          degree_level,
          academic_year || 1,
          group_id || null,
        ],
        (errIns, result) => {
          if (errIns) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json(errIns);
            });
          }

          const studentId = result.insertId;

          // Step 2: Generate email & password
          const email = `${first_name}${last_name}${studentId}@email.com`
            .toLowerCase()
            .replace(/\s+/g, "");
          const password = formatPassword(date_of_birth);

          // Step 3: Get Student role_id
          connection.query(
            "SELECT role_id FROM roles WHERE role_name = 'Student'",
            (errRole, roleRows) => {
              if (errRole || roleRows.length === 0) {
                return connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ message: "Student role not found" });
                });
              }

              const roleId = roleRows[0].role_id;

              // Step 4: Insert user
              connection.query(
                "INSERT INTO users (email, password, role_id, ref_id) VALUES (?, ?, ?, ?)",
                [email, password, roleId, studentId],
                (errUser, userResult) => {
                  if (errUser) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(500).json(errUser);
                    });
                  }

                  const userId = userResult.insertId;

                  // Step 5: Link user_id back to student
                  connection.query(
                    "UPDATE students SET user_id = ? WHERE student_id = ?",
                    [userId, studentId],
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
                          message: "Student created successfully",
                          student_id: studentId,
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
// PUT /api/students/:id — update student fields only
// ──────────────────────────────────────────────
exports.update = (req, res) => {
  const allowed = [
    "student_code",
    "first_name",
    "last_name",
    "gender",
    "date_of_birth",
    "phone",
    "address",
    "guardian_name",
    "guardian_phone",
    "department_id",
    "major_id",
    "degree_level",
    "academic_year",
    "status",
    "group_id",
  ];

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
  const sql = `UPDATE students SET ${fields.join(", ")} WHERE student_id = ?`;

  db.query(sql, values, (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Student not found" });
    res.json({ message: "Student updated successfully" });
  });
};

// ──────────────────────────────────────────────
// DELETE /api/students/:id — hard delete (removes student + user account)
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
        "SELECT user_id FROM students WHERE student_id = ?",
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
              res.status(404).json({ message: "Student not found" });
            });

          const userId = rows[0].user_id;

          connection.query(
            "DELETE FROM students WHERE student_id = ?",
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
          res.json({ message: "Student permanently deleted" });
        });
      }
    });
  });
};

// ──────────────────────────────────────────────
// POST /api/students/bulk-delete — hard delete multiple
// ──────────────────────────────────────────────
exports.bulkDelete = (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "ids must be a non-empty array" });
  }

  const placeholders = ids.map(() => "?").join(",");
  const sql = `DELETE FROM students WHERE student_id IN (${placeholders})`;

  db.query(sql, ids, (err, result) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    res.json({
      message: `${result.affectedRows} student(s) permanently deleted`,
    });
  });
};

// ──────────────────────────────────────────────
// GET /api/students/search — lightweight search returning id/name/phone/code/group
// Used by payments and other selectors
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// GET /api/students/profile — logged-in student's own profile
// ──────────────────────────────────────────────
exports.getMyProfile = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT s.*, u.email, u.password,
           m.name AS major_name, d.name AS department_name,
           g.group_name
    FROM students s
    JOIN users u ON s.user_id = u.user_id
    LEFT JOIN majors m ON s.major_id = m.major_id
    LEFT JOIN departments d ON s.department_id = d.department_id
    LEFT JOIN class_groups g ON s.group_id = g.group_id
    WHERE s.user_id = ?
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    if (rows.length === 0)
      return res.status(404).json({ message: "Student not found" });
    res.json(rows[0]);
  });
};

// ──────────────────────────────────────────────
// PUT /api/students/profile — student updates own profile
// ──────────────────────────────────────────────
exports.updateMyProfile = (req, res) => {
  const userId = req.user.user_id;
  const {
    first_name,
    last_name,
    phone,
    address,
    guardian_name,
    guardian_phone,
    password,
  } = req.body;

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

      // Step 1: Get student record
      connection.query(
        `SELECT student_id FROM students WHERE user_id = ?`,
        [userId],
        (err, studentRows) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res
                .status(500)
                .json({ message: "Server error", error: err.message });
            });
          }
          if (studentRows.length === 0) {
            return connection.rollback(() => {
              connection.release();
              res.status(404).json({ message: "Student not found" });
            });
          }

          const studentId = studentRows[0].student_id;
          const studentFields = {};
          if (first_name !== undefined) studentFields.first_name = first_name;
          if (last_name !== undefined) studentFields.last_name = last_name;
          if (phone !== undefined) studentFields.phone = phone || null;
          if (address !== undefined) studentFields.address = address || null;
          if (guardian_name !== undefined)
            studentFields.guardian_name = guardian_name || null;
          if (guardian_phone !== undefined)
            studentFields.guardian_phone = guardian_phone || null;

          const studentKeys = Object.keys(studentFields);
          let studentQueryDone = false;
          let userQueryDone = false;

          const tryCommit = () => {
            if (studentQueryDone && userQueryDone) {
              connection.commit((errCommit) => {
                if (errCommit) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ message: errCommit.message });
                  });
                }

                // Fetch updated profile
                connection.query(
                  `SELECT s.*, u.email, u.password,
                     m.name AS major_name, d.name AS department_name, g.group_name
                   FROM students s
                   JOIN users u ON s.user_id = u.user_id
                   LEFT JOIN majors m ON s.major_id = m.major_id
                   LEFT JOIN departments d ON s.department_id = d.department_id
                   LEFT JOIN class_groups g ON s.group_id = g.group_id
                   WHERE s.student_id = ?`,
                  [studentId],
                  (errFetch, fetchRows) => {
                    connection.release();
                    if (errFetch) {
                      return res.status(500).json({
                        message: "Server error",
                        error: errFetch.message,
                      });
                    }
                    res.json({
                      message: "Profile updated successfully",
                      student: fetchRows[0] || null,
                    });
                  },
                );
              });
            }
          };

          // Update student fields
          if (studentKeys.length > 0) {
            const setClauses = studentKeys.map((k) => `${k} = ?`).join(", ");
            const values = studentKeys.map((k) => studentFields[k]);
            values.push(studentId);
            connection.query(
              `UPDATE students SET ${setClauses} WHERE student_id = ?`,
              values,
              (err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res
                      .status(500)
                      .json({ message: "Server error", error: err.message });
                  });
                }
                studentQueryDone = true;
                tryCommit();
              },
            );
          } else {
            studentQueryDone = true;
          }

          // Update user password if provided
          if (password && password.trim()) {
            connection.query(
              `UPDATE users SET password = ? WHERE user_id = ?`,
              [password.trim(), userId],
              (err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    res
                      .status(500)
                      .json({ message: "Server error", error: err.message });
                  });
                }
                userQueryDone = true;
                tryCommit();
              },
            );
          } else {
            userQueryDone = true;
            tryCommit();
          }
        },
      );
    });
  });
};

exports.searchLight = (req, res) => {
  const search = req.query.q || "";
  const groupId = req.query.group_id || "";
  const limit = parseInt(req.query.limit) || 20;

  let sql = `
    SELECT s.student_id AS id, s.first_name, s.last_name, s.student_code, s.phone,
           g.group_name
    FROM students s
    LEFT JOIN class_groups g ON s.group_id = g.group_id
  `;
  const params = [];
  const conditions = [];

  if (search.trim()) {
    const like = `%${search.trim()}%`;
    conditions.push(
      "(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_code LIKE ? OR s.phone LIKE ? OR g.group_name LIKE ?)",
    );
    params.push(like, like, like, like, like);
  }

  if (groupId) {
    conditions.push("s.group_id = ?");
    params.push(groupId);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY s.first_name ASC LIMIT ?";
  params.push(limit);

  db.query(sql, params, (err, rows) => {
    if (err)
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    res.json(
      rows.map((r) => ({
        id: r.id,
        full_name: `${r.first_name} ${r.last_name}`.trim(),
        first_name: r.first_name,
        last_name: r.last_name,
        student_code: r.student_code,
        phone: r.phone,
        group_name: r.group_name,
      })),
    );
  });
};
