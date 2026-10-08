import { ZodError } from "zod";
import { errors } from "./errors.js";

export function parseId(id: string | undefined) {
  if (!id || id.trim().length === 0) {
    throw errors.badRequest("Invalid id");
  }

  return id;
}

export function formatZodError(error: ZodError) {
  return errors.badRequest("Validation failed", error.flatten());
}
