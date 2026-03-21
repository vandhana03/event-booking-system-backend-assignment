require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();
const routes = require("./routes");

const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

app.use(cors());
app.use(express.json());

// Mount the routes with and without the '/api' prefix to prevent 404 errors
app.use("/api", routes);
app.use("/", routes);

const swaggerDoc = YAML.load("./swagger.yaml");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Base route for health checks and pointing users to API docs
app.get("/", (req, res) => {
  res.redirect("/api-docs");
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Swagger docs at http://localhost:${PORT}/api-docs`);
});
