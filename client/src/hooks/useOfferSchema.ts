import { useEffect } from "react";

interface OfferData {
  productName: string;
  productId: string;
  productImage?: string;
  price: number;
  currency?: string;
  priceValidUntil?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  sellerName?: string;
  discount?: number;
  discountPercent?: number;
}

/**
 * Hook que injeta Offer Schema.org estruturado dinamicamente
 * Usado em páginas de checkout/pricing
 */
export function useOfferSchema(offerData: OfferData) {
  useEffect(() => {
    const schema: any = {
      "@context": "https://schema.org",
      "@type": "Offer",
      name: offerData.productName,
      url: `https://lowfy.com.br/marketplace/produto/${offerData.productId}`,
      image: offerData.productImage || "https://lowfy.com.br/og-image.svg",
      price: offerData.price.toString(),
      priceCurrency: offerData.currency || "BRL",
      availability: `https://schema.org/${offerData.availability || "InStock"}`,
      seller: {
        "@type": "Organization",
        name: offerData.sellerName || "Lowfy",
        url: "https://lowfy.com.br",
      },
    };

    // Adicionar desconto se disponível
    if (offerData.discount) {
      schema.discount = offerData.discount.toString();
    }
    if (offerData.discountPercent) {
      schema.discountPercent = offerData.discountPercent.toString();
    }

    // Adicionar data de validade se disponível
    if (offerData.priceValidUntil) {
      schema.priceValidUntil = offerData.priceValidUntil;
    }

    let scriptTag = document.querySelector(
      'script[data-schema="offer-schema"]'
    ) as HTMLScriptElement;

    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.type = "application/ld+json";
      scriptTag.setAttribute("data-schema", "offer-schema");
      document.head.appendChild(scriptTag);
    }

    scriptTag.textContent = JSON.stringify(schema);
  }, [offerData]);
}
