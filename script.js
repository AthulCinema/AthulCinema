// ==========================================
// 1. CONFIGURATION & GLOBAL STATE
// ==========================================

const API_KEY = '835e03c80c7146db1d12752b81a21852'; // Your TMDB API Key
const BASE_URL = 'https://api.themoviedb.org/3';

// --- MAIN APP STATE ---
// This object acts as the "brain" of the app, remembering where the user is and what they've saved.
let state = {
  user: { displayName: 'Guest User', photoURL: 'https://ui-avatars.com/api/?name=Guest+User&background=random' },
  page: 1,
  category: 'trending',
  genres: [],
  providers: [],
  sortBy: 'popularity.desc',
  year: '',
  lang: '', 
  query: '',
  fetching: false,
  activeMovie: null,
  
  // Load saved user data from the browser's local storage (or start empty if first visit)
  favorites: JSON.parse(localStorage.getItem('athul_favs')) || [],
  watchHistory: JSON.parse(localStorage.getItem('athul_watch')) || [],
  mixtapes: JSON.parse(localStorage.getItem('athul_mixtapes')) || []
};

// --- GLOBAL VARIABLES FOR FEATURES & MINI-GAMES ---
// Six Degrees Game State
let sdActive = false;
let sdTargetId = null;
let sdTargetName = "";
let sdClicks = 0;

let currentVideos = [];       // Holds trailer data for the active movie
let swipeMovies = [];         // Queue of movies for the Tinder-style Swipe Mode
let compareList = [];         // Holds the 2 movies selected for the VS Comparison Mode
let debounceTimer;            // Prevents the search bar from spamming the API

// Movie Roulette
let rouletteMovies = [];
let rouletteWinnerId = null;

// Cine-Trivia
let tScore = 0;
let tAns = null;

// Funny Booking System & Banana Wallet
let selectedSeats = [];
const TICKET_PRICE = 200; // Cost in 🍌 Bananas
const funnyOccupants = ["Thanos", "Your Ex", "Batman", "A Ghost", "Spiderman", "Peppa Pig"];

// --- UI CONFIGURATION ---
// Chameleon Effect: Matches the modal glow to the movie's primary genre
const genreColors = {
    28: '#ef4444', 12: '#f59e0b', 16: '#3b82f6', 35: '#eab308', 80: '#78716c', 99: '#14b8a6', 
    18: '#8b5cf6', 10751: '#ec4899', 14: '#a855f7', 36: '#d97706', 27: '#dc2626', 10402: '#ec4899', 
    9648: '#6366f1', 10749: '#f43f5e', 878: '#06b6d4', 53: '#fca5a5', 10752: '#16a34a'
};

// Emoji Decoder Game Data
const emojiData = [
    { emojis: '🦇 🃏 🤡 🌃', answer: 'The Dark Knight', options: ['Joker', 'The Dark Knight', 'Batman Begins', 'Suicide Squad'] },
    { emojis: '🚢 🧊 🚪 🥶', answer: 'Titanic', options: ['Poseidon', 'Titanic', 'The Abyss', 'Waterworld'] },
    { emojis: '🦖 🦕 🏝️ 🚙', answer: 'Jurassic Park', options: ['King Kong', 'Godzilla', 'Jurassic Park', 'Journey 2'] },
    { emojis: '🕷️ 🕸️ 🏙️ 👨‍🎓', answer: 'Spider-Man', options: ['Venom', 'Spider-Man', 'Iron Man', 'Ant-Man'] },
    { emojis: '🦁 👑 🌅 🐗', answer: 'The Lion King', options: ['Madagascar', 'The Lion King', 'Tarzan', 'The Jungle Book'] },
    { emojis: '👽 🚲 🌕 👦', answer: 'E.T.', options: ['Super 8', 'Stranger Things', 'E.T.', 'Alien'] },
    { emojis: '🧙‍♂️ 💍 🌋 🧝', answer: 'Lord of the Rings', options: ['Harry Potter', 'The Hobbit', 'Warcraft', 'Lord of the Rings'] },
    { emojis: '💊 🕶️ 💻 🐇', answer: 'The Matrix', options: ['Inception', 'The Matrix', 'Hackers', 'Blade Runner'] }
];
// ==========================================
// 2. INITIALIZATION & UTILITY FUNCTIONS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Start up the main UI components
  initHeroCarousel();
  loadMovies();
  setupInfiniteScroll();
  setupSearch();
  setupOutsideClick();
  updateSmartGreeting();
  checkFirstTimeVisit();
  
  // --- FEATURE 1: Check if a Mixtape was shared in the URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const sharedTape = urlParams.get('shared_tape');
  
  if (sharedTape) {
      try {
          // Decode the URL string back into an array of movies
          const movies = JSON.parse(decodeURIComponent(sharedTape));
          const modal = document.getElementById('sharedMixtapeModal');
          const grid = document.getElementById('shared-mixtape-grid');
          grid.innerHTML = '';
          
          movies.forEach(async (m) => {
              // Fetch poster for each shared movie
              const res = await fetch(`${BASE_URL}/movie/${m.id}?api_key=${API_KEY}`);
              const data = await res.json();
              if(data.poster_path) {
                  const d = document.createElement('div');
                  d.className = 'history-card';
                  // Clicking the poster in the shared modal opens the movie details!
                  d.onclick = () => { modal.style.display='none'; openMovieModal(m.id); };
                  d.innerHTML = `<img src="https://image.tmdb.org/t/p/w154${data.poster_path}" title="${data.title}">`;
                  grid.appendChild(d);
              }
          });
          
          modal.style.display = 'flex';
          
          // Clean up the URL so it doesn't keep opening on refresh
          window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
          console.error("Failed to load shared mixtape.");
      }
  }
});

// --- FIRST TIME VISIT WELCOME ---
function checkFirstTimeVisit() {
  if (!localStorage.getItem('athul_visited')) {
    setTimeout(() => {
        const welcome = document.getElementById('welcomeModal');
        if(welcome) welcome.style.display = 'flex';
    }, 1000);
  }
}

function closeWelcomeModal() {
  document.getElementById('welcomeModal').style.display = 'none';
  localStorage.setItem('athul_visited', 'true');
}

// --- EXPANDABLE DESCRIPTION UTILITY ---
// This handles the "Read More / Show Less" feature for long movie plots and actor bios.
function setupExpandableText(elementId, text, btnId) {
    const el = document.getElementById(elementId);
    const btn = document.getElementById(btnId);
    
    if (!text) {
        el.innerText = "No description available.";
        btn.style.display = 'none';
        el.classList.remove('collapsed');
        return;
    }

    el.innerText = text;
    
    // If text is long, show the "Read More" button and collapse it
    if (text.length > 250) {
        el.classList.add('collapsed');
        btn.style.display = 'inline-block';
        btn.innerText = "Read More v";
        
        btn.onclick = () => {
            if (el.classList.contains('collapsed')) {
                el.classList.remove('collapsed');
                btn.innerText = "Show Less ^";
            } else {
                el.classList.add('collapsed');
                btn.innerText = "Read More v";
            }
        };
    } else {
        // If text is short, don't show the button
        el.classList.remove('collapsed');
        btn.style.display = 'none';
    }
}
// ==========================================
// 3. DATA FETCHING & RENDERING
// ==========================================

