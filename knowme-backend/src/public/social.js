const token = localStorage.getItem('knowme_token') || '';
const headers = {
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

const timelineEl = document.getElementById('timeline');
const storiesEl = document.getElementById('stories');
const statusEl = document.getElementById('feed-status');
const searchEl = document.getElementById('search-query');

let cursor = null;
let loading = false;
let done = false;

async function createPost() {
  const content = document.getElementById('post-content').value;
  const image = document.getElementById('post-image').value;
  const media = image ? [{ mediaUrl: image, mediaType: 'IMAGE' }] : [];

  await fetch('/api/social/posts', {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, media }),
  });

  document.getElementById('post-content').value = '';
  document.getElementById('post-image').value = '';
  await resetAndLoad();
}

async function createStory() {
  const content = document.getElementById('story-content').value;
  const mediaUrl = document.getElementById('story-image').value;

  await fetch('/api/social/stories', {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, mediaUrl, mediaType: mediaUrl ? 'IMAGE' : 'TEXT' }),
  });

  document.getElementById('story-content').value = '';
  document.getElementById('story-image').value = '';
  await resetAndLoad();
}

async function toggleLike(postId) {
  await fetch(`/api/social/posts/${postId}/likes`, {
    method: 'POST',
    headers,
  });
  await resetAndLoad();
}

function renderStories(stories) {
  storiesEl.innerHTML = '<h3>Stories</h3>';
  stories.forEach((story) => {
    const el = document.createElement('article');
    el.className = 'story';
    el.innerHTML = `
      <strong>@${story.author.username}</strong>
      <div>${story.content || ''}</div>
      ${story.mediaUrl ? `<img src="${story.mediaUrl}" alt="story" style="max-width:180px;border-radius:6px;" />` : ''}
      <div class="meta">Expires: ${new Date(story.expiresAt).toLocaleString()} | Likes: ${story.likes.length}</div>
    `;
    storiesEl.appendChild(el);
  });
}

function renderAd(ad) {
  if (!ad) return;
  const adEl = document.createElement('article');
  adEl.className = 'ad-card';
  adEl.innerHTML = `
    <div class="meta">Sponsored · ${ad.placement} · ${ad.durationSec}s</div>
    <strong>${ad.name}</strong>
    <div><a href="${ad.clickUrl || ad.mediaUrl}" target="_blank" rel="noreferrer">Open advertiser</a></div>
    <div id="ad-countdown-${ad.id}">Tiempo restante: 60s</div>
  `;
  timelineEl.appendChild(adEl);

  let remaining = 60;
  const timer = setInterval(() => {
    remaining -= 1;
    const node = document.getElementById(`ad-countdown-${ad.id}`);
    if (node) node.textContent = `Tiempo restante: ${remaining}s`;
    if (remaining <= 0) clearInterval(timer);
  }, 1000);

  fetch('/api/ads/impressions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ adId: ad.id, watchMs: 60000, grossRevenueUsd: 0.03 }),
  });
}

function renderPosts(posts, ad) {
  if (!cursor) {
    timelineEl.innerHTML = '<h3>Timeline (chronological)</h3>';
  }

  if (ad) renderAd(ad);

  posts.forEach((post) => {
    const el = document.createElement('article');
    el.className = 'post';

    const mediaHtml = (post.media || []).map((item) => `<img src="${item.mediaUrl}" alt="media" style="max-width:220px;border-radius:6px;margin-top:6px;" />`).join('');
    const hashtags = (post.hashtags || []).map((row) => `#${row.hashtag.tag}`).join(' ');

    el.innerHTML = `
      <strong>@${post.author.username}</strong>
      <p>${post.content || ''}</p>
      <div>${mediaHtml}</div>
      <div class="meta">Type: ${post.postType} | Likes: ${post.likes.length} | Comments: ${post.comments.length}</div>
      <div class="meta">${hashtags}</div>
      <button data-like="${post.id}">Like/Unlike</button>
    `;

    timelineEl.appendChild(el);
  });

  timelineEl.querySelectorAll('button[data-like]').forEach((button) => {
    button.onclick = () => toggleLike(button.dataset.like);
  });
}

async function loadTimeline() {
  if (loading || done) return;
  loading = true;
  statusEl.textContent = 'Loading feed...';

  const qs = new URLSearchParams();
  qs.set('limit', '10');
  if (cursor) qs.set('cursor', cursor);
  if (searchEl.value.trim()) qs.set('q', searchEl.value.trim());

  const res = await fetch(`/api/social/timeline?${qs}`, { headers });
  if (!res.ok) {
    timelineEl.innerHTML = '<p>Login required. Save JWT in localStorage key <code>knowme_token</code>.</p>';
    storiesEl.innerHTML = '';
    statusEl.textContent = '';
    loading = false;
    return;
  }

  const data = await res.json();
  if (!cursor) renderStories(data.stories || []);
  renderPosts(data.posts || [], data.ad);
  cursor = data.nextCursor;
  done = !cursor;
  loading = false;
  statusEl.textContent = done ? 'No more posts' : 'Scroll to load more';
}

async function resetAndLoad() {
  cursor = null;
  done = false;
  await loadTimeline();
}

document.getElementById('create-post').addEventListener('click', createPost);
document.getElementById('create-story').addEventListener('click', createStory);
document.getElementById('reload').addEventListener('click', resetAndLoad);
document.getElementById('search-btn').addEventListener('click', resetAndLoad);

window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 280) {
    loadTimeline();
  }
});

resetAndLoad();
