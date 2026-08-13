import { NextResponse } from 'next/server';
import { jsonError } from '@/server/http';
import { getPubMedAdapter } from '@/pubmed';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pmid: string }> },
) {
  try {
    const { pmid } = await params;
    const article = await getPubMedAdapter().getArticle(pmid);
    if (!article) {
      return NextResponse.json(
        {
          error: {
            code: 'not_found',
            message: `No article found for PMID ${pmid}.`,
          },
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ article });
  } catch (error) {
    return jsonError(error);
  }
}
