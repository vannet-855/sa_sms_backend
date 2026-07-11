const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const verifyToken = require("./middleware/authMiddleware");
const roleMiddleware = require("./middleware/roleMiddleware");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Auth routes
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// Reference data routes
const facultyRoutes = require("./routes/facultyRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const majorRoutes = require("./routes/majorRoutes");
const classGroupRoutes = require("./routes/classGroupRoutes");
const shiftRoutes = require("./routes/shiftRoutes");
const academicYearRoutes = require("./routes/academicYearRoutes");
const semesterRoutes = require("./routes/semesterRoutes");
const examTypeRoutes = require("./routes/examTypeRoutes");
const roomRoutes = require("./routes/roomRoutes");
const timeSlotRoutes = require("./routes/timeSlotRoutes");

app.use("/api/faculties", facultyRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/majors", majorRoutes);
app.use("/api/class-groups", classGroupRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/academic-years", academicYearRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/exam-types", examTypeRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/time-slots", timeSlotRoutes);

// Core entity routes
const userRoutes = require("./routes/userRoutes");
const studentRoutes = require("./routes/studentRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const courseRoutes = require("./routes/courseRoutes");

app.use("/api/users", userRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/courses", courseRoutes);

// Dashboard route
const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/api/dashboard", dashboardRoutes);

// Relation entity routes
const classRoutes = require("./routes/classRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const examRoutes = require("./routes/examRoutes");
const examResultRoutes = require("./routes/examResultRoutes");
const courseResultRoutes = require("./routes/courseResultRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

app.use("/api/classes", classRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/exam-results", examResultRoutes);
app.use("/api/course-results", courseResultRoutes);
app.use("/api/payments", paymentRoutes);

// Test admin route
app.get("/api/admin", verifyToken, roleMiddleware("Admin"), (req, res) => {
  res.json({ message: "Welcome Admin" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
