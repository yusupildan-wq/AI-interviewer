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
    reason: { type: 'string' },
    messageToCandidate: { type: 'string' },
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
  },
  required: ['shouldIntervene', 'interventionType', 'reason', 'messageToCandidate', 'scoreImpact'],
  additionalProperties: false,
} as const;
