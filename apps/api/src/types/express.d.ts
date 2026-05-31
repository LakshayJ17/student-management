declare namespace Express {
  interface Request {
    user?: {
      teacherId: number;
      email: string;
    };
  }
}
