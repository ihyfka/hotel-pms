import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";

interface ValidationTargets {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validate(schemas: ValidationTargets) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(
          req.query,
        )) as Request["query"];
      }
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(
          req.params,
        )) as Request["params"];
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(error);
      }
      return next(error);
    }
  };
}
