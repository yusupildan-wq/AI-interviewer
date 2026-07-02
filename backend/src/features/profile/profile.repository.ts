import type { UserProfile } from '@ai-interviewer/shared';
import { eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { userProfiles } from '../../db/schema.js';

type UserProfileRow = typeof userProfiles.$inferSelect;

const toUserProfile = (row: UserProfileRow): UserProfile => ({
  userId: row.userId,
  targetRole: row.targetRole,
  seniority: row.seniority,
  preferredLanguage: row.preferredLanguage,
  targetCompanies: row.targetCompanies,
  weakAreas: row.weakAreas,
  interviewGoal: row.interviewGoal,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const findUserProfile = async (userId: string): Promise<UserProfile | undefined> => {
  const row = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });
  return row ? toUserProfile(row) : undefined;
};

export const createDefaultUserProfile = async (userId: string): Promise<UserProfile> => {
  const [row] = await db.insert(userProfiles).values({ userId }).returning();
  if (!row) {
    throw new Error('Could not create user profile.');
  }
  return toUserProfile(row);
};

export const saveUserProfile = async (
  userId: string,
  values: Partial<
    Pick<
      UserProfile,
      | 'targetRole'
      | 'seniority'
      | 'preferredLanguage'
      | 'targetCompanies'
      | 'weakAreas'
      | 'interviewGoal'
    >
  >,
): Promise<UserProfile> => {
  const [row] = await db
    .insert(userProfiles)
    .values({
      userId,
      ...values,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        ...values,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) {
    throw new Error('Could not save user profile.');
  }

  return toUserProfile(row);
};
