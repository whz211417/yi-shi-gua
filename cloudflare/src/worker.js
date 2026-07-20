const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const buckets = new Map();

function cors(origin, allowedOrigin) {
  const permitted = origin === allowedOrigin ? origin : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': permitted,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function allowedRequest(request, env) {
  const origin = request.headers.get('Origin');
  return !origin || origin === env.ALLOWED_ORIGIN;
}

function rateLimited(request) {
  const key = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const bucket = buckets.get(key) || { startedAt: now, count: 0 };
  if (now - bucket.startedAt >= WINDOW_MS) {
    bucket.startedAt = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

function buildPrompt(input) {
  const required = ['hexagram', 'mealPeriod', 'place', 'weather', 'recommendation'];
  if (!input || required.some((key) => typeof input[key] !== 'string' || !input[key].trim())) return null;
  const states = input.dailyState && typeof input.dailyState === 'object' ? input.dailyState : {};
  return `你是「易食卦」的饮食解读者。此产品将梅花易数式数时起卦视为娱乐性提示，不作命定、医疗、营养诊断或神秘能力承诺。请用自然、克制、有一点文气但不江湖腔的简体中文，写 100-160 字的解读。必须：先提及卦象取向，再连接餐别、去处、天气与今日状态，最后落到给定推荐；不要虚构食堂供应、店铺、价格或健康结论；不要改写推荐，不要使用 markdown 标题或项目符号。\n\n卦象：${input.hexagram}\n餐别：${input.mealPeriod}\n去处：${input.place}\n天气：${input.weather}\n今日状态：预算${states.budget || '正常'}，时间${states.time || '正常'}，饱腹${states.fullness || '正常'}，心情${states.mood || '不限'}\n当前推荐：${input.recommendation}\n具体菜建议：${Array.isArray(input.dishes) ? input.dishes.slice(0, 4).join('、') : '以现场实际为准'}\n请输出解读正文：`;
}

export default {
  async fetch(request, env) {
    const headers = cors(request.headers.get('Origin'), env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/interpret') return json({ error: 'not_found' }, 404, headers);
    if (!allowedRequest(request, env)) return json({ error: 'origin_not_allowed' }, 403, headers);
    if (rateLimited(request)) return json({ error: 'rate_limited' }, 429, headers);
    if (!env.DEEPSEEK_API_KEY) return json({ error: 'ai_not_configured' }, 503, headers);
    let payload;
    try { payload = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, headers); }
    const prompt = buildPrompt(payload);
    if (!prompt) return json({ error: 'invalid_payload' }, 400, headers);
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.75, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!upstream.ok) return json({ error: 'ai_unavailable' }, 502, headers);
    const data = await upstream.json();
    const interpretation = data?.choices?.[0]?.message?.content?.trim();
    if (!interpretation) return json({ error: 'empty_ai_response' }, 502, headers);
    return json({ interpretation, provider: 'deepseek-chat', entertainmentOnly: true }, 200, headers);
  },
};
