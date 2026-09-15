/* Portfolio feedback collector — Cloudflare Worker.
   Needs a KV namespace bound as FEEDBACK and a secret ADMIN_KEY.

   POST /            store one note (called by the portfolio)
   GET  /?key=SECRET download every note as CSV (import into Proton Sheets)
*/

const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST') {
      let note;
      try {
        note = JSON.parse(await request.text());
      } catch (e) {
        return new Response('bad json', { status: 400 });
      }
      const entry = {
        at: note.at || new Date().toISOString(),
        name: (note.name || '').slice(0, 120),
        email: (note.email || '').slice(0, 160),
        text: (note.text || '').slice(0, 4000),
        lang: note.lang || '',
        country: request.headers.get('cf-ipcountry') || ''
      };
      if (!entry.text.trim()) return new Response('empty', { status: 400 });
      // Key sorts chronologically, random suffix avoids collisions.
      const id = entry.at + '-' + Math.random().toString(36).slice(2, 8);
      await env.FEEDBACK.put('note:' + id, JSON.stringify(entry));
      return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (request.method === 'GET') {
      if (url.searchParams.get('key') !== env.ADMIN_KEY) {
        return new Response('nope', { status: 401 });
      }
      const list = await env.FEEDBACK.list({ prefix: 'note:' });
      const rows = [['at', 'name', 'email', 'text', 'lang', 'country'].join(',')];
      for (const k of list.keys) {
        const raw = await env.FEEDBACK.get(k.name);
        if (!raw) continue;
        const n = JSON.parse(raw);
        rows.push([n.at, n.name, n.email, n.text, n.lang, n.country].map(csvCell).join(','));
      }
      return new Response(rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="portfolio-feedback.csv"'
        }
      });
    }

    return new Response('method not allowed', { status: 405 });
  }
};
