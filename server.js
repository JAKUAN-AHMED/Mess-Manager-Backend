require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");
const errorHandler = require("./src/middlewares/error");

const app = express();

connectDB();

app.use(cors({
  origin: [
    'https://manager-mess.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json());

app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/users", require("./src/routes/users"));
app.use("/api/meals", require("./src/routes/meals"));
app.use("/api/expenses", require("./src/routes/expenses"));
app.use("/api/reports", require("./src/routes/reports"));
app.use("/api/payments", require("./src/routes/payments"));
app.use("/api/mess", require("./src/routes/mess"));
app.use("/api/meal-adjustments", require("./src/routes/mealAdjustments"));
app.use("/api/ledger",           require("./src/routes/ledger"));

app.get("/api/health", (req, res) =>
  res.json({ status: "OK", message: "Mess Management API is running" }),
);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
