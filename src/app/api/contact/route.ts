// app/api/contact/route.ts
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = ['https://mkeverything.ru', 'https://mkeverything.com'];

function corsHeaders(origin: string | null) {
  return {
    'access-control-allow-origin':
      origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin')),
  });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin'));

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid json' },
      { status: 400, headers },
    );
  }

  const email = body.email?.trim();
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!email || !emailRegex.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'invalid email' },
      { status: 400, headers },
    );
  }

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `new email received: ${email}`,
        }),
      },
    );

    if (!tgRes.ok) {
      return NextResponse.json(
        { ok: false, error: 'failed to notify' },
        { status: 502, headers },
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: 'failed to notify' },
      { status: 502, headers },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200, headers });
}
