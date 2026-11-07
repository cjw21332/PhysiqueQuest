import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
const querySchema = z.object({ search: z.string().max(100).optional(), muscle: z.string().max(100).optional(), equipment: z.string().max(100).optional(), bodyPart: z.string().max(100).optional(), target: z.string().max(100).optional(), secondary: z.string().max(100).optional(), sort: z.enum(['name-asc', 'name-desc', 'body-part', 'equipment', 'recent']).optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).default(12) }).strict();
export function parseCatalogQuery(query: unknown) {
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) throw new BadRequestException('Invalid exercise query');
  return parsed.data;
}
