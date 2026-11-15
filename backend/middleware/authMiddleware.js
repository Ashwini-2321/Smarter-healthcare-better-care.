const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const User = require("../models/User");
const { users } = require("../data/users");
const { isDatabaseConnected } = require("../config/db");

async function authenticate(req, res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication is required." });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Authentication token is invalid or expired." });
  }

  if (
    typeof payload.sub !== "string" ||
    !["patient", "doctor", "admin"].includes(payload.role)
  ) {
    return res.status(401).json({ message: "Authentication token is invalid." });
  }

  const account = isDatabaseConnected()
    ? mongoose.Types.ObjectId.isValid(payload.sub)
      ? await User.findById(payload.sub).select("role isActive").lean()
      : null
    : users.find((user) => String(user.id) === payload.sub);
  if (!account || account.isActive === false || account.role !== payload.role) {
    return res.status(401).json({ message: "This account is unavailable or its session is no longer valid." });
  }

  req.auth = { userId: payload.sub, role: payload.role };
  return next();
}

function optionalAuthenticate(req, res, next) {
  const authorization = req.get("authorization");
  if (!authorization) {
    return next();
  }

  return authenticate(req, res, next);
}

module.exports = { authenticate, optionalAuthenticate };
