const app = document.getElementById('app');


/* ---------- backend (Supabase) ---------- */
const CFG = window.CONFIG || {};
const CONFIGURED = !!(CFG.SUPABASE_URL && !CFG.SUPABASE_URL.includes('YOUR-PROJECT') && window.supabase);
const sb = CONFIGURED ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
let session = null;
// UI gate only — the real protection is Row Level Security in supabase/schema.sql
const isAdmin = () => !!session && session.user.email?.toLowerCase() === (CFG.ADMIN_EMAIL || '').toLowerCase();

const demoPosts = [{
  id: 'hello-world', title: 'Hello, world — why I started this blog', tag: 'life', date: '2026-10-25', cover: '', images: {},
  md: `I'm Amanda, a software engineer who loves the quiet, behind-the-scenes side of software: APIs, databases, queues and everything that makes an app feel fast and reliable.

This space is where I'll write down what I learn, so future me (and maybe you) can find it later.

## What to expect

Notes on **backend engineering**, small project write-ups, and the occasional reflection on working as an engineer.

> Write it down, or you will learn it twice.`
}];

const fail = (err, msg) => { console.error(err); alert(msg || 'Something went wrong: ' + (err.message || err)); return false; };

const api = {
  async posts() {
    if (!sb) return demoPosts;
    const { data, error } = await sb.from('posts').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (error) { fail(error, 'Could not load posts: ' + error.message); return []; }
    return data;
  },
  async post(id) {
    if (!sb) return demoPosts.find(p => p.id === id);
    const { data } = await sb.from('posts').select('*').eq('id', id).maybeSingle();
    return data;
  },
  async savePost(p) { const { error } = await sb.from('posts').upsert(p); return error ? fail(error) : true; },
  async deletePost(id) { const { error } = await sb.from('posts').delete().eq('id', id); return error ? fail(error) : true; },
  async study() {
    if (!sb) return [];
    const { data, error } = await sb.from('study').select('*').order('date', { ascending: false }).order('id', { ascending: false });
    if (error) { fail(error, 'Could not load study log: ' + error.message); return []; }
    return data;
  },
  async addStudy(e) { const { error } = await sb.from('study').insert(e); return error ? fail(error) : true; },
  async deleteStudy(id) { const { error } = await sb.from('study').delete().eq('id', id); return error ? fail(error) : true; },
  async upload(file) {
    const blob = await resize(file);
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await sb.storage.from('images').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) { fail(error, 'Upload failed: ' + error.message); return null; }
    return sb.storage.from('images').getPublicUrl(path).data.publicUrl;
  }
};

