// AI 任務拆解：可選 Claude、Gemini，或兩者同時並排比較。
// 使用者自行提供 API key（只存在這台瀏覽器的 localStorage）。
// 用一般 <script> 載入，SDK 在第一次使用時才以 import() 從 CDN 動態載入，
// 這樣直接雙擊打開 index.html（file://）也能用。
(() => {
const SDK_URLS = {
    anthropic: 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.8.0/+esm',
    genai: 'https://cdn.jsdelivr.net/npm/@google/genai@3.2.0/+esm'
};

const STORAGE_KEY = 'pomodoro-ai-settings';
const DEFAULTS = {
    claudeKey: '',
    geminiKey: '',
    claudeModel: 'claude-opus-5-5',
    geminiModel: 'gemini-3.8-flash',
    provider: 'both'
};

const SYSTEM_PROMPT = `You are a focus coach for a Pomodoro timer app.
Break the user's task into concrete, actionable steps that each fit into one or more 25-minute pomodoros.
Keep 3-8 steps. Reply in the same language the user wrote in.
Return JSON matching the schema: steps (title + estimated pomodoros) and one short focus tip.`;

const SCHEMA = {
    type: 'object',
    properties: {
        steps: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    pomodoros: { type: 'integer' }
                },
                required: ['title', 'pomodoros'],
                additionalProperties: false
            }
        },
        tip: { type: 'string' }
    },
    required: ['steps', 'tip'],
    additionalProperties: false
};

function loadSettings() {
    try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch {
        return { ...DEFAULTS };
    }
}

function saveSettings(s) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch { /* private mode etc. */ }
}

// ---------- Providers ----------

async function askClaude(task, s) {
    if (!s.claudeKey) throw new Error('尚未設定 Claude API key');
    const { default: Anthropic } = await import(SDK_URLS.anthropic);
    const client = new Anthropic({ apiKey: s.claudeKey, dangerouslyAllowBrowser: true });
    const res = await client.beta.messages.create({
        model: s.claudeModel,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
            effort: 'low',
            format: { type: 'json_schema', schema: SCHEMA }
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: task }]
    });
    if (res.stop_reason === 'refusal') {
        throw new Error('Claude 拒絕了這個請求' + (res.stop_details?.explanation ? `：${res.stop_details.explanation}` : ''));
    }
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return JSON.parse(text);
}

async function askGemini(task, s) {
    if (!s.geminiKey) throw new Error('尚未設定 Gemini API key');
    const { GoogleGenAI } = await import(SDK_URLS.genai);
    const ai = new GoogleGenAI({ apiKey: s.geminiKey });
    const res = await ai.models.generateContent({
        model: s.geminiModel,
        contents: task,
        config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseJsonSchema: SCHEMA
        }
    });
    return JSON.parse(res.text);
}

const PROVIDERS = {
    claude: { label: 'Claude', run: askClaude },
    gemini: { label: 'Gemini', run: askGemini }
};

// ---------- UI ----------

const $ = id => document.getElementById(id);
const aiModal = $('ai-modal');
const aiTask = $('ai-task');
const aiProvider = $('ai-provider');
const aiResults = $('ai-results');
const aiRunBtn = $('ai-run-btn');
const currentTaskEl = $('current-task');

$('ai-btn').addEventListener('click', () => {
    aiProvider.value = loadSettings().provider;
    aiModal.classList.remove('hidden');
    aiTask.focus();
});
$('ai-close-btn').addEventListener('click', () => aiModal.classList.add('hidden'));

aiProvider.addEventListener('change', () => {
    saveSettings({ ...loadSettings(), provider: aiProvider.value });
});

aiRunBtn.addEventListener('click', async () => {
    const task = aiTask.value.trim();
    if (!task) return aiTask.focus();
    const s = loadSettings();
    const ids = aiProvider.value === 'both' ? ['claude', 'gemini'] : [aiProvider.value];

    aiResults.innerHTML = '';
    aiResults.classList.toggle('two-col', ids.length > 1);
    aiRunBtn.disabled = true;

    // 同時呼叫，各自完成就各自顯示
    await Promise.allSettled(ids.map(async id => {
        const col = document.createElement('section');
        col.className = 'ai-col';
        col.innerHTML = `<h3>${PROVIDERS[id].label}</h3><p class="ai-status">思考中…</p>`;
        aiResults.appendChild(col);
        try {
            renderPlan(col, await PROVIDERS[id].run(task, s));
        } catch (err) {
            col.querySelector('.ai-status').textContent = `錯誤：${err.message}`;
            col.querySelector('.ai-status').classList.add('error');
        }
    }));
    aiRunBtn.disabled = false;
});

function renderPlan(col, plan) {
    col.querySelector('.ai-status').remove();
    const ol = document.createElement('ol');
    for (const step of plan.steps || []) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.className = 'ai-step';
        btn.title = '設為目前任務';
        btn.textContent = `${step.title}（🍅×${step.pomodoros}）`;
        btn.addEventListener('click', () => {
            currentTaskEl.textContent = `🎯 ${step.title}`;
            aiModal.classList.add('hidden');
        });
        li.appendChild(btn);
        ol.appendChild(li);
    }
    col.appendChild(ol);
    if (plan.tip) {
        const tip = document.createElement('p');
        tip.className = 'ai-tip';
        tip.textContent = `💡 ${plan.tip}`;
        col.appendChild(tip);
    }
}

// ---------- API key 設定（放在原本的 Settings 視窗） ----------

const fields = {
    claudeKey: $('claude-key'),
    geminiKey: $('gemini-key'),
    claudeModel: $('claude-model'),
    geminiModel: $('gemini-model')
};

$('settings-btn').addEventListener('click', () => {
    const s = loadSettings();
    for (const [k, el] of Object.entries(fields)) el.value = s[k];
});

$('save-settings-btn').addEventListener('click', () => {
    const s = loadSettings();
    for (const [k, el] of Object.entries(fields)) s[k] = el.value.trim() || DEFAULTS[k];
    saveSettings(s);
});
})();
