require("dotenv").config();

const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://localhost:27017/clinexa",
  JWT_SECRET: process.env.JWT_SECRET || "replace_with_your_generated_secret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || "http://localhost:8000",
};

module.exports = env;
