import Image from "next/image";
import type { ArticleVisual } from "@/lib/article-visuals";

export function ArticleCover({
  article,
  className,
  sizes,
  preload = false,
}: {
  article: ArticleVisual;
  className: string;
  sizes: string;
  preload?: boolean;
}) {
  return (
    <Image
      className={className}
      src={article.image}
      alt={article.imageAlt}
      width={1600}
      height={900}
      sizes={sizes}
      preload={preload}
    />
  );
}
