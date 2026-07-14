// Global state to store loaded data and active chart instances
let dashboardData = null;
let charts = {};

// Colors mapping matching the CSS style variables
const colors = {
    Positive: '#10b981',
    Negative: '#ef4444',
    Neutral: '#f59e0b',
    Irrelevant: '#06b6d4'
};

// Tweet Explorer variables
let explorerPage = 1;
const tweetsPerPage = 6;
let filteredTweets = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialise tab navigation
    initNavigation();
    
    // 2. Fetch the JSON metrics
    fetch('sentiment_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load sentiment data file');
            }
            return response.json();
        })
        .then(data => {
            dashboardData = data;
            
            // Populate select lists and brands comparison tables
            populateFilters();
            buildBrandTable();
            
            // Build the initial charts
            createCharts();
            
            // Set up event listeners for filters
            setupEventListeners();
            
            // Load initial view
            updateDashboard('all');
            filterExplorerTweets();
        })
        .catch(err => {
            console.error('Initialization error:', err);
        });
});

/* --- Tab Switching Navigation --- */
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            
            // Update active nav button
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Update visible content area
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${targetTab}-tab`) {
                    content.classList.add('active');
                }
            });
            
            // Redraw charts if resizing occurred or tab was hidden
            Object.values(charts).forEach(chart => chart.update());
        });
    });
}

/* --- Populate Filter Lists --- */
function populateFilters() {
    const filterSelect = document.getElementById('entity-filter');
    const entities = Object.keys(dashboardData.entities);
    
    entities.forEach(entity => {
        const option = document.createElement('option');
        option.value = entity;
        option.textContent = entity;
        filterSelect.appendChild(option);
    });
}

/* --- Populate Brand Stats Table --- */
function buildBrandTable() {
    const tableBody = document.getElementById('brand-table-body');
    const entities = Object.keys(dashboardData.entities);
    
    entities.forEach(entity => {
        const stats = dashboardData.entities[entity];
        const row = document.createElement('tr');
        
        const total = stats.total;
        const pos = stats.sentiment_counts.Positive || 0;
        const neg = stats.sentiment_counts.Negative || 0;
        const neu = stats.sentiment_counts.Neutral || 0;
        const irr = stats.sentiment_counts.Irrelevant || 0;
        
        row.innerHTML = `
            <td style="font-weight: 600; color: #f8fafc;">${entity}</td>
            <td>${total.toLocaleString()}</td>
            <td style="color: ${colors.Positive}; font-weight: 600;">${((pos / total) * 100).toFixed(1)}%</td>
            <td style="color: ${colors.Negative}; font-weight: 600;">${((neg / total) * 100).toFixed(1)}%</td>
            <td style="color: ${colors.Neutral}; font-weight: 600;">${((neu / total) * 100).toFixed(1)}%</td>
            <td style="color: ${colors.Irrelevant}; font-weight: 600;">${((irr / total) * 100).toFixed(1)}%</td>
            <td>${stats.avg_word_count}</td>
        `;
        tableBody.appendChild(row);
    });
}

/* --- Initialise Chart.js Instances --- */
function createCharts() {
    // A. Doughnut Chart: Overall Sentiment Breakout
    const ctxDoughnut = document.getElementById('sentimentDoughnutChart').getContext('2d');
    charts.sentimentDoughnut = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: ['Positive', 'Negative', 'Neutral', 'Irrelevant'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: [colors.Positive, colors.Negative, colors.Neutral, colors.Irrelevant],
                borderColor: '#1c1f30',
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((val / total) * 100).toFixed(1);
                            return ` ${context.label}: ${val.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    // B. Horizontal Bar Chart: Top Discussion Terms
    const ctxWords = document.getElementById('topWordsChart').getContext('2d');
    charts.topWords = new Chart(ctxWords, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Frequency',
                data: [],
                backgroundColor: 'rgba(59, 130, 246, 0.75)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: '#2e344e' },
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#f8fafc', font: { family: 'Space Grotesk', weight: '500' } }
                }
            }
        }
    });

    // C. Line Chart: Tweet Length Distribution Histogram
    const ctxLength = document.getElementById('lengthDistributionChart').getContext('2d');
    const bins = dashboardData.histograms.bins;
    charts.lengthDistribution = new Chart(ctxLength, {
        type: 'line',
        data: {
            labels: bins.map(b => `${b}-${b + 15}`),
            datasets: [
                {
                    label: 'Positive',
                    data: dashboardData.histograms.data.Positive,
                    borderColor: colors.Positive,
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Negative',
                    data: dashboardData.histograms.data.Negative,
                    borderColor: colors.Negative,
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Neutral',
                    data: dashboardData.histograms.data.Neutral,
                    borderColor: colors.Neutral,
                    backgroundColor: 'rgba(245, 158, 11, 0.05)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Irrelevant',
                    data: dashboardData.histograms.data.Irrelevant,
                    borderColor: colors.Irrelevant,
                    backgroundColor: 'rgba(6, 182, 212, 0.05)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
                }
            },
            scales: {
                x: {
                    grid: { color: '#2e344e' },
                    ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 }
                },
                y: {
                    grid: { color: '#2e344e' },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });

    // D. Brands Sentiment Stacked Bar Comparison Chart
    const ctxBrandComp = document.getElementById('brandComparisonChart').getContext('2d');
    const entities = Object.keys(dashboardData.entities);
    
    // Construct series data
    const datasetPos = [];
    const datasetNeg = [];
    const datasetNeu = [];
    const datasetIrr = [];
    
    entities.forEach(entity => {
        const counts = dashboardData.entities[entity].sentiment_counts;
        const total = dashboardData.entities[entity].total;
        
        datasetPos.push(parseFloat(((counts.Positive || 0) / total * 100).toFixed(1)));
        datasetNeg.push(parseFloat(((counts.Negative || 0) / total * 100).toFixed(1)));
        datasetNeu.push(parseFloat(((counts.Neutral || 0) / total * 100).toFixed(1)));
        datasetIrr.push(parseFloat(((counts.Irrelevant || 0) / total * 100).toFixed(1)));
    });

    charts.brandComparison = new Chart(ctxBrandComp, {
        type: 'bar',
        data: {
            labels: entities,
            datasets: [
                { label: 'Positive', data: datasetPos, backgroundColor: colors.Positive },
                { label: 'Negative', data: datasetNeg, backgroundColor: colors.Negative },
                { label: 'Neutral', data: datasetNeu, backgroundColor: colors.Neutral },
                { label: 'Irrelevant', data: datasetIrr, backgroundColor: colors.Irrelevant }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8' } }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 90, minRotation: 90 }
                },
                y: {
                    stacked: true,
                    grid: { color: '#2e344e' },
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) { return value + '%'; }
                    },
                    max: 100
                }
            }
        }
    });
}

