import { NextRequest, NextResponse } from 'next/server';
import { resolveLLM, getLLMStatus } from '@/lib/llm/provider';
import { generateText } from 'ai';
import { runAIRequest } from '@/lib/llm/request-policy';
import { AIRequestError } from '@/lib/llm/endpoint';

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(getLLMStatus(req));
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof AIRequestError ? error.message : 'Invalid AI configuration' }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = resolveLLM(req);
    if (!resolved) {
      return NextResponse.json(
        {
          success: false,
          error: 'No API key provided. Please configure an API key in settings or server environment (GROK_API_KEY, XAI_API_KEY, OPENAI_API_KEY).',
        },
        { status: 400 }
      );
    }

    console.log(`[LLM Test] Testing connection to ${resolved.providerName} (${resolved.modelName})...`);

    const result = await runAIRequest(req, 'llm-test', () => generateText({
      model: resolved.model,
      prompt: 'Respond with the single word "READY".',
      maxTokens: 10,
      maxRetries: 0,
      abortSignal: AbortSignal.any([req.signal, AbortSignal.timeout(10000)]),
    }));

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${resolved.providerName} (${resolved.modelName})!`,
      provider: resolved.provider,
      providerName: resolved.providerName,
      modelName: resolved.modelName,
      response: result.text.trim(),
    });
  } catch (error: unknown) {
    if (error instanceof AIRequestError) {
      return NextResponse.json({ success: false, error: error.message }, {
        status: error.status,
        headers: error.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : {},
      });
    }
    console.error('[LLM Test] Connection test failed');
    return NextResponse.json(
      {
        success: false,
        error: 'AI provider connection failed. Check your settings and try again.',
      },
      { status: 400 }
    );
  }
}
