import type { ApiErrorCode } from './types';

export class PubMedError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PubMedError';
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof PubMedError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'upstream_error' as const,
        message: 'The PubMed service could not complete the request.',
      },
    },
  };
}
