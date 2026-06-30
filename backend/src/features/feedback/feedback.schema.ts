export const feedbackReportJsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    growthAreas: { type: 'array', items: { type: 'string' } },
    notableMoments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quote: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['quote', 'note'],
        additionalProperties: false,
      },
    },
    recommendation: {
      type: 'string',
      enum: ['strong-hire', 'hire', 'lean-hire', 'no-hire', 'strong-no-hire'],
    },
  },
  required: ['summary', 'strengths', 'growthAreas', 'notableMoments', 'recommendation'],
  additionalProperties: false,
} as const;
