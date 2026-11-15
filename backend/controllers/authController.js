const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { users } = require("../data/users");
const { isDatabaseConnected } = require("../config/db");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/env");
const { hashPassword, comparePassword } = require("../utils/password");
const { createNotification } = require("../services/notificationService");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pendingRegistrationEmails = new Set();

function formatUser(user) {
  return {
    id: user._id ? String(user._id) : user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    profile: user.profile || "",
  };
}

function createAuthResponse(user) {
  const safeUser = formatUser(user);
  const token = jwt.sign(
    { sub: safeUser.id, role: safeUser.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return { token, user: safeUser };
}

function isDuplicateEmailError(error) {
  return error && error.code === 11000;
}

async function register(req, res) {
  const { name, email, password, phone = "" } = req.body || {};
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  if (
    !normalizedName ||
    !emailPattern.test(normalizedEmail) ||
    typeof password !== "string" ||
    password.length < 8 ||
    typeof phone !== "string"
  ) {
    return res.status(400).json({
      message: "Provide a name, valid email, password of at least 8 characters, and valid phone number.",
    });
  }

  let user;

  if (isDatabaseConnected()) {
    const existingUser = await User.exists({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    try {
      user = await User.create({
        name: normalizedName,
        email: normalizedEmail,
        password,
        phone: phone.trim(),
        role: "patient",
      });
    } catch (error) {
      if (isDuplicateEmailError(error)) {
        return res.status(409).json({ message: "An account with this email already exists." });
      }
      throw error;
    }
  } else {
    if (
      users.some((existingUser) => existingUser.email === normalizedEmail) ||
      pendingRegistrationEmails.has(normalizedEmail)
    ) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    pendingRegistrationEmails.add(normalizedEmail);
    try {
      user = {
        id: crypto.randomUUID(),
        name: normalizedName,
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        phone: phone.trim(),
        role: "patient",
        profile: "",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(user);
    } finally {
      pendingRegistrationEmails.delete(normalizedEmail);
    }
  }

  await createNotification({
    userId: user._id || user.id,
    type: "registration_success",
    title: "Welcome to Clinexa",
    message: "Your patient account is ready. You can now manage appointments and prescriptions here.",
  });

  return res.status(201).json(createAuthResponse(user));
}

async function login(req, res) {
  const { email, password } = req.body || {};
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!emailPattern.test(normalizedEmail) || typeof password !== "string") {
    return res.status(400).json({ message: "Provide a valid email and password." });
  }

  let user;
  let passwordMatches = false;

  if (isDatabaseConnected()) {
    user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (user) {
      passwordMatches = await user.comparePassword(password);
    }
  } else {
    user = users.find((existingUser) => existingUser.email === normalizedEmail);
    if (user) {
      passwordMatches = await comparePassword(password, user.passwordHash);
    }
  }

  if (!user || user.isActive === false || !passwordMatches) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }

  return res.json(createAuthResponse(user));
}

async function getProfile(req, res) {
  const user = isDatabaseConnected()
    ? await User.findById(req.auth.userId)
    : users.find((existingUser) => existingUser.id === req.auth.userId);

  if (!user) {
    return res.status(404).json({ message: "User profile not found." });
  }

  return res.json({ user: formatUser(user) });
}

async function updateProfile(req, res) {
  const { name, email, phone, profile } = req.body || {};
  const updates = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name must not be empty." });
    }
    updates.name = name.trim();
  }

  if (email !== undefined) {
    if (typeof email !== "string" || !emailPattern.test(email.trim())) {
      return res.status(400).json({ message: "Provide a valid email address." });
    }
    updates.email = email.trim().toLowerCase();
  }

  if (phone !== undefined) {
    if (typeof phone !== "string") {
      return res.status(400).json({ message: "Phone number must be text." });
    }
    updates.phone = phone.trim();
  }

  if (profile !== undefined) {
    if (typeof profile !== "string") {
      return res.status(400).json({ message: "Profile information must be text." });
    }
    updates.profile = profile.trim();
  }

  let user;

  if (isDatabaseConnected()) {
    try {
      user = await User.findByIdAndUpdate(req.auth.userId, updates, {
        new: true,
        runValidators: true,
      });
    } catch (error) {
      if (isDuplicateEmailError(error)) {
        return res.status(409).json({ message: "An account with this email already exists." });
      }
      throw error;
    }
  } else {
    user = users.find((existingUser) => existingUser.id === req.auth.userId);
    if (
      updates.email &&
      users.some(
        (existingUser) =>
          existingUser.id !== req.auth.userId && existingUser.email === updates.email
      )
    ) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    if (user) {
      Object.assign(user, updates);
    }
  }

  if (!user) {
    return res.status(404).json({ message: "User profile not found." });
  }

  return res.json({ user: formatUser(user) });
}

module.exports = { register, login, getProfile, updateProfile };