// --- FETCH MOVIES ---
function loadMovies(append = false) {
  if (state.fetching) return; // Prevent spamming API requests while loading
  state.fetching = true;
  
  if(!append) document.getElementById('grid').innerHTML = '';

  let url;
  
  // Build the correct TMDB URL based on what the user is currently doing
  if (state.query) {
    url = `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${state.query}&page=${state.page}`;
  } else if (state.category === 'trending') {
    url = `${BASE_URL}/trending/movie/week?api_key=${API_KEY}&page=${state.page}`;
  } else if (state.category === 'discover') {
    url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=${state.sortBy}&page=${state.page}&include_adult=false`;
    if (state.genres.length > 0) url += `&with_genres=${state.genres.join(',')}`;
    if (state.year) url += `&primary_release_year=${state.year}`;
    if (state.lang) url += `&with_original_language=${state.lang}`; // Apply Language Filter
    if (state.providers.length > 0) url += `&with_watch_providers=${state.providers.join('|')}&watch_region=IN`;
  } else {
    state.fetching = false; 
    return;
  }

  fetch(url)
    .then(res => res.json())
    .then(data => {
      renderMovies(data.results, append);
      state.fetching = false;
    })
    .catch(error => {
      console.error("Error fetching movies:", error);
      state.fetching = false;
    });
}

// --- RENDER MOVIE CARDS ---
function renderMovies(movies, append) {
  const grid = document.getElementById('grid');
  if(!movies || movies.length === 0) return;

  movies.forEach(m => {
    // Skip movies that don't have a poster image
    if (!m.poster_path) return; 
    
    const el = document.createElement('div');
    el.className = 'movie-card';
    el.onclick = () => openMovieModal(m.id);
    
    // --- FEATURE 4: 3D Tilt Effect ---
    // Calculates mouse position to tilt the card dynamically
    el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -15; // Tilt intensity
        const rotateY = ((x - centerX) / centerX) * 15;
        el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
    });
    
    // --- FEATURE 2: Video Hover Previews ---
    let hoverTimer;
    el.addEventListener('mouseenter', () => {
        // Wait 1.2 seconds of hovering before playing to prevent accidental triggers
        hoverTimer = setTimeout(async () => {
            const res = await fetch(`${BASE_URL}/movie/${m.id}/videos?api_key=${API_KEY}`);
            const data = await res.json();
            const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
            
            if (trailer) {
                const iframe = document.createElement('iframe');
                iframe.className = 'trailer-preview';
                // Muted autoplay is required by browsers to auto-play on hover
                iframe.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&controls=0&modestbranding=1`;
                iframe.frameBorder = '0';
                iframe.allow = 'autoplay';
                el.querySelector('.poster-container').appendChild(iframe);
            }
        }, 1200); 
    });
    
    el.addEventListener('mouseleave', () => {
        // Cancel the timer if the user moves their mouse away quickly
        clearTimeout(hoverTimer);
        const iframe = el.querySelector('.trailer-preview');
        if (iframe) iframe.remove(); // Remove video when mouse leaves to save memory
        el.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`; // Reset 3D Tilt
    });

    // Build the actual HTML inside the card
    el.innerHTML = `
      <div class="poster-container">
        <img src="https://image.tmdb.org/t/p/w300${m.poster_path}" loading="lazy">
        <button class="compare-btn-overlay" onclick="event.stopPropagation(); addToCompare(${m.id})">
            <i class="ri-scales-3-line"></i>
        </button>
      </div>
      <div class="card-content">
        <h3 class="card-title">${m.title}</h3>
        <div class="card-meta">
            <span>${m.release_date ? m.release_date.substring(0,4) : 'N/A'}</span>
            <span><i class="ri-star-fill" style="color:#fbbf24"></i> ${m.vote_average.toFixed(1)}</span>
        </div>
      </div>
    `;
    grid.appendChild(el);
  });
}
// ==========================================
// 4. UI NAVIGATION & FILTERING
// ==========================================

// --- HERO CAROUSEL ---
function initHeroCarousel() {
    fetch(`${BASE_URL}/trending/movie/day?api_key=${API_KEY}`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('hero-carousel');
            data.results.slice(0, 5).forEach((m, i) => {
                const slide = document.createElement('div');
                slide.className = `hero-slide ${i === 0 ? 'active' : ''}`;
                slide.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.3), var(--bg)), url(https://image.tmdb.org/t/p/original${m.backdrop_path})`;
                slide.innerHTML = `
                    <div class="hero-content">
                        <h1 class="hero-title">${m.title}</h1>
                        <div class="hero-meta">
                            <span>${m.vote_average.toFixed(1)} Rating</span>
                        </div>
                        <button class="btn-primary" onclick="openMovieModal(${m.id})"><i class="ri-play-circle-fill"></i> View Details</button>
                    </div>
                `;
                container.appendChild(slide);
            });
            setInterval(() => {
                const slides = document.querySelectorAll('.hero-slide');
                const active = document.querySelector('.hero-slide.active');
                if(!active) return;
                active.classList.remove('active');
                let next = active.nextElementSibling || slides[0];
                if(next.className.includes('hero-overlay')) next = slides[0];
                next.classList.add('active');
            }, 5000);
        });
}

