import { useEffect } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Hook que injeta FAQ Schema.org estruturado dinamicamente
 * Usado em páginas com perguntas frequentes
 */
export function useFAQSchema(faqs: FAQItem[]) {
  useEffect(() => {
    if (faqs.length === 0) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    };

    let scriptTag = document.querySelector(
      'script[data-schema="faq-schema"]'
    ) as HTMLScriptElement;

    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.type = "application/ld+json";
      scriptTag.setAttribute("data-schema", "faq-schema");
      document.head.appendChild(scriptTag);
    }

    scriptTag.textContent = JSON.stringify(schema);
  }, [faqs]);
}
