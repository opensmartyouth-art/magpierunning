// events/<연도>/<대회>/ 의 event.md 와 사진을 읽어 dist/ 에 정적 사이트를 만든다.
//   npm run build
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const eventsDir = join(root, 'events');
const dist = join(root, 'dist');
const SITE = 'MAGPIE RUNNING';
const PAGE_SIZE = 50; // 대회가 이만큼을 넘을 때만 목록을 나눈다
const IMG = /\.(jpe?g|png|webp)$/i;
const SKIPPED_IMG = /\.(heic|heif|tiff?|gif|bmp)$/i;
const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${String(d).padStart(2, '0')}, ${y}`; };
const linkOf = (v) => { const [label, url] = v.split('|').map((x) => x.trim()); return { label, url: url || '#' }; }; // link: 라벨 | 주소

function frontmatter(text, where) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error(`${where}/event.md: 맨 위에 --- 로 둘러싼 항목이 없습니다`);
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const k of ['title', 'date']) if (!out[k]) throw new Error(`${where}/event.md: ${k} 가 없습니다`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new Error(`${where}/event.md: date 는 YYYY-MM-DD 형식이어야 합니다 (현재 값: ${out.date})`);
  return out;
}

async function readEvents() {
  const events = [];
  const yearDirs = (await readdir(eventsDir, { withFileTypes: true })).filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name)).map((d) => d.name);
  for (const year of yearDirs) {
    const eventDirs = (await readdir(join(eventsDir, year), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const slug of eventDirs) {
      const where = `events/${year}/${slug}`;
      const dir = join(root, where);
      let text;
      try { text = await readFile(join(dir, 'event.md'), 'utf8'); } catch { throw new Error(`${where}: event.md 파일이 없습니다`); }
      const meta = frontmatter(text, where);
      if (!meta.date.startsWith(year)) throw new Error(`${where}/event.md: date(${meta.date})의 연도가 폴더 연도(${year})와 다릅니다`);
      const files = await readdir(dir);
      const skipped = files.filter((f) => SKIPPED_IMG.test(f));
      if (skipped.length) console.warn(`경고: ${where} 의 ${skipped.join(', ')} 은(는) 지원하지 않는 형식이라 건너뜁니다 (jpg, png, webp 만 가능)`);
      const photos = files.filter((f) => IMG.test(f)).sort(natural);
      if (!photos.length) throw new Error(`${where}: 사진(jpg, png, webp)이 없습니다`);
      if (meta.cover && !photos.includes(meta.cover)) throw new Error(`${where}/event.md: cover 파일 ${meta.cover} 이(가) 폴더에 없습니다`);
      events.push({ year, slug, dir, ...meta, photos, cover: meta.cover || photos[0] });
    }
  }
  return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
}

// 사진 → 웹용 크기. 원본은 dist 에 넣지 않는다. 출력 파일명은 주소에 안전하게 순번(001, 002 …)으로 만든다.
async function processPhotos(ev) {
  const out = join(dist, 'events', ev.year, ev.slug, 'photos');
  await mkdir(out, { recursive: true });
  const items = [];
  for (let i = 0; i < ev.photos.length; i++) {
    const file = ev.photos[i];
    const name = String(i + 1).padStart(3, '0');
    const input = join(ev.dir, file);
    const meta = await sharp(input).metadata();
    const rotated = meta.orientation && meta.orientation >= 5; // 가로·세로가 바뀌는 방향
    const W = rotated ? meta.height : meta.width;
    const H = rotated ? meta.width : meta.height;
    const big = Math.min(1600, W);
    const small = Math.min(800, W);
    await sharp(input).rotate().resize({ width: big }).jpeg({ quality: 82, progressive: true }).toFile(join(out, `${name}-${big}.jpg`));
    if (small !== big) await sharp(input).rotate().resize({ width: small }).jpeg({ quality: 80, progressive: true }).toFile(join(out, `${name}-${small}.jpg`));
    items.push({ name, big, small, w: big, h: Math.round((H / W) * big) });
  }
  // 목록 커버: 레퍼런스 .image-portrait(2:3)에 맞춰 잘라 둔다
  const covDir = join(dist, 'events', ev.year, ev.slug);
  const cover = join(ev.dir, ev.cover);
  await sharp(cover).rotate().resize({ width: 600, height: 900, fit: 'cover' }).jpeg({ quality: 80 }).toFile(join(covDir, 'cover-600.jpg'));
  await sharp(cover).rotate().resize({ width: 1200, height: 1800, fit: 'cover' }).jpeg({ quality: 80 }).toFile(join(covDir, 'cover-1200.jpg'));
  return items;
}

const head = (title, base) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" type="image/png" sizes="32x32" href="${base}assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="${base}assets/favicon-192.png">
<link rel="apple-touch-icon" href="${base}assets/apple-touch-icon.png">
<link rel="stylesheet" href="${base}assets/site.css">
</head>`;

