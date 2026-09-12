declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
        unit_id?: string;
        department_id?: string;
      };
    }
  }
}
export {};