/* --- Update Dashboard (KPIs, Charts) on Filter Change --- */
function updateDashboard(entity) {
    let counts = {};
    let total = 0;
    let avgWords = 0;
    let avgChars = 0;
    let topWords = [];
    
    if (entity === 'all') {
        // Overall global dashboard state
        counts = dashboardData.overall.sentiment_counts;
        total = dashboardData.overall.total_tweets;
        avgWords = dashboardData.overall.avg_word_count;
        avgChars = dashboardData.overall.avg_char_length;
        
        // Aggregate top words across all sentiments
        const wordCounter = {};
        Object.keys(dashboardData.top_words).forEach(sent => {
            dashboardData.top_words[sent].forEach(item => {
                wordCounter[item.word] = (wordCounter[item.word] || 0) + item.count;
            });
        });
        topWords = Object.keys(wordCounter)
            .map(word => ({ word: word, count: wordCounter[word] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
            
    } else {
        // Specific brand entity state
        const entityStats = dashboardData.entities[entity];
        counts = entityStats.sentiment_counts;
        total = entityStats.total;
        avgWords = entityStats.avg_word_count;
        
        // Character length estimation for selected entity
        avgChars = Math.round(avgWords * 5.2);
        
        // Extract top words by matching sample tweets for this entity
        const wordCounter = {};
        dashboardData.sample_tweets
            .filter(t => t.entity === entity)
            .forEach(t => {
                const words = t.text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
                words.forEach(w => {
                    if (w.length > 3 && !['game', 'play', 'like', 'good', 'with', 'this', 'that', 'they', 'them', 'some'].includes(w)) {
                        wordCounter[w] = (wordCounter[w] || 0) + 1;
                    }
                });
            });
        
        topWords = Object.keys(wordCounter)
            .map(w => ({ word: w, count: wordCounter[w] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
            
        // If sample tweets didn't produce enough words, fall back to global
        if (topWords.length < 5) {
            topWords = dashboardData.top_words.Positive.slice(0, 10);
        }
    }
    
    // 1. Update KPI Values
    document.getElementById('kpi-total').textContent = total.toLocaleString();
    
    const posVal = counts.Positive || 0;
    const posPct = total > 0 ? ((posVal / total) * 100).toFixed(1) : 0;
    document.getElementById('kpi-positive').textContent = `${posPct}%`;
    document.getElementById('kpi-positive-count').textContent = `${posVal.toLocaleString()} positive tweets`;
    
    const negVal = counts.Negative || 0;
    const negPct = total > 0 ? ((negVal / total) * 100).toFixed(1) : 0;
    document.getElementById('kpi-negative').textContent = `${negPct}%`;
    document.getElementById('kpi-negative-count').textContent = `${negVal.toLocaleString()} negative tweets`;
    
    document.getElementById('kpi-length').textContent = `${avgWords} words`;
    document.getElementById('kpi-char-length').textContent = `${avgChars} chars avg`;
    
    // 2. Update Doughnut Chart
    charts.sentimentDoughnut.data.datasets[0].data = [
        counts.Positive || 0,
        counts.Negative || 0,
        counts.Neutral || 0,
        counts.Irrelevant || 0
    ];
    charts.sentimentDoughnut.update();
    
    // 3. Update Horizontal Words Bar Chart
    charts.topWords.data.labels = topWords.map(w => w.word);
    charts.topWords.data.datasets[0].data = topWords.map(w => w.count);
    charts.topWords.update();
}

/* --- Tweet Explorer Filtering and Pagination --- */
function filterExplorerTweets() {
    const selectedBrand = document.getElementById('entity-filter').value;
    const selectedSentiment = document.getElementById('explorer-sentiment').value;
    const searchQuery = document.getElementById('explorer-search').value.toLowerCase().trim();
    
    explorerPage = 1;
    
    filteredTweets = dashboardData.sample_tweets.filter(tweet => {
        // Apply Brand filter
        if (selectedBrand !== 'all' && tweet.entity !== selectedBrand) return false;
        
        // Apply Sentiment filter
        if (selectedSentiment !== 'all' && tweet.sentiment !== selectedSentiment) return false;
        
        // Apply Search filter
        if (searchQuery !== '' && !tweet.text.toLowerCase().includes(searchQuery)) return false;
        
        return true;
    });
    
    renderExplorerTweets();
}

function renderExplorerTweets() {
    const listContainer = document.getElementById('tweets-list');
    listContainer.innerHTML = '';
    
    const matchCountEl = document.getElementById('explorer-match-count');
    matchCountEl.textContent = `Showing ${filteredTweets.length.toLocaleString()} matching tweets`;
    
    const totalPages = Math.max(1, Math.ceil(filteredTweets.length / tweetsPerPage));
    document.getElementById('page-num-indicator').textContent = `Page ${explorerPage} of ${totalPages}`;
    
    // Enable/disable page buttons
    document.getElementById('prev-page-btn').disabled = (explorerPage === 1);
    document.getElementById('next-page-btn').disabled = (explorerPage === totalPages);
    
    if (filteredTweets.length === 0) {
        listContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dark); border: 1px dashed var(--border-color); border-radius: 8px;">
                No tweets match the selected filters.
            </div>
        `;
        return;
    }
    
    const startIndex = (explorerPage - 1) * tweetsPerPage;
    const endIndex = Math.min(startIndex + tweetsPerPage, filteredTweets.length);
    
    const pageTweets = filteredTweets.slice(startIndex, endIndex);
    
    pageTweets.forEach(tweet => {
        const card = document.createElement('div');
        card.className = 'tweet-card';
        
        const sentimentClass = tweet.sentiment.toLowerCase();
        
        card.innerHTML = `
            <div class="tweet-meta-row">
                <span class="tweet-entity">${tweet.entity}</span>
                <span class="tweet-sentiment-badge ${sentimentClass}">${tweet.sentiment}</span>
            </div>
            <p class="tweet-text">"${tweet.text}"</p>
            <div class="tweet-footer">
                <span>ID: #${tweet.id} &bull; Length: ${tweet.char_length} chars</span>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

/* --- Setup Event Listeners --- */
function setupEventListeners() {
    // 1. Top Navbar filter updates dashboard and explorer
    document.getElementById('entity-filter').addEventListener('change', (e) => {
        updateDashboard(e.target.value);
        filterExplorerTweets();
    });
    
    // 2. Explorer controls
    document.getElementById('explorer-sentiment').addEventListener('change', () => {
        filterExplorerTweets();
    });
    
    document.getElementById('explorer-search').addEventListener('input', () => {
        filterExplorerTweets();
    });
    
    document.getElementById('reset-explorer-btn').addEventListener('click', () => {
        document.getElementById('explorer-sentiment').value = 'all';
        document.getElementById('explorer-search').value = '';
        filterExplorerTweets();
    });
    
    // Pagination buttons
    document.getElementById('prev-page-btn').addEventListener('click', () => {
        if (explorerPage > 1) {
            explorerPage--;
            renderExplorerTweets();
        }
    });
    
    document.getElementById('next-page-btn').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredTweets.length / tweetsPerPage);
        if (explorerPage < totalPages) {
            explorerPage++;
            renderExplorerTweets();
        }
    });
}
