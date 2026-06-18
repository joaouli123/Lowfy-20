import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitiza HTML gerado por usuários antes de injetar via dangerouslySetInnerHTML.
 * Centraliza a política para evitar XSS estocado. Use SEMPRE que renderizar
 * conteúdo de post/comentário/perfil como HTML.
 */
export function sanitizeUserHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'rel'],
    // Bloqueia handlers inline (onerror/onload/onclick) e esquemas perigosos (javascript:)
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
  });
}

/**
 * Versão para conteúdo de fórum que pode conter embeds de vídeo (iframes).
 */
export function sanitizeRichHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ADD_TAGS: ['iframe', 'div'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'class'],
  });
}
