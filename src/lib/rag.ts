import { prisma } from "@/lib/prisma";
import { chunkBlogContent } from "@/lib/chunker";
import { embedDocuments, embedQuery } from "@/lib/voyage";

export interface ChunkResult {
  id: string;
  title: string;
  content: string;
  similarity: number;
  href: string; // 출처 링크 (/blog/... 또는 /magazines/.../...)
}

export async function generateEmbeddings(
  blogPostId: string,
  options?: { autoPublish?: boolean }
): Promise<void> {
  const autoPublish = options?.autoPublish ?? false;

  const post = await prisma.blogPost.findUnique({
    where: { id: blogPostId },
    select: { id: true, title: true, content: true, publishedAt: true },
  });

  if (!post || !post.content) return;

  // Always mark as processing
  await prisma.blogPost.update({
    where: { id: blogPostId },
    data: { embeddingStatus: "processing" },
  });

  try {
    const chunks = chunkBlogContent(post.content, post.title);

    // Delete existing chunks for this post
    await prisma.$queryRawUnsafe(
      `DELETE FROM "BlogPostChunk" WHERE "blogPostId" = $1`,
      blogPostId
    );

    if (chunks.length > 0) {
      // Generate embeddings
      const embeddings = await embedDocuments(chunks.map((c) => c.content));

      // Insert chunks with embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const vec = `[${embeddings[i].join(",")}]`;

        await prisma.$queryRawUnsafe(
          `INSERT INTO "BlogPostChunk" ("id", "blogPostId", "chunkIndex", "title", "content", "embedding")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::vector)`,
          blogPostId,
          chunk.chunkIndex,
          chunk.title,
          chunk.content,
          vec
        );
      }
    }

    if (autoPublish) {
      await prisma.blogPost.update({
        where: { id: blogPostId },
        data: {
          embeddingStatus: "completed",
          status: "published",
          publishedAt: post.publishedAt ?? new Date(),
        },
      });
    } else {
      await prisma.blogPost.update({
        where: { id: blogPostId },
        data: { embeddingStatus: "completed" },
      });
    }

    console.log(
      `[RAG] Generated ${chunks.length} chunks for post "${post.title}"`
    );
  } catch (err) {
    await prisma.blogPost.update({
      where: { id: blogPostId },
      data: { embeddingStatus: "failed" },
    }).catch(() => {});
    throw err;
  }
}

// 매거진 아티클(MagazineArticle) 본문을 청크·임베딩하여 MagazineArticleChunk에 저장.
// (MagazineArticle에는 embeddingStatus가 없어 상태 추적 없이 best-effort로 동작)
export async function generateMagazineArticleEmbeddings(
  articleId: string,
): Promise<void> {
  const article = await prisma.magazineArticle.findUnique({
    where: { id: articleId },
    select: { id: true, title: true, content: true },
  });
  if (!article || !article.content) return;

  const chunks = chunkBlogContent(article.content, article.title);

  await prisma.$queryRawUnsafe(
    `DELETE FROM "MagazineArticleChunk" WHERE "articleId" = $1`,
    articleId,
  );

  if (chunks.length > 0) {
    const embeddings = await embedDocuments(chunks.map((c) => c.content));
    for (let i = 0; i < chunks.length; i++) {
      const vec = `[${embeddings[i].join(",")}]`;
      await prisma.$queryRawUnsafe(
        `INSERT INTO "MagazineArticleChunk" ("id", "articleId", "chunkIndex", "title", "content", "embedding")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::vector)`,
        articleId,
        chunks[i].chunkIndex,
        chunks[i].title,
        chunks[i].content,
        vec,
      );
    }
  }

  console.log(
    `[RAG] Generated ${chunks.length} magazine chunks for "${article.title}"`,
  );
}

// 단독 기사(Article) 임베딩. aiIndexable=false거나 본문 없으면 청크를 제거하고 종료.
export async function generateArticleEmbeddings(
  articleId: string,
): Promise<void> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, title: true, content: true, aiIndexable: true },
  });
  if (!article) return;

  // 항상 기존 청크 제거(재임베딩/색인제외 모두 커버)
  await prisma.$queryRawUnsafe(
    `DELETE FROM "ArticleChunk" WHERE "articleId" = $1`,
    articleId,
  );

  if (!article.aiIndexable || !article.content) {
    console.log(`[RAG] Article "${article.title}" 색인 제외(aiIndexable/본문)`);
    return;
  }

  const chunks = chunkBlogContent(article.content, article.title);
  if (chunks.length > 0) {
    const embeddings = await embedDocuments(chunks.map((c) => c.content));
    for (let i = 0; i < chunks.length; i++) {
      const vec = `[${embeddings[i].join(",")}]`;
      await prisma.$queryRawUnsafe(
        `INSERT INTO "ArticleChunk" ("id", "articleId", "chunkIndex", "title", "content", "embedding")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::vector)`,
        articleId,
        chunks[i].chunkIndex,
        chunks[i].title,
        chunks[i].content,
        vec,
      );
    }
  }

  console.log(
    `[RAG] Generated ${chunks.length} article chunks for "${article.title}"`,
  );
}

type RawChunk = {
  id: string;
  title: string;
  content: string;
  similarity: number;
  slug: string;
  magazineId: string | null;
  source: "blog" | "magazine" | "article";
};

export async function searchChunks(
  query: string,
  topK: number = 5
): Promise<ChunkResult[]> {
  if (!process.env.VOYAGE_API_KEY) return [];

  const queryEmbedding = await embedQuery(query);
  const vec = `[${queryEmbedding.join(",")}]`;

  // 블로그 + 기사 청크를 각각 검색한 뒤 유사도로 합쳐 상위 topK.
  // (매거진기사는 단일 Article로 병합됨 → ArticleChunk로 통합. 매거진 자체 텍스트
  //  색인은 후속에서 페이지 블록 기반으로 추가 예정.)
  const [blog, article] = await Promise.all([
    prisma.$queryRawUnsafe<RawChunk[]>(
      `SELECT c."id", c."title", c."content",
              1 - (c."embedding" <=> $1::vector) AS similarity,
              p."slug", NULL AS "magazineId", 'blog' AS source
       FROM "BlogPostChunk" c
       JOIN "BlogPost" p ON p."id" = c."blogPostId"
       WHERE p."status" = 'published'
       ORDER BY c."embedding" <=> $1::vector
       LIMIT $2`,
      vec,
      topK
    ),
    prisma.$queryRawUnsafe<RawChunk[]>(
      `SELECT c."id", c."title", c."content",
              1 - (c."embedding" <=> $1::vector) AS similarity,
              a."slug", NULL AS "magazineId", 'article' AS source
       FROM "ArticleChunk" c
       JOIN "Article" a ON a."id" = c."articleId"
       WHERE a."status" = 'published'
       ORDER BY c."embedding" <=> $1::vector
       LIMIT $2`,
      vec,
      topK
    ),
  ]);

  const hrefOf = (r: RawChunk): string =>
    r.source === "article" ? `/articles/${r.slug}` : `/blog/${r.slug}`;

  const merged: ChunkResult[] = [...blog, ...article].map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    similarity: r.similarity,
    href: hrefOf(r),
  }));

  return merged
    .filter((r) => r.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
