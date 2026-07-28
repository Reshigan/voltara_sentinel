export class AppError extends Error {
  statusCode: number;
  userMessage: string;

  constructor(message: string, statusCode = 500, userMessage?: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.userMessage = userMessage ?? message;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, message);
    this.name = "ConflictError";
  }
}

export function errorToResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: err.userMessage },
      { status: err.statusCode },
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return Response.json(
    { error: message },
    { status: 500 },
  );
}