const MENU_JS = `<script>
(function () {
  var toggle = document.querySelector('.menu-toggle'), nav = document.querySelector('.nav'), close = document.querySelector('.close-menu-toggle');
  function set(open) {
    toggle.classList.toggle('active-menu-toggle', open);
    nav.classList.toggle('nav-collapse', open);
    document.body.classList.toggle('menu-collapse', open);
    toggle.setAttribute('aria-expanded', open);
    nav.querySelectorAll('a, button').forEach(function (e) { e.tabIndex = open ? 0 : -1; });
  }
  // 로고 전환: 원본(aimeleondore.com)처럼 스크롤이 0보다 크면 header--fixed 를 붙이고, 로고 두 장의 투명도를 CSS 가 0.5s ease 로 바꾼다
  var header = document.querySelector('.header');
  function onScroll() { header.classList.toggle('header--fixed', (window.pageYOffset || document.documentElement.scrollTop) > 0); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  set(false);
  toggle.addEventListener('click', function (e) { e.preventDefault(); set(!nav.classList.contains('nav-collapse')); });
  close.addEventListener('click', function () { set(false); });
  document.querySelector('.main-wrapper').addEventListener('click', function () { if (nav.classList.contains('nav-collapse')) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
})();
</script>`;

// 연도 메뉴: events/ 아래 연도 폴더에서 만든다. 위에서부터 Coming soon(링크 없음), 최신 연도, 이전 연도 순이다.
const header = (base, years, active) => `<header class="header header--crest-transition">
<div class="container h-100">
<div class="d-flex justify-content-between align-items-center h-lg-100">
<a href="#" class="menu-toggle" role="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><span></span></a>
<a class="site-name" href="${base}" aria-label="${SITE} — Home"><img class="site-name__logo" src="${base}assets/Logo.svg" alt="${SITE}" height="28"><img class="site-name__logo-crest" src="${base}assets/Logo02.svg" alt="" aria-hidden="true" height="28"></a>
<nav class="nav" id="site-nav" aria-label="Years">
<div class="nav__wrapper">
<div class="nav__bar"><button class="close-menu-toggle" aria-label="Close menu"><span></span></button></div>
<div class="nav__container"><div class="nav__content"><div class="main-nav-panels">
<ul class="main-nav-panel main-nav-panel--active">
<li><span class="main-nav-panel__link coming-soon">Coming soon</span></li>
${years.map((y) => `<li><a class="main-nav-panel__link" href="${base}year/${y}/"${y === active ? ' aria-current="page"' : ''}>${y}</a></li>`).join('\n')}
</ul>
</div></div></div></div>
</nav>
</div>
</div>
</header>`;

const evUrl = (ev, base) => `${base}events/${ev.year}/${ev.slug}/`;

function card(ev, base) {
  const href = evUrl(ev, base);
  return `<div class="article col-2">
<a href="${href}" class="image-portrait article__featured-image" aria-label="View photos: ${esc(ev.title)}"><img src="${href}cover-600.jpg" srcset="${href}cover-600.jpg 1x, ${href}cover-1200.jpg 2x" alt="${esc(ev.title)}" width="600" height="900" loading="lazy"></a>
<div class="short-desc article__info"><h3 class="article__title"><a href="${href}">${esc(ev.title)}</a></h3><time class="article__date color-mg" datetime="${ev.date}">${longDate(ev.date)}</time></div>
</div>`;
}

function listPage(events, page, pages, years, year) {
  const base = year || page > 1 ? '../../' : './';
  const slice = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const link = (p) => (p === 1 ? `${base}` : `${base}page/${p}/`);
  const nav = pages > 1 ? `<div class="pagination">${page > 1 ? `<span class="prev"><a href="${link(page - 1)}" aria-label="Previous page"></a></span>` : ''}${Array.from({ length: pages }, (_, i) => i + 1).map((p) => (p === page ? `<span class="page current" aria-current="page">${String(p).padStart(2, '0')}</span>` : `<span class="page"><a href="${link(p)}" aria-label="Page ${p}">${String(p).padStart(2, '0')}</a></span>`)).join('')}${page < pages ? `<span class="next"><a href="${link(page + 1)}" aria-label="Next page"></a></span>` : ''}</div>` : '';
  return `${head(year ? `${year} — ${SITE}` : SITE, base)}
<body class="template-blog">
${header(base, years, year)}
<main id="main-content" class="main-wrapper" role="main">
<section class="container-wrapper container">
<div class="articles articles--current">
${year ? `<h1 class="year-label">${year}</h1>` : ''}
<div class="grid-row grid-row--lg-five">
${slice.map((e) => card(e, base)).join('\n')}
</div>
${nav}
</div>
</section>
</main>
${MENU_JS}
</body>
</html>
`;
}