// --- TABS NAVIGATION ---
function setTab(cat, btn) {
  // Update active state of buttons
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  
  const grid = document.getElementById('grid');
  const swipe = document.getElementById('swipe-view');
  const profile = document.getElementById('profile-view');
  const controls = document.getElementById('main-controls');
  const mood = document.querySelector('.mood-wrapper');
  const hero = document.getElementById('hero-carousel');

  // Hide everything first
  grid.style.display = 'none'; swipe.style.display = 'none'; profile.style.display = 'none';
  controls.style.display = 'block'; mood.style.display = 'block'; hero.style.display = 'block';

  // Show correct views based on selected tab
  if (cat === 'profile') {
    controls.style.display = 'none'; mood.style.display = 'none'; hero.style.display = 'none';
    profile.style.display = 'block';
    renderProfileView();
  } else if (cat === 'swipe') {
    controls.style.display = 'none'; mood.style.display = 'none'; hero.style.display = 'none';
    swipe.style.display = 'flex';
    initSwipeMode();
   } else if (cat === 'favorites') {
    // --- FEATURE: Drag & Drop Tier List Watchlist ---
    grid.style.display = 'grid';
    controls.style.display = 'none';
    renderDraggableWatchlist();
} else if (cat === 'upcoming') {
    // --- FEATURE: Upcoming Releases ---
    grid.style.display = 'grid';
    controls.style.display = 'none'; // Hide normal filters for upcoming
    state.fetching = true;
    grid.innerHTML = '<h3 style="text-align:center; width:100%; margin-top:2rem;">Loading upcoming blockbusters...</h3>';
    
    // Fetch upcoming movies 
    fetch(`${BASE_URL}/movie/upcoming?api_key=${API_KEY}&region=IN&page=1`)
      .then(res => res.json())
      .then(data => {
          grid.innerHTML = '';
          const today = new Date();
          data.results.forEach(m => {
              if (!m.poster_path) return;
              
              // Calculate days remaining
              const releaseDate = new Date(m.release_date);
              const diffTime = releaseDate - today;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              let badgeHtml = '';
              if (diffDays > 0) {
                  badgeHtml = `<div class="countdown-badge"><i class="ri-time-line"></i> In ${diffDays} Days</div>`;
              } else {
                  badgeHtml = `<div class="countdown-badge out-now"><i class="ri-fire-fill"></i> Out Now!</div>`;
              }

              const el = document.createElement('div');
              el.className = 'movie-card';
              el.onclick = () => openMovieModal(m.id);
              el.innerHTML = `
                <div class="poster-container">
                  ${badgeHtml}
                  <img src="https://image.tmdb.org/t/p/w300${m.poster_path}" loading="lazy">
                </div>
                <div class="card-content">
                  <h3 class="card-title">${m.title}</h3>
                  <div class="card-meta"><span>${m.release_date}</span></div>
                </div>
              `;
              grid.appendChild(el);
          });
          state.fetching = false;
      });
  } else {
    // Normal browsing (Trending or Discover)
    grid.style.display = 'grid';
    state.category = cat;
    if(cat === 'trending') resetFilters(false);
    resetAndLoad();
  }
}

// --- FILTERING LOGIC ---
function setMood(mood, btn) {
    document.querySelectorAll('.mood-card').forEach(c => c.classList.remove('active'));
    if(btn) btn.classList.add('active');
    const map = { 'happy': '35,16', 'adrenaline': '28,12', 'scared': '27,9648', 'romantic': '10749', 'smart': '99,878', 'drama': '18,36' };
    state.genres = map[mood].split(',');
    state.category = 'discover'; state.query = '';
    resetAndLoad();
}

function toggleGenre(id, name, el) {
    const idx = state.genres.indexOf(id);
    if (idx === -1) { state.genres.push(id); el.classList.add('selected'); }
    else { state.genres.splice(idx, 1); el.classList.remove('selected'); }
    document.getElementById('selected-genre-text').innerText = state.genres.length ? `${state.genres.length} Selected` : 'Genres';
    state.category = 'discover'; resetAndLoad();
}

function toggleProvider(id, btn) {
    const idx = state.providers.indexOf(id);
    if(idx === -1) { state.providers.push(id); btn.classList.add('active'); }
    else { state.providers.splice(idx, 1); btn.classList.remove('active'); }
    state.category = 'discover'; resetAndLoad();
}

function selectOption(type, val, text) {
    if(type === 'sort') { state.sortBy = val; document.getElementById('selected-sort-text').innerText = text; }
    if(type === 'year') { state.year = val; }
    if(type === 'lang') { state.lang = val; document.getElementById('selected-lang-text').innerText = text; }
    state.category = 'discover'; resetAndLoad();
}

function resetFilters(shouldLoad = true) {
    state.genres = []; state.providers = []; state.year = ''; state.sortBy = 'popularity.desc'; state.query = ''; state.lang = '';
    document.querySelectorAll('.option.selected').forEach(e => e.classList.remove('selected'));
    document.querySelectorAll('.provider-btn.active').forEach(e => e.classList.remove('active'));
    document.getElementById('selected-genre-text').innerText = 'Genres';
    document.getElementById('selected-lang-text').innerText = 'Language';
    document.getElementById('year-input').value = '';
    document.getElementById('search').value = '';
    if(shouldLoad) { state.category = 'trending'; resetAndLoad(); }
}

function resetAndLoad() { 
    state.page = 1; 
    loadMovies(); 
}

