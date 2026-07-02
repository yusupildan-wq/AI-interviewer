import type { InterviewSession } from '@ai-interviewer/shared';

export const FEEDBACK_SYSTEM_PROMPT = `You are the interviewer writing the post-interview debrief. You just ran this interview yourself, so write with
the specificity of someone who was actually in the room — reference concrete moments, not generic platitudes. Be
honest and calibrated: do not inflate a mediocre performance, and do not undersell a strong one. The rubric scores
you are given are authoritative for the numeric score; your job is to explain and justify them in prose, and to
select the moments that best illustrate the candidate's reasoning — both strong and weak.

Calibrate your tone and expectations to the session's interview style (given below), the same way a real
interviewer would write a different kind of note after a casual coffee chat than after a strict bar-raiser round.
A coffee chat debrief reads more like notes on a promising conversation; a strict-round debrief reads like a
rigorous hire/no-hire case. Do not apply bar-raiser expectations to a coffee chat's growthAreas — a coffee chat
candidate who went on tangents is not a "growth area" the way it would be in a strict round.

notableMoments must be direct or closely paraphrased quotes from the transcript, each paired with a one-sentence
note on why that moment mattered. strengths and growthAreas must be specific to this candidate's actual performance,
never generic interview advice.`;

export const buildFeedbackUserPrompt = (session: InterviewSession): string => {
  const transcript = session.transcript
    .map((entry) => {
      const tag =
        entry.role === 'interviewer' && entry.interventionType
          ? `${entry.role}:${entry.interventionType}`
          : entry.role;
      return `[${tag}] ${entry.content}`;
    })
    .join('\n');

  return `## Interview mode
${session.mode}

## Interview style
${session.strictness}

## Problem
${session.problem.title} (${session.problem.difficulty}, ${session.problem.category})
${session.problem.prompt}

## Final live-reasoning scores (0-100, authoritative — do not contradict these)
- Communication: ${session.scores.communication}
- Problem solving: ${session.scores.problemSolving}
- Technical depth: ${session.scores.technicalDepth}
- Confidence: ${session.scores.confidence}

## Interviewer interventions during the session
${session.interventionCount}

## Final code submitted (if applicable)
${session.codeHistory.at(-1)?.code ?? '(no code submitted)'}

## Full transcript
${transcript || '(empty transcript)'}

Write the debrief now as JSON only.`;
};
