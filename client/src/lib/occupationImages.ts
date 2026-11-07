/**
 * Presentation-only photo map for occupation cards. Keys cover both the mock IDs and the
 * backend seed slugs (server/seed_data/occupations.json). Occupations without a photo
 * fall back to the door illustration.
 */
const PHOTOS: Record<string, string> = {
  'graphic-designer': 'graphic-designer',
  accountant: 'accountant',
  nurse: 'registered-nurse',
  'registered-nurse': 'registered-nurse',
  'customer-support': 'customer-support',
  'customer-service-agent': 'customer-support',
};

export function occupationPhoto(occupationId: string): string | null {
  const file = PHOTOS[occupationId];
  return file ? `/images/occupations/${file}.webp` : null;
}
