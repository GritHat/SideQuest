import { STATUS_CODES } from 'node:http';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: { path: string; message: string }[];
}

/**
 * Writes every HTTP error as RFC 9457 `application/problem+json` (manifesto §6).
 * Unexpected errors become a generic 500: their details are logged, never sent.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const problem: ProblemDetails = {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Error',
      status,
      instance: request.originalUrl,
    };

    if (exception instanceof HttpException) {
      Object.assign(problem, describe(exception.getResponse()));
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).type('application/problem+json').json(problem);
  }
}

function describe(body: string | object): Pick<ProblemDetails, 'detail' | 'errors'> {
  if (typeof body === 'string') {
    return { detail: body };
  }
  const { message, errors } = body as { message?: unknown; errors?: ProblemDetails['errors'] };
  const detail = Array.isArray(message) ? message.join('; ') : typeof message === 'string' ? message : undefined;
  return { detail, ...(errors ? { errors } : {}) };
}