function eventPage(ev, items, older, newer, years) {
  const base = '../../../';
  const figs = items.map((p, i) => `<figure><img src="photos/${p.name}-${p.big}.jpg" srcset="photos/${p.name}-${p.small}.jpg ${p.small}w, photos/${p.name}-${p.big}.jpg ${p.big}w" sizes="(min-width: 1025px) 50vw, 100vw" width="${p.w}" height="${p.h}" alt="${esc(ev.title)} photo ${i + 1}" loading="lazy"></figure>`).join('\n');
  const pn = [older && `<span class="prev-article"><a href="${evUrl(older, base)}">Older Post</a></span>`, newer && `<span class="next-article"><a href="${evUrl(newer, base)}">Newer Post</a></span>`].filter(Boolean).join('\n');
  return `${head(`${ev.title} — ${SITE}`, base)}
<body class="template-article">
${header(base, years, ev.year)}
<main id="main-content" class="main-wrapper" role="main">
<div id="article" class="container-wrapper container container-wrapper--pt">
<article class="section article article-single" itemscope itemtype="http://schema.org/Article">
<div class="article__header">
<h1 class="article__title">${esc(ev.title)}</h1>
<time class="article__date color-mg" datetime="${ev.date}">${longDate(ev.date)}</time>
</div>
${ev.summary || ev.link ? `<div class="article__content">${ev.summary ? `<p>${esc(ev.summary)}</p>` : ''}${ev.link ? `<p><u><a href="${esc(linkOf(ev.link).url)}">${esc(linkOf(ev.link).label)}</a></u></p>` : ''}</div>` : ''}
</article>
<div class="photo-grid">
${figs}
</div>
${pn ? `<div class="pagination">\n${pn}\n</div>` : ''}
</div>
</main>
${MENU_JS}
</body>
</html>
`;
}

async function buildCss() {
  const rd = (f) => readFile(join(root, 'site', f), 'utf8');
  const parts = await Promise.all(['css/fonts.css', 'css/tokens.css', 'css/base.css', 'css/06-header.css', 'css/08-main-menu.css', 'css/21-article-card.css', 'css/22-article-header.css', 'css/23-article-pagination.css', 'css/05-pagination.css', 'gallery.css'].map(rd));
  await mkdir(join(dist, 'assets'), { recursive: true });
  await writeFile(join(dist, 'assets/site.css'), parts.join('\n\n'));
}

async function buildBrand() {
  // 루트의 Logo.svg(처음 로고), Logo02.svg(스크롤 후 로고), Favicon.png 를 사이트에 넣는다
  const need = ['Logo.svg', 'Logo02.svg', 'Favicon.png'];
  for (const f of need) { try { await readFile(join(root, f)); } catch { throw new Error(`${f} 파일이 레포 맨 위에 없습니다`); } }
  await mkdir(join(dist, 'assets'), { recursive: true });
  for (const f of ['Logo.svg', 'Logo02.svg']) await writeFile(join(dist, 'assets', f), await readFile(join(root, f)));
  for (const [name, size] of [['favicon-32.png', 32], ['favicon-192.png', 192], ['apple-touch-icon.png', 180]]) {
    await sharp(join(root, 'Favicon.png')).resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toFile(join(dist, 'assets', name));
  }
}

async function main() {
  const t0 = Date.now();
  await rm(dist, { recursive: true, force: true });
  const events = await readEvents();
  if (!events.length) throw new Error('events/ 아래에 대회가 하나도 없습니다');
  await mkdir(dist, { recursive: true });
  await buildCss();
  await buildBrand();
  const processed = new Map();
  for (const ev of events) processed.set(`${ev.year}/${ev.slug}`, await processPhotos(ev));
  const years = [...new Set(events.map((e) => e.year))].sort().reverse(); // 최신 연도가 위
  const pages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  for (let p = 1; p <= pages; p++) {
    const dir = p === 1 ? dist : join(dist, 'page', String(p));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), listPage(events, p, pages, years));
  }
  for (const y of years) {
    const dir = join(dist, 'year', y);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), listPage(events.filter((e) => e.year === y), 1, 1, years, y));
  }
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    // 날짜 내림차순: 다음 칸이 older
    await writeFile(join(dist, 'events', ev.year, ev.slug, 'index.html'), eventPage(ev, processed.get(`${ev.year}/${ev.slug}`), events[i + 1], events[i - 1], years));
  }
  await writeFile(join(dist, '.nojekyll'), '');
  const total = [...processed.values()].reduce((n, a) => n + a.length, 0);
  console.log(`built ${events.length} events, ${total} photos, ${years.length} years in ${((Date.now() - t0) / 1000).toFixed(1)}s → dist`);
}

main().catch((e) => { console.error(`빌드 실패: ${e.message}`); process.exit(1); });
