const feed = document.getElementById('shorts-feed');
const status = document.getElementById('status');

let cursor = null;
let loading = false;
let done = false;

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const video = entry.target;
    if (entry.isIntersecting) {
      video.play().catch(() => {});
      video.dataset.startedAt = String(Date.now());
    } else {
      const startedAt = Number(video.dataset.startedAt || Date.now());
      const watchedMs = Date.now() - startedAt;
      trackWatch(video.dataset.shortId, watchedMs);
      video.pause();
    }
  });
}, { threshold: 0.7 });

async function trackWatch(shortId, watchedMs) {
  if (!shortId || watchedMs < 500) return;
  await fetch(`/api/shorts/${shortId}/watch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ watchedMs }),
  });
}

function renderAd(ad, shortId) {
  const banner = document.createElement('article');
  banner.className = 'ad-banner';
  banner.innerHTML = `
    <div class="meta">Sponsored · ${ad.placement} · duración fija ${ad.durationSec}s · intervalo ${ad.intervalMin}m</div>
    <strong>${ad.name}</strong>
    <div><a href="${ad.clickUrl || ad.mediaUrl}" target="_blank" rel="noreferrer">Open advertiser</a></div>
    <div id="short-ad-${ad.id}">Tiempo restante: 60s</div>
  `;
  feed.appendChild(banner);

  let remaining = 60;
  const timer = setInterval(() => {
    remaining -= 1;
    const node = document.getElementById(`short-ad-${ad.id}`);
    if (node) node.textContent = `Tiempo restante: ${remaining}s`;
    if (remaining <= 0) clearInterval(timer);
  }, 1000);

  fetch('/api/ads/impressions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adId: ad.id, shortVideoId: shortId, watchMs: 60000, grossRevenueUsd: 0.02 }),
  });
}

function renderShort(item, ad) {
  const card = document.createElement('article');
  card.className = 'short-card';
  card.innerHTML = `
    <video muted loop playsinline data-short-id="${item.id}">
      <source src="${item.videoUrl}" type="video/mp4" />
    </video>
    <div class="meta">
      <h3>${item.title}</h3>
      <p>@${item.owner.username}</p>
      <small>Engagement: ${item.metrics.engagementScore.toFixed(2)} | Trending: ${item.metrics.trendingScore.toFixed(2)}</small>
    </div>
  `;

  const video = card.querySelector('video');
  io.observe(video);
  feed.appendChild(card);

  if (ad) renderAd(ad, item.id);
}

async function loadMore() {
  if (loading || done) return;
  loading = true;
  status.textContent = 'Loading...';

  const qs = new URLSearchParams();
  if (cursor) qs.set('cursor', cursor);
  qs.set('limit', '5');

  const res = await fetch(`/api/shorts/feed?${qs}`);
  const data = await res.json();

  data.items.forEach((item, idx) => renderShort(item, idx === 0 ? data.ad : null));

  cursor = data.nextCursor;
  done = !cursor;
  status.textContent = done ? 'No more shorts' : 'Scroll for more';
  loading = false;
}

window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    loadMore();
  }
});

loadMore();