// --- LIVE SEARCH & EASTER EGGS ---
function setupSearch() {
  const input = document.getElementById('search');
  input.addEventListener('keyup', (e) => {
    const term = e.target.value.toLowerCase();
    
    // Fun Easter Eggs
    if (term === 'thanos') { document.body.style.filter = "grayscale(100%) blur(2px)"; setTimeout(()=>document.body.style.filter="none", 3000); }
    if (term === 'barbie') { document.documentElement.style.setProperty('--accent', '#ec4899'); }
    if (term === 'matrix') { document.documentElement.style.setProperty('--accent', '#22c55e'); document.documentElement.style.setProperty('--bg', '#000000'); document.body.style.fontFamily="'Courier New', monospace"; }
    
    // Live Search with Debounce (waits 300ms after you stop typing)
    clearTimeout(debounceTimer);
    if (term.length < 2) { document.getElementById('live-search-results').style.display = 'none'; return; }
    
    debounceTimer = setTimeout(() => {
        fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${term}&page=1`)
            .then(res => res.json())
            .then(data => {
                const list = document.getElementById('live-search-results');
                list.innerHTML = ''; list.style.display = 'block';
                data.results.slice(0, 5).forEach(m => {
                    if(!m.poster_path) return;
                    const div = document.createElement('div');
                    div.className = 'search-item';
                    div.onclick = () => { openMovieModal(m.id); list.style.display = 'none'; input.value = ''; };
                    div.innerHTML = `<img src="https://image.tmdb.org/t/p/w92${m.poster_path}"><span>${m.title}</span>`;
                    list.appendChild(div);
                });
            });
    }, 300);

    if(e.key === 'Enter') { 
        state.query = e.target.value; 
        resetAndLoad(); 
        document.getElementById('live-search-results').style.display = 'none'; 
    }
  });
}
// ==========================================
// 5. DETAILED MODALS (MOVIES & ACTORS)
// ==========================================

// --- MOVIE MODAL ---
async function openMovieModal(id) {
  const modal = document.getElementById('movieModal');
  modal.style.display = 'flex';
  
  // Fetch massive amount of data: info, credits, videos, and watch providers
  const res = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}&append_to_response=credits,videos,recommendations,keywords,watch/providers`);
  const data = await res.json();
  state.activeMovie = data;
  currentVideos = data.videos?.results || [];
  
  // Update History (Now saving genres so Badges can be calculated later!)
  const histIdx = state.watchHistory.findIndex(m=>m.id===data.id);
  if(histIdx>-1) state.watchHistory.splice(histIdx,1);
  state.watchHistory.push({ 
      id: data.id, 
      title: data.title, 
      poster_path: data.poster_path, 
      runtime: data.runtime, 
      vote_average: data.vote_average,
      genres: data.genres ? data.genres.map(g => g.name) : [] 
  });
  localStorage.setItem('athul_watch', JSON.stringify(state.watchHistory));

  // --- FEATURE 5: Where to Stream Links ---
  const streamContainer = document.getElementById('m-providers');
  streamContainer.innerHTML = '';
  // Try India providers first, fallback to US
  const providersData = data['watch/providers']?.results?.IN || data['watch/providers']?.results?.US || {};
  const providersList = providersData?.flatrate || providersData?.rent || [];
  if (providersList.length > 0) {
      providersList.slice(0, 3).forEach(p => {
          streamContainer.innerHTML += `
            <a href="${providersData.link}" target="_blank" class="stream-btn">
                <img src="https://image.tmdb.org/t/p/w92${p.logo_path}">${p.provider_name}
            </a>`;
      });
  } else {
      streamContainer.innerHTML = `<span style="font-size:0.85rem; color:var(--text-muted);">Not currently streaming.</span>`;
  }

  // Chameleon Effect (Glows to match the movie's genre)
  const content = modal.querySelector('.modal-content');
  const genreId = data.genres && data.genres[0] ? data.genres[0].id : null;
  const color = genreColors[genreId] || '#ffffff';
  content.style.boxShadow = `0 0 50px ${color}40`;
  content.style.borderColor = `${color}80`;

  // Populate Basic Data
  document.getElementById('m-title').innerText = data.title;
  document.getElementById('m-tagline').innerText = data.tagline || "";
  document.getElementById('m-hero').style.backgroundImage = `url(https://image.tmdb.org/t/p/original${data.backdrop_path})`;
  document.getElementById('m-release').innerText = data.release_date;
  document.getElementById('m-runtime').innerText = `${data.runtime}m`;

  // --- DETAILED DESCRIPTION UPGRADES ---
  // Find the Director
  const director = data.credits?.crew?.find(c => c.job === 'Director');
  
  // Setup Meta Tags (Director, Budget, Revenue)
  const metaBox = document.getElementById('m-meta');
  metaBox.innerHTML = '';
  if (director) metaBox.innerHTML += `<div class="meta-tag-item"><strong>Director:</strong> ${director.name}</div>`;
  if (data.budget > 0) metaBox.innerHTML += `<div class="meta-tag-item"><strong>Budget:</strong> $${(data.budget / 1000000).toFixed(1)}M</div>`;
  if (data.revenue > 0) metaBox.innerHTML += `<div class="meta-tag-item"><strong>Box Office:</strong> $${(data.revenue / 1000000).toFixed(1)}M</div>`;

  // Setup Expandable Plot Description
  setupExpandableText('m-desc', data.overview, 'm-desc-btn');

  // Keywords (Clickable to start a new search!)
  const kwC = document.getElementById('m-keywords'); kwC.innerHTML = '';
  if(data.keywords && data.keywords.keywords) {
      data.keywords.keywords.slice(0, 8).forEach(k => {
          const s = document.createElement('span'); s.className = 'keyword-chip'; s.innerText = k.name;
          s.onclick = () => { state.query=k.name; resetAndLoad(); modal.style.display='none'; };
          kwC.appendChild(s);
      });
  }

  // Cast
  const castC = document.getElementById('m-cast'); castC.innerHTML = '';
  if(data.credits && data.credits.cast) {
      data.credits.cast.slice(0, 10).forEach(p => {
        if(!p.profile_path) return;
        const d = document.createElement('div'); d.className = 'cast-item';
        d.onclick = () => openActorModal(p.id);
        d.innerHTML = `<img src="https://image.tmdb.org/t/p/w185${p.profile_path}" title="${p.name}">`;
        castC.appendChild(d);
      });
  }

  updateFavBtn();
}

// --- ACTOR ABOUT MODAL ---
async function openActorModal(id) {
    // Hide the movie modal and show the actor modal
    document.getElementById('movieModal').style.display = 'none';
    const modal = document.getElementById('actorModal'); 
    modal.style.display = 'flex';
    
    // Set a clean loading state
    document.getElementById('a-name').innerText = "Loading...";
    document.getElementById('a-img').src = "https://via.placeholder.com/300x450?text=Loading...";
    document.getElementById('a-films').innerHTML = '';
    document.getElementById('a-meta').innerHTML = '';

    // Fetch full actor data and their combined credits
    const res = await fetch(`${BASE_URL}/person/${id}?api_key=${API_KEY}&append_to_response=combined_credits`);
    const data = await res.json();
    
    // Populate text and image
    document.getElementById('a-name').innerText = data.name;
    document.getElementById('a-img').src = data.profile_path ? `https://image.tmdb.org/t/p/w300${data.profile_path}` : 'https://via.placeholder.com/300x450?text=No+Image';
    
    // Setup Meta Tags (Birthday, Birthplace)
    const metaBox = document.getElementById('a-meta');
    metaBox.innerHTML = '';
    if (data.birthday) metaBox.innerHTML += `<div class="meta-tag-item"><strong>Born:</strong> ${data.birthday}</div>`;
    if (data.place_of_birth) metaBox.innerHTML += `<div class="meta-tag-item"><i class="ri-map-pin-line"></i> ${data.place_of_birth}</div>`;

    // Setup Expandable Biography
    setupExpandableText('a-bio', data.biography, 'a-bio-btn');
    
    const grid = document.getElementById('a-films'); 
    
    // Populate ALL movies (limit and poster filter removed!)
    data.combined_credits.cast
        .filter(m => m.media_type === 'movie') // Only get movies (ignore TV shows)
        .sort((a, b) => b.popularity - a.popularity)
        .forEach(f => {
            const d = document.createElement('div'); 
            
            // If the movie has no poster, use a fallback image so it still looks clean
            const posterImg = f.poster_path 
                ? `https://image.tmdb.org/t/p/w154${f.poster_path}` 
                : `https://via.placeholder.com/154x231/1b1c22/9ca3af?text=${encodeURIComponent(f.title)}`;

            d.innerHTML = `<img src="${posterImg}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; cursor:pointer; transition: transform 0.2s;" title="${f.title}" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">`;
            
            // Click to open movie
            d.onclick = () => { 
                modal.style.display = 'none'; 
                openMovieModal(f.id); 
            };
            grid.appendChild(d);
        });
}

// --- MODAL UTILITY FUNCTIONS ---

// Closes the modal if the user clicks outside the content area
function closeModal(e, id) { 
    if(e.target.id === id) {
        // Ensure we clean up theater mode and stop video if closed by clicking outside
        closeVideoModal();
    }
}

// Finds the trailer, plays it, and turns on Ambient Theater Mode
function playBestTrailer() {
    const v = currentVideos.find(x => x.type === 'Trailer') || currentVideos[0];
    
    if(v) { 
        document.getElementById('m-hero').style.display = 'none'; 
        document.getElementById('m-video-container').style.display = 'flex'; 
        document.getElementById('m-video-player').src = `https://www.youtube.com/embed/${v.key}?autoplay=1`; 
        
        // --- FEATURE: Ambient Theater Mode ---
        // 1. Add the class to dim the rest of the modal
        document.getElementById('movieModal').classList.add('theater-mode');
        
        // 2. Calculate the glow color based on the movie's primary genre
        const genreId = state.activeMovie.genres && state.activeMovie.genres[0] ? state.activeMovie.genres[0].id : null;
        const glowColor = genreColors[genreId] || '#e50914'; // Default to Netflix red if no genre match
        
        // 3. Apply a massive, soft box-shadow to the video wrapper to create the "Ambilight" effect
        const mediaWrapper = document.querySelector('.media-wrapper');
        if(mediaWrapper) mediaWrapper.style.boxShadow = `0 0 100px ${glowColor}99`; // '99' adds transparency
    } else {
        alert("No trailer available for this movie.");
    }
}

// Stops the video and returns to the movie details (without closing the modal entirely)
function stopTrailer() {
    // 1. Clear the iframe to stop audio/video playback
    document.getElementById('m-video-player').src = ''; 
    
    // 2. Swap the UI back to the hero image
    document.getElementById('m-hero').style.display = 'block'; 
    document.getElementById('m-video-container').style.display = 'none'; 
    
    // 3. Disable Theater Mode Features
    document.getElementById('movieModal').classList.remove('theater-mode');
    const mediaWrapper = document.querySelector('.media-wrapper');
    if(mediaWrapper) mediaWrapper.style.boxShadow = 'none';
}

// Closes the entire modal completely
function closeVideoModal() { 
    // First, stop the video and reset the UI
    stopTrailer();
    
    // Then, hide the entire modal
    document.getElementById('movieModal').style.display = 'none'; 
}

// Adds or removes the active movie from the user's favorites list
function toggleFav() {
    const idx = state.favorites.findIndex(m => m.id === state.activeMovie.id);
    
    if(idx === -1) {
        state.favorites.push(state.activeMovie); 
    } else {
        state.favorites.splice(idx, 1);
    }
    
    // Save to local storage
    localStorage.setItem('athul_favs', JSON.stringify(state.favorites)); 
    updateFavBtn();
}

// Updates the favorites button text and icon 
function updateFavBtn() {
    if (!state.activeMovie) return;
    
    const isFav = state.favorites.some(m => m.id === state.activeMovie.id);
    document.getElementById('m-fav-text').innerText = isFav ? 'Remove' : 'Add';
    document.getElementById('m-fav-icon').className = isFav ? 'ri-heart-fill' : 'ri-heart-add-line';
}


// ==========================================
// 6. USER PROFILES & BADGES
// ==========================================

// --- RENDER PROFILE DASHBOARD ---
function renderProfileView() {
    const hist = state.watchHistory;
    
    // Update basic stats
    document.getElementById('stat-watched').innerText = hist.length;
    
    // Calculate total runtime and average rating
    const totalMins = hist.reduce((acc, m) => acc + (m.runtime || 0), 0);
    document.getElementById('stat-total-runtime').innerText = `${Math.floor(totalMins / 60)}h`;
    
    const avgRating = hist.length > 0 ? (hist.reduce((acc, m) => acc + (m.vote_average || 0), 0) / hist.length).toFixed(1) : "-";
    document.getElementById('stat-avg-rating').innerText = avgRating;
    
    // --- FEATURE 1: Achievement Badges System ---
    const badgesContainer = document.getElementById('badge-grid');
    badgesContainer.innerHTML = '';
    
    // Define the badges and the logic required to unlock them
    const badges = [
        { id: 'critic', name: 'The Critic', icon: 'ri-star-smile-fill', desc: 'Watch 5 movies', unlocked: hist.length >= 5 },
        { id: 'potato', name: 'Couch Potato', icon: 'ri-sofa-fill', desc: 'Watch 10+ hours', unlocked: totalMins >= 600 },
        { id: 'horror', name: 'Scream Fan', icon: 'ri-ghost-fill', desc: 'Watch a Horror movie', unlocked: hist.some(m => m.genres && m.genres.includes('Horror')) },
        { id: 'action', name: 'Adrenaline', icon: 'ri-fire-fill', desc: 'Watch an Action movie', unlocked: hist.some(m => m.genres && m.genres.includes('Action')) }
    ];
    
    // Render the badges
    badges.forEach(b => {
        badgesContainer.innerHTML += `
            <div class="badge ${b.unlocked ? 'unlocked' : ''}" title="${b.desc}">
                <i class="${b.icon}"></i>
                <span style="font-size:0.75rem; font-weight:bold;">${b.name}</span>
            </div>
        `;
    });

    // --- RENDER WATCH HISTORY ---
    const hGrid = document.getElementById('watch-history-grid'); 
    hGrid.innerHTML = '';
    // Use .slice().reverse() to show the most recently watched movies first
    hist.slice().reverse().forEach(m => {
        const d = document.createElement('div'); 
        d.className = 'history-card';
        d.onclick = () => openMovieModal(m.id);
        d.innerHTML = `<img src="https://image.tmdb.org/t/p/w154${m.poster_path}" title="${m.title}">`;
        hGrid.appendChild(d);
    });

    // --- RENDER MIXTAPES (SHAREABLE) ---
    const tGrid = document.getElementById('mixtape-list'); 
    tGrid.innerHTML = '';
    state.mixtapes.forEach(tape => {
        const d = document.createElement('div'); 
        d.className = 'history-card';
        d.style.background = 'var(--accent)'; 
        d.style.padding = '10px'; 
        d.style.display = 'flex'; 
        d.style.flexDirection = 'column'; 
        d.style.alignItems = 'center'; 
        d.style.justifyContent = 'center'; 
        d.style.textAlign = 'center'; 
        
        // Encode the movies array into a URL-safe string for sharing
        const sharedData = encodeURIComponent(JSON.stringify(tape.movies));
        const shareUrl = `${window.location.origin}${window.location.pathname}?shared_tape=${sharedData}`;

        d.innerHTML = `
            <strong>${tape.name}</strong>
            <small style="margin-bottom:0.5rem;">${tape.movies.length} Items</small>
            <button class="btn-secondary" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="event.stopPropagation(); navigator.clipboard.writeText('${shareUrl}'); alert('Link copied to clipboard! Share it with friends.');">
                <i class="ri-share-line"></i> Share
            </button>
        `;
        
        // Clicking the card itself alerts the list of movies
        d.onclick = () => alert(`${tape.name}:\n${tape.movies.map(m=>m.title).join('\n')}`);
        tGrid.appendChild(d);
    });
}

function clearHistory(type) { 
    if(confirm('Clear watch history?')) { 
        localStorage.setItem('athul_watch', '[]'); 
        state.watchHistory = []; 
        renderProfileView(); 
    } 
}

// --- MIXTAPE UTILITIES ---
function createMixtape() {
    const name = prompt("Name your mixtape (e.g., 'Date Night'):");
    if(name) { 
        state.mixtapes.push({name, movies:[]}); 
        localStorage.setItem('athul_mixtapes', JSON.stringify(state.mixtapes)); 
        renderProfileView(); 
    }
}

function addToMixtapeCurrent() {
    if(!state.mixtapes.length) return alert("Please create a mixtape in your Profile first!");
    
    // Ask the user which mixtape to add the current movie to
    const listChoices = state.mixtapes.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
    const choice = prompt(`Add '${state.activeMovie.title}' to which list (1-${state.mixtapes.length})?\n` + listChoices);
    
    const idx = parseInt(choi// --- FUNNY SEAT GAME & BANANA STASH ---
function getBananaBalance() {
    const today = new Date().toDateString();
    let lastDate = localStorage.getItem('athul_banana_date');
    let balance = parseInt(localStorage.getItem('athul_banana_balance'));

    // Reset to 1000 daily
    if (lastDate !== today || isNaN(balance)) {
        balance = 1000; 
        localStorage.setItem('athul_banana_date', today);
        localStorage.setItem('athul_banana_balance', balance);
    }
    return balance;
}

function openBookingModal() {
    document.getElementById('bookingModal').style.display = 'flex';
    document.getElementById('booking-selection-view').style.display = 'block';
    document.getElementById('booking-ticket-view').style.display = 'none';
    
    const grid = document.getElementById('seats-grid'); 
    grid.innerHTML = ''; 
    selectedSeats = []; 
    
    document.getElementById('b-title').innerText = state.activeMovie.title;
    
    // UPDATED ID: from wallet-balance to banana-stash
    document.getElementById('banana-stash').innerText = getBananaBalance();
    updatePoints(); // UPDATED function call

    // Generate 48 random seats
    for(let i=0; i<48; i++) {
        const s = document.createElement('div'); 
        s.className = 'seat';
        
        // 30% chance a seat is taken by a funny character
        if(Math.random() < 0.3) { 
            s.classList.add('occupied'); 
            s.title = funnyOccupants[Math.floor(Math.random() * funnyOccupants.length)]; 
            s.onclick = () => alert(`Seat taken by ${s.title}`); 
        } else { 
            s.classList.add('available'); 
            s.onclick = () => { 
                s.classList.toggle('selected'); 
                if(s.classList.contains('selected')) selectedSeats.push(i); 
                else selectedSeats.splice(selectedSeats.indexOf(i), 1); 
                updatePoints(); // UPDATED function call
            } 
        }
        grid.appendChild(s);
    }
}

// UPDATED function name: from updatePrice to updatePoints
function updatePoints() { 
    // UPDATED ID: from total-price to total-points
    document.getElementById('total-points').innerText = `${selectedSeats.length * TICKET_PRICE} 🍌`; 
}

function confirmBooking() {
    if(!selectedSeats.length) return alert("Pick a seat! Are you going to sit on the floor?");
    
    // UPDATED variable name: from cost to pointsNeeded
    const pointsNeeded = selectedSeats.length * TICKET_PRICE;
    let balance = getBananaBalance();

    if (pointsNeeded > balance) {
        // UPDATED: Removed "Payment Failed"
        alert(`Not enough bananas! You need ${pointsNeeded} 🍌 to unlock these seats, but you only have ${balance} 🍌 left today! Come back tomorrow.`);
        return;
    }

    // Deduct Bananas
    balance -= pointsNeeded;
    localStorage.setItem('athul_banana_balance', balance);
    
    // Switch to Digital Ticket View
    document.getElementById('booking-selection-view').style.display = 'none';
    document.getElementById('booking-ticket-view').style.display = 'block';
    
    document.getElementById('t-movie-title').innerText = state.activeMovie.title;
    document.getElementById('t-date').innerText = new Date().toLocaleDateString();
    
    // Map array indices to fake seat numbers (Row A-F, Col 1-8)
    const seatNames = selectedSeats.map(index => {
        const row = String.fromCharCode(65 + Math.floor(index / 8));
        const col = (index % 8) + 1;
        return `${row}${col}`;
    }).join(', ');
    
    document.getElementById('t-seats').innerText = seatNames;
    
    // UPDATED ID: from t-paid to t-points-used
    document.getElementById('t-points-used').innerText = `${pointsNeeded} 🍌`;
      }
                                        ce) - 1;
    if(state.mixtapes[idx]) { 
        state.mixtapes[idx].movies.push({id: state.activeMovie.id, title: state.activeMovie.title}); 
        localStorage.setItem('athul_mixtapes', JSON.stringify(state.mixtapes)); 
        alert("Added to playlist!"); 
    }
}
// ==========================================
// 7. INTERACTIVE MINI-GAMES & FEATURES
// ==========================================



// --- COMPARE MODE ---
async function addToCompare(id) {
    if(compareList.length >= 2) compareList = []; // Reset if full
    
    const res = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}`); 
    const m = await res.json();
    compareList.push(m);
    
    if(compareList.length === 1) {
        alert(`Selected ${m.title}. Pick another movie to compare!`);
    } else {
        openCompareModal();
    }
}

function openCompareModal() {
    const [m1, m2] = compareList;
    const h = `
        <div class="compare-modal" onclick="this.remove()">
            <div class="compare-content">
                <div class="c-col">
                    <img src="https://image.tmdb.org/t/p/w300${m1.poster_path}">
                    <h3>${m1.title}</h3>
                    <p class="${m1.vote_average > m2.vote_average ? 'win' : ''}">⭐ ${m1.vote_average}</p>
                    <p class="${m1.revenue > m2.revenue ? 'win' : ''}">💰 $${(m1.revenue/1e6).toFixed(0)}M</p>
                </div>
                <div class="c-vs">VS</div>
                <div class="c-col">
                    <img src="https://image.tmdb.org/t/p/w300${m2.poster_path}">
                    <h3>${m2.title}</h3>
                    <p class="${m2.vote_average > m1.vote_average ? 'win' : ''}">⭐ ${m2.vote_average}</p>
                    <p class="${m2.revenue > m1.revenue ? 'win' : ''}">💰 $${(m2.revenue/1e6).toFixed(0)}M</p>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', h); 
    compareList = []; // Clear queue
}

// --- CINE-TRIVIA GAME ---
function startTrivia() { 
    document.getElementById('triviaModal').style.display = 'flex'; 
    tScore = 0; 
    document.getElementById('trivia-score').innerText = tScore; 
    nextQuestion(); 
}

async function nextQuestion() {
    document.getElementById('trivia-result').style.display = 'none'; 
    document.getElementById('t-options').innerHTML = ''; 
    document.getElementById('t-question').innerText = "Loading...";
    
    const res = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&page=${Math.floor(Math.random()*10)+1}`);
    const data = await res.json();
    const movies = data.results.sort(() => 0.5 - Math.random()).slice(0, 4);
    const correct = movies[0]; 
    tAns = correct.id;
    
    document.getElementById('t-question').innerText = `Which movie was released in ${correct.release_date.split('-')[0]}?`;
    
    movies.sort(() => 0.5 - Math.random()).forEach(m => {
        const b = document.createElement('button'); 
        b.className = 'trivia-btn'; 
        b.innerText = m.title;
        b.onclick = () => { 
            if(m.id === tAns) { 
                b.classList.add('correct'); 
                tScore += 10; 
                document.getElementById('t-result-msg').innerText = "🎉 Correct!"; 
            } else { 
                b.classList.add('wrong'); 
                document.getElementById('t-result-msg').innerText = "❌ Wrong!"; 
            }
            document.querySelectorAll('.trivia-btn').forEach(btn => btn.disabled = true);
            document.getElementById('trivia-score').innerText = tScore; 
            document.getElementById('trivia-result').style.display = 'block';
        };
        document.getElementById('t-options').appendChild(b);
    });
}

// --- MOVIE ROULETTE ---
async function openRoulette() {
    document.getElementById('rouletteModal').style.display = 'flex';
    document.getElementById('roulette-watch-btn').style.display = 'none';
    document.getElementById('roulette-title').innerText = "Click Spin!";
    document.getElementById('roulette-poster').src = "https://via.placeholder.com/300x450/1b1c22/ffffff?text=Ready?";
    
    // Pre-fetch a list of popular movies to spin through
    if(rouletteMovies.length === 0) {
        const res = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&page=${Math.floor(Math.random()*5)+1}`);
        const data = await res.json();
        rouletteMovies = data.results.filter(m => m.poster_path);
    }
}

