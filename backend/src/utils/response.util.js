export const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

export const errorResponse = (res, message = 'Error', code = 'INTERNAL_ERROR', statusCode = 500, details = null) => {
  const response = {
    success: false,
    code,
    message
  };
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }
  return res.status(statusCode).json(response);
};
