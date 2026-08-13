import { ArticleDetail } from '@/components/article-detail';

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ pmid: string }>;
}) {
  const { pmid } = await params;
  return <ArticleDetail pmid={pmid} />;
}
