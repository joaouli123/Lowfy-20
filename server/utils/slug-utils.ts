/**
 * Generates an SEO-friendly slug from a title
 * - Converts to lowercase
 * - Removes accents
 * - Replaces spaces with hyphens
 * - Removes special characters
 * - Limits to 80 characters
 */
export function generateSlug(title: string): string {
  // Remove accents and normalize
  const withoutAccents = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Convert to lowercase and replace spaces with hyphens
  let slug = withoutAccents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Limit to 80 characters
  if (slug.length > 80) {
    slug = slug.substring(0, 80).replace(/-[^-]*$/, '');
  }

  return slug;
}

/**
 * Generates a unique slug by checking for existing slugs and appending a number if needed
 */
export async function generateUniqueSlug(
  title: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 2;

  // Check if slug exists, and if so, append a number
  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
