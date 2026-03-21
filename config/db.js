require("dotenv").config();

let pool;

if (process.env.USE_IN_MEMORY_DB === "true") {
  console.log("Using In-Memory Database...");
  pool = require("./db.memory");
} else {
  const mysql = require("mysql2/promise");
  console.log("Using MySQL Database...");
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "event_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

module.exports = pool;