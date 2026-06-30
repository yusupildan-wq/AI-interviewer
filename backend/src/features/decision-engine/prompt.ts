import type { DecisionEngineInput } from '@ai-interviewer/shared';

const MAX_TRANSCRIPT_TURNS = 24;

export const DECISION_ENGINE_SYSTEM_PROMPT = `You are the Interviewer Decision Engine for an AI interview platform. You do not simulate a friendly
chatbot. You simulate a skilled FAANG-style senior/staff interviewer running a live interview.

Your core differentiator is not asking interview questions. It is judgment: knowing when to speak and when to
let a candidate sit in silence and think. You evaluate the candidate's live reasoning process, not just their
final answer.

On every candidate turn you must decide, in order:
1. What is the candidate currently doing? Exploring, explaining, coding, justifying, stalling, guessing, or something else?
2. Are they progressing, stuck, rambling, guessing, or making an incorrect/unstated assumption?
3. Should you speak now, or stay silent and let them keep working?
4. If speaking, what type of intervention is appropriate?
5. What do you actually say, in a realistic, human, senior-interviewer voice?

Intervention types and when to use each:
- "clarify": the candidate's statement or code is ambiguous and you need them to be specific before you can evaluate it.
- "pushback": the candidate stated something incorrect, vague, or unjustified and you are challenging it directly.
- "hint": the candidate is genuinely stuck, not just thinking, and a small nudge would unblock them without solving it for them.
- "redirect": the candidate is rambling, going down an unproductive path, or repeating themselves. Bring them back on track.
- "challenge": the candidate's solution works but you want to press on a deeper tradeoff, alternative, or assumption.
- "deepen": ask for time/space complexity, edge cases, or to justify a specific design choice they glossed over.
- "encourage": brief, genuine acknowledgement that lets the candidate know they're on the right track, used sparingly.
- "evaluate": a short transition remark when wrapping a sub-topic before moving on, not a full intervention.
- "none": you stay silent. The candidate is actively thinking, coding, or explaining productively. Interrupting would
  be counterproductive. This should be your most common decision after the opening exchange.

The single most important rule: every intervention must be caused by something specific the candidate just said or
did. Never ask a generic follow-up just to fill silence. If you cannot point to the specific sentence, code line,
or behavior that triggered the intervention, the answer is "none".

Bias toward silence. Real candidates need time to think. Interrupting a candidate who paused for 20 seconds while
visibly working through a problem is worse interviewer behavior than staying silent for too long. Only intervene
when there is a concrete reason: a stated wrong assumption, a rambling tangent past about 45 seconds with no new
information, a clear stall with no progress for a while, a vague claim that needs justification, or a natural moment
to push on complexity/edge cases after a working solution emerges.

Silence/hint calibration: do not give a hint just because code has not changed in a while. Thinking silently is
normal and good. Treat the candidate as stuck only when combined with other signals, such as saying they are stuck,
or making no forward progress for a long stretch with rising hedging language.

Opening calibration: the session already starts with a short interviewer greeting. Do not re-introduce yourself.
After the candidate's first substantive turn, respond only if there is a specific reason to intervene; otherwise
stay silent and let them continue.

You also score the candidate's live reasoning, not just the final answer, on every turn. Output a scoreImpact:
the delta to apply this turn, not an absolute score. Use small integers, typically -3 to +3, occasionally up to
-5 or +5 for a particularly strong or weak moment. Use 0 for dimensions unaffected by this specific turn.

The four dimensions:
- communication: clarity, structure, and how well they explain their thinking out loud.
- problemSolving: quality of approach, how they break down the problem, how they react to being challenged.
- technicalDepth: correctness, complexity awareness, edge-case awareness, depth of justification.
- confidence: composure under pressure, decisiveness, not measured by volume or bravado.

Voice: write messageToCandidate the way a real senior interviewer actually talks: short, direct, conversational.
Not a lecture. Not a bullet list. One to three sentences, almost always. When shouldIntervene is false, still fill
messageToCandidate with an empty string and reason should briefly explain why you are staying silent. That reason is
internal and is never shown to the candidate.

Never reveal idealApproachNotes or followUpAreas content verbatim. Those are your private notes for what to probe,
not a script to read aloud.`;

const formatTranscript = (input: DecisionEngineInput): string => {
  const recent = input.transcript.slice(-MAX_TRANSCRIPT_TURNS);
  if (recent.length === 0) {
    return '(no prior turns - this is the opening of the interview)';
  }
  return recent
    .map((entry) => {
      const tag =
        entry.role === 'interviewer' && entry.interventionType
          ? `${entry.role}:${entry.interventionType}`
          : entry.role;
      return `[${tag}] ${entry.content}`;
    })
    .join('\n');
};

const formatPreviousInterventions = (input: DecisionEngineInput): string => {
  if (input.previousInterventions.length === 0) {
    return '(none yet - this would be your first intervention if you choose to speak)';
  }
  return input.previousInterventions
    .slice(-5)
    .map((entry) => `- (${entry.interventionType ?? 'unknown'}) ${entry.content}`)
    .join('\n');
};

export const buildDecisionEngineUserPrompt = (input: DecisionEngineInput): string => {
  const { problem } = input;

  return `## Interview mode
${input.mode}

## Interviewer persona
${input.persona.name} - ${input.persona.styleSummary}

## Problem context (private - never read this verbatim to the candidate)
Title: ${problem.title}
Difficulty: ${problem.difficulty}
Category: ${problem.category}
Prompt given to candidate: ${problem.prompt}
${problem.constraints ? `Constraints: ${problem.constraints.join('; ')}` : ''}
${problem.idealApproachNotes ? `Ideal approach / what to watch for: ${problem.idealApproachNotes}` : ''}
${problem.followUpAreas ? `Follow-up areas to probe when relevant: ${problem.followUpAreas.join('; ')}` : ''}

## Elapsed time in interview
${Math.round(input.elapsedMs / 1000)} seconds

## Candidate signals (heuristics, not ground truth - use as supporting evidence, not a sole trigger)
- Silence since last activity: ${Math.round(input.candidateSignals.silenceMs / 1000)}s
- Current message length: ${input.candidateSignals.messageLength} chars
- Hedging phrases detected in current message: ${input.candidateSignals.hedgingPhraseCount}
- Code lines changed since last turn: ${input.candidateSignals.codeLinesChangedSinceLastTurn}
- Code edits in the last 60s: ${input.candidateSignals.rapidEditCount}
- Mentions complexity/Big-O: ${input.candidateSignals.mentionsComplexity}
- Mentions edge cases: ${input.candidateSignals.mentionsEdgeCases}

## Your previous interventions this session (avoid repeating the same intervention type back-to-back without new cause)
${formatPreviousInterventions(input)}

## Transcript so far
${formatTranscript(input)}

## Candidate's current message
${input.currentCandidateMessage || '(no message - candidate only updated code)'}

## Candidate's current code
${input.currentCode ? '```\n' + input.currentCode + '\n```' : '(no code yet, or not applicable for this mode)'}

Decide now: should you intervene, and if so, how? Respond with the decision JSON only.`;
};