function spinRoulette() {
    if(rouletteMovies.length === 0) return;
    const btn = document.getElementById('spin-btn');
    const poster = document.getElementById('roulette-poster');
    const title = document.getElementById('roulette-title');
    const watchBtn = document.getElementById('roulette-watch-btn');
    
    btn.disabled = true;
    watchBtn.style.display = 'none';
    poster.classList.add('spin-blur');
    
    let spins = 0;
    const maxSpins = 30; // Number of flashes
    const speed = 80;    // MS per flash
    
    const spinInterval = setInterval(() => {
        const randomMovie = rouletteMovies[Math.floor(Math.random() * rouletteMovies.length)];
        poster.src = `https://image.tmdb.org/t/p/w300${randomMovie.poster_path}`;
        title.innerText = randomMovie.title;
        spins++;
        
        if (spins >= maxSpins) {
            clearInterval(spinInterval);
            poster.classList.remove('spin-blur');
            btn.disabled = false;
            btn.innerText = "SPIN AGAIN";
            watchBtn.style.display = 'flex';
            rouletteWinnerId = randomMovie.id;
            
            // Add a little celebration pop
            poster.style.transform = "scale(1.05)";
            setTimeout(() => poster.style.transform = "scale(1)", 200);
        }
    }, speed);
}

