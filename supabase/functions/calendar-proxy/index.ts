// Supabase Edge Function: calendar-proxy
// Browsers can't fetch iCal feed URLs directly (no CORS headers on Google/Apple/
// Outlook feeds), so this tiny proxy fetches the feed server-side and returns it
// with CORS enabled. Deploy via the Supabase dashboard (SETUP.md Part 3).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const target = new URL(req.url).searchParams.get('url');
  if (!target || !/^https:\/\//i.test(target)) {
    return new Response('Provide ?url=https://... (an iCal feed address)', { status: 400, headers: cors });
  }

  try {
    const res = await fetch(target, { headers: { 'User-Agent': 'HealthHub/1.0' }, redirect: 'follow' });
    const text = await res.text();
    if (!res.ok) return new Response(`Upstream error ${res.status}`, { status: 502, headers: cors });
    if (!text.includes('BEGIN:VCALENDAR')) {
      return new Response('URL did not return an iCal calendar', { status: 422, headers: cors });
    }
    return new Response(text, { status: 200, headers: { ...cors, 'Content-Type': 'text/calendar' } });
  } catch {
    return new Response('Failed to fetch calendar', { status: 502, headers: cors });
  }
});
