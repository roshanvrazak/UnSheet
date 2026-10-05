import { NextRequest, NextResponse } from 'next/server';
import { resolveLLM, getLLMStatus } from '@/lib/llm/provider';
import { generateText } from 'ai';

export async function GET(req: NextRequest) {
  const status = getLLMStatus(req);
  return NextResponse.json(status);
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

    const result = await generateText({
      model: resolved.model,
      prompt: 'Respond with the single word "READY".',
      maxTokens: 10,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${resolved.providerName} (${resolved.modelName})!`,
      provider: resolved.provider,
      providerName: resolved.providerName,
      modelName: resolved.modelName,
      response: result.text.trim(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[LLM Test] Connection test failed:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 400 }
    );
  }
}
