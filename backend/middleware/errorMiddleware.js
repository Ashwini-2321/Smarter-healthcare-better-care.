function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  console.error(error);
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;

  return res.status(statusCode).json({
    message:
      statusCode >= 500
        ? "An unexpected server error occurred."
        : error.message,
  });
}

module.exports = errorMiddleware;
