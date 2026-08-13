import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/pubmed/errors';

export function jsonError(error: unknown): NextResponse {
  const response = toErrorResponse(error);
  return NextResponse.json(response.body, { status: response.status });
}
