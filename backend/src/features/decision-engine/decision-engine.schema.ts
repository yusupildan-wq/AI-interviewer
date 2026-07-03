/** JSON Schema for structured-output enforcement of DecisionEngineOutput. */
export const decisionEngineJsonSchema = {
  type: 'object',
  properties: {
    shouldIntervene: { type: 'boolean' },
    interventionType: {
      type: 'string',
      enum: [
        'clarify',
        'pushback',
        'hint',
        'redirect',
        'challenge',
        'deepen',
        'encourage',
        'evaluate',
        'none',
      ],
    },
    reason: {
      type: 'string',
      description:
        'Internal only, never shown to the candidate. One short phrase (under ~12 words), not a paragraph.',
    },
    messageToCandidate: {
      type: 'string',
      description:
        'Spoken out loud to the candidate via voice synthesis. One sentence by default, two at most — never a paragraph or list.',
    },
    scoreImpact: {
      type: 'object',
      properties: {
        communication: { type: 'integer' },
        problemSolving: { type: 'integer' },
        technicalDepth: { type: 'integer' },
        confidence: { type: 'integer' },
      },
      required: ['communication', 'problemSolving', 'technicalDepth', 'confidence'],
      additionalProperties: false,
    },
    notableMention: {
      type: 'string',
      description:
        'Empty string in almost every turn. Only fill this in when the candidate mentions something ' +
        'genuinely worth remembering long-term and referencing later — a specific technology, project, ' +
        'prior job, or personal detail (their dog, a hobby, a family business). A short phrase, e.g. ' +
        "'mentioned a summer internship at a fintech startup' or 'has a dog that interrupted the call'. " +
        'Do not fill this in for routine technical statements already captured by scoring.',
    },
  },
  required: [
    'shouldIntervene',
    'interventionType',
    'reason',
    'messageToCandidate',
    'scoreImpact',
    'notableMention',
  ],
  additionalProperties: false,
} as const;
