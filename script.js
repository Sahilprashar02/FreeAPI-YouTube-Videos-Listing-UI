const API_URL = "https://api.freeapi.app/api/v1/public/youtube/videos";

const state = {
  allVideos: [],
  page: 1,
  totalPages: 1,
  isLoading: false,
  query: "",
  filter: "all",
};

const grid = document.querySelector("#video-grid");
const loader = document.querySelector("#loader");
const emptyState = document.querySelector("#empty-state");
const loadMoreButton = document.querySelector("#load-more");
const resultCount = document.querySelector("#result-count");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const filterButtons = document.querySelectorAll(".filter");

function formatDuration(isoDuration = "") {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];

  return parts
    .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, "0")))
    .join(":");
}

function compactNumber(value = 0) {
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function timeAgo(dateString) {
  const published = new Date(dateString);
  const seconds = Math.floor((Date.now() - published.getTime()) / 1000);
  const intervals = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [label, amount] of intervals) {
    const count = Math.floor(seconds / amount);
    if (count >= 1) {
      return `${count} ${label}${count > 1 ? "s" : ""} ago`;
    }
  }

  return "Just now";
}

function normalizeVideo(record) {
  const video = record.items || {};
  const snippet = video.snippet || {};
  const stats = video.statistics || {};
  const thumbnails = snippet.thumbnails || {};
  const tags = snippet.tags || [];

  return {
    id: video.id,
    title: snippet.title || "Untitled video",
    description: snippet.description || "No description available.",
    channel: snippet.channelTitle || "Unknown channel",
    publishedAt: snippet.publishedAt,
    thumbnail:
      thumbnails.maxres?.url ||
      thumbnails.standard?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      "",
    duration: formatDuration(video.contentDetails?.duration),
    views: compactNumber(stats.viewCount || 0),
    likes: compactNumber(stats.likeCount || 0),
    tags,
    url: `https://www.youtube.com/watch?v=${video.id}`,
  };
}

function getVisibleVideos() {
  const query = state.query.trim().toLowerCase();

  return state.allVideos.filter((video) => {
    const searchable = [
      video.title,
      video.description,
      video.channel,
      ...video.tags,
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || searchable.includes(query);
    const matchesFilter =
      state.filter === "all" || searchable.includes(state.filter.toLowerCase());

    return matchesQuery && matchesFilter;
  });
}

function createVideoCard(video) {
  const article = document.createElement("article");
  article.className = "video-card";

  const tagMarkup = video.tags
    .slice(0, 3)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");

  article.innerHTML = `
    <a class="thumb-link" href="${video.url}" target="_blank" rel="noreferrer">
      <img src="${video.thumbnail}" alt="${escapeHtml(video.title)} thumbnail" loading="lazy" />
      <span class="duration">${video.duration}</span>
    </a>
    <div class="card-body">
      <div class="avatar" aria-hidden="true">${escapeHtml(video.channel.charAt(0))}</div>
      <div>
        <a class="title" href="${video.url}" target="_blank" rel="noreferrer">
          ${escapeHtml(video.title)}
        </a>
        <div class="meta">
          <span>${escapeHtml(video.channel)}</span>
          <span aria-hidden="true">•</span>
          <span>${video.views} views</span>
          <span aria-hidden="true">•</span>
          <span>${timeAgo(video.publishedAt)}</span>
        </div>
        <p class="description">${escapeHtml(video.description)}</p>
        <div class="tags">${tagMarkup}</div>
      </div>
    </div>
  `;

  return article;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderVideos() {
  const videos = getVisibleVideos();
  grid.replaceChildren(...videos.map(createVideoCard));

  emptyState.hidden = videos.length > 0 || state.isLoading;
  resultCount.textContent = `${videos.length} of ${state.allVideos.length} loaded videos`;
  loadMoreButton.hidden = state.page >= state.totalPages;
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  loader.hidden = !isLoading || state.allVideos.length > 0;
  loadMoreButton.disabled = isLoading;
  loadMoreButton.textContent = isLoading ? "Loading..." : "Load more";
}

async function fetchVideos(page = 1) {
  setLoading(true);

  try {
    const response = await fetch(`${API_URL}?page=${page}&limit=12`);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const pageData = payload.data;
    const videos = pageData.data.map(normalizeVideo);

    state.allVideos = [...state.allVideos, ...videos];
    state.page = pageData.page;
    state.totalPages = pageData.totalPages;
    renderVideos();
  } catch (error) {
    emptyState.hidden = false;
    emptyState.querySelector("h2").textContent = "Could not load videos";
    emptyState.querySelector("p").textContent =
      "Please check your internet connection and try again.";
    resultCount.textContent = "Unable to fetch videos";
    console.error(error);
  } finally {
    setLoading(false);
    renderVideos();
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = searchInput.value;
  renderVideos();
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  renderVideos();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.filter = button.dataset.filter;
    renderVideos();
  });
});

loadMoreButton.addEventListener("click", () => {
  if (state.page < state.totalPages) {
    fetchVideos(state.page + 1);
  }
});

fetchVideos();
