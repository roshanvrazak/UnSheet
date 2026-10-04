import { NextRequest, NextResponse } from 'next/server';
import { SpecRefinementRequestSchema, SpecRefinementResponseSchema, DashboardSpecSchema } from '@unsheet/contracts';
import { checkRateLimit, rateLimitResponse } from '@/lib/llm/rate-limit';
import { formatSchemaMetadata, SPEC_REFINEMENT_SYSTEM_INSTRUCTION } from '@/lib/llm/prompts';
import { deterministicRefineSpec } from '@/lib/llm/fallback';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  const rateLimitResult = checkRateLimit(req, 'spec-refine', { maxRequests: 20 });
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult.retryAfterSeconds);
  }

  try {
    const body = await req.json();

    const parseResult = SpecRefinementRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid request payload: ${parseResult.error.message}`,
          explanation: 'Failed to validate request against SpecRefinementRequestSchema.',
        },
        { status: 400 }
      );
    }

    const { prompt, currentSpec, profiles, history } = parseResult.data;
    const schemaMetadataStr = formatSchemaMetadata(profiles);

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey.trim() !== '') {
      try {
        const result = await generateObject({
          model: openai('gpt-4o-mini'),
          system: SPEC_REFINEMENT_SYSTEM_INSTRUCTION + '\n\n' + schemaMetadataStr,
          prompt,
          schema: z.object({
            updatedSpec: DashboardSpecSchema,
            explanation: z.string().max(2000),
            appliedChanges: z.array(z.string().max(256)),
          }),
        });

        const responsePayload = {
          success: true,
          updatedSpec: result.object.updatedSpec,
          explanation: result.object.explanation,
          appliedChanges: result.object.appliedChanges,
        };

        const validatedResponse = SpecRefinementResponseSchema.parse(responsePayload);
        return NextResponse.json(validatedResponse);
      } catch (llmError) {
        console.warn('OpenAI generateObject failed, falling back to deterministic modifier:', llmError);
      }
    }

    const fallbackResult = deterministicRefineSpec(prompt, currentSpec, profiles);
    const responsePayload = {
      success: true,
      updatedSpec: fallbackResult.updatedSpec,
      explanation: fallbackResult.explanation + ' (Fallback mode)',
      appliedChanges: fallbackResult.appliedChanges,
    };

    const validatedResponse = SpecRefinementResponseSchema.parse(responsePayload);
    return NextResponse.json(validatedResponse);
  } catch (error: any) {
    console.error('Error in /api/spec/refine:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        explanation: 'Failed to process spec refinement request.',
      },
      { status: 500 }
    );
  }
}
