import type { SynthesizeSpeechRequest, TranscribeAudioResponse } from '@ai-interviewer/shared';
import express, { Router } from 'express';

import { asyncHandler } from '../../shared/async-handler.js';
import { HttpError } from '../../shared/http-error.js';
import { synthesizeSpeech, transcribeAudio } from './voice.service.js';

export const voiceRouter = Router();

const audioBodyParser = express.raw({ type: () => true, limit: '20mb' });

voiceRouter.post(
  '/transcribe',
  audioBodyParser,
  asyncHandler(async (request, response) => {
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      throw new HttpError(400, 'Request body must contain raw audio bytes.');
    }

    const text = await transcribeAudio(request.body, request.headers['content-type'] ?? '');
    const result: TranscribeAudioResponse = { text };
    response.json(result);
  }),
);

voiceRouter.post(
  '/speak',
  asyncHandler(async (request, response) => {
    const body = request.body as Partial<SynthesizeSpeechRequest>;
    if (!body.text || typeof body.text !== 'string') {
      throw new HttpError(400, 'Request must include text to synthesize.');
    }

    const audio = await synthesizeSpeech(body.text);
    response.setHeader('Content-Type', 'audio/wav');
    response.send(audio);
  }),
);
