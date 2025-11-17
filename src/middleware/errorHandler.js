const errorHandler = (err, req, res) => {
  console.error(err.stack);

  const status = err.status || 500;
  const message = err.message || 'Something went wrong!';

  res.status(status).json({
    success: false,
    status,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
