declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type NotifyPayload = {
  eventId: string;
  title: string;
  description: string | null;
  closesAtIso: string;
  outcomeLabels: string[];
  creatorUsername: string | null;
};

function buildMessage(payload: NotifyPayload) {
  const closesAt = new Date(payload.closesAtIso);
  const closesAtLabel = Number.isNaN(closesAt.getTime())
    ? payload.closesAtIso
    : closesAt.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

  const creatorText = payload.creatorUsername?.trim() || "unknown";

  return [
    "Новое событие создано",
    `Название: ${payload.title}`,
    `Создатель: ${creatorText}`,
    `Прием ставок до: ${closesAtLabel} (МСК)`,
  ].join("\n");
}

function toTelegramUserId(value: string) {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  return normalized;
}

async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string
) {
  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    }
  );

  const telegramBody = await telegramResponse.json();
  const ok = telegramResponse.ok && telegramBody?.ok !== false;
  return {
    ok,
    description: telegramBody?.description ?? null,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!token || !supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "missing_required_secrets",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = (await request.json()) as NotifyPayload;
    if (
      !payload?.eventId ||
      !payload?.title ||
      !Array.isArray(payload?.outcomeLabels)
    ) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "invalid_payload",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const profilesResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id,username`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!profilesResponse.ok) {
      const profilesErrorText = await profilesResponse.text();
      return new Response(
        JSON.stringify({
          ok: false,
          error: "profiles_load_failed",
          details: profilesErrorText || "Cannot load profiles",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const profiles = (await profilesResponse.json()) as Array<{
      id: string;
      username: string;
    }>;

    const messageText = buildMessage(payload);
    const recipients = (profiles ?? [])
      .map((profile) => ({
        chatId: toTelegramUserId(String(profile.id)),
        username: profile.username ?? null,
      }))
      .filter((row) => row.chatId !== null);

    let sentCount = 0;
    const failed: Array<{
      chatId: string;
      username: string | null;
      reason: string;
    }> = [];

    for (const recipient of recipients) {
      const result = await sendTelegramMessage(
        token,
        recipient.chatId as string,
        messageText
      );
      if (result.ok) {
        sentCount += 1;
        continue;
      }
      failed.push({
        chatId: recipient.chatId as string,
        username: recipient.username,
        reason: result.description ?? "Unknown Telegram API error",
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        totalRecipients: recipients.length,
        sentCount,
        failedCount: failed.length,
        failed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        ok: false,
        error: "unexpected_error",
        details: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
