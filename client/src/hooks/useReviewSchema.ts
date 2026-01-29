import { useEffect } from "react";

interface ReviewData {
  productName: string;
  productId: string;
  ratingValue: number;
  bestRating?: number;
  worstRating?: number;
  ratingCount: number;
  reviewCount: number;
  reviewText?: string;
  author?: string;
  datePublished?: string;
}

/**
 * Hook que injeta Review Schema.org estruturado dinamicamente
 * Usado em páginas de produtos com reviews
 */
export function useReviewSchema(reviewData: ReviewData) {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Review",
      "@id": `https://lowfy.com.br/marketplace/produto/${reviewData.productId}#review`,
      itemReviewed: {
        "@type": "Product",
        name: reviewData.productName,
        url: `https://lowfy.com.br/marketplace/produto/${reviewData.productId}`,
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: reviewData.ratingValue.toString(),
        bestRating: (reviewData.bestRating || 5).toString(),
        worstRating: (reviewData.worstRating || 1).toString(),
      },
      reviewCount: reviewData.reviewCount.toString(),
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: reviewData.ratingValue.toString(),
        ratingCount: reviewData.ratingCount.toString(),
        bestRating: (reviewData.bestRating || 5).toString(),
        worstRating: (reviewData.worstRating || 1).toString(),
      },
      ...(reviewData.reviewText && { reviewBody: reviewData.reviewText }),
      ...(reviewData.author && { author: { "@type": "Person", name: reviewData.author } }),
      ...(reviewData.datePublished && { datePublished: reviewData.datePublished }),
    };

    let scriptTag = document.querySelector(
      'script[data-schema="review-schema"]'
    ) as HTMLScriptElement;

    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.type = "application/ld+json";
      scriptTag.setAttribute("data-schema", "review-schema");
      document.head.appendChild(scriptTag);
    }

    scriptTag.textContent = JSON.stringify(schema);
  }, [reviewData]);
}
