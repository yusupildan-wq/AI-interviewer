import { HttpError } from './http-error.js';

/** Express route params can type as string | string[] | undefined; routes only ever expect a single segment. */
export const requireParam = (value: string | string[] | undefined, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpError(400, `Missing required route parameter: ${name}`);
  }
  return value;
};
