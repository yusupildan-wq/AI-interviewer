import type {
  CodingLanguage,
  SeniorityLevel,
  TargetRole,
  UpdateUserProfileRequest,
  UserProfile,
} from '@ai-interviewer/shared';

import { HttpError } from '../../shared/http-error.js';
import {
  createDefaultUserProfile,
  findUserProfile,
  saveUserProfile,
} from './profile.repository.js';

const VALID_TARGET_ROLES: TargetRole[] = [
  'frontend',
  'backend',
  'full-stack',
  'mobile',
  'ml-ai',
  'data',
  'devops',
  'security',
];

const VALID_SENIORITY: SeniorityLevel[] = ['intern', 'new-grad', 'mid-level', 'senior', 'staff'];

const VALID_LANGUAGES: CodingLanguage[] = [
  'javascript',
  'typescript',
  'python',
  'java',
  'csharp',
  'cpp',
  'go',
  'rust',
];

const MAX_LIST_ITEMS = 8;
const MAX_LIST_ITEM_LENGTH = 60;
const MAX_GOAL_LENGTH = 240;

const cleanStringList = (value: unknown, fieldName: string): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${fieldName} must be a list.`);
  }

  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS)
    .map((item) => item.slice(0, MAX_LIST_ITEM_LENGTH));

  return Array.from(new Set(items));
};

export const getOrCreateUserProfile = async (userId: string): Promise<UserProfile> => {
  const existing = await findUserProfile(userId);
  return existing ?? createDefaultUserProfile(userId);
};

export const updateUserProfile = async (
  userId: string,
  input: Partial<UpdateUserProfileRequest>,
): Promise<UserProfile> => {
  const updates: Partial<UpdateUserProfileRequest> = {};

  if (input.targetRole !== undefined) {
    if (!VALID_TARGET_ROLES.includes(input.targetRole)) {
      throw new HttpError(400, `targetRole must be one of: ${VALID_TARGET_ROLES.join(', ')}`);
    }
    updates.targetRole = input.targetRole;
  }

  if (input.seniority !== undefined) {
    if (!VALID_SENIORITY.includes(input.seniority)) {
      throw new HttpError(400, `seniority must be one of: ${VALID_SENIORITY.join(', ')}`);
    }
    updates.seniority = input.seniority;
  }

  if (input.preferredLanguage !== undefined) {
    if (!VALID_LANGUAGES.includes(input.preferredLanguage)) {
      throw new HttpError(400, `preferredLanguage must be one of: ${VALID_LANGUAGES.join(', ')}`);
    }
    updates.preferredLanguage = input.preferredLanguage;
  }

  const targetCompanies = cleanStringList(input.targetCompanies, 'targetCompanies');
  if (targetCompanies !== undefined) {
    updates.targetCompanies = targetCompanies;
  }

  const weakAreas = cleanStringList(input.weakAreas, 'weakAreas');
  if (weakAreas !== undefined) {
    updates.weakAreas = weakAreas;
  }

  if (input.interviewGoal !== undefined) {
    if (typeof input.interviewGoal !== 'string') {
      throw new HttpError(400, 'interviewGoal must be a string.');
    }
    updates.interviewGoal =
      input.interviewGoal.trim().slice(0, MAX_GOAL_LENGTH) ||
      'Prepare for realistic technical interviews.';
  }

  return saveUserProfile(userId, updates);
};