function openRouletteWinner() {
    document.getElementById('rouletteModal').style.display = 'none';
    if(rouletteWinnerId) openMovieModal(rouletteWinnerId);
}

// --- EMOJI DECODER GAME ---
function startEmojiGame() {
    document.getElementById('emojiModal').style.display = 'flex';
    emojiScore = 0;
    document.getElementById('emoji-score').innerText = emojiScore;
    nextEmojiQuestion();
}

function nextEmojiQuestion() {
    document.getElementById('emoji-result').style.display = 'none';
    const qBox = document.getElementById('e-question');
    const optsBox = document.getElementById('e-options');
    optsBox.innerHTML = '';
    
    // Pick random puzzle
    const puzzle = emojiData[Math.floor(Math.random() * emojiData.length)];
    let currentEmojiAns = puzzle.answer;
    qBox.innerText = puzzle.emojis;
    
    // Shuffle options
    const shuffledOpts = puzzle.options.sort(() => 0.5 - Math.random());
    
    shuffledOpts.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'trivia-btn';
        b.innerText = opt;
        b.onclick = () => {
            if(opt === currentEmojiAns) {
                b.classList.add('correct');
                emojiScore += 50;
                document.getElementById('e-result-msg').innerText = "🧠 Genius!";
            } else {
                b.classList.add('wrong');
                document.getElementById('e-result-msg').innerText = `❌ It was ${currentEmojiAns}`;
            }
            document.querySelectorAll('#e-options .trivia-btn').forEach(btn => btn.disabled = true);
            document.getElementById('emoji-score').innerText = emojiScore;
            document.getElementById('emoji-result').style.display = 'block';
        };
        optsBox.appendChild(b);
    });
}
// ==========================================
// 8. UTILITY & THEMING FUNCTIONS
// ==========================================

