/**
 * Gym Tracker — Cloudflare Worker
 *
 * Recibe: POST { person, day, exerciseIndex, weight }
 * Accion: Lee el archivo src/data/{person}.ts del repo de GitHub,
 *         actualiza el campo `weight` del ejercicio indicado,
 *         y hace un commit via GitHub Contents API.
 *
 * Variables de entorno requeridas (Cloudflare Secrets):
 *   GITHUB_TOKEN   — PAT con scope "contents: write" al repo
 *   GH_OWNER       — usuario u org (ej: "FedeAltava")
 *   GH_REPO        — nombre del repo (ej: "gym-tracker")
 *   ALLOWED_ORIGIN — URL del sitio (ej: "https://fedealtava.github.io/gym-tracker")
 */

export default {
  async fetch(request, env) {
    // ── CORS ──────────────────────────────────────────────────
    const origin = request.headers.get('Origin') ?? '';
    const allowed = env.ALLOWED_ORIGIN ?? '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowed || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    // ── Parse body ────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    const { person, day, exerciseIndex, weight } = body;

    if (
      typeof person !== 'string' ||
      typeof day !== 'string' ||
      typeof exerciseIndex !== 'number' ||
      typeof weight !== 'number' ||
      weight < 0
    ) {
      return new Response('Invalid payload', { status: 400, headers: corsHeaders });
    }

    // Only allow known persons
    if (!['fede', 'belen'].includes(person)) {
      return new Response('Unknown person', { status: 400, headers: corsHeaders });
    }

    // ── GitHub API ────────────────────────────────────────────
    const { GITHUB_TOKEN, GH_OWNER, GH_REPO } = env;
    const GITHUB_OWNER = GH_OWNER;
    const GITHUB_REPO = GH_REPO;
    const filePath = `src/data/${person}.ts`;
    const apiBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gym-tracker-worker',
    };

    // 1. Get current file content + SHA
    const getRes = await fetch(`${apiBase}/contents/${filePath}`, { headers });
    if (!getRes.ok) {
      return new Response(`GitHub GET failed: ${await getRes.text()}`, { status: 502, headers: corsHeaders });
    }

    const fileData = await getRes.json();
    const currentContent = atob(fileData.content.replace(/\n/g, ''));
    const sha = fileData.sha;

    // 2. Update weight field for the target exercise
    const updated = updateWeight(currentContent, day, exerciseIndex, weight);
    if (updated === null) {
      return new Response('Exercise not found in file', { status: 422, headers: corsHeaders });
    }

    // 3. Commit updated file
    const commitBody = {
      message: `chore: update ${person} ${day} exercise[${exerciseIndex}] weight to ${weight}kg`,
      content: btoa(unescape(encodeURIComponent(updated))),
      sha,
    };

    const putRes = await fetch(`${apiBase}/contents/${filePath}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(commitBody),
    });

    if (!putRes.ok) {
      return new Response(`GitHub PUT failed: ${await putRes.text()}`, { status: 502, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true, weight }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};

/**
 * Encuentra el ejercicio en el bloque del dia indicado (por indice)
 * y reemplaza su campo `weight: <valor>` con el nuevo peso.
 *
 * Estrategia: contar bloques de ejercicios dentro del dia correcto
 * usando una maquina de estados simple sobre el texto TypeScript.
 */
function updateWeight(source, day, exerciseIndex, newWeight) {
  // Find the day block: look for day: 'LUNES' / "LUNES" / 'MARTES' etc.
  const dayPattern = new RegExp(`day:\\s*['"]${day}['"]`);
  const dayMatch = dayPattern.exec(source);
  if (!dayMatch) return null;

  // From dayMatch.index, find the exercises array
  const exercisesKeyword = 'exercises:';
  const exercisesStart = source.indexOf(exercisesKeyword, dayMatch.index);
  if (exercisesStart === -1) return null;

  // Walk through the exercises array counting object starts ({)
  // to find the target exerciseIndex-th exercise block
  let depth = 0;
  let exerciseCount = -1;
  let targetStart = -1;
  let targetEnd = -1;
  let inArray = false;

  for (let i = exercisesStart; i < source.length; i++) {
    const ch = source[i];

    if (!inArray && ch === '[') {
      inArray = true;
      continue;
    }

    if (!inArray) continue;

    if (ch === '{') {
      depth++;
      if (depth === 1) {
        exerciseCount++;
        if (exerciseCount === exerciseIndex) {
          targetStart = i;
        }
      }
    } else if (ch === '}') {
      if (depth === 1 && exerciseCount === exerciseIndex) {
        targetEnd = i;
        break;
      }
      depth--;
    } else if (ch === ']' && depth === 0) {
      // End of exercises array without finding target
      break;
    }
  }

  if (targetStart === -1 || targetEnd === -1) return null;

  const exerciseBlock = source.slice(targetStart, targetEnd + 1);

  // Replace or insert weight field
  const weightPattern = /weight:\s*[\d.]+/;
  let updatedBlock;
  if (weightPattern.test(exerciseBlock)) {
    updatedBlock = exerciseBlock.replace(weightPattern, `weight: ${newWeight}`);
  } else {
    // Insert before closing brace
    updatedBlock = exerciseBlock.replace(/}$/, `  weight: ${newWeight},\n        }`);
  }

  return source.slice(0, targetStart) + updatedBlock + source.slice(targetEnd + 1);
}
