import { NextRequest, NextResponse } from 'next/server';
import { AskYourDataRequestSchema, AskYourDataResponseSchema, SafeSqlQuerySchema, QueryPlan, WidgetSpec } from '@unsheet/contracts';
import { checkRateLimit, rateLimitResponse } from '@/lib/llm/rate-limit';
import { formatSchemaMetadata, ASK_YOUR_DATA_SYSTEM_INSTRUCTION } from '@/lib/llm/prompts';
import { deterministicAskQuery } from '@/lib/llm/fallback';
import { generateObject } from 'ai';
import { resolveLLM } from '@/lib/llm/provider';
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

    // 3. Resolve LLM provider (xAI/Grok, OpenAI, or custom endpoint)
    const resolved = resolveLLM(req);
    if (resolved) {
      try {
        console.log(`[Ask AI] Calling ${resolved.providerName} (${resolved.modelName}) [source: ${resolved.source}]...`);
        const result = await generateObject({
          model: resolved.model,
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
        console.log(`[Ask AI] ${resolved.providerName} successfully answered question.`);
      } catch (llmError: unknown) {
        const errorMsg = llmError instanceof Error ? llmError.message : String(llmError);
        console.warn(`[Ask AI] ${resolved.providerName} (${resolved.modelName}) call failed: ${errorMsg}. Falling back to deterministic engine.`);
      }
    } else {
      console.log('[Ask AI] No LLM API key configured (env or client header). Using deterministic engine.');
    }

    // 4. Fallback if no key or LLM failed
    if (!sqlResult) {
      const fallback = deterministicAskQuery(question, sheetName, profiles);
      sqlResult = fallback.sql;
      intentResult = fallback.interpretedIntent;
      queryPlanResult = fallback.queryPlan;
      widgetResult = fallback.suggestedWidget;
      explanationResult = fallback.explanation;
    } else {
      // If LLM succeeded, also provide suggestedWidget and queryPlan so client gets rich visualizations and in-memory execution
      const fallback = deterministicAskQuery(question, sheetName, profiles);
      queryPlanResult = fallback.queryPlan;
      widgetResult = fallback.suggestedWidget;
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
    // Extract table names present after FROM / JOIN
    const fromMatches = sqlResult.match(/\b(?:from|join)\s+"([^"]+)"/gi) || [];
    const tableNamesInSql = new Set([
      sheetName.toLowerCase(),
      sheetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
      ...fromMatches.map((m) => m.replace(/\b(?:from|join)\s+"/i, '').replace(/"$/, '').toLowerCase()),
    ]);

    // Extract aliases defined after AS (e.g. AS "alias_name")
    const asAliases = new Set(
      Array.from(sqlResult.matchAll(/\bas\s+"([^"]+)"/gi)).map((m) => m[1]!.toLowerCase())
    );

    // Extract quoted identifiers or words matching column keys
    const referencedMatches = sqlResult.match(/"([^"]+)"/g) || [];
    for (const match of referencedMatches) {
      const colName = match.replace(/"/g, '');
      const lowerCol = colName.toLowerCase();
      // If it's a table name or an output alias in the query, skip column check
      if (tableNamesInSql.has(lowerCol) || asAliases.has(lowerCol)) {
        continue;
      }

      // Check if it exists in profiles or is an alias generated in query
      const isProfileCol = allowlistedColumns.has(lowerCol);
      const isCommonAlias = [
        'total_', 'avg_', 'sum_', 'count_', 'min_', 'max_',
        'total', 'avg', 'sum', 'count', 'min', 'max', 'records', 'val', 'value', 'label'
      ].some((prefix) => lowerCol === prefix || lowerCol.startsWith(prefix));

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
