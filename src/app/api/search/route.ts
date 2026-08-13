import { NextResponse } from 'next/server';
import { jsonError } from '@/server/http';
import { getPubMedAdapter } from '@/pubmed';
import { parseSearchParams } from '@/pubmed/searchParams';

export async function GET(request: Request) {
  try {
    const adapter = getPubMedAdapter();
    const url = new URL(request.url);
    const searchRequest = parseSearchParams(url.searchParams);
    const body = await adapter.search(searchRequest);
    return NextResponse.json(body);
  } catch (error) {
    return jsonError(error);
  }
}