function resize(file, max = 1400) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = img.width * s; c.height = img.height * s;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(res, 'image/jpeg', 0.82);
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = d => new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const plain = md => md.replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^[#>\-*\d.\s]+/gm, '').replace(/[*_`]/g, '');
const excerpt = p => { const t = plain(p.md).trim().replace(/\s+/g, ' '); return t.slice(0, 120) + (t.length > 120 ? '…' : ''); };
const readTime = p => Math.max(1, Math.round(plain(p.md).split(/\s+/).length / 200));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // local date
const today = () => ymd(new Date());

/* ---------- tiny markdown renderer ---------- */
function md2html(src, images = {}) {
  const codes = [];
  src = src.replace(/```\w*\n([\s\S]*?)```/g, (m, c) => { codes.push(c); return `\n\n@@CODE${codes.length - 1}@@\n\n`; });
  src = esc(src);
  const url = u => {
    const m = u.match(/^img:(\w+)$/);
    if (m) return images[m[1]] || '';
    return /^(https?:|mailto:|#)/.test(u) ? u : '';
  };
  const inline = s => s.split(/(`[^`]+`)/).map(part => {
    if (/^`[^`]+`$/.test(part)) return `<code>${part.slice(1, -1)}</code>`;
    return part
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => `<img src="${url(u)}" alt="${a}">`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${url(u)}" target="_blank" rel="noopener">${t}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  }).join('');
  return src.split(/\n{2,}/).map(b => {
    b = b.replace(/^\n+|\n+$/g, '');
    if (!b.trim()) return '';
    let m;
    if ((m = b.match(/^@@CODE(\d+)@@$/))) return `<pre><code>${esc(codes[m[1]]).replace(/\n$/, '')}</code></pre>`;
    if ((m = b.match(/^(#{1,3})\s+(.*)$/))) return `<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`;
    if (/^(-{3,}|\*{3,})$/.test(b.trim())) return '<hr>';
    if (/^&gt;\s?/.test(b)) return `<blockquote>${inline(b.split('\n').map(l => l.replace(/^&gt;\s?/, '')).join('<br>'))}</blockquote>`;
    if (/^[-*]\s+/.test(b)) return `<ul>${b.split('\n').map(l => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    if (/^\d+\.\s+/.test(b)) return `<ol>${b.split('\n').map(l => `<li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`;
    if ((m = b.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) return `<figure><img src="${url(m[2])}" alt="${m[1]}">${m[1] ? `<figcaption>${m[1]}</figcaption>` : ''}</figure>`;
    return `<p>${inline(b.replace(/\n/g, '<br>'))}</p>`;
  }).join('\n');
}

/* ---------- shared pieces ---------- */
const divider = `<div class="divider"><svg viewBox="0 0 600 10" preserveAspectRatio="none"><path d="M0 5 C100 0 200 10 300 5 S500 0 600 6" stroke="url(#gBP)" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#rough2)"/></svg></div>`;

const postCard = p => `
<article class="card post-card fade" onclick="location.hash='#/post/${esc(p.id)}'" id="post-${esc(p.id)}">
  ${p.cover ? `<img class="thumb" src="${esc(p.cover)}" alt="">` : `<div class="thumb"></div>`}
  <div class="body">
    <div class="meta">${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}${fmt(p.date)} · ${readTime(p)} min read</div>
    <h3>${esc(p.title)}</h3>
    <p>${esc(excerpt(p))}</p>
  </div>
</article>`;

const projectsSoon = `
<div class="card soon"><div class="big"><span class="brush blue">coming soon</span></div>
<p>coming soon ✿</p></div>`;

const notConfigured = `<div class="card notice">Backend isn't connected yet — showing demo content. Follow <b>README.md</b> to connect Supabase.</div>`;


const ytId = u => { const m = String(u || '').match(/(?:youtu\.be\/|[?&]v=|embed\/)([\w-]{11})/); return m ? m[1] : ''; };

const songSection = () => {
  const sg = CFG.SONG || {};
  if (!sg.title) return '';
  return `
  <section class="block" id="song">
    <h2 class="sec-title"><span class="brush pink">soundtrack of this season</span></h2>
    <p class="sec-sub">the song that sounds like where I am right now</p>
    <a class="card player" href="#/song" id="song-link">
      <svg class="vinyl" viewBox="0 0 100 100" aria-hidden="true">
        <g filter="url(#rough2)" fill="none" stroke="#2b2740" stroke-width="2.5">
          <circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="30" stroke="#c9b6ff" stroke-width="2"/>
          <circle cx="50" cy="50" r="12" fill="#ffd2e8"/><circle cx="50" cy="50" r="2" fill="#2b2740"/>
        </g>
      </svg>
      <div class="player-info">
        <div class="now">now playing</div>
        <h3>${esc(sg.title)}</h3>
        <div class="artist">${esc(sg.artist)}</div>
        ${sg.note ? `<p class="song-note">“${esc(sg.note)}”</p>` : ''}
      </div>
      <span class="yt">listen & lyrics →</span>
    </a>
  </section>`;
};


const songBg = () => {
  const wave = (cls, color, y, w) => `
    <svg class="wave ${cls}" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
      <g filter="url(#rough2)"><path d="M0 ${y} q75 -${w} 150 0 t150 0 t150 0 t150 0 t150 0 t150 0 t150 0 t150 0" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/></g>
    </svg>`;
  const notes = [['♪', 6, 19, 0, 'p'], ['♫', 18, 24, 6, 'k'], ['✦', 31, 17, 3, 'b'], ['♪', 47, 22, 9, 'k'], ['♡', 62, 20, 2, 'p'], ['♫', 74, 26, 11, 'b'], ['✦', 85, 18, 5, 'p'], ['♪', 93, 23, 8, 'k']]
    .map(([ch, left, dur, delay, c]) => `<span class="note ${c}" style="left:${left}%;animation-duration:${dur}s;animation-delay:-${delay}s">${ch}</span>`).join('');
  return `<div class="song-bg" aria-hidden="true">
    ${wave('w1', '#c4b0ff', 70, 45)}${wave('w2', '#ffb8dc', 60, 38)}${wave('w3', '#a9c6ff', 66, 30)}
    ${notes}
  </div>`;
};

function songPage() {
  const sg = CFG.SONG || {};
  if (!sg.title) return '<div class="empty">no song yet ✿</div>';
  const id = sg.youtubeId || ytId(sg.url);
  return songBg() + `
  <section class="block fade song-page">
    <h1 class="sec-title"><span class="brush pink">soundtrack of this season</span></h1>
    <p class="sec-sub">the song that sounds like where I am right now</p>
    <div class="song-layout">
      <div class="song-media">
        ${id && location.protocol === 'file:' ? `<a class="video thumb-fallback" href="${esc(sg.url)}" target="_blank" rel="noopener" aria-label="watch ${esc(sg.title)} on YouTube"><img src="https://img.youtube.com/vi/${esc(id)}/hqdefault.jpg" alt=""><span class="play-badge">▶ watch on youtube</span></a><p class="hint" style="margin-top:8px">embedded player needs the site to run on http(s) — it works once deployed or via a local server.</p>`
        : id ? `<div class="video"><iframe src="https://www.youtube.com/embed/${esc(id)}" title="${esc(sg.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`
             : `<a class="btn primary" href="${esc(sg.url)}" target="_blank" rel="noopener">listen on youtube ↗</a>`}
        <h2 class="song-title">${esc(sg.title)}</h2>
        <div class="artist">${esc(sg.artist)}</div>
        ${sg.note ? `<p class="song-note">“${esc(sg.note)}”</p>` : ''}
        ${sg.url ? `<p style="margin-top:12px"><a class="yt" href="${esc(sg.url)}" target="_blank" rel="noopener">open on youtube ↗</a></p>` : ''}
      </div>
      <div class="lyrics">
        <h3>lyrics</h3>
        ${sg.lyrics ? `<div class="lyrics-text">${esc(sg.lyrics)}</div>` : '<p class="hint">lyrics coming soon ✿</p>'}
        ${sg.lyrics && sg.lyricsCredit ? `<p class="credit">lyrics & translation by <a href="${esc(sg.lyricsCredit.url)}" target="_blank" rel="noopener">${esc(sg.lyricsCredit.name)} ↗</a></p>` : ''}
      </div>
    </div>
  </section>`;
}

/* ---------- views ---------- */
function home({ posts, study: logs }) {
  return `
  ${CONFIGURED ? '' : notConfigured}
  <section class="hero fade">
    <div>
      <div class="hello">hi, I'm</div>
      <h1 class="name"><span class="w"><span class="grad g1">a</span><span class="brush manda"><span class="grad g1">manda</span></span></span> <span class="w grad g2">farliana</span> <span class="w grad g3">setyasari</span></h1>
      <p class="desc">a software engineer, backend interest.</p>
      <div class="cta">
        <a class="btn primary" href="#/projects" id="cta-projects">see projects</a>
        <a class="btn" href="#/blog" id="cta-blog">read my blog</a>
      </div>
    </div>
  </section>
  ${about()}
  <section class="block" id="projects">
    <h2 class="sec-title">projects</h2><p class="sec-sub">things I'm building</p>${projectsSoon}
  </section>
  ${studyPreview(logs)}
  <section class="block">
    <div class="row"><div><h2 class="sec-title">latest writing</h2><p class="sec-sub">notes, learnings & tutorials</p></div>
    <a class="btn small" href="#/blog" id="all-posts">all posts →</a></div>
    ${posts.length ? `<div class="grid">${posts.slice(0, 3).map(postCard).join('')}</div>` : '<div class="empty">no posts yet ✿</div>'}
  </section>
  ${songSection()}`;
}

function studyPreview(all) {
  const days = new Set(all.map(e => e.date));
  const dots = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = ymd(d);
    dots.push(`<span class="dot${days.has(k) ? ' on' : ''}${i === 0 ? ' now' : ''}" title="${fmt(k)}"></span>`);
  }
  return `
  <section class="block" id="study-preview">
    <div class="row"><div><h2 class="sec-title"><span class="brush blue">study log</span></h2>
      <p class="sec-sub">small steady moving with my own pace</p></div>
      <a class="btn small" href="#/study" id="open-study">open log →</a></div>
    <div class="card sp">
      <div class="sp-top">
        <div class="stat"><b>${streak(all)}</b>day streak 🔥</div>
        <div class="dots" aria-label="last 28 days">${dots.join('')}</div>
      </div>
      ${all.length ? all.slice(0, 3).map(e => `
        <a class="sp-item" href="#/study"><span class="sp-date">${fmt(e.date)}</span><span>${esc(e.topic)}</span>${e.tag ? `<span class="tag">${esc(e.tag)}</span>` : ''}</a>`).join('')
        : '<p class="hint" style="margin-top:10px">no entries yet</p>'}
    </div>
  </section>`;
}

function projects() {
  return `<section class="block fade"><h1 class="sec-title">projects</h1><p class="sec-sub">things I'm building</p>${projectsSoon}</section>`;
}

function about() {
  return `
  <section class="block" id="about">
    <h2 class="sec-title"><span class="brush pink">about me</span></h2>
    <p class="sec-sub">a little more about me</p>
    <div class="about-grid">
      <div class="card"><h3>call me manda ✿</h3><p>I mostly working with java & golang. My dream is I really wanna get good at building and handling high-scale distributed systems!!!</p></div>
      <div class="card contact-card">
        <div class="contact-head">
          <h3>say hi ✿</h3>
          <span class="contact-badge">open to connect</span>
        </div>
        <p class="contact-lead">reach me here — always happy to talk:D</p>
        <div class="contact-links">
          <a class="contact-link" href="mailto:amandafarlianasetyasari@gmail.com" id="link-email">
            <span class="ic mail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></span>
            <span class="meta-line"><small>email</small><b>amandafarlianasetyasari@gmail.com</b></span>
            <span class="arrow" aria-hidden="true">↗</span>
          </a>
          <a class="contact-link" href="https://github.com/nekkuzuria" target="_blank" rel="noopener" id="link-github">
            <span class="ic github"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.7 1.2 3.3.9.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C18.9 4.3 19.9 4.6 19.9 4.6c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg></span>
            <span class="meta-line"><small>github</small><b>@nekkuzuria</b></span>
            <span class="arrow" aria-hidden="true">↗</span>
          </a>
          <a class="contact-link" href="https://linkedin.com/in/amandasetyasari" target="_blank" rel="noopener" id="link-linkedin">
            <span class="ic linkedin"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-.9 1.8-1.9 3.7-1.9 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21H9z"/></svg></span>
            <span class="meta-line"><small>linkedin</small><b>in/amandasetyasari</b></span>
            <span class="arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </div>
    <h2 class="sec-title" style="margin-top:50px">tech I like</h2>
    <div class="chips">${['Java', 'Spring Boot', 'Go', 'PostgreSQL', 'MongoDB', 'Redis', 'Kafka'].map(c => `<span class="chip">${c}</span>`).join('')}</div>
  </section>`;
}

function blog({ posts }) {
  return `
  <section class="block fade">
    ${CONFIGURED ? '' : notConfigured}
    <div class="row"><div><h1 class="sec-title"><span class="brush blue">blog</span></h1><p class="sec-sub">notes, learnings & tutorials</p></div>
    ${isAdmin() ? '<a class="btn primary small" href="#/write" id="write-btn">+ write a post</a>' : ''}</div>
    ${posts.length ? `<div class="grid">${posts.map(postCard).join('')}</div>` : `<div class="empty">no posts yet ✿</div>`}
  </section>`;
}

function postView(p) {
  if (!p) return `<div class="empty">post not found. <a href="#/blog" style="text-decoration:underline">back to blog</a></div>`;
  return `
  <article class="article fade">
    <a class="back" href="#/blog" id="back-blog">← back to blog</a>
    <h1>${esc(p.title)}</h1>
    <div class="meta">${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}${fmt(p.date)} · ${readTime(p)} min read</div>
    ${p.cover ? `<img class="cover" src="${esc(p.cover)}" alt="">` : ''}
    <div class="content">${md2html(p.md, p.images)}</div>
    ${divider}
    ${isAdmin() && sb ? `<div class="cta"><a class="btn small" href="#/edit/${esc(p.id)}" id="edit-btn">edit</a>
    <button class="btn small danger" id="delete-btn" onclick="delPost('${esc(p.id)}')">delete</button></div>` : ''}
  </article>`;
}

/* ---------- editor (admin only) ---------- */
let draft = null;
function editor(existing) {
  draft = existing ? JSON.parse(JSON.stringify(existing)) :
    { id: '', title: '', tag: '', date: today(), cover: '', md: '', images: {} };
  draft._isNew = !existing;
  return `
  <div class="editor fade">
    <h1 class="sec-title"><span class="brush">${existing ? 'edit post' : 'new post'}</span></h1>
    <label for="f-title">title</label><input type="text" id="f-title" placeholder="An interesting title" />
    <div class="frow2">
      <div><label for="f-tag">tag</label><input type="text" id="f-tag" placeholder="backend, life…" /></div>
      <div><label for="f-date">date</label><input type="text" id="f-date" placeholder="YYYY-MM-DD" /></div>
    </div>
    <label>cover photo (optional)</label>
    <input type="file" accept="image/*" id="f-cover" />
    <div id="cover-prev"></div>
    <div class="tabs"><label style="margin:0">content <span class="hint">· markdown</span></label>
      <span><button class="tab on" id="tab-write" type="button">write</button><button class="tab" id="tab-preview" type="button">preview</button></span></div>
    <div class="toolbar">
      <button type="button" data-md="**|**" title="bold"><b>B</b></button>
      <button type="button" data-md="*|*" title="italic"><i>I</i></button>
      <button type="button" data-md="## |" title="heading">H</button>
      <button type="button" data-md="> |" title="quote">❝</button>
      <button type="button" data-md="- |" title="list">•</button>
      <button type="button" data-md="\`|\`" title="code">&lt;/&gt;</button>
      <button type="button" data-md="[|](https://)" title="link">🔗</button>
      <button type="button" id="add-image" title="photo">🖼 photo</button>
      <input type="file" accept="image/*" id="img-input" hidden />
    </div>
    <textarea id="f-md" placeholder="Write in markdown…&#10;&#10;## A heading&#10;Some **bold** text, a [link](https://...)&#10;&#10;Use the 🖼 button to add photos."></textarea>
    <div id="md-preview" class="article content" hidden></div>
    <div class="cta"><button class="btn primary" id="save-btn" type="button">publish</button>
    <a class="btn" href="#/blog" id="cancel-btn">cancel</a></div>
  </div>`;
}

function bindEditor() {
  const $ = id => document.getElementById(id);
  const ta = $('f-md');
  $('f-title').value = draft.title; $('f-tag').value = draft.tag; $('f-date').value = draft.date; ta.value = draft.md;
  const prev = () => $('cover-prev').innerHTML = draft.cover ? `<img src="${esc(draft.cover)}" style="max-height:200px;border-radius:12px;margin-top:8px" alt="">` : '';
  prev();
  $('f-title').oninput = e => draft.title = e.target.value;
  $('f-tag').oninput = e => draft.tag = e.target.value;
  $('f-date').oninput = e => draft.date = e.target.value;
  ta.oninput = e => draft.md = e.target.value;
  $('f-cover').onchange = async e => {
    if (!e.target.files[0]) return;
    const u = await api.upload(e.target.files[0]);
    if (u) { draft.cover = u; prev(); }
  };

  const insert = (before, after = '') => {
    const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e);
    ta.setRangeText(before + sel + after, s, e, 'end');
    if (!sel) ta.selectionStart = ta.selectionEnd = s + before.length;
    ta.focus(); draft.md = ta.value;
  };
  document.querySelectorAll('[data-md]').forEach(b => b.onclick = () => insert(...b.dataset.md.split('|')));
  $('add-image').onclick = () => $('img-input').click();
  $('img-input').onchange = async e => {
    if (!e.target.files[0]) return;
    const u = await api.upload(e.target.files[0]);
    e.target.value = '';
    if (!u) return;
    const key = 'i' + Date.now().toString(36);
    draft.images[key] = u;
    insert(`\n\n![caption](img:${key})\n\n`);
  };

  const show = w => {
    $('tab-write').classList.toggle('on', w); $('tab-preview').classList.toggle('on', !w);
    ta.hidden = !w; $('md-preview').hidden = w;
    document.querySelector('.toolbar').style.display = w ? '' : 'none';
    if (!w) $('md-preview').innerHTML = md2html(draft.md, draft.images) || '<p class="hint">nothing to preview yet</p>';
  };
  $('tab-write').onclick = () => show(true);
  $('tab-preview').onclick = () => show(false);

  $('save-btn').onclick = async () => {
    if (!draft.title.trim()) return alert('Please add a title ✿');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return alert('Date must look like 2026-10-25');
    const { _isNew, blocks, created_at, ...p } = draft;
    p.images = Object.fromEntries(Object.entries(p.images || {}).filter(([k]) => p.md.includes('img:' + k)));
    if (_isNew) p.id = (p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'post') + '-' + Date.now().toString(36);
    const btn = $('save-btn'); btn.disabled = true; btn.textContent = 'saving…';
    if (await api.savePost(p)) location.hash = '#/post/' + p.id;
    else { btn.disabled = false; btn.textContent = 'publish'; }
  };
}

async function delPost(id) {
  if (!confirm('Delete this post?')) return;
  if (await api.deletePost(id)) location.hash = '#/blog';
}

/* ---------- study log (public read, admin write) ---------- */
let studyData = [];
const cal = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: null };

function streak(entries) {
  const days = new Set(entries.map(e => e.date));
  let n = 0, d = new Date();
  if (!days.has(ymd(d))) d.setDate(d.getDate() - 1); // today not logged yet is ok
  while (days.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function calendar(entries) {
  const counts = {};
  entries.forEach(e => counts[e.date] = (counts[e.date] || 0) + 1);
  const first = new Date(cal.y, cal.m, 1);
  const lead = (first.getDay() + 6) % 7; // week starts Monday
  const total = new Date(cal.y, cal.m + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="cal-empty"></span>';
  for (let d = 1; d <= total; d++) {
    const key = ymd(new Date(cal.y, cal.m, d));
    const cls = ['cal-day', counts[key] ? 'has-log' : '', key === today() ? 'is-today' : '', key === cal.sel ? 'is-sel' : ''].join(' ');
    cells += `<button type="button" class="${cls}" data-date="${key}" title="${counts[key] ? counts[key] + ' log' : 'no log'}">${d}</button>`;
  }
  const title = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return `
  <div class="card calendar" id="calendar">
    <div class="cal-head">
      <button type="button" class="cal-nav" id="cal-prev" aria-label="previous month">‹</button>
      <span class="cal-title">${title}</span>
      <button type="button" class="cal-nav" id="cal-next" aria-label="next month">›</button>
    </div>
    <div class="cal-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span class="cal-dow">${d}</span>`).join('')}${cells}</div>
  </div>`;
}

function study() {
  const all = studyData;
  const entries = cal.sel ? all.filter(e => e.date === cal.sel) : all;
  const mins = all.reduce((s, e) => s + (+e.mins || 0), 0);
  const byDay = {};
  entries.forEach(e => (byDay[e.date] = byDay[e.date] || []).push(e));
  const admin = isAdmin();
  const list = Object.keys(byDay).map(d => `
    <div class="day"><div class="day-date">${fmt(d)}</div>
      <div>${byDay[d].map(e => `
        <div class="card entry" id="entry-${e.id}">
          <div class="meta">${e.tag ? `<span class="tag">${esc(e.tag)}</span>` : ''}${e.mins ? e.mins + ' min' : ''}</div>
          <h3>${esc(e.topic)}</h3>
          ${e.notes ? `<p>${esc(e.notes)}</p>` : ''}
          ${admin ? `<button class="x" title="delete" onclick="delStudy(${e.id})">✕</button>` : ''}
        </div>`).join('')}</div></div>`).join('');
  const empty = cal.sel ? `<div class="empty">no log on ${fmt(cal.sel)}</div>` : '<div class="empty">nothing logged yet ✿</div>';
  const form = admin ? `
    <form class="card studyform" id="study-form">
      <div class="frow">
        <input type="text" id="s-topic" placeholder="what did you learn${cal.sel ? '' : ' today'}?" required />
        <input type="date" id="s-date" value="${cal.sel || today()}" />
      </div>
      <textarea id="s-notes" placeholder="notes, key takeaways, links… (optional)"></textarea>
      <div class="frow">
        <input type="text" id="s-tag" placeholder="tag (e.g. postgres)" />
        <input type="number" id="s-mins" min="0" placeholder="minutes" />
        <button class="btn primary small" type="submit" id="s-add">+ add to log</button>
      </div>
    </form>` : '';
  return `
  <section class="block fade">
    <div class="study-head">
      <div class="study-intro">
        <h1 class="sec-title"><span class="brush pink">study log</span></h1>
        <p class="sec-sub">what I learned, day by day</p>
        <div class="stats">
          <div class="stat"><b>${streak(all)}</b>day streak 🔥</div>
          <div class="stat"><b>${new Set(all.map(e => e.date)).size}</b>days logged</div>
          <div class="stat"><b>${(mins / 60).toFixed(1)}</b>hours studied</div>
        </div>
      </div>
      <div class="study-cal">${calendar(all)}</div>
    </div>
    <div class="study-main${admin ? ' has-form' : ''}">
      ${form}
      <div class="study-list">
        <div class="row list-head"><h2 class="list-title">${cal.sel ? fmt(cal.sel) : 'all entries'}</h2>
          ${cal.sel ? '<button class="btn small" id="show-all" type="button">show all</button>' : ''}</div>
        ${list || empty}
      </div>
    </div>
  </section>`;
}

function refreshStudy() {
  const y = window.scrollY;
  app.innerHTML = study();
  bindStudy();
  window.scrollTo(0, y);
}

function bindStudy() {
  const form = document.getElementById('study-form');
  if (form) form.onsubmit = async e => {
    e.preventDefault();
    const v = id => document.getElementById(id).value.trim();
    if (!v('s-topic')) return;
    const row = { date: v('s-date') || today(), topic: v('s-topic'), notes: v('s-notes'), tag: v('s-tag'), mins: v('s-mins') ? +v('s-mins') : null };
    if (await api.addStudy(row)) { studyData = await api.study(); refreshStudy(); }
  };
  const shift = n => { const d = new Date(cal.y, cal.m + n, 1); cal.y = d.getFullYear(); cal.m = d.getMonth(); refreshStudy(); };
  document.getElementById('cal-prev').onclick = () => shift(-1);
  document.getElementById('cal-next').onclick = () => shift(1);
  document.querySelectorAll('.cal-day').forEach(b => b.onclick = () => {
    cal.sel = cal.sel === b.dataset.date ? null : b.dataset.date; // click again to deselect
    refreshStudy();
  });
  const sa = document.getElementById('show-all');
  if (sa) sa.onclick = () => { cal.sel = null; refreshStudy(); };
}

async function delStudy(id) {
  if (!confirm('Delete this entry?')) return;
  if (await api.deleteStudy(id)) { studyData = await api.study(); refreshStudy(); }
}

/* ---------- admin / auth ---------- */
async function login(provider) {
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname } });
  if (error) fail(error);
}
async function logout() { await sb.auth.signOut(); location.hash = '#/'; }

function admin() {
  let body;
  if (!CONFIGURED) body = notConfigured;
  else if (isAdmin()) body = `
    <p class="sec-sub">signed in as ${esc(session.user.email)}</p>
    <div class="cta"><a class="btn primary" href="#/write" id="adm-write">+ new post</a>
      <a class="btn" href="#/study" id="adm-study">study log</a>
      <button class="btn" id="adm-logout" onclick="logout()">sign out</button></div>`;
  else if (session) body = `
    <p class="sec-sub">${esc(session.user.email)} isn't allowed to edit this site.</p>
    <div class="cta"><button class="btn" onclick="logout()">sign out</button></div>`;
  else body = `
    <p class="sec-sub">only the site owner can sign in. Everyone else can read ✿</p>
    <div class="cta"><button class="btn primary" id="login-google" onclick="login('google')">continue with Google</button>
      <button class="btn" id="login-github" onclick="login('github')">continue with GitHub</button></div>`;
  return `<section class="block fade"><h1 class="sec-title"><span class="brush">admin</span></h1>${body}</section>`;
}

const needAdmin = `<div class="empty">this page is for the site owner. <a href="#/admin" style="text-decoration:underline">sign in</a></div>`;

/* ---------- router ---------- */
let routeToken = 0;
async function route() {
  const token = ++routeToken;
  const [, page, arg] = (location.hash || '#/').slice(1).split('/');
  let html, nav = page || 'home', after = null;
  switch (page) {
    case 'projects': html = projects(); break;
    case 'song': html = songPage(); break;
    case 'admin': html = admin(); nav = ''; break;
    case 'study':
      studyData = await api.study(); html = study(); after = bindStudy; break;
    case 'blog': html = blog({ posts: await api.posts() }); break;
    case 'post': html = postView(await api.post(arg)); nav = 'blog'; break;
    case 'write': nav = 'blog'; html = isAdmin() && sb ? editor() : needAdmin; if (isAdmin() && sb) after = bindEditor; break;
    case 'edit': {
      nav = 'blog';
      if (isAdmin() && sb) { const p = await api.post(arg); html = p ? editor(p) : postView(null); if (p) after = bindEditor; }
      else html = needAdmin;
      break;
    }
    default: {
      const [posts, logs] = await Promise.all([api.posts(), api.study()]);
      html = home({ posts, study: logs }); nav = 'home';
    }
  }
  if (token !== routeToken) return; // a newer navigation won
  app.innerHTML = html;
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === nav));
  document.getElementById('admin-link').textContent = isAdmin() ? 'admin ●' : 'admin';
  if (after) after();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
if (sb) {
  sb.auth.getSession().then(({ data }) => { session = data.session; route(); });
  sb.auth.onAuthStateChange((_e, s) => { const was = isAdmin(); session = s; if (was !== isAdmin()) route(); });
} else route();

window.addEventListener('scroll', () => document.querySelector('.nav').classList.toggle('scrolled', window.scrollY > 8), { passive: true });
