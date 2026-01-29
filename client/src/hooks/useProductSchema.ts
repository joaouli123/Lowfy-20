import { useEffect } from "react";

interface ProductSchemaProps {
  id: string;
  name: string;
  description: string;
  image?: string;
  price?: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  seller?: string;
}

/**
 * Hook que injeta Product Schema.org estruturado dinamicamente
 * Usado em páginas de produtos individuais
 */
export function useProductSchema({
  id,
  name,
  description,
  image,
  price,
  currency = "BRL",
  rating,
  reviewCount,
  availability = "InStock",
  seller = "Lowfy",
}: ProductSchemaProps) {
  useEffect(() => {
    const schema: any = {
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": `https://lowfy.com.br/marketplace/produto/${id}`,
      name,
      description,
      url: `https://lowfy.com.br/marketplace/produto/${id}`,
      image: image || "https://lowfy.com.br/og-image.svg",
      brand: {
        "@type": "Brand",
        name: "Lowfy",
      },
      seller: {
        "@type": "Organization",
        name: seller,
        url: "https://lowfy.com.br",
      },
      offers: {
        "@type": "Offer",
        url: `https://lowfy.com.br/marketplace/produto/${id}`,
        priceCurrency: currency,
        price: price?.toString() || "0",
        availability: `https://schema.org/${availability}`,
        seller: {
          "@type": "Organization",
          name: seller,
        },
      },
    };

    // Adicionar rating se disponível
    if (rating && reviewCount) {
      schema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: rating.toString(),
        reviewCount: reviewCount.toString(),
      };
    }

    // Criar ou atualizar script tag
    let scriptTag = document.querySelector(
      'script[data-schema="product-schema"]'
    ) as HTMLScriptElement;

    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.type = "application/ld+json";
      scriptTag.setAttribute("data-schema", "product-schema");
      document.head.appendChild(scriptTag);
    }

    scriptTag.textContent = JSON.stringify(schema);

    return () => {
      // Cleanup não é necessário pois o schema será substituído
    };
  }, [id, name, description, image, price, currency, rating, reviewCount, availability, seller]);
}

/**
 * Hook que injeta Aggregate Offer Schema para múltiplos vendedores
 */
export function useAggregateOfferSchema(
  productId: string,
  productName: string,
  offers: Array<{
    seller: string;
    price: number;
    currency?: string;
    availability?: string;
  }>
) {
  useEffect(() => {
    if (offers.length === 0) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "AggregateOffer",
      priceCurrency: offers[0].currency || "BRL",
      lowPrice: Math.min(...offers.map((o) => o.price)).toString(),
      highPrice: Math.max(...offers.map((o) => o.price)).toString(),
      offerCount: offers.length.toString(),
      offers: offers.map((offer) => ({
        "@type": "Offer",
        seller: offer.seller,
        price: offer.price.toString(),
        priceCurrency: offer.currency || "BRL",
        availability: `https://schema.org/${offer.availability || "InStock"}`,
      })),
    };

    let scriptTag = document.querySelector(
      'script[data-schema="aggregate-offer"]'
    ) as HTMLScriptElement;

    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.type = "application/ld+json";
      scriptTag.setAttribute("data-schema", "aggregate-offer");
      document.head.appendChild(scriptTag);
    }

    scriptTag.textContent = JSON.stringify(schema);
  }, [productId, productName, offers]);
}
