function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ message: "You are not authorized to access this resource." });
    }

    return next();
  };
}

module.exports = { authorizeRoles };
