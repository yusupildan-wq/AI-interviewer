import type { Problem } from '@ai-interviewer/shared';

export const problems: Problem[] = [
  {
    id: 'two-sum',
    mode: 'coding',
    title: 'Two Sum',
    prompt:
      'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`. Assume exactly one solution exists, and you may not use the same element twice.',
    difficulty: 'easy',
    category: 'arrays & hashing',
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      'Exactly one valid answer exists.',
    ],
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
    ],
    idealApproachNotes:
      'Brute force is O(n^2). The expected approach is a single pass with a hash map from value to index, achieving O(n) time / O(n) space. Watch for candidates who jump straight to nested loops without considering the hash map tradeoff, and for candidates who do not discuss what happens with duplicate values.',
    followUpAreas: [
      'Time/space complexity of the brute-force vs hash-map approach',
      'What if the array is sorted — can two pointers beat the hash map on space?',
      'What if there are multiple valid pairs and we need all of them?',
      'Edge cases: duplicate values, negative numbers, no solution exists',
    ],
  },
  {
    id: 'lru-cache',
    mode: 'coding',
    title: 'LRU Cache',
    prompt:
      'Design a data structure that implements a Least Recently Used (LRU) cache. It should support `get(key)` and `put(key, value)` in O(1) average time, with a fixed capacity. When the cache exceeds capacity, evict the least recently used item.',
    difficulty: 'medium',
    category: 'design + data structures',
    constraints: ['1 <= capacity <= 3000', 'At most 2 * 10^5 calls to get and put'],
    idealApproachNotes:
      'Expected approach is a doubly linked list + hash map of key -> node, giving O(1) get/put. Weaker candidates reach for an array or a plain object and try to fake O(1) eviction; push on this. Strong candidates proactively discuss the linked list + map combination before writing code.',
    followUpAreas: [
      'Why is a plain hash map alone insufficient for O(1) eviction order?',
      'Walk through what happens on a cache hit vs cache miss vs eviction',
      'Thread-safety / concurrent access considerations',
      'How would this change for an LFU (least frequently used) cache?',
    ],
  },
  {
    id: 'conflicting-feedback',
    mode: 'behavioral',
    title: 'Conflicting Feedback From Two Stakeholders',
    prompt:
      'Tell me about a time you received conflicting feedback or requirements from two stakeholders on the same project. How did you handle it?',
    difficulty: 'medium',
    category: 'collaboration & influence',
    idealApproachNotes:
      'Looking for a concrete STAR-shaped story: specific situation, the candidate\'s own actions (not just "the team"), and a measurable or observable outcome. Red flags: vague generalities, no real conflict, blaming stakeholders, or an answer that never resolves.',
    followUpAreas: [
      'What was the actual disagreement, specifically?',
      'What would you do differently if it happened again?',
      'How did the stakeholders react to your resolution?',
      'Distinguish what "you" did versus what "the team" did',
    ],
  },
  {
    id: 'failure-and-recovery',
    mode: 'behavioral',
    title: 'A Project That Went Wrong',
    prompt:
      'Describe a project or decision that did not go the way you expected. What happened, and what did you learn?',
    difficulty: 'medium',
    category: 'ownership & growth',
    idealApproachNotes:
      'Looking for genuine ownership of a real failure, a specific root cause, and evidence of behavior change afterward. Red flags: a "failure" that is actually a humblebrag, no real mistake owned, or no lasting change in behavior.',
    followUpAreas: [
      'What was your specific role in what went wrong?',
      'What did you change about how you work afterward?',
      'How did you communicate the failure to others?',
    ],
  },
  {
    id: 'url-shortener',
    mode: 'system-design',
    title: 'Design a URL Shortener',
    prompt:
      'Design a service like bit.ly that takes a long URL and returns a short one, and redirects short URLs to the original long URL at scale.',
    difficulty: 'medium',
    category: 'distributed systems',
    idealApproachNotes:
      'Expect the candidate to clarify scale (reads vs writes ratio, QPS) before designing. Core components: ID generation strategy (counter + base62 vs hash vs random with collision check), datastore choice and indexing, caching layer for hot redirects, and how reads (very high QPS, latency-sensitive) are isolated from writes. Weak answers jump straight to schema without discussing scale or the read/write asymmetry.',
    followUpAreas: [
      'Read-heavy vs write-heavy traffic — how does that change the design?',
      'How do you generate short codes and avoid collisions at scale?',
      'Where would you put caching, and what is the eviction/invalidation policy?',
      'How would you handle custom aliases and analytics without slowing down redirects?',
      'Single point of failure analysis and how to remove it',
    ],
  },
  {
    id: 'resume-deep-dive',
    mode: 'resume-deep-dive',
    title: 'Resume Deep Dive',
    prompt:
      'Walk me through a project on your resume that you are most proud of. Be ready to go deep on the technical decisions you personally made.',
    difficulty: 'medium',
    category: 'technical depth & ownership',
    idealApproachNotes:
      'This is an open-ended deep dive driven by whatever the candidate brings up. The interviewer should follow the thread of whatever project/technology the candidate names, and push for specifics: what exactly did the candidate build, what tradeoffs did they personally weigh, and how would they have done it differently. Red flags: answers that stay at a high "the team did X" level without the candidate\'s own specific contribution, or inability to justify basic technical choices in their own project.',
    followUpAreas: [
      'What specifically did you build versus what did the team build?',
      'Why did you choose this technology/approach over the alternatives?',
      'What would you do differently if you rebuilt this today?',
      'What was the hardest bug or failure mode you hit, and how did you find it?',
    ],
  },
];

export type CandidateSafeProblem = Omit<Problem, 'idealApproachNotes' | 'followUpAreas'>;

/** Strips interviewer-private fields (the answer key) before a problem reaches the candidate. */
export const candidateSafeProblem = (problem: Problem): CandidateSafeProblem => {
  const {
    idealApproachNotes: _idealApproachNotes,
    followUpAreas: _followUpAreas,
    ...rest
  } = problem;
  return rest;
};

export const findProblemById = (id: string): Problem | undefined =>
  problems.find((problem) => problem.id === id);

export const findProblemsByMode = (mode: Problem['mode']): Problem[] =>
  problems.filter((problem) => problem.mode === mode);

export const pickRandomProblemForMode = (mode: Problem['mode']): Problem | undefined => {
  const candidates = findProblemsByMode(mode);
  if (candidates.length === 0) {
    return undefined;
  }
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
};
