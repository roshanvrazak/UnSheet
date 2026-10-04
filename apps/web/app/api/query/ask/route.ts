import { NextRequest, NextResponse } from 'next/server';
import { AskYourDataRequestSchema, AskYourDataResponseSchema, SafeSqlQuerySchema, QueryPlan, WidgetSpec } from '@unsheet/contracts';
import { checkRateLimit, rateLimitResponse } from '@/lib/llm/rate-limit';
import { formatSchemaMetadata, ASK_YOUR_DATA_SYSTEM_INSTRUCTION } from '@/lib/llm/prompts';
import { deterministicAskQuery } from '@/lib/llm/fallback';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  // 1. Rate Limiting (max 30 calls/min)
  const rateLimitResult = checkRateLimit(req, 'query-ask', { maxRequests: 30 });
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult.retryAfterSeconds);
  }

  try {
    const body = await req.json();

    // 2. Parse request with AskYourDataRequestSchema
    const parseResult = AskYourDataRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid request payload: ${parseResult.error.message}`,
          interpretedIntent: '',
          explanation: 'Failed to validate request against AskYourDataRequestSchema.',
        },
        { status: 400 }
      );
    }

    const { question, sheetName, profiles } = parseResult.data;
    const schemaMetadataStr = formatSchemaMetadata(profiles);
    const allowlistedColumns = new Set(profiles.map((p) => p.columnKey.toLowerCase()));

    let sqlResult = '';
    let intentResult = '';
    let queryPlanResult: QueryPlan | undefined = undefined;
    let widgetResult: WidgetSpec | undefined = undefined;
    let explanationResult = '';

    // 3. Check if OpenAI API key is present
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey.trim() !== '') {
      try {
        const result = await generateObject({
          model: openai('gpt-4o-mini'),
          system: ASK_YOUR_DATA_SYSTEM_INSTRUCTION + '\n\n' + schemaMetadataStr,
          prompt: `Table name: "${sheetName}"\nQuestion: ${question}`,
          schema: z.object({
            interpretedIntent: z.string().max(500),
            sql: z.string().max(4000),
            explanation: z.string().max(2000),
          }),
        });

        sqlResult = result.object.sql.trim();
        intentResult = result.object.interpretedIntent;
        explanationResult = result.object.explanation;
      } catch (llmError) {
        console.warn('OpenAI generateObject failed for ask-your-data, falling back to deterministic parser:', llmError);
      }
    }

    // 4. Fallback if no key or LLM failed
    if (!sqlResult) {
      const fallback = deterministicAskQuery(question, sheetName, profiles);
      sqlResult = fallback.sql;
      intentResult = fallback.interpretedIntent;
      queryPlanResult = fallback.queryPlan;
      widgetResult = fallback.suggestedWidget;
      explanationResult = fallback.explanation;
    }

    // 5. Validate SQL with SafeSqlQuerySchema
    const sqlValidation = SafeSqlQuerySchema.safeParse(sqlResult);
    if (!sqlValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Generated SQL failed safety validation: ${sqlValidation.error.message}`,
          interpretedIntent: intentResult,
          explanation: 'Generated query violated safety constraints (DDL/DML/multi-statement/forbidden function).',
        },
        { status: 400 }
      );
    }

    // 6. Check that referenced columns exist in provided profiles (allowlist check)
    // Extract quoted identifiers or words matching column keys
    const referencedMatches = sqlResult.match(/"([^"]+)"/g) || [];
    for (const match of referencedMatches) {
      const colName = match.replace(/"/g, '');
      // If it's not the sheetName and not a standard SQL function/alias (like COUNT, SUM, etc.), verify
      if (colName.toLowerCase() !== sheetName.toLowerCase()) {
        // Check if it exists in profiles or is an alias generated in query
        const isProfileCol = allowlistedColumns.has(colName.toLowerCase());
        const isCommonAlias = ['total_', 'avg_', 'sum_', 'count_', 'min_', 'max_'].some((prefix) => colName.toLowerCase().startsWith(prefix));
        if (!isProfileCol && !isCommonAlias) {
          return NextResponse.json(
            {
              success: false,
              error: `SQL references un-allowlisted column: "${colName}"`,
              interpretedIntent: intentResult,
              explanation: 'Query rejected because it references columns not present in the provided schema profile.',
            },
            { status: 400 }
          );
        }
      }
    }

    const responsePayload = {
      success: true,
      interpretedIntent: intentResult,
      sql: sqlResult,
      queryPlan: queryPlanResult,
      suggestedWidget: widgetResult,
      explanation: explanationResult,
    };

    const validatedResponse = AskYourDataResponseSchema.parse(responsePayload);
    return NextResponse.json(validatedResponse);
  } catch (error: unknown) {
    console.error('Error in /api/query/ask:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        interpretedIntent: '',
        explanation: 'Failed to process ask-your-data request.',
      },
      { status: 500 }
    );
  }
}