// --- CINEMA WRAPPED (Year in Review) ---
function generateWrapped() {
    const history = state.watchHistory;
    
    // Require a minimum number of movies to generate a fun report
    if(history.length < 3) {
        alert("Watch a few more movies first to generate your Wrapped!");
        return;
    }
    
    // Calculate total watch time and average rating
    const totalMins = history.reduce((acc, m) => acc + (m.runtime || 100), 0);
    const totalHours = Math.floor(totalMins / 60);
    const avgRating = (history.reduce((acc, m) => acc + (m.vote_average || 0), 0) / history.length).toFixed(1);
    
    // Determine the user's "Title" based on watch time
    let title = "The Casual Watcher";
    if (totalHours > 20) title = "The Cinephile";
    if (totalHours > 50) title = "The Screen Addict";
    
    // Generate a fun fact based on their average ratings
    let fact = `Your average rating is ${avgRating}. You have great taste!`;
    if (avgRating < 6) fact = `An average rating of ${avgRating}... You watch a lot of trash, don't you? 😂`;
    if (avgRating > 8) fact = `An average rating of ${avgRating}. You only watch masterpieces! 👑`;

    // Populate the Wrapped Modal
    document.getElementById('w-title').innerText = title;
    document.getElementById('w-hours').innerText = totalHours;
    document.getElementById('w-movies').innerText = history.length;
    document.getElementById('w-fun-fact').innerText = fact;
    
    // Display the modal
    document.getElementById('wrappedModal').style.display = 'flex';
}

// --- THEMING & UI UTILITIES ---
function toggleTheme() {
    const root = document.documentElement; 
    const isDark = root.getAttribute('data-theme') === 'dark';
    
    // Swap the theme
    root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    
    // Swap the icon on the button
    document.getElementById('theme-icon-btn').innerHTML = isDark 
        ? '<i class="ri-sun-line"></i>' 
        : '<i class="ri-moon-line"></i>';
}

function updateSmartGreeting() {
    // Look at the user's local clock to give a relevant greeting
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "Good Morning!" : hour < 18 ? "Good Afternoon!" : "Good Evening!";
    document.getElementById('dynamic-greeting').innerText = `${timeOfDay} What's your vibe?`;
}

// --- INFINITE SCROLLING ---
function setupInfiniteScroll() { 
    // Listen for when the user scrolls
    window.addEventListener('scroll', () => { 
        // If they are within 500 pixels of the bottom of the page, load the next page of movies!
        if(window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
            // Only trigger if we aren't currently fetching to prevent duplicate pages
            if (!state.fetching) {
                state.page += 1; // Increment the page number
                loadMovies(true); // 'true' tells the function to append, not replace
            }
        } 
    }); 
}

// --- DROPDOWN OUTSIDE CLICK ---
function setupOutsideClick() { 
    // Closes custom dropdown menus (like Genres or Sorting) if the user clicks anywhere else on the screen
    document.addEventListener('click', e => { 
        if(!e.target.closest('.custom-select-wrapper')) {
            document.querySelectorAll('.select-options').forEach(dropdown => {
                dropdown.style.display = 'none';
            });
        }
    }); 
}

