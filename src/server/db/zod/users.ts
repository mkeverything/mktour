import { apiTokens, sessions, users } from '@/server/db/schema/users';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-zod';
import z from 'zod';

export const usersSelectSchema = createSelectSchema(users);
export const usersInsertSchema = createInsertSchema(users);
export const usersUpdateSchema = createUpdateSchema(users);

export const usersSelectPublicSchema = usersSelectSchema.omit({
  email: true,
});

export const usersSelectMinimalSchema = usersSelectPublicSchema.omit({
  createdAt: true,
  selectedClub: true,
  rating: true,
});

export const editProfileFormSchema = usersUpdateSchema
  .omit({
    id: true,
    username: true,
    email: true,
    createdAt: true,
    selectedClub: true,
    rating: true,
  })
  .extend({
    name: z.string().max(50, 'max 50').optional(),
  });

export const apiTokensSelectSchema = createSelectSchema(apiTokens);
export const apiTokensInsertSchema = createInsertSchema(apiTokens);

export const apiToken = apiTokensSelectSchema.pick({
  id: true,
  name: true,
  createdAt: true,
  lastUsedAt: true,
});

export const sessionsSelectSchema = createSelectSchema(sessions);
export const sessionsInsertSchema = createInsertSchema(sessions);

export const validateRequestSchema = z.object({
  user: usersSelectSchema.nullable(),
  session: sessionsSelectSchema.nullable(),
});

export type UserPublicModel = z.infer<typeof usersSelectPublicSchema>;
export type UserMinimalModel = z.infer<typeof usersSelectMinimalSchema>;
export type EditProfileFormModel = z.infer<typeof editProfileFormSchema>;
export type ApiTokenModel = z.infer<typeof apiToken>;
export type ApiTokenInsertModel = z.infer<typeof apiTokensInsertSchema>;

export type UserModel = z.infer<typeof usersSelectSchema>;
export type UserInsertModel = z.infer<typeof usersInsertSchema>;
export type UserUpdateModel = z.infer<typeof usersUpdateSchema>;

export type SessionModel = z.infer<typeof sessionsSelectSchema>;
export type SessionInsertModel = z.infer<typeof sessionsInsertSchema>;
