import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http-error.js';

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionParams {
  model: string;
  temperature?: number;
  maxCompletionTokens: number;
  messages: OpenAiChatMessage[];
  responseFormat?: { name: string; schema: object };
  signal?: AbortSignal;
}

const requestChatCompletion = async (params: ChatCompletionParams): Promise<string> => {
  if (!env.openaiApiKey) {
    throw new HttpError(
      503,
      'OPENAI_API_KEY is not configured. Set it in backend/.env to enable the Interviewer Decision Engine.',
    );
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        temperature: params.temperature,
        max_completion_tokens: params.maxCompletionTokens,
        messages: params.messages,
        ...(params.responseFormat
          ? {
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: params.responseFormat.name,
                  schema: params.responseFormat.schema,
                  strict: true,
                },
              },
            }
          : {}),
      }),
      signal: params.signal,
    });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'AbortError') {
      throw caught;
    }
    throw new HttpError(
      502,
      `OpenAI chat completion request failed: ${caught instanceof Error ? caught.message : 'unknown error'}`,
    );
  }

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    const status = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw new HttpError(
      status,
      `OpenAI chat completion request failed (${response.status}): ${message}`,
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new HttpError(502, 'OpenAI chat completion returned no content.');
  }

  return content;
};

export interface StructuredChatCompletionParams {
  model: string;
  temperature?: number;
  maxCompletionTokens: number;
  messages: OpenAiChatMessage[];
  jsonSchemaName: string;
  jsonSchema: object;
  signal?: AbortSignal;
}

/** Raw fetch, matching the existing OpenAI TTS integration in voice.service.ts rather
 * than adding the `openai` SDK as a second way to call the same API. */
export const createStructuredChatCompletion = (
  params: StructuredChatCompletionParams,
): Promise<string> =>
  requestChatCompletion({
    model: params.model,
    temperature: params.temperature,
    maxCompletionTokens: params.maxCompletionTokens,
    messages: params.messages,
    responseFormat: { name: params.jsonSchemaName, schema: params.jsonSchema },
    signal: params.signal,
  });

export interface ChatCompletionTextParams {
  model: string;
  temperature?: number;
  maxCompletionTokens: number;
  messages: OpenAiChatMessage[];
}

/** Plain-text completion (no structured output) for free-form conversational replies. */
export const createChatCompletion = (params: ChatCompletionTextParams): Promise<string> =>
  requestChatCompletion(params);
