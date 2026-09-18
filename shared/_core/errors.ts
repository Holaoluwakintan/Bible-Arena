export function ForbiddenError(message: string): Error {
  const error = new Error(message);
  (error as any).statusCode = 403;
  (error as any).code = "FORBIDDEN";
  return error;
}

export function NotFoundError(message: string): Error {
  const error = new Error(message);
  (error as any).statusCode = 404;
  (error as any).code = "NOT_FOUND";
  return error;
}