// --- RANDOM MOVIE BUTTON (Easter Egg) ---
function surpriseMe() {
    const btn = document.querySelector('.nav-actions .theme-btn:last-child');
    btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i>';
    
    // Fetch a random page of top-rated movies and pick one randomly
    fetch(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}&page=${Math.floor(Math.random()*10)+1}`)
        .then(r => r.json())
        .then(d => {
            const randomMovie = d.results[Math.floor(Math.random() * d.results.length)];
            openMovieModal(randomMovie.id);
            btn.innerHTML = '<i class="ri-dice-line"></i>';
        });
}

function toggleDropdown(id, triggerElement) { 
    const el = document.getElementById(id); 
    el.style.display = el.style.display === 'block' ? 'none' : 'block'; 
}
// ==========================================
// 9. ADVANCED INTERACTIVE MODELS
// ==========================================

// --- DRAG AND DROP WATCHLIST ---
function renderDraggableWatchlist() {
    const grid = document.getElementById('grid');
    grid.innerHTML = '<div class="tier-list-header">DRAG & DROP TO RANK YOUR FAVORITES</div>';
    
    state.favorites.forEach((m, index) => {
        const el = document.createElement('div');
        el.className = 'movie-card draggable';
        el.draggable = true;
        el.dataset.index = index;
        
        el.innerHTML = `
          <div class="poster-container"><img src="https://image.tmdb.org/t/p/w300${m.poster_path}">
            <div style="position:absolute; top:5px; left:5px; background:var(--accent); color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; z-index:10;">#${index + 1}</div>
          </div>
          <div class="card-content"><h3 class="card-title">${m.title}</h3></div>
        `;
        
        // Drag Events
        let draggedIdx = null;
        el.addEventListener('dragstart', function(e) {
            draggedIdx = parseInt(this.dataset.index);
            e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('dragover', function(e) {
            e.preventDefault(); 
            this.classList.add('drag-over');
        });
        el.addEventListener('dragleave', function() {
            this.classList.remove('drag-over');
        });
        el.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            const targetIdx = parseInt(this.dataset.index);
            
            if(draggedIdx !== null && draggedIdx !== targetIdx) {
                // Swap the items in the array
                const movedItem = state.favorites.splice(draggedIdx, 1)[0];
                state.favorites.splice(targetIdx, 0, movedItem);
                localStorage.setItem('athul_favs', JSON.stringify(state.favorites));
                renderDraggableWatchlist(); // Re-render instantly
            }
        });
        
        // Click to view (if not dragging)
        el.onclick = () => openMovieModal(m.id);
        grid.appendChild(el);
    });
}

// --- FRAME BY FRAME GAME ---
let currentFrameAns = null;
function startFrameGame() {
    document.getElementById('frameModal').style.display = 'flex';
    nextFrame();
}

async function nextFrame() {
    document.getElementById('frame-result').style.display = 'none';
    const imgBox = document.getElementById('frame-image');
    const optsBox = document.getElementById('frame-options');
    optsBox.innerHTML = '';
    
    // Reset Image Blur
    imgBox.style.transition = 'none';
    imgBox.style.filter = 'blur(40px)';
    
    // Fetch random popular movies
    const res = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&page=${Math.floor(Math.random()*15)+1}`);
    const data = await res.json();
    const movies = data.results.filter(m => m.backdrop_path).sort(() => 0.5 - Math.random()).slice(0, 4);
    
    const correct = movies[0];
    currentFrameAns = correct.id;
    imgBox.src = `https://image.tmdb.org/t/p/w780${correct.backdrop_path}`;
    
    // Animate the blur clearing up over 6 seconds
    setTimeout(() => {
        imgBox.style.transition = 'filter 6s ease-out';
        imgBox.style.filter = 'blur(0px)';
    }, 100);

    movies.sort(() => 0.5 - Math.random()).forEach(m => {
        const b = document.createElement('button');
        b.className = 'trivia-btn';
        b.innerText = m.title;
        b.onclick = () => {
            imgBox.style.transition = 'filter 0.5s'; imgBox.style.filter = 'blur(0px)'; // Instantly clear
            if(m.id === currentFrameAns) {
                b.classList.add('correct');
                document.getElementById('f-result-msg').innerText = "🦅 Eagle Eyes! Correct!";
            } else {
                b.classList.add('wrong');
                document.getElementById('f-result-msg').innerText = `❌ It was ${correct.title}`;
            }
            document.querySelectorAll('#frame-options .trivia-btn').forEach(btn => btn.disabled = true);
            document.getElementById('frame-result').style.display = 'block';
        };
        optsBox.appendChild(b);
    });
}

// --- SIX DEGREES OF CINEMA ---
async function startSixDegrees() {
    // Pick a random target actor (Morgan Freeman, Tom Hanks, etc.)
    const targets = [{id: 192, name: "Morgan Freeman"}, {id: 31, name: "Tom Hanks"}, {id: 287, name: "Brad Pitt"}, {id: 1245, name: "Scarlett Johansson"}];
    const target = targets[Math.floor(Math.random() * targets.length)];
    
    sdTargetId = target.id;
    sdTargetName = target.name;
    sdClicks = 0;
    sdActive = true;
    
    const hud = document.getElementById('six-degrees-hud');
    hud.style.display = 'block';
    document.getElementById('sd-target').innerText = sdTargetName;
    document.getElementById('sd-clicks').innerText = sdClicks;
    
    alert(`Game Started!\nFind your way to ${sdTargetName} by clicking through movie casts.\nGo!`);
}

function stopSixDegrees() {
    sdActive = false;
    document.getElementById('six-degrees-hud').style.display = 'none';
}

// UPDATE EVENT LISTENER FOR SIX DEGREES (Hooks into existing modal clicks)
document.addEventListener('click', (e) => {
    // If we click an actor item or movie card while game is active, increase clicks
    if (sdActive && (e.target.closest('.cast-item') || e.target.closest('.movie-card') || e.target.closest('.history-card'))) {
        sdClicks++;
        document.getElementById('sd-clicks').innerText = sdClicks;
    }
    
    // Check win condition (if an actor modal opens and it's the target)
    if (sdActive && document.getElementById('actorModal').style.display === 'flex') {
        const currentActorName = document.getElementById('a-name').innerText;
        if (currentActorName === sdTargetName) {
            setTimeout(() => {
                alert(`🎉 YOU WIN! You connected to ${sdTargetName} in ${sdClicks} clicks!\n1,000 🍌 added to your wallet!`);
                let bal = parseInt(localStorage.getItem('athul_banana_balance') || 1000) + 1000;
                localStorage.setItem('athul_banana_balance', bal);
                stopSixDegrees();
            }, 500);
        }
    }
});
function updateSmartGreeting() {
    // ... existing code ...
    
    // Set a CSS variable for the actual viewport height (mobile fix)
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Add this listener to handle screen rotations
window.addEventListener('resize', updateSmartGreeting);
