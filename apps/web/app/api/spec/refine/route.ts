import { NextRequest, NextResponse } from 'next/server';
import { SpecRefinementRequestSchema, SpecRefinementResponseSchema, DashboardSpecSchema } from '@unsheet/contracts';
import { checkRateLimit, rateLimitResponse } from '@/lib/llm/rate-limit';
import { formatSchemaMetadata, SPEC_REFINEMENT_SYSTEM_INSTRUCTION } from '@/lib/llm/prompts';
import { deterministicRefineSpec } from '@/lib/llm/fallback';
import { generateObject } from 'ai';
import { resolveLLM } from '@/lib/llm/provider';
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

    const { prompt, currentSpec, profiles } = parseResult.data;
    const schemaMetadataStr = formatSchemaMetadata(profiles);

    const resolved = resolveLLM(req);
    if (resolved) {
      try {
        console.log(`[Spec Refine] Calling ${resolved.providerName} (${resolved.modelName}) [source: ${resolved.source}]...`);
        const result = await generateObject({
          model: resolved.model,
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
      } catch (llmError: unknown) {
        const errorMsg = llmError instanceof Error ? llmError.message : String(llmError);
        console.warn(`[Spec Refine] ${resolved.providerName} (${resolved.modelName}) failed: ${errorMsg}. Falling back to deterministic engine.`);
      }
    } else {
      console.log('[Spec Refine] No LLM API key configured (env or client header). Using deterministic engine.');
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
  } catch (error: unknown) {
    console.error('Error in /api/spec/refine:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        explanation: 'Failed to process spec refinement request.',
      },
      { status: 500 }
    );
  }
}
