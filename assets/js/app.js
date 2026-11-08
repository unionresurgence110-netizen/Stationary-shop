/* ==========================================================
   OM RIDHI SIDHI — FULL STACK STOREFRONT
   Frontend application
   ========================================================== */

const API_BASE = 'https://om-ridhi-sidhi.onrender.com/api';
const TOKEN_KEY = 'ors-auth-token';
const THEME_KEY = 'ors-theme';

const DEFAULTS = {
    name: 'OM RIDHI SIDHI',
    suffix: 'GENERAL STORE',
    motto: 'Little things. Big smiles.',
    phone: '',
    address: '',
    email: '',
    bannerImage: 'assets/images/shop-banner.png',
    aboutImage: '',
    description: 'Your neighbourhood store for everyday essentials.',
    socials: {}
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const path = location.pathname;
const inSub = /\/(pages|customer|owner)\//.test(path);
const root = inSub ? '../' : '';
const link = p => root + p;

const icon = name => `<i data-lucide="${name}"></i>`;

function socialBrandIcon(name) {
    const paths = {
        instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6" r=".8" fill="currentColor"/>',
        facebook: '<path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v5h4v-5h3l1-4h-4V9c0-.7.3-1 1-1z" fill="currentColor" stroke="none"/>',
        whatsapp: '<path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 3 2.5 5 5.5 5.5l1-1.4-2-1-1 1c-1-.4-1.7-1.1-2.1-2.1l1-1-1-2Z" fill="currentColor" stroke="none"/>',
        tiktok: '<path d="M14 4v10.5a4 4 0 1 1-4-4M14 4c.5 3 2.2 4.7 5 5"/>'
    };
    const key = String(name||'').toLowerCase();
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[key]||'<circle cx="12" cy="12" r="8"/>'}</svg>`;
}

const safe = value =>
    String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));

const money = value =>
    'Rs. ' + Number(value || 0).toLocaleString('en-IN');

let cfg = { ...DEFAULTS };
let currentUser = null;
let products = [];
let categories = [];
let favourites = [];
let notices = [];

const getToken = () => localStorage.getItem(TOKEN_KEY);

function getTokenUser() {
    const token = getToken();
    if (!token) return null;

    try {
        const payload = JSON.parse(
            atob(
                token.split('.')[1]
                    .replace(/-/g, '+')
                    .replace(/_/g, '/')
            )
        );

        if (payload.exp && Date.now() / 1000 >= payload.exp) return null;

        return payload;
    } catch {
        return null;
    }
}

const signedIn = () => Boolean(getToken());
const isOwner = () => currentUser?.role === 'admin';

async function api(endpoint, options = {}) {
    const headers = { ...(options.headers || {}) };

    if (getToken()) {
        headers.Authorization = `Bearer ${getToken()}`;
    }

    let body = options.body;

    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
    }

    const response = await fetch(API_BASE + endpoint, {
        ...options,
        headers,
        body
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 401 && getToken()) {
            localStorage.removeItem(TOKEN_KEY);
            currentUser = null;
        }

        throw new Error(
            data.error || 'Something went wrong. Please try again.'
        );
    }

    return data;
}

function toast(message, type = 'info') {
    let box = $('#ors-toast');

    if (!box) {
        box = document.createElement('div');
        box.id = 'ors-toast';
        box.className = 'ors-toast';
        document.body.appendChild(box);
    }

    box.textContent = message;
    box.dataset.type = type;
    box.classList.add('show');

    clearTimeout(window.orsToastTimer);
    window.orsToastTimer = setTimeout(
        () => box.classList.remove('show'),
        3500
    );
}


// Replace browser-native validation bubbles with the storefront's own message.
document.addEventListener('invalid', event => {
    event.preventDefault();
    const field = event.target;
    let message = 'Please check this field and try again.';
    if (field.validity?.valueMissing) message = 'Please fill in this field.';
    else if (field.validity?.typeMismatch) message = 'Please enter a valid value.';
    else if (field.validity?.tooShort) message = `Please enter at least ${field.minLength} characters.`;
    else if (field.validity?.rangeUnderflow || field.validity?.rangeOverflow) message = 'Please enter a value within the allowed range.';
    toast(message, 'error');
}, true);

function icons() {
    if (window.lucide) window.lucide.createIcons();
}

async function loadSettings() {
    try {
        const data = await api('/public/settings');
        const settings = data.settings || {};

        cfg = {
            ...DEFAULTS,
            ...settings,
            socials: {
                ...DEFAULTS.socials,
                ...(settings.socials || {})
            }
        };
    } catch (error) {
        console.error('Settings:', error.message);
    }
}

async function loadCurrentUser() {
    if (!getToken()) {
        currentUser = null;
        return null;
    }

    try {
        const data = await api('/auth/me');
        currentUser = data.user || null;
        return currentUser;
    } catch (error) {
        const tokenUser = getTokenUser();

        currentUser = tokenUser
            ? {
                id: tokenUser.id,
                role: tokenUser.role
            }
            : null;

        return currentUser;
    }
}

function brandMark() {
    return `
        <span class="brand-mark">
            <i data-lucide="store"></i>
        </span>
    `;
}

function brand() {
    return `
        <a class="brand" href="${link('index.html')}">
            ${brandMark()}
            <span data-shop-name>
                ${safe(cfg.name)}
                <small>${safe(cfg.suffix)}</small>
            </span>
        </a>
    `;
}

function header() {
    return `
        <header class="topbar">
            ${brand()}

            <nav class="icon-nav" aria-label="Main navigation">
                <a class="nav-icon" href="${link('index.html')}"
                   aria-label="Home">${icon('house')}</a>

                <a class="nav-icon" href="${link('pages/products.html')}"
                   aria-label="Products">${icon('shopping-bag')}</a>

                <a class="nav-icon" href="${link('pages/suggestions.html')}"
                   aria-label="Suggestions">${icon('lightbulb')}</a>

                <a class="nav-icon" href="${link('customer/favourites.html')}"
                   aria-label="Favourites">${icon('heart')}</a>

                <a class="nav-icon gift" href="${link('pages/offers.html')}"
                   aria-label="Offers">${icon('gift')}</a>

                 <a class="nav-icon" href="${link(
    isOwner()
        ? 'owner/dashboard.html'
        : signedIn()
            ? 'customer/profile.html'
            : 'customer/login.html'
)}" aria-label="Account">
    ${icon(signedIn() ? 'user-round' : 'log-in')}
</a>

                <button class="nav-icon" type="button" data-theme
                        aria-label="Toggle theme">
                    ${icon('moon')}
                </button>
            </nav>
        </header>
    `;
}

function footer(){
 const tel=cfg.phone.replace(/[^+\d]/g,'');
 const socials=cfg.socials||{};
 const socialItems=[
  ['instagram',socials.instagram,'Instagram'],
  ['facebook',socials.facebook,'Facebook'],
  ['whatsapp',socials.whatsapp,'WhatsApp'],
  ['tiktok',socials.tiktok,'TikTok']
 ].filter(x=>x[1]);
 return `<footer class="footer premium-footer">
  <div class="footer-main premium-footer-main">
   <div class="footer-intro">
    <span class="footer-kicker">WELCOME TO OUR SHOP</span>
    <h2>Little things.<br><span>Big smiles.</span></h2>
    <p>${safe(cfg.description)}</p>
    <a class="footer-explore-btn" href="${link('pages/products.html')}">Explore our collection ${icon('arrow-up-right')}</a>
    ${socialItems.length?`<div class="socials premium-socials">${socialItems.map(([ic,url,label])=>`<a href="${safe(url)}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${socialBrandIcon(ic)}</a>`).join('')}</div>`:''}
   </div>
   <div class="footer-column"><h3>Explore</h3><span class="footer-heading-line"></span>
    <a href="${link('index.html')}">Home</a><a href="${link('pages/products.html')}">Shop Products</a><a href="${link('pages/offers.html')}">Latest Offers</a><a href="${link('pages/suggestions.html')}">Suggestions</a><a href="${link('pages/reviews.html')}">Shop Reviews</a>
   </div>
   <div class="footer-column"><h3>Customer Corner</h3><span class="footer-heading-line"></span>
    <a href="${link('customer/login.html')}">My Account</a><a href="${link('customer/favourites.html')}">My Favourites</a><a href="${link('pages/guides.html')}">How It Works</a><a href="${link('pages/about.html')}">About Our Shop</a><a href="${link('pages/privacy.html')}">Privacy Policy</a>
   </div>
   <div class="footer-column footer-contact"><h3>Get In Touch</h3><span class="footer-heading-line"></span>
    ${cfg.phone?`<div class="footer-contact-item">${icon('phone')}<div><small>Call us</small><a href="tel:${safe(tel)}">${safe(cfg.phone)}</a><button class="copy-phone" type="button" data-copy-phone>Copy number ${icon('copy')}</button></div></div>`:''}
    ${cfg.email?`<div class="footer-contact-item">${icon('mail')}<div><small>Email us</small><a href="mailto:${safe(cfg.email)}">${safe(cfg.email)}</a></div></div>`:''}
    ${cfg.address?`<div class="footer-contact-item">${icon('map-pin')}<div><small>Visit our shop</small><p>${safe(cfg.address)}</p></div></div>`:''}
    <div class="footer-contact-note">${icon('heart')}<span>We look forward to serving you!</span></div>
   </div>
  </div>
  <div class="premium-footer-message"><span class="footer-star">✦</span><p>Making everyday creativity a little more special.</p><span class="footer-star">✦</span></div>
  <div class="footer-bottom premium-footer-bottom"><span>© ${new Date().getFullYear()} ${safe(cfg.name)} ${safe(cfg.suffix)}. All rights reserved.</span><span class="footer-made">Made with <span>♥</span> for creativity</span></div>
 </footer>`;
}

function shell(title, description, content) {
    document.body.innerHTML = `
        ${header()}

        <main class="page-shell">
            <section class="page-heading">
                <span class="eyebrow">${safe(cfg.name)}</span>
                <h1>${safe(title)}</h1>
                <p>${safe(description || '')}</p>
            </section>

            ${content}
        </main>

        ${footer()}
    `;

    bindShared();
    icons();
    return Promise.resolve();
}

function bindShared() {
    $$('[data-theme]').forEach(button => {
        button.addEventListener('click', () => {
            document.body.classList.toggle('dark');

            localStorage.setItem(
                THEME_KEY,
                document.body.classList.contains('dark')
                    ? 'dark'
                    : 'light'
            );
        });
    });

    $$('[data-copy-phone]').forEach(button => {
        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(cfg.phone);
                toast('Phone number copied!');
            } catch {
                toast('Unable to copy phone number.', 'error');
            }
        });
    });
}

function emptyState(title, message, button = '') {
    return `
        <div class="empty empty-large">
            ${icon('package-open')}
            <h2>${safe(title)}</h2>
            <p>${safe(message)}</p>
            ${button}
        </div>
    `;
}

function errorState(error) {
    return `
        <div class="panel">
            <h3>Something went wrong</h3>
            <p>${safe(error.message || error)}</p>
            <button class="btn btn-primary" onclick="location.reload()">
                Try again
            </button>
        </div>
    `;
}

/* ==========================================================
   PART 2 — STOREFRONT AND CUSTOMER FEATURES
   ========================================================== */

function productImage(product) {
    if (product.image_url) {
        return `
            <img src="${safe(product.image_url)}"
                 alt="${safe(product.name)}"
                 loading="lazy">
        `;
    }

    return `<div class="product-placeholder">
        ${icon('package')}
    </div>`;
}

function productCard(product) {
    const liked = Boolean(product.is_liked);
    const favourite = Boolean(product.is_favourite) ||
        favourites.some(item => String(item.id) === String(product.id));
    const description = String(product.description || '').trim();
    const rawTags = Array.isArray(product.manual_tags) ? product.manual_tags : [];
    const tags = rawTags.map(tag => String(tag).trim()).filter(Boolean);
    if (product.manual_featured || product.featured) tags.unshift('Featured');
    if (product.manual_best_seller) tags.unshift('Best Seller');
    if (product.manual_most_liked) tags.unshift('Popular');
    if (product.has_discount) tags.unshift('Offer');
    if (product.created_at && Date.now() - new Date(product.created_at).getTime() < 7 * 86400000) tags.unshift('New');
    const uniqueTags = [...new Set(tags)].slice(0, 3);

    return `
        <article class="product-card" data-product-card
                 data-product-name="${safe(product.name)}"
                 data-product-description="${safe(description)}"
                 data-product-category="${safe(product.category_name || 'General')}"
                 data-product-price="${safe(money(product.price))}">
            <div class="product-image">
                ${productImage(product)}
                <div class="product-badges">
                    <span class="product-category-pill">${safe(product.category_name || 'General')}</span>
                    ${uniqueTags.map(tag => `<span class="product-tag-badge">${safe(tag)}</span>`).join('')}
                </div>
                <button class="heart-btn ${favourite ? 'active' : ''}"
                        data-favourite="${safe(product.id)}"
                        aria-label="${favourite ? 'Remove from favourites' : 'Add to favourites'}"
                        type="button">${icon('heart')}</button>
            </div>
            <div class="product-info">
                <h3>${safe(product.name)}</h3>
                <strong class="product-price">${money(product.price)}</strong>
                <div class="product-card-bottom">
                    <button class="product-reserve-btn"
                            data-reserve="${safe(product.id)}"
                            type="button"
                            ${!product.is_available || Number(product.stock_quantity) <= 0 ? 'disabled' : ''}>
                        Reserve <span>↗</span>
                    </button>
                    <button class="like-btn ${liked ? 'active' : ''}"
                            data-like="${safe(product.id)}"
                            type="button" aria-label="Like product">
                        ${icon('thumbs-up')}
                        <span class="like-count">${Number(product.likes_count || 0)}</span>
                    </button>
                </div>
                <span class="product-details-hint">Tap to view details <span>↗</span></span>
            </div>
        </article>
    `;
}

async function getProducts(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
            query.set(key, value);
        }
    });

    const data = await api('/public/products?' + query.toString());
    return data.products || [];
}

async function getCategories() {
    const data = await api('/public/categories');
    return data.categories || [];
}

async function loadFavourites() {
    if (!signedIn()) {
        favourites = [];
        return;
    }

    try {
        const data = await api('/customer/favourites');
        favourites = data.products || [];
    } catch {
        favourites = [];
    }
}

function openProductDetails(card) {
    let sheet = $('#product-detail-sheet');
    if (!sheet) {
        sheet = document.createElement('div');
        sheet.id = 'product-detail-sheet';
        sheet.className = 'product-sheet-backdrop';
        sheet.innerHTML = `
            <section class="product-sheet" role="dialog" aria-modal="true"
                     aria-labelledby="product-sheet-title">
                <div class="sheet-grabber"></div>
                <button class="sheet-close" type="button" aria-label="Close details">${icon('x')}</button>
                <span class="sheet-category"></span>
                <h2 id="product-sheet-title"></h2>
                <strong class="sheet-price"></strong>
                <p class="sheet-description"></p>
                <button class="btn btn-primary sheet-done" type="button">Done</button>
            </section>`;
        document.body.appendChild(sheet);
        sheet.addEventListener('click', e => {
            if (e.target === sheet || e.target.closest('.sheet-close,.sheet-done')) closeProductDetails();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeProductDetails();
        });
        icons();
    }
    sheet.querySelector('.sheet-category').textContent = card.dataset.productCategory;
    sheet.querySelector('#product-sheet-title').textContent = card.dataset.productName;
    sheet.querySelector('.sheet-price').textContent = card.dataset.productPrice;
    const rawDescription = card.dataset.productDescription || 'No description is available for this product yet.';
    const sentences = rawDescription.match(/[^.!?]+[.!?]?/g) || [rawDescription];
    const compactDescription = rawDescription.length > 190
        ? (sentences[0] || rawDescription).trim()
        : sentences.slice(0, 2).join(' ').trim();
    sheet.querySelector('.sheet-description').textContent = compactDescription;
    sheet.classList.add('is-open');
    document.body.classList.add('sheet-open');
}
function closeProductDetails() {
    $('#product-detail-sheet')?.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
}
function askConfirmation(title, message, confirmLabel = 'Confirm') {
    return new Promise(resolve => {
        let modal = $('#ors-confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ors-confirm-modal';
            modal.className = 'ors-dialog-backdrop';
            modal.innerHTML = `
                <section class="ors-dialog" role="dialog" aria-modal="true">
                    <span class="dialog-icon">${icon('shield-check')}</span>
                    <h2 class="confirm-title"></h2>
                    <p class="confirm-message"></p>
                    <div class="dialog-actions">
                        <button type="button" class="btn btn-light" data-cancel>Cancel</button>
                        <button type="button" class="btn btn-primary" data-confirm>Confirm</button>
                    </div>
                </section>`;
            document.body.appendChild(modal);
        }
        modal.querySelector('.confirm-title').textContent = title;
        modal.querySelector('.confirm-message').textContent = message;
        modal.querySelector('[data-confirm]').textContent = confirmLabel;
        const finish = value => {
            modal.classList.remove('is-open');
            modal.querySelector('[data-cancel]').onclick = null;
            modal.querySelector('[data-confirm]').onclick = null;
            modal.onclick = null;
            resolve(value);
        };
        modal.querySelector('[data-cancel]').onclick = () => finish(false);
        modal.querySelector('[data-confirm]').onclick = () => finish(true);
        modal.onclick = event => { if (event.target === modal) finish(false); };
        modal.classList.add('is-open');
    });
}

function askReservationQuantity() {
    return new Promise(resolve => {
        let modal = $('#reservation-quantity-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'reservation-quantity-modal';
            modal.className = 'ors-dialog-backdrop';
            modal.innerHTML = `
                <form class="ors-dialog" novalidate>
                    <span class="dialog-icon">${icon('shopping-bag')}</span>
                    <h2>Reserve for pickup</h2>
                    <p>How many items would you like to reserve?</p>
                    <label class="field">Quantity
                        <input name="quantity" type="number" min="1" max="30" value="1" inputmode="numeric">
                    </label>
                    <p class="dialog-error" aria-live="polite"></p>
                    <div class="dialog-actions">
                        <button type="button" class="btn btn-light" data-cancel>Cancel</button>
                        <button type="submit" class="btn btn-primary">Continue</button>
                    </div>
                </form>`;
            document.body.appendChild(modal);
        }
        const form = modal.querySelector('form');
        const input = form.elements.quantity;
        const error = modal.querySelector('.dialog-error');
        let settled = false;
        const cancel = event => { event?.preventDefault(); event?.stopPropagation(); finish(null); };
        const finish = value => {
            if (settled) return;
            settled = true;
            modal.classList.remove('is-open');
            modal.removeEventListener('click', backdropClick);
            form.removeEventListener('submit', submit);
            modal.querySelector('[data-cancel]').removeEventListener('click', cancel);
            resolve(value);
        };
        const backdropClick = event => { if (event.target === modal) finish(null); };
        const submit = event => {
            event.preventDefault();
            const value = Number(input.value);
            if (!Number.isInteger(value) || value < 1 || value > 30) {
                error.textContent = 'Please enter a quantity from 1 to 30.';
                input.focus();
                return;
            }
            finish(value);
        };
        input.value = '1';
        error.textContent = '';
        form.addEventListener('submit', submit);
        modal.querySelector('[data-cancel]').addEventListener('click', cancel);
        modal.addEventListener('click', backdropClick);
        modal.classList.add('is-open');
        requestAnimationFrame(() => input.focus());
    });
}

function bindProductActions(container = document) {
    container.querySelectorAll('[data-product-card]').forEach(card => {
        card.addEventListener('click', event => {
            if (event.target.closest('button, a, input, select')) return;
            openProductDetails(card);
        });
    });
    container.querySelectorAll('[data-like]').forEach(button => {
        button.addEventListener('click', async event => {
            event.stopPropagation();
            if (!signedIn()) {
                location.href = link('customer/login.html');
                return;
            }

            const id = button.dataset.like;
            const active = button.classList.contains('active');
            button.disabled = true;
            try {
                const data = await api(`/products/${id}/like`, {
                    method: active ? 'DELETE' : 'POST'
                });
                button.classList.toggle('active', Boolean(data.liked));
                const count = button.querySelector('.like-count');
                if (count && Number.isFinite(Number(data.likes_count))) {
                    count.textContent = String(data.likes_count);
                }
                toast(data.liked ? 'You liked this product.' : 'Like removed.');
            } catch (error) {
                toast(error.message, 'error');
            } finally {
                button.disabled = false;
            }
        });
    });

    container.querySelectorAll('[data-favourite]').forEach(button => {
        button.addEventListener('click', async event => {
            event.stopPropagation();
            if (!signedIn()) {
                location.href = link('customer/login.html');
                return;
            }

            const id = button.dataset.favourite;
            const active = button.classList.contains('active');

            try {
                const data = await api(`/products/${id}/favourite`, {
                    method: active ? 'DELETE' : 'POST'
                });

                button.classList.toggle(
                    'active',
                    Boolean(data.favourite)
                );

                toast(data.favourite
                    ? 'Added to favourites.'
                    : 'Removed from favourites.');
            } catch (error) {
                toast(error.message, 'error');
            }
        });
    });

    container.querySelectorAll('[data-reserve]').forEach(button => {
        button.addEventListener('click', async () => {
            if (!signedIn()) {
                location.href = link('customer/login.html');
                return;
            }

            const quantity = await askReservationQuantity();
            if (quantity === null) return;

            try {
                await api('/reservations', {
                    method: 'POST',
                    body: { productId: button.dataset.reserve, quantity }
                });
                toast('Pickup request sent successfully!');
            } catch (error) {
                toast(error.message, 'error');
            }
        });
    });
}

async function initHome() {
    // Preserve the original design-reference banner and premium footer.
    const hero = $('.hero');
    if (hero) {
        if (cfg.bannerImage) {
            const bannerUrl = String(cfg.bannerImage).replace(/[\\'"\n\r]/g, '');
            hero.style.backgroundImage = `linear-gradient(90deg,rgba(12,24,62,.78),rgba(24,48,111,.20)),url('${bannerUrl}')`;
        }
        hero.classList.add('shop-banner-responsive');
    }

    const existingFooter = $('.footer');
    if (existingFooter) existingFooter.outerHTML = footer();

    const featured = $('#featured-grid');
    const recommended = $('#recommend-grid');
    const categoryGrid = $('#category-grid');

    try {
        const [items, cats] = await Promise.all([
            getProducts(),
            getCategories()
        ]);

        products = items;
        categories = cats;

        if (featured) {
            featured.innerHTML = items.length
                ? items.slice(0, 4).map(productCard).join('')
                : emptyState('No products yet', 'Products will appear here.');
        }

        if (recommended) {
            recommended.innerHTML = items.length
                ? items.slice(4, 8).map(productCard).join('')
                : '';
        }

        if (categoryGrid) {
            categoryGrid.innerHTML = cats.map(category => `
                <a class="category-card"
                   href="pages/products.html?category=${encodeURIComponent(category.name)}">

                    ${category.image_url
                        ? `<img src="${safe(category.image_url)}"
                               alt="${safe(category.name)}">`
                        : icon(category.icon || 'package')}

                    <h3>${safe(category.name)}</h3>
                </a>
            `).join('');
        }

        bindProductActions();
        bindHomeSearch();

    } catch (error) {
        if (featured) featured.innerHTML = errorState(error);
    }

    $$('[data-shop-name]').forEach(el => {
        el.innerHTML = `${safe(cfg.name)} <small>${safe(cfg.suffix)}</small>`;
    });

    $$('[data-motto]').forEach(el => {
        el.textContent = cfg.motto;
    });

    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();

    const banner = $('#offer-banner');
    if (banner) {
        banner.querySelector('[data-close-banner]')
            ?.addEventListener('click', () => banner.remove());
    }

    const socials = $('#social-links');
    if (socials) {
        socials.innerHTML = Object.entries(cfg.socials || {})
            .filter(([, url]) => url)
            .map(([name, url]) => `
                <a href="${safe(url)}"
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="${safe(name)}">
                    ${icon(name === 'whatsapp' ? 'message-circle' : name)}
                </a>
            `).join('');
    }

    bindShared();
    icons();
}

function enhanceCustomSelect(select) {
    if (!select || select.dataset.customized === 'true') return;
    select.dataset.customized = 'true';
    const wrap = document.createElement('div');
    wrap.className = 'custom-dropdown';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dropdown-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    const label = document.createElement('span');
    const caret = document.createElement('span');
    caret.textContent = '⌄';
    trigger.append(label, caret);
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.setAttribute('role', 'listbox');
    const sync = () => {
        const selected = select.options[select.selectedIndex];
        label.textContent = selected?.textContent || 'Select';
        menu.querySelectorAll('button').forEach(button => {
            const active = button.dataset.value === select.value;
            button.classList.toggle('selected', active);
            button.setAttribute('aria-selected', String(active));
        });
    };
    Array.from(select.options).forEach(option => {
        const item = document.createElement('button');
        item.type = 'button';
        item.setAttribute('role', 'option');
        item.dataset.value = option.value;
        item.textContent = option.textContent;
        item.addEventListener('click', () => {
            select.value = option.value;
            select.dispatchEvent(new Event('change', {bubbles:true}));
            sync();
            wrap.classList.remove('open');
        });
        menu.appendChild(item);
    });
    trigger.addEventListener('click', () => wrap.classList.toggle('open'));
    document.addEventListener('click', event => { if (!wrap.contains(event.target)) wrap.classList.remove('open'); });
    select.insertAdjacentElement('afterend', wrap);
    wrap.append(trigger, menu);
    select.classList.add('visually-hidden-native-select');
    sync();
}


const MANUAL_PRODUCT_TAGS = ['New', 'Popular', 'Best Seller', 'Offer', 'Featured'];
const CATEGORY_ICON_OPTIONS = ['package','book-open','pencil','backpack','palette','trophy','flower-2','calculator','ruler','scissors','paintbrush','notebook-pen','pen-tool','sticky-note','gift','toy-brick','flask-conical','globe','eraser','highlighter','school','briefcase-business','folder','clipboard-list','printer','paperclip','star','shapes','bookmark','box'];

function categoryIconPicker(prefix, selectedIcon = 'package') {
    const selected = CATEGORY_ICON_OPTIONS.includes(selectedIcon) ? selectedIcon : 'package';
    return `<div class="field full"><span>Category icon</span><input type="hidden" name="icon" value="${safe(selected)}"><div class="icon-picker" data-icon-picker>${CATEGORY_ICON_OPTIONS.map(name => `<button type="button" class="icon-choice ${name === selected ? 'selected' : ''}" data-icon-choice="${name}" aria-label="${name}" aria-pressed="${name === selected}">${icon(name)}<small>${name}</small></button>`).join('')}</div><small class="muted">Selected icon: <strong data-icon-selected>${safe(selected)}</strong></small></div>`;
}

function wireCategoryIconPickers(root = document) {
    root.querySelectorAll('[data-icon-picker]').forEach(picker => {
        const field = picker.closest('.field');
        const input = field?.querySelector('input[name="icon"]');
        const label = field?.querySelector('[data-icon-selected]');
        if (!input) return;
        picker.querySelectorAll('[data-icon-choice]').forEach(button => button.addEventListener('click', () => {
            input.value = button.dataset.iconChoice;
            if (label) label.textContent = input.value;
            picker.querySelectorAll('[data-icon-choice]').forEach(option => {
                const active = option === button;
                option.classList.toggle('selected', active);
                option.setAttribute('aria-pressed', String(active));
            });
        }));
    });
}

function wireOwnerImagePreview(form, prefix) {
    const input = form?.querySelector(`[name="${prefix}Image"]`);
    const preview = form?.querySelector(`[data-preview="${prefix}"]`);
    if (!input || !preview) return;
    input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
            toast('Choose JPG, PNG, WEBP or GIF up to 5 MB.', 'error'); input.value = ''; return;
        }
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            if (image.width < 500 || image.height < 500) {
                toast(`Image must be at least 500 × 500 pixels. Selected image is ${image.width} × ${image.height}.`, 'error');
                input.value = ''; URL.revokeObjectURL(objectUrl); return;
            }
            preview.src = objectUrl; preview.classList.remove('hidden');
        };
        image.onerror = () => { toast('The selected file is not a valid supported image.', 'error'); input.value = ''; URL.revokeObjectURL(objectUrl); };
        image.src = objectUrl;
    };
    form.querySelector(`[data-clear-preview="${prefix}"]`)?.addEventListener('click', () => { input.value = ''; preview.removeAttribute('src'); preview.classList.add('hidden'); });
}

function localDateTimeValue(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function openProductSuggestionDialog(productName = '') {
    if (!signedIn()) {
        toast('Please sign in to suggest a product.', 'error');
        const next = `${location.pathname}${location.search}`;
        location.href = `${link('customer/login.html')}?next=${encodeURIComponent(next)}`;
        return;
    }

    let modal = $('#ors-search-suggestion-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ors-search-suggestion-modal';
        modal.className = 'ors-dialog-backdrop';
        modal.innerHTML = `
            <form class="ors-dialog search-suggestion-dialog" novalidate>
                <span class="dialog-icon">${icon('lightbulb')}</span>
                <h2>Suggest this product</h2>
                <p>Tell the shop which product you would like to see. The product name is filled from your search.</p>
                <label class="field">Product name
                    <input name="title" type="text" maxlength="120" autocomplete="off" placeholder="Product name">
                </label>
                <label class="field">A few details
                    <textarea name="details" rows="4" maxlength="1500" placeholder="Brand, size, colour or any details that may help the shop..."></textarea>
                </label>
                <p class="dialog-error" aria-live="polite"></p>
                <div class="dialog-actions">
                    <button type="button" class="btn btn-light" data-cancel>Cancel</button>
                    <button type="submit" class="btn btn-primary">Submit suggestion</button>
                </div>
            </form>`;
        document.body.appendChild(modal);
    }

    const form = modal.querySelector('form');
    const title = form.elements.title;
    const details = form.elements.details;
    const error = modal.querySelector('.dialog-error');
    const cancel = modal.querySelector('[data-cancel]');
    title.value = productName || '';
    details.value = '';
    error.textContent = '';

    const close = () => {
        modal.classList.remove('is-open');
        form.removeEventListener('submit', submit);
        cancel.removeEventListener('click', cancelDialog);
        modal.removeEventListener('click', backdropClick);
        document.removeEventListener('keydown', escapeKey);
    };
    const cancelDialog = event => { event?.preventDefault(); close(); };
    const backdropClick = event => { if (event.target === modal) close(); };
    const escapeKey = event => { if (event.key === 'Escape' && modal.classList.contains('is-open')) close(); };
    const submit = async event => {
        event.preventDefault();
        const cleanTitle = title.value.trim();
        const cleanDetails = details.value.trim();
        if (!cleanTitle) {
            error.textContent = 'Please enter the product name.';
            title.focus();
            return;
        }
        if (cleanDetails.length < 5) {
            error.textContent = 'Please add a few details (at least 5 characters).';
            details.focus();
            return;
        }
        const submitButton = form.querySelector('[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting…';
        try {
            await api('/customer/suggestions', {
                method: 'POST',
                body: { title: cleanTitle, details: cleanDetails }
            });
            close();
            toast('Your product suggestion has been sent. Thank you!');
        } catch (requestError) {
            error.textContent = requestError.message || 'Could not submit your suggestion. Please try again.';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit suggestion';
        }
    };

    form.addEventListener('submit', submit);
    cancel.addEventListener('click', cancelDialog);
    modal.addEventListener('click', backdropClick);
    document.addEventListener('keydown', escapeKey);
    modal.classList.add('is-open');
    requestAnimationFrame(() => title.focus());
}

function bindHomeSearch() {
    const form = $('#home-search');
    if (!form) return;
    const input = form.querySelector('input[name="q"]');
    const results = $('#home-search-results');
    if (!input || !results) return;

    let categorySelect = form.querySelector('[name="category"]');
    if (!categorySelect) {
        categorySelect = document.createElement('select');
        categorySelect.name = 'category';
        categorySelect.setAttribute('aria-label', 'Search category');
        categorySelect.className = 'home-search-category';
        categorySelect.innerHTML = '<option value="">All categories</option>' +
            categories.map(c => `<option value="${safe(c.name)}">${safe(c.name)}</option>`).join('');
        form.insertBefore(categorySelect, form.querySelector('button[type="submit"]'));
    }
    enhanceCustomSelect(categorySelect);

    let error = $('#home-search-error');
    if (!error) {
        error = document.createElement('p');
        error.id = 'home-search-error';
        error.className = 'home-search-error hidden';
        error.setAttribute('role', 'alert');
        error.textContent = 'Please enter a product name to search.';
        form.insertAdjacentElement('afterend', error);
    }

    let timer;
    let requestId = 0;
    const search = async ({validate = false} = {}) => {
        const q = input.value.trim();
        const category = categorySelect.value;
        if (!q) {
            results.classList.add('hidden');
            results.innerHTML = '';
            if (validate) {
                error.classList.remove('hidden');
                input.setAttribute('aria-invalid', 'true');
                input.focus();
            }
            return;
        }
        error.classList.add('hidden');
        input.removeAttribute('aria-invalid');
        const currentRequest = ++requestId;
        results.classList.remove('hidden');
        results.innerHTML = '<div class="search-result-status">Searching products…</div>';
        try {
            const items = await getProducts({q, category});
            if (currentRequest !== requestId) return;
            products = items;
            if (items.length) {
                results.innerHTML = `<div class="home-search-result-grid">${items.slice(0, 6).map(productCard).join('')}</div>` +
                    (items.length > 6 ? `<a class="search-view-all" href="pages/products.html?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}">View all ${items.length} results</a>` : '');
                bindProductActions(results);
                icons();
            } else {
                results.innerHTML = `<div class="search-empty-state"><strong>No products found</strong><p>We couldn't find “${safe(q)}”. Would you like to request this product from the shop?</p><button class="btn btn-primary" type="button" data-suggest-missing>＋ Add to suggestions</button></div>`;
                results.querySelector('[data-suggest-missing]').addEventListener('click', () => openProductSuggestionDialog(q));
            }
        } catch (searchError) {
            if (currentRequest !== requestId) return;
            results.innerHTML = `<div class="search-result-status">${safe(searchError.message || 'Search is temporarily unavailable.')}</div>`;
        }
    };

    input.addEventListener('input', () => {
        clearTimeout(timer);
        error.classList.add('hidden');
        input.removeAttribute('aria-invalid');
        if (!input.value.trim()) {
            requestId++;
            results.classList.add('hidden');
            results.innerHTML = '';
            return;
        }
        timer = setTimeout(() => search(), 350);
    });
    categorySelect.addEventListener('change', () => {
        if (input.value.trim()) search();
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        clearTimeout(timer);
        search({validate: true});
    });
    document.addEventListener('click', event => {
        if (!form.contains(event.target) && !results.contains(event.target)) results.classList.add('hidden');
    });
}

async function initProducts() {
    const params = new URLSearchParams(location.search);

    let category = params.get('category') || '';
    let q = params.get('q') || '';

    let sort = 'newest';

    async function render() {
        const content = $('#products-content');

        const items = await getProducts({
            q,
            category,
            sort
        });

        products = items;

        content.innerHTML = items.length
            ? `<div class="product-grid">${items.map(productCard).join('')}</div>`
            : `<div class="empty search-empty-state">
                <strong>No products found</strong>
                <p>Try another search or category, or suggest this product to the shop.</p>
                <button class="btn btn-primary" type="button" data-suggest-no-results>Suggest this product</button>
              </div>`;

        content.querySelector('[data-suggest-no-results]')?.addEventListener('click', () => {
            openProductSuggestionDialog(q);
        });
        bindProductActions(content);
        icons();
    }

    shell('Our Products', 'Explore the products available in our store.', `
        <section class="panel">
            <form id="product-filter" class="form-grid">

                <label class="field">
                    Search products
                    <input name="q" value="${safe(q)}"
                           placeholder="Search products...">
                </label>

                <label class="field">
                    Category
                    <select name="category">
                        <option value="">All categories</option>
                        ${categories.map(c => `
                            <option value="${safe(c.name)}"
                                ${category === c.name ? 'selected' : ''}>
                                ${safe(c.name)}
                            </option>
                        `).join('')}
                    </select>
                </label>

                <label class="field">
                    Sort by
                    <select name="sort">
                        <option value="newest">Newest</option>
                        <option value="price-low">Price: Low to high</option>
                        <option value="price-high">Price: High to low</option>
                        <option value="liked">Most liked</option>
                    </select>
                </label>

                <button class="btn btn-primary" type="submit">
                    Apply filters
                </button>
            </form>
        </section>

        <div id="products-content" class="products-results"></div>
    `);

    $('#product-filter').querySelectorAll('select').forEach(enhanceCustomSelect);
    $('#product-filter').addEventListener('submit', async event => {
        event.preventDefault();

        const data = new FormData(event.currentTarget);

        q = data.get('q') || '';
        category = data.get('category') || '';
        sort = data.get('sort') || 'newest';

        try {
            await render();
        } catch (error) {
            $('#products-content').innerHTML = errorState(error);
        }
    });

    try {
        await render();
    } catch (error) {
        $('#products-content').innerHTML = errorState(error);
    }
}

async function initCustomer() {
    if (path.endsWith('/login.html')) {
        return authPage(false);
    }

    if (path.endsWith('/register.html')) {
        return authPage(true);
    }

    if (!signedIn()) {
        location.replace('login.html');
        return;
    }

    if (path.endsWith('/favourites.html')) {
        try {
            const data = await api('/customer/favourites');
            const items = data.products || [];

            shell('My Favourites', 'Your saved products.', `
                ${items.length
                    ? `<div class="product-grid">${items.map(productCard).join('')}</div>`
                    : emptyState(
                        'No favourites yet',
                        'Save products to find them here.',
                        '<a class="btn btn-primary" href="../pages/products.html">Browse products</a>'
                    )}
            `);

            bindProductActions();
        } catch (error) {
            shell('My Favourites', '', errorState(error));
        }
    }

    if (path.endsWith('/profile.html')) {
        try {
            const [user, dashboard] = [
                currentUser,
                await api('/customer/dashboard')
            ];

            const reservations = dashboard.reservations || [];
            const notifications = dashboard.notifications || [];

            shell('My Profile', 'Your account and shop activity.', `
                <section class="panel profile-card">
                    <h2>${safe(user?.name || 'Customer')}</h2>
                    <p>${safe(user?.email || '')}</p>

                    <div class="dash-links">
                        <a href="favourites.html">
                            ${icon('heart')} My favourites
                        </a>
                    </div>
                </section>

                <section class="panel">
                    <h2>My pickup requests</h2>

                    ${reservations.length
                        ? reservations.map(r => `
                            <div class="reservation-card">
                                <h3>${safe(r.product_name || 'Product')}</h3>
                                <p>Quantity: ${safe(r.quantity)}</p>
                                <p>Status: ${safe(r.status)}</p>

                                ${r.status === 'Request Sent'
                                    ? `<button class="btn btn-dark"
                                        data-cancel-reservation="${safe(r.id)}">
                                        Cancel request
                                      </button>`
                                    : ''}
                            </div>
                        `).join('')
                        : '<p>No pickup requests yet.</p>'}
                </section>

                <section class="panel">
                    <h2>Notifications</h2>

                    ${notifications.length
                        ? notifications.map(n => `
                            <div class="notification-card">
                                <h3>${safe(n.title)}</h3>
                                <p>${safe(n.body)}</p>
                                ${!n.is_read ? `
                                    <button class="btn btn-dark"
                                            data-read-notice="${safe(n.id)}">
                                        Mark as read
                                    </button>
                                ` : ''}
                            </div>
                        `).join('')
                        : '<p>No new notifications.</p>'}
                </section>

                <section class="panel account-danger-zone">
                    <h2>Delete account permanently</h2>
                    <p>This permanently deletes your account, pickup requests, favourites, likes, notifications, suggestions and shop reviews linked to your account. This cannot be undone.</p>
                    <button class="btn btn-danger" id="delete-account" type="button">Delete my account</button>
                </section>

                <button class="btn btn-dark" id="signout">
                    Sign out
                </button>
            `);

            $('#signout').onclick = signOut;
            $('#delete-account').onclick = async () => {
                const password = await askPasswordForDeletion();
                if (password === null) return;
                const sure = await askConfirmation(
                    'Delete your account permanently?',
                    'Are you absolutely sure? All account-linked records will be permanently deleted. This action cannot be undone.',
                    'Yes, delete permanently'
                );
                if (!sure) return;
                try {
                    await api('/customer/account', { method: 'DELETE', body: { password } });
                    localStorage.removeItem(TOKEN_KEY);
                    currentUser = null;
                    toast('Your account has been permanently deleted.');
                    location.href = link('customer/login.html');
                } catch (error) {
                    toast(error.message, 'error');
                }
            };

            $$('[data-cancel-reservation]').forEach(button => {
                button.onclick = async () => {
                    try {
                        await api(
                            `/reservations/${button.dataset.cancelReservation}/cancel`,
                            { method: 'POST' }
                        );

                        toast('Request cancelled.');
                        location.reload();
                    } catch (error) {
                        toast(error.message, 'error');
                    }
                };
            });

            $$('[data-read-notice]').forEach(button => {
                button.onclick = async () => {
                    try {
                        await api(
                            `/customer/notifications/${button.dataset.readNotice}/read`,
                            { method: 'PATCH' }
                        );

                        button.disabled = true;
                        toast('Notification marked as read.');
                    } catch (error) {
                        toast(error.message, 'error');
                    }
                };
            });

        } catch (error) {
            shell('My Profile', '', errorState(error));
        }
    }
                   }
function askPasswordForDeletion() {
    return new Promise(resolve => {
        let modal = $('#delete-account-password-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'delete-account-password-modal';
            modal.className = 'ors-dialog-backdrop';
            modal.innerHTML = `<form class="ors-dialog" novalidate>
                <span class="dialog-icon">${icon('lock')}</span>
                <h2>Confirm your password</h2>
                <p>Enter your current password before continuing.</p>
                <label class="field">Current password<input name="password" type="password" autocomplete="current-password" required></label>
                <p class="dialog-error" aria-live="polite"></p>
                <div class="dialog-actions"><button type="button" class="btn btn-light" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">Continue</button></div>
            </form>`;
            document.body.appendChild(modal);
        }
        const form = modal.querySelector('form');
        const input = form.elements.password;
        const error = modal.querySelector('.dialog-error');
        let settled = false;
        const finish = value => { if (settled) return; settled = true; modal.classList.remove('is-open'); form.removeEventListener('submit', submit); modal.querySelector('[data-cancel]').removeEventListener('click', cancel); modal.removeEventListener('click', backdrop); resolve(value); };
        const cancel = e => { e.preventDefault(); finish(null); };
        const backdrop = e => { if (e.target === modal) finish(null); };
        const submit = e => { e.preventDefault(); if (!input.value) { error.textContent='Enter your current password.'; return; } finish(input.value); };
        input.value=''; error.textContent='';
        form.addEventListener('submit',submit); modal.querySelector('[data-cancel]').addEventListener('click',cancel); modal.addEventListener('click',backdrop); modal.classList.add('is-open');
        requestAnimationFrame(()=>input.focus());
    });
}

function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    currentUser = null;
    location.href = link('customer/login.html');
}

function authPage(register) {
    shell(
        register ? 'Create your account' : 'Welcome back',
        register
            ? 'Register to save favourites and manage your shop activity.'
            : 'Sign in to continue.',
        `
        <div class="auth-card">
            <div class="auth-emblem">${brandMark()}</div>

            <h2>${register ? 'Create account' : 'Sign in'}</h2>

            <form id="auth-form" class="form-grid">

                ${register ? `
                    <label class="field full">
                        Your name
                        <input name="name" required minlength="2"
                               autocomplete="name">
                    </label>
                ` : ''}

                <label class="field full">
                    Email address
                    <input name="email" type="email" required
                           autocomplete="email">
                </label>

                <label class="field full">
                    Password
                    <input name="password" type="password" required
                           minlength="8"
                           autocomplete="${register ? 'new-password' : 'current-password'}">
                </label>

                <button class="btn btn-primary field full" type="submit">
                    ${register ? 'Create account' : 'Sign in'}
                </button>

            </form>

            <p id="auth-note" class="form-note"></p>

            <p class="tiny-note">
                ${register
                    ? 'Already registered?'
                    : 'New customer?'}
                <a href="${register ? 'login' : 'register'}.html">
                    ${register ? 'Sign in' : 'Create an account'}
                </a>
            </p>
        </div>
        `
    );

    $('#auth-form').addEventListener('submit', async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');
        const note = $('#auth-note');

        button.disabled = true;
        note.textContent = 'Please wait...';

        const fd = new FormData(form);

        const body = {
            name: fd.get('name'),
            email: fd.get('email'),
            password: fd.get('password')
        };

        try {
            if (register) {
                await api('/auth/register', {
                    method: 'POST',
                    body
                });

                toast('Account created. Please sign in.');
                location.href = 'login.html';
                return;
            }

            const data = await api('/auth/login', {
                method: 'POST',
                body
            });

            localStorage.setItem(TOKEN_KEY, data.token);
            currentUser = data.user;

            location.href = data.user.role === 'admin'
                ? '../owner/dashboard.html'
                : 'profile.html';

        } catch (error) {
            note.textContent = error.message;
            button.disabled = false;
        }
    });
}

/* ==========================================================
   PART 3 — PUBLIC PAGES, OWNER AREA AND STARTUP
   ========================================================== */

async function initStatic() {

    if (path.endsWith('/offers.html')) {
        const data = await api('/public/offers');
        const items = data.offers || [];

        return shell('Special Offers', 'Discover current shop offers.', `
            ${items.length
                ? items.map(o => `
                    <article class="panel">
                        <h2>${safe(o.title)}</h2>
                        <p>${safe(o.description || '')}</p>
                        <p>Discount: ${safe(o.discount_value)}
                            ${o.discount_type === 'percent' ? '%' : ''}</p>
                    </article>
                `).join('')
                : emptyState('No active offers', 'Check back later for new offers.')}
        `);
    }

    if (path.endsWith('/updates.html')) {
        const data = await api('/public/notices');
        const items = data.notices || [];

        return shell('Shop Updates', 'Latest announcements from our store.', `
            ${items.length
                ? items.map(n => `
                    <article class="panel">
                        <h2>${safe(n.title)}</h2>
                        <p>${safe(n.body)}</p>
                        <small>${new Date(n.created_at).toLocaleDateString()}</small>
                    </article>
                `).join('')
                : emptyState('No updates yet', 'New announcements will appear here.')}
        `);
    }

    if (path.endsWith('/reviews.html')) {
        const data = await api('/public/reviews');
        const items = data.reviews || [];

        return shell('Customer Reviews', 'Feedback from our customers.', `
            <section class="panel">
                <h2>Share your experience</h2>

                ${signedIn()
                    ? `<form id="review-form" class="form-grid">
                        <label class="field full">
                            Your review
                            <textarea name="body" required minlength="3"
                                      maxlength="1500"></textarea>
                        </label>
                        <button class="btn btn-primary">Submit review</button>
                      </form>`
                    : '<p><a href="../customer/login.html">Sign in</a> to write a review.</p>'}
            </section>

            ${items.length
                ? items.map(r => `
                    <article class="panel">
                        <h3>${safe(r.reviewer_name)}</h3>
                        <p>${safe(r.body)}</p>
                    </article>
                `).join('')
                : emptyState('No reviews yet', 'Be the first to share feedback.')}
        `).then(() => {
            $('#review-form')?.addEventListener('submit', async e => {
                e.preventDefault();

                try {
                    await api('/shop/reviews', {
                        method: 'POST',
                        body: { body: new FormData(e.currentTarget).get('body') }
                    });

                    toast('Review submitted.');
                    location.reload();
                } catch (error) {
                    toast(error.message, 'error');
                }
            });
        });
    }

    if (path.endsWith('/suggestions.html')) {
        const data = await api('/public/suggestions');
        const items = data.suggestions || [];
        let likedIds = new Set();
        if (signedIn()) {
            try { const likes = await api('/customer/suggestions/likes'); likedIds = new Set((likes.suggestionIds || []).map(String)); }
            catch (error) { console.warn('Could not load suggestion likes:', error.message); }
        }
        shell('Suggestions', 'Ideas and requests from our community.', `
            ${signedIn() ? `<section class="panel"><h2>Suggest a product</h2><form id="suggestion-form" class="form-grid" novalidate><label class="field full">Title<input name="title" required maxlength="120"></label><label class="field full">Details<textarea name="details" maxlength="1500"></textarea></label><button class="btn btn-primary">Send suggestion</button></form></section>` : `<p><a href="../customer/login.html">Sign in</a> to submit a suggestion or like a public suggestion.</p>`}
            ${items.length ? items.map(s => {
                const liked = likedIds.has(String(s.id));
                return `<article class="panel suggestion-public-card"><h3>${safe(s.title)}</h3><p>${safe(s.details)}</p>${s.owner_reply ? `<p class="suggestion-owner-reply"><b>Shop reply:</b> ${safe(s.owner_reply)}</p>` : ''}<div class="suggestion-public-actions">${signedIn() ? `<button class="btn btn-light suggestion-like-btn ${liked ? 'active' : ''}" type="button" data-suggestion-like="${safe(s.id)}" aria-pressed="${liked}">${icon('thumbs-up')} <span>${liked ? 'Liked' : 'Like'}</span> <strong data-suggestion-likes="${safe(s.id)}">${Number(s.likes_count || 0)}</strong></button>` : `<a class="btn btn-light" href="../customer/login.html">Sign in to like · ${Number(s.likes_count || 0)}</a>`}</div></article>`;
            }).join('') : emptyState('No suggestions yet', 'Suggestions will appear here.')}
        `);
        $('#suggestion-form')?.addEventListener('submit', async e => {
            e.preventDefault(); const fd = new FormData(e.currentTarget);
            if (!String(fd.get('title') || '').trim()) { toast('Please enter a product name before sending.', 'error'); e.currentTarget.querySelector('[name="title"]')?.focus(); return; }
            try { await api('/customer/suggestions', {method:'POST',body:{title:fd.get('title'),details:fd.get('details')}}); toast('Suggestion submitted.'); location.reload(); }
            catch (error) { toast(error.message, 'error'); }
        });
        $$('[data-suggestion-like]').forEach(button => button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                const result = await api(`/customer/suggestions/${button.dataset.suggestionLike}/like`, {method:'POST'});
                button.classList.toggle('active', result.liked); button.setAttribute('aria-pressed', String(result.liked));
                button.querySelector('span').textContent = result.liked ? 'Liked' : 'Like';
                const count = document.querySelector(`[data-suggestion-likes="${button.dataset.suggestionLike}"]`);
                if (count) count.textContent = result.likes_count;
            } catch (error) { toast(error.message, 'error'); }
            finally { button.disabled = false; }
        }));
        return;
    }

    if (path.endsWith('/about.html')) {
        return shell('About Our Store', 'Get to know our shop.', `
            <section class="panel">
                ${cfg.aboutImage
                    ? `<img class="about-image" src="${safe(cfg.aboutImage)}"
                            alt="${safe(cfg.name)}">`
                    : ''}

                <h2>${safe(cfg.name)} ${safe(cfg.suffix)}</h2>
                <p>${safe(cfg.description)}</p>

                <div class="about-details">
                    <div>
                        ${icon('map-pin')}
                        <b>Address</b>
                        <p>${safe(cfg.address || 'Not added yet.')}</p>
                        ${cfg.latitude && cfg.longitude ? `<a class="btn btn-primary map-directions" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(cfg.latitude)}&mlon=${encodeURIComponent(cfg.longitude)}#map=17/${encodeURIComponent(cfg.latitude)}/${encodeURIComponent(cfg.longitude)}">${icon('map-pin')} View on OpenStreetMap</a>` : ''}
                    </div>

                    <div>
                        ${icon('phone')}
                        <b>Phone</b>
                        <p>${safe(cfg.phone || 'Not added yet.')}</p>
                    </div>

                    <div>
                        ${icon('mail')}
                        <b>Email</b>
                        <p>${safe(cfg.email || 'Not added yet.')}</p>
                    </div>
                </div>
                ${cfg.latitude && cfg.longitude ? `<div class="about-map-wrap"><h3>Find our shop</h3><iframe title="Shop location on OpenStreetMap" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(Number(cfg.longitude)-0.01)}%2C${encodeURIComponent(Number(cfg.latitude)-0.01)}%2C${encodeURIComponent(Number(cfg.longitude)+0.01)}%2C${encodeURIComponent(Number(cfg.latitude)+0.01)}&layer=mapnik&marker=${encodeURIComponent(cfg.latitude)}%2C${encodeURIComponent(cfg.longitude)}"></iframe></div>` : ''}
                ${Object.entries(cfg.socials||{}).filter(([,url])=>url).length ? `<div class="about-social-links"><h3>Connect with us</h3>${Object.entries(cfg.socials||{}).filter(([,url])=>url).map(([key,url])=>`<a href="${safe(url)}" target="_blank" rel="noopener noreferrer" aria-label="${safe(key)}">${socialBrandIcon(key)}<span>${safe(key)}</span></a>`).join('')}</div>` : ''}
            </section>
        `);
    }

    if (path.endsWith('/guides.html')) {
        return shell('How It Works', 'A simple guide to shopping with us.', `
            <section class="panel">
                <h2>Reserve for pickup</h2>
                <ol>
                    <li>Browse the available products.</li>
                    <li>Sign in to your customer account.</li>
                    <li>Choose a product and send a pickup request.</li>
                    <li>Wait for the shop owner to approve it.</li>
                    <li>Visit the shop and collect your item.</li>
                </ol>
                <p class="muted">
                    A request is not confirmed until approved by the owner.
                    Online payment and delivery are not provided.
                </p>
            </section>
        `);
    }

    if (path.endsWith('/privacy.html')) {
        return shell('Privacy Policy', 'Information about your account and activity.', `
            <section class="panel">
                <h2>Privacy information</h2>
                <p>
                    This website supports product browsing and in-store
                    pickup reservations. Account information is used to
                    provide customer features.
                </p>
                <p>
                    The shop owner should review and approve the final
                    privacy policy before the website goes public.
                </p>
            </section>
        `);
    }
}

/* -------------------------
   OWNER ACCESS
------------------------- */

/* -------------------------
   OWNER ACCESS
------------------------- */

async function requireOwner() {
    if (!signedIn()) {
        location.href = '../customer/login.html';
        return false;
    }

    await loadCurrentUser();

    if (!isOwner()) {
        document.body.innerHTML = `
            <main class="page-shell">
                <h1>Access denied</h1>
                <p>This area is only available to the shop owner.</p>
                <a class="btn btn-primary" href="../index.html">Go home</a>
            </main>
        `;
        return false;
    }

    return true;
}

async function initOwner() {
    if (!await requireOwner()) return;

    if (path.endsWith('/dashboard.html')) {
        const data = await api('/owner/summary');

        return shell('Owner Dashboard', 'Your shop at a glance.', `
            <div class="stats-grid">
                ${Object.entries(data).map(([key, value]) => `
                    <article class="panel stat-card">
                        <span>${safe(key.replaceAll('_', ' '))}</span>
                        <h2>${safe(value)}</h2>
                    </article>
                `).join('')}
            </div>

            <section class="panel">
                <h2>Manage your shop</h2>
                <div class="dash-links">
                    <a href="products.html">Products</a>
                    <a href="categories.html">Categories</a>
                    <a href="reservations.html">Reservations</a>
                    <a href="offers.html">Offers</a>
                    <a href="reviews.html">Reviews</a>
                    <a href="suggestions.html">Suggestions</a>
                    <a href="updates.html">Updates</a>
                    <a href="settings.html">Settings</a>
                </div>
            </section>
        `);
    }

    if (path.endsWith('/products.html')) {
        const [data, categoryData] = await Promise.all([api('/owner/products'), api('/owner/categories')]);
        const items = data.products || [];
        const categoryItems = categoryData.categories || [];
        const categoryOptions = categoryItems.map(c => `<option value="${safe(c.id)}">${safe(c.name)}</option>`).join('');
        const tagOptions = selected => `<option value="">No manual tag</option>${MANUAL_PRODUCT_TAGS.map(tag => `<option value="${tag}" ${tag === selected ? 'selected' : ''}>${tag}</option>`).join('')}`;
        const imageField = (prefix, imageUrl='') => `<div class="field full owner-image-field"><span>Product image <small>(JPG, PNG, WEBP or GIF · max 5 MB · minimum 500 × 500 px)</small></span><input type="file" name="${prefix}Image" accept="image/jpeg,image/png,image/webp,image/gif"><img class="owner-upload-preview ${imageUrl ? '' : 'hidden'}" data-preview="${prefix}" src="${safe(imageUrl)}" alt="Product preview"><button type="button" class="btn btn-light owner-clear-preview" data-clear-preview="${prefix}">Clear selected image</button></div>`;
        const productCard = product => {
            const savedTag = Array.isArray(product.manual_tags) ? product.manual_tags[0] || '' : '';
            const validTag = MANUAL_PRODUCT_TAGS.includes(savedTag) ? savedTag : '';
            return `<article class="panel owner-item-card">
                <div class="owner-item-heading">${product.image_url ? `<img class="owner-item-thumb" src="${safe(product.image_url)}" alt="">` : `<div class="owner-item-thumb owner-item-placeholder">${icon('image')}</div>`}<div><h3>${safe(product.name)}</h3><p>${money(product.price)} · Stock: ${safe(product.stock_quantity)}</p><p class="muted">${safe(categoryItems.find(c=>String(c.id)===String(product.category_id))?.name || 'Uncategorised')} · Manual tag: ${safe(savedTag || 'None')}</p></div></div>
                <div class="owner-item-actions"><button class="btn btn-light" type="button" data-edit-product="${safe(product.id)}">Edit product</button><button class="btn btn-dark" type="button" data-hide-product="${safe(product.id)}">Hide product</button></div>
                <form class="form-grid owner-edit-form hidden" data-product-edit="${safe(product.id)}">
                    <label class="field">Product name<input name="name" value="${safe(product.name)}" required maxlength="180"></label>
                    <label class="field">Price<input name="price" type="number" min="0" step="0.01" value="${safe(product.price)}" required></label>
                    <label class="field">Category<select name="categoryId" data-owner-custom-select><option value="">No category</option>${categoryItems.map(c=>`<option value="${safe(c.id)}" ${String(c.id)===String(product.category_id)?'selected':''}>${safe(c.name)}</option>`).join('')}</select></label>
                    <label class="field">Stock quantity<input name="stockQuantity" type="number" min="0" step="1" value="${safe(product.stock_quantity)}"></label>
                    <label class="field full">Description<textarea name="description">${safe(product.description)}</textarea></label>
                    <label class="field full">Manual tag <small>Choose at most one. Automatic tags continue to work separately.</small><select name="tag" data-owner-custom-select>${tagOptions(validTag)}</select></label>
                    ${!validTag && savedTag ? `<p class="field full muted">This product has an older custom tag (“${safe(savedTag)}”). Choose a new fixed tag or No manual tag when saving.</p>` : ''}
                    ${imageField('edit-'+product.id,product.image_url || '')}
                    <label class="field owner-check-field"><input type="checkbox" name="removeImage"> Remove current image</label>
                    <div class="field full owner-item-actions"><button class="btn btn-primary" type="submit">Save changes</button><button class="btn btn-light" type="button" data-cancel-edit="${safe(product.id)}">Cancel</button></div>
                </form>
            </article>`;
        };
        return shell('Manage Products', 'Add products, images, categories and searchable tags.', `
            <section class="panel owner-form-panel"><h2>Add product</h2><form id="owner-product-form" class="form-grid">
                <label class="field">Product name<input name="name" required maxlength="180"></label>
                <label class="field">Price<input name="price" type="number" min="0" step="0.01" required></label>
                <label class="field">Category<select name="categoryId" data-owner-custom-select><option value="">Choose category (optional)</option>${categoryOptions}</select></label>
                <label class="field">Stock quantity<input name="stockQuantity" type="number" min="0" step="1" value="0"></label>
                <label class="field full">Description<textarea name="description"></textarea></label>
                <label class="field full">Manual tag <small>Choose at most one. Automatic tags continue to work separately.</small><select name="tag" data-owner-custom-select>${tagOptions('')}</select></label>
                ${imageField('new')}
                <div class="field full owner-item-actions"><button class="btn btn-primary" type="submit">Add product</button><button class="btn btn-light" type="reset">Cancel / Clear</button></div>
            </form></section>
            ${items.map(productCard).join('') || '<div class="empty">No products found yet.</div>'}
        `).then(() => {
            $$('[data-owner-custom-select]').forEach(enhanceCustomSelect);
            const form = $('#owner-product-form'); wireOwnerImagePreview(form, 'new');
            form.onreset = () => setTimeout(() => { const img=form.querySelector('[data-preview="new"]'); if(img){img.removeAttribute('src');img.classList.add('hidden');}},0);
            const uploadProductImage = async (id,file) => { if(!file)return; const fd=new FormData(); fd.append('image',file); await api(`/owner/products/${id}/image`,{method:'POST',body:fd}); };
            form.onsubmit = async e => {
                e.preventDefault(); const fd=new FormData(form),submit=form.querySelector('[type="submit"]'); submit.disabled=true; let created=null;
                try {
                    const tag=String(fd.get('tag')||'');
                    created=await api('/owner/products',{method:'POST',body:{name:fd.get('name'),price:Number(fd.get('price')),categoryId:fd.get('categoryId')||null,stockQuantity:Number(fd.get('stockQuantity')||0),description:fd.get('description'),tags:tag?[tag]:[]}});
                    const file=fd.get('newImage'); if(file instanceof File&&file.size)await uploadProductImage(created.product.id,file);
                    toast('Product added successfully.');location.reload();
                }catch(error){if(created){toast('Product was saved, but its image upload failed: '+error.message,'error');setTimeout(()=>location.reload(),1600);}else{toast(error.message,'error');submit.disabled=false;}}
            };
            $$('[data-edit-product]').forEach(button=>button.onclick=()=>document.querySelector(`[data-product-edit="${button.dataset.editProduct}"]`)?.classList.toggle('hidden'));
            $$('[data-cancel-edit]').forEach(button=>button.onclick=()=>document.querySelector(`[data-product-edit="${button.dataset.cancelEdit}"]`)?.classList.add('hidden'));
            $$('[data-product-edit]').forEach(form=>{
                const id=form.dataset.productEdit; wireOwnerImagePreview(form,'edit-'+id);
                form.onsubmit=async e=>{
                    e.preventDefault();const fd=new FormData(form),submit=form.querySelector('[type="submit"]');submit.disabled=true;
                    try{
                        const tag=String(fd.get('tag')||'');
                        await api(`/owner/products/${id}`,{method:'PATCH',body:{name:fd.get('name'),price:Number(fd.get('price')),categoryId:fd.get('categoryId')||null,stockQuantity:Number(fd.get('stockQuantity')||0),description:fd.get('description'),tags:tag?[tag]:[]}});
                        const file=fd.get(`edit-${id}Image`);if(file instanceof File&&file.size)await uploadProductImage(id,file);
                        if(fd.get('removeImage')==='on'&&!(file instanceof File&&file.size))await api(`/owner/products/${id}/image`,{method:'DELETE'});
                        toast('Product updated.');location.reload();
                    }catch(error){toast(error.message,'error');submit.disabled=false;}
                };
            });
            $$('[data-hide-product]').forEach(button=>button.onclick=async()=>{if(!await askConfirmation('Hide product?','This product will no longer appear in the shop.','Hide product'))return;try{await api(`/owner/products/${button.dataset.hideProduct}`,{method:'DELETE'});toast('Product hidden.');location.reload();}catch(error){toast(error.message,'error');}});
        });
    }

    if (path.endsWith('/categories.html')) {
        const data = await api('/owner/categories'); const items = data.categories || [];
        const categoryImageField = (prefix,imageUrl='') => `<div class="field full owner-image-field"><span>Category image <small>(JPG, PNG, WEBP or GIF · max 5 MB · minimum 500 × 500 px)</small></span><input type="file" name="${prefix}Image" accept="image/jpeg,image/png,image/webp,image/gif"><img class="owner-upload-preview ${imageUrl?'':'hidden'}" data-preview="${prefix}" src="${safe(imageUrl)}" alt="Category preview"><button type="button" class="btn btn-light owner-clear-preview" data-clear-preview="${prefix}">Clear selected image</button></div>`;
        return shell('Manage Categories','Create, edit and add images to product categories.',`
            <section class="panel owner-form-panel"><h2>Add category</h2><form id="owner-category-form" class="form-grid">
                <label class="field">Category name<input name="name" required maxlength="100"></label>
                ${categoryIconPicker('new-category','package')}${categoryImageField('new-category')}
                <div class="field full owner-item-actions"><button class="btn btn-primary" type="submit">Add category</button><button class="btn btn-light" type="reset">Cancel / Clear</button></div>
            </form></section>
            ${items.map(c=>`<article class="panel owner-item-card"><div class="owner-item-heading">${c.image_url?`<img class="owner-item-thumb" src="${safe(c.image_url)}" alt="">`:`<div class="owner-item-thumb owner-item-placeholder">${icon(c.icon||'package')}</div>`}<div><h3>${safe(c.name)}</h3><p class="muted">Icon: ${safe(c.icon||'package')}</p></div></div>
                <div class="owner-item-actions"><button class="btn btn-light" type="button" data-edit-category="${safe(c.id)}">Edit category</button><button class="btn btn-dark" type="button" data-delete-category="${safe(c.id)}">Delete category</button></div>
                <form class="form-grid owner-edit-form hidden" data-category-edit="${safe(c.id)}"><label class="field">Category name<input name="name" value="${safe(c.name)}" required maxlength="100"></label>${categoryIconPicker('edit-category-'+c.id,c.icon||'package')}${categoryImageField('edit-category-'+c.id,c.image_url||'')}
                    <label class="field owner-check-field"><input type="checkbox" name="removeImage"> Remove current image</label><div class="field full owner-item-actions"><button class="btn btn-primary" type="submit">Save changes</button><button class="btn btn-light" type="button" data-cancel-category="${safe(c.id)}">Cancel</button></div>
                </form></article>`).join('')||'<div class="empty">No categories found yet.</div>'}
        `).then(()=>{
            wireCategoryIconPickers();
            const uploadCategoryImage=async(id,file)=>{if(!file)return;const fd=new FormData();fd.append('image',file);await api(`/owner/categories/${id}/image`,{method:'POST',body:fd});};
            const form=$('#owner-category-form');wireOwnerImagePreview(form,'new-category');
            form.onreset=()=>setTimeout(()=>{const img=form.querySelector('[data-preview="new-category"]');if(img){img.removeAttribute('src');img.classList.add('hidden');}},0);
            form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),submit=form.querySelector('[type="submit"]');submit.disabled=true;let created=null;try{created=await api('/owner/categories',{method:'POST',body:{name:fd.get('name'),icon:fd.get('icon')||'package'}});const file=fd.get('new-categoryImage');if(file instanceof File&&file.size)await uploadCategoryImage(created.category.id,file);toast('Category added.');location.reload();}catch(error){if(created){toast('Category was saved, but its image upload failed: '+error.message,'error');setTimeout(()=>location.reload(),1600);}else{toast(error.message,'error');submit.disabled=false;}}};
            $$('[data-edit-category]').forEach(b=>b.onclick=()=>document.querySelector(`[data-category-edit="${b.dataset.editCategory}"]`)?.classList.toggle('hidden'));
            $$('[data-cancel-category]').forEach(b=>b.onclick=()=>document.querySelector(`[data-category-edit="${b.dataset.cancelCategory}"]`)?.classList.add('hidden'));
            $$('[data-category-edit]').forEach(f=>{const id=f.dataset.categoryEdit,prefix='edit-category-'+id;wireOwnerImagePreview(f,prefix);f.onsubmit=async e=>{e.preventDefault();const fd=new FormData(f),submit=f.querySelector('[type="submit"]');submit.disabled=true;try{await api(`/owner/categories/${id}`,{method:'PATCH',body:{name:fd.get('name'),icon:fd.get('icon')||'package'}});const file=fd.get(prefix+'Image');if(file instanceof File&&file.size)await uploadCategoryImage(id,file);if(fd.get('removeImage')==='on'&&!(file instanceof File&&file.size))await api(`/owner/categories/${id}/image`,{method:'DELETE'});toast('Category updated.');location.reload();}catch(error){toast(error.message,'error');submit.disabled=false;}};});
            $$('[data-delete-category]').forEach(button=>button.onclick=async()=>{if(!await askConfirmation('Delete category?','Products in this category will remain, but become uncategorised.','Delete category'))return;try{await api(`/owner/categories/${button.dataset.deleteCategory}`,{method:'DELETE'});toast('Category deleted.');location.reload();}catch(error){toast(error.message,'error');}});
        });
    }

    if (path.endsWith('/reservations.html')) {
        const data = await api('/owner/reservations'); const items = data.reservations || [];
        return shell('Pickup Reservations','Manage customer pickup requests.',`
            ${items.map(r=>`<article class="panel" data-reservation-card="${safe(r.id)}"><h3>${safe(r.product_name||'Product')}</h3><p>Customer: ${safe(r.customer_name||'')}</p><p>Quantity: ${safe(r.quantity)}</p><p>Status: ${safe(r.status)}</p>
                ${r.status==='Request Sent'?`<label class="field full reservation-message-field">Optional message for customer<textarea data-reservation-message maxlength="500" placeholder="Add a note for the customer (optional)"></textarea></label><div class="owner-item-actions"><button class="btn btn-primary" data-reservation-action="approve" data-id="${safe(r.id)}">Approve</button><button class="btn btn-dark" data-reservation-action="decline" data-id="${safe(r.id)}">Decline</button></div>`:''}
                ${r.status==='Reserved'?`<button class="btn btn-primary" data-reservation-complete="${safe(r.id)}">Mark completed</button>`:''}
                ${r.status==='Declined'&&r.decline_reason?`<p class="muted">Message sent: ${safe(r.decline_reason)}</p>`:''}
            </article>`).join('')||'<div class="empty">No reservations found.</div>'}
        `).then(()=>{
            $$('[data-reservation-action]').forEach(button=>button.onclick=async()=>{
                const decision=button.dataset.reservationAction,card=button.closest('[data-reservation-card]');
                const message=String(card?.querySelector('[data-reservation-message]')?.value||'').trim();button.disabled=true;
                try{await api(`/owner/reservations/${button.dataset.id}/decision`,{method:'POST',body:{decision,message}});toast(decision==='approve'?'Reservation approved.':'Reservation declined.');location.reload();}
                catch(error){toast(error.message,'error');button.disabled=false;}
            });
            $$('[data-reservation-complete]').forEach(button=>button.onclick=async()=>{try{await api(`/owner/reservations/${button.dataset.reservationComplete}/complete`,{method:'POST'});toast('Reservation completed.');location.reload();}catch(error){toast(error.message,'error');}});
        });
    }

    if (path.endsWith('/settings.html')) {
        return initOwnerSettings();
    }

    if (path.endsWith('/offers.html')) {
        const [offerData,productData]=await Promise.all([api('/owner/offers'),api('/owner/products')]);
        const items=offerData.offers||[],productsForOffers=productData.products||[];
        const productChoices=selectedIds=>productsForOffers.map(product=>`<label class="offer-product-choice"><input type="checkbox" name="productIds" value="${safe(product.id)}" ${selectedIds.map(String).includes(String(product.id))?'checked':''}><span>${safe(product.name)}</span><small>${money(product.price)}</small></label>`).join('')||'<p class="muted">Add products first to attach them to offers. You can still create a general offer.</p>';
        const offerFields=offer=>{
            const starts=offer?localDateTimeValue(offer.starts_at):localDateTimeValue(new Date());
            const ends=offer?localDateTimeValue(offer.ends_at):localDateTimeValue(Date.now()+7*86400000);
            return `<label class="field">Offer title<input name="title" maxlength="180" required value="${safe(offer?.title||'')}"></label>
                <label class="field">Discount type<select name="discountType" data-owner-custom-select><option value="percent" ${offer?.discount_type!=='fixed'?'selected':''}>Percentage (%)</option><option value="fixed" ${offer?.discount_type==='fixed'?'selected':''}>Fixed amount (Rs.)</option></select></label>
                <label class="field">Discount value<input name="discountValue" type="number" min="0.01" step="0.01" required value="${safe(offer?.discount_value||'')}"></label>
                <label class="field">Starts at<input name="startsAt" type="datetime-local" required value="${starts}"></label>
                <label class="field">Deadline / Ends at<input name="endsAt" type="datetime-local" required value="${ends}"></label>
                <label class="field full">Description<textarea name="description" maxlength="3000">${safe(offer?.description||'')}</textarea></label>
                <div class="field full"><span>Apply to products <small class="muted">Leave all unchecked for a general shop offer.</small></span><div class="offer-product-picker">${productChoices(offer?.product_ids||[])}</div></div>
                <div class="field full owner-item-actions"><button class="btn btn-primary" type="submit">${offer?'Save offer changes':'Create offer'}</button>${offer?`<button class="btn btn-light" type="button" data-cancel-offer="${safe(offer.id)}">Cancel</button>`:''}</div>`;
        };
        const statusOf=offer=>{const now=Date.now();if(offer.is_hidden)return 'Hidden by owner';if(now>new Date(offer.ends_at).getTime())return 'Expired · hidden from public';if(now<new Date(offer.starts_at).getTime())return 'Scheduled';return 'Active · public';};
        return shell('Manage Offers','Create, edit, extend, hide or permanently delete offers.',`
            <section class="panel owner-form-panel"><h2>Create offer</h2><form id="owner-offer-form" class="form-grid">${offerFields(null)}</form></section>
            <h2 class="owner-section-title">All offers</h2>
            ${items.map(o=>`<article class="panel owner-item-card" data-offer-card="${safe(o.id)}"><div class="owner-item-heading"><div><h3>${safe(o.title)}</h3><p>${safe(o.description||'')}</p><p class="muted">${safe(o.discount_type==='percent'?`${o.discount_value}% off`:`Rs. ${o.discount_value} off`)} · ${statusOf(o)}</p><p class="muted">Deadline: ${safe(new Date(o.ends_at).toLocaleString())}</p></div></div>
                <div class="owner-item-actions"><button class="btn btn-light" type="button" data-edit-offer="${safe(o.id)}">Edit / Extend deadline</button><button class="btn btn-dark" type="button" data-toggle-offer="${safe(o.id)}" data-hidden="${Boolean(o.is_hidden)}">${o.is_hidden?'Unhide offer':'Hide offer'}</button><button class="btn btn-danger" type="button" data-delete-offer="${safe(o.id)}">Delete permanently</button></div>
                <form class="form-grid owner-edit-form hidden" data-offer-edit="${safe(o.id)}">${offerFields(o)}</form>
            </article>`).join('')||'<div class="empty">No offers created yet.</div>'}
        `).then(()=>{
            $$('[data-owner-custom-select]').forEach(enhanceCustomSelect);
            const readOfferForm=form=>{const fd=new FormData(form),start=new Date(fd.get('startsAt')),end=new Date(fd.get('endsAt'));if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))throw new Error('Choose valid start and deadline dates.');return {title:fd.get('title'),description:fd.get('description'),discountType:fd.get('discountType'),discountValue:Number(fd.get('discountValue')),startsAt:start.toISOString(),endsAt:end.toISOString(),productIds:fd.getAll('productIds')};};
            const createForm=$('#owner-offer-form');createForm.onsubmit=async e=>{e.preventDefault();const submit=createForm.querySelector('[type="submit"]');submit.disabled=true;try{await api('/owner/offers',{method:'POST',body:readOfferForm(createForm)});toast('Offer created.');location.reload();}catch(error){toast(error.message,'error');submit.disabled=false;}};
            $$('[data-edit-offer]').forEach(button=>button.onclick=()=>document.querySelector(`[data-offer-edit="${button.dataset.editOffer}"]`)?.classList.toggle('hidden'));
            $$('[data-cancel-offer]').forEach(button=>button.onclick=()=>document.querySelector(`[data-offer-edit="${button.dataset.cancelOffer}"]`)?.classList.add('hidden'));
            $$('[data-offer-edit]').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('[type="submit"]');submit.disabled=true;try{await api(`/owner/offers/${form.dataset.offerEdit}`,{method:'PATCH',body:readOfferForm(form)});toast('Offer updated.');location.reload();}catch(error){toast(error.message,'error');submit.disabled=false;}});
            $$('[data-toggle-offer]').forEach(button=>button.onclick=async()=>{const isHidden=button.dataset.hidden==='true';try{await api(`/owner/offers/${button.dataset.toggleOffer}/visibility`,{method:'PATCH',body:{isHidden:!isHidden}});toast(isHidden?'Offer unhidden.':'Offer hidden from public.');location.reload();}catch(error){toast(error.message,'error');}});
            $$('[data-delete-offer]').forEach(button=>button.onclick=async()=>{if(!await askConfirmation('Delete offer permanently?','This permanently deletes the offer and its product links. This cannot be undone.','Delete permanently'))return;try{await api(`/owner/offers/${button.dataset.deleteOffer}`,{method:'DELETE'});toast('Offer permanently deleted.');location.reload();}catch(error){toast(error.message,'error');}});
        });
    }

    if (path.endsWith('/reviews.html')) {
        const data = await api('/owner/reviews');

        return shell('Manage Reviews', 'Review customer feedback.', `
            ${(data.reviews || []).map(r => `
                <article class="panel">
                    <h3>${safe(r.reviewer_name)}</h3>
                    <p>${safe(r.body)}</p>
                    <p>Visible: ${safe(r.is_visible)}</p>
                </article>
            `).join('')}
        `);
    }

    if (path.endsWith('/suggestions.html')) {
        const data=await api('/owner/suggestions'),items=data.suggestions||[];
        return shell('Manage Suggestions','Publish, hide, reply to or delete customer suggestions.',`
            ${items.map(s=>`<article class="panel owner-item-card" data-owner-suggestion="${safe(s.id)}"><h3>${safe(s.title)}</h3><p>${safe(s.details||'')}</p><p class="muted">From: ${safe(s.customer_name||'Shop owner')} · ${Number(s.likes_count||0)} likes</p>
                <form class="form-grid" data-suggestion-edit="${safe(s.id)}"><label class="field full">Visibility<select name="status" data-owner-custom-select><option value="private" ${s.public_status==='private'?'selected':''}>Private</option><option value="published" ${s.public_status==='published'?'selected':''}>Public</option><option value="hidden" ${s.public_status==='hidden'?'selected':''}>Hidden</option></select></label>
                    <label class="field full">Owner reply<textarea name="reply" maxlength="1500" placeholder="Write an optional reply to the customer">${safe(s.owner_reply||'')}</textarea></label>
                    <div class="field full owner-item-actions"><button class="btn btn-primary" type="submit">Save / Publish</button><button class="btn btn-danger" type="button" data-delete-suggestion="${safe(s.id)}">Delete suggestion</button></div>
                </form></article>`).join('')||'<div class="empty">No suggestions found.</div>'}
        `).then(()=>{
            $$('[data-owner-custom-select]').forEach(enhanceCustomSelect);
            $$('[data-suggestion-edit]').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),submit=form.querySelector('[type="submit"]');submit.disabled=true;try{await api(`/owner/suggestions/${form.dataset.suggestionEdit}`,{method:'PATCH',body:{status:fd.get('status'),reply:fd.get('reply')}});toast('Suggestion updated.');location.reload();}catch(error){toast(error.message,'error');submit.disabled=false;}});
            $$('[data-delete-suggestion]').forEach(button=>button.onclick=async()=>{if(!await askConfirmation('Delete suggestion?','This permanently removes the suggestion and its likes.','Delete suggestion'))return;try{await api(`/owner/suggestions/${button.dataset.deleteSuggestion}`,{method:'DELETE'});toast('Suggestion deleted.');location.reload();}catch(error){toast(error.message,'error');}});
        });
    }

    if (path.endsWith('/updates.html')) {
        return shell('Shop Updates', 'Publish an announcement.', `
            <section class="panel">
                <form id="notice-form" class="form-grid">
                    <label class="field full">
                        Title
                        <input name="title" required>
                    </label>

                    <label class="field full">
                        Message
                        <textarea name="body" required></textarea>
                    </label>

                    <label class="field">
                        <input type="checkbox" name="isPublished" checked>
                        Publish immediately
                    </label>

                    <button class="btn btn-primary">Publish update</button>
                </form>
            </section>
        `).then(() => {
            $('#notice-form').onsubmit = async e => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);

                try {
                    await api('/owner/notices', {
                        method: 'POST',
                        body: {
                            title: fd.get('title'),
                            body: fd.get('body'),
                            isPublished: fd.get('isPublished') === 'on'
                        }
                    });

                    toast('Update published.');
                    e.currentTarget.reset();
                } catch (error) {
                    toast(error.message, 'error');
                }
            };
        });
    }
}

/* -------------------------
   OWNER SETTINGS

------------------------- */
 /* -------------------------
   OWNER SETTINGS
------------------------- */

async function initOwnerSettings() {
    const keys = ['name','suffix','motto','description','phone','email','address','latitude','longitude','bannerImage','aboutImage','socials'];
    return shell('Store Settings', 'Manage your public shop information and location.', `
        <form id="shop-settings" class="panel form-grid">
            <h2 class="field full owner-settings-section">Shop identity</h2>
            <label class="field">Shop name<input name="name" value="${safe(cfg.name)}" required></label>
            <label class="field">Subtitle<input name="suffix" value="${safe(cfg.suffix)}"></label>
            <label class="field full">Motto<input name="motto" value="${safe(cfg.motto)}"></label>
            <h2 class="field full owner-settings-section">About our shop</h2>
            <label class="field full">Shop description (shown on About page)<textarea name="description" rows="4">${safe(cfg.description)}</textarea></label>
            <div class="field full owner-image-field"><span>Homepage banner image</span><input name="bannerImage" value="${safe(cfg.bannerImage)}" placeholder="Image URL"/><input type="file" id="banner-upload" accept="image/jpeg,image/png,image/webp,image/gif"><img class="owner-upload-preview ${cfg.bannerImage?'':'hidden'}" id="banner-preview" src="${safe(cfg.bannerImage)}" alt="Homepage banner preview"><button type="button" class="btn btn-light" data-upload-setting="bannerImage" data-file="banner-upload">Upload banner image</button><small class="muted">Current default is the existing homepage banner. It will not be used as the About image.</small></div>
            <div class="field full owner-image-field"><span>About page image</span><input name="aboutImage" value="${safe(cfg.aboutImage)}" placeholder="Image URL (optional)"/><input type="file" id="about-upload" accept="image/jpeg,image/png,image/webp,image/gif"><img class="owner-upload-preview ${cfg.aboutImage?'':'hidden'}" id="about-preview" src="${safe(cfg.aboutImage)}" alt="About image preview"><button type="button" class="btn btn-light" data-upload-setting="aboutImage" data-file="about-upload">Upload About image</button></div>
            <h2 class="field full owner-settings-section">Contact details</h2>
            <label class="field">Phone<input name="phone" value="${safe(cfg.phone)}"></label>
            <label class="field">Email<input name="email" type="email" value="${safe(cfg.email)}"></label>
            <label class="field full">Shop address<input name="address" value="${safe(cfg.address)}"></label>
            <h2 class="field full owner-settings-section">Shop location on map</h2>
            <p class="field full muted">Allow location access to centre the map near you, then drag the marker to the exact shop location. You can also tap the map to move the pin.</p>
            <div class="field full owner-map-actions"><button type="button" class="btn btn-light" id="owner-use-location">Use my current location</button><span class="muted" id="owner-map-status">Map pin can be moved after the map loads.</span></div>
            <div class="field full"><div id="owner-location-map" class="owner-location-map"></div></div>
            <label class="field">Map latitude<input name="latitude" id="owner-latitude" type="number" step="any" value="${safe(cfg.latitude||'')}"></label>
            <label class="field">Map longitude<input name="longitude" id="owner-longitude" type="number" step="any" value="${safe(cfg.longitude||'')}"></label>
            <h2 class="field full owner-settings-section">Social links</h2>
            ${['instagram','facebook','whatsapp','tiktok'].map(key=>`<label class="field">${safe(key)} profile/link<input name="${key}" type="url" value="${safe(cfg.socials?.[key]||'')}" placeholder="https://..."></label>`).join('')}
            <div class="field full owner-item-actions"><button class="btn btn-primary" type="submit">Save settings</button><button class="btn btn-light" type="reset">Cancel / Reset changes</button></div>
        </form>
    `).then(async()=>{
        const form=$('#shop-settings');
        // Leaflet is loaded only on this owner settings page; the customer storefront is unaffected.
        const loadLeaflet=()=>new Promise((resolve,reject)=>{
            if(window.L)return resolve();
            if(!document.querySelector('#ors-leaflet-css')){const l=document.createElement('link');l.id='ors-leaflet-css';l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l);}
            const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);
        });
        let map,marker;
        const latInput=$('#owner-latitude'),lngInput=$('#owner-longitude'),status=$('#owner-map-status');
        const validCoords=()=>Number.isFinite(Number(latInput.value))&&Number.isFinite(Number(lngInput.value))&&latInput.value!==''&&lngInput.value!=='';
        const setPin=(lat,lng)=>{latInput.value=Number(lat).toFixed(6);lngInput.value=Number(lng).toFixed(6);if(map){const point=[Number(lat),Number(lng)];marker.setLatLng(point);map.setView(point,16);}};
        try{
            await loadLeaflet();
            const initial=validCoords()?[Number(latInput.value),Number(lngInput.value)]:[20,0];
            map=L.map('owner-location-map').setView(initial,validCoords()?16:2);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
            marker=L.marker(initial,{draggable:true}).addTo(map);
            marker.on('dragend',()=>{const p=marker.getLatLng();setPin(p.lat,p.lng);status.textContent='Pin position updated. Save settings to keep it.';});
            map.on('click',e=>{setPin(e.latlng.lat,e.latlng.lng);status.textContent='Pin position updated. Save settings to keep it.';});
            [latInput,lngInput].forEach(input=>input.addEventListener('change',()=>{if(validCoords())setPin(latInput.value,lngInput.value);}));
            setTimeout(()=>map.invalidateSize(),250);
            status.textContent='Drag the pin or tap the map to set the shop location.';
        }catch(error){status.textContent='Map could not load. You can still enter latitude and longitude manually.';console.warn('Map load:',error);}
        form.addEventListener('reset',()=>setTimeout(()=>{if(validCoords()&&map)setPin(latInput.value,lngInput.value);},0));
        $('#owner-use-location').onclick=()=>{
            if(!navigator.geolocation){toast('Location is not supported by this browser.','error');return;}
            status.textContent='Waiting for location permission…';
            navigator.geolocation.getCurrentPosition(pos=>{setPin(pos.coords.latitude,pos.coords.longitude);status.textContent='Current location set as the starting pin. Move it to the shop if needed.';},err=>{status.textContent='Location permission was not granted or location is unavailable. You can move the pin manually.';toast('Could not access your location. Check browser permission.', 'error');},{enableHighAccuracy:true,timeout:12000,maximumAge:0});
        };
        $$('[data-upload-setting]').forEach(button=>button.onclick=async()=>{
            const fileInput=document.getElementById(button.dataset.file),file=fileInput.files?.[0];
            if(!file){toast('Please choose an image first.','error');return;}
            if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)||file.size>5*1024*1024){toast('Choose JPG, PNG, WEBP or GIF up to 5 MB.','error');return;}
            const fd=new FormData();fd.append('folder','settings');fd.append('image',file);button.disabled=true;
            try{const uploaded=await api('/owner/upload',{method:'POST',body:fd});form.elements[button.dataset.uploadSetting].value=uploaded.url;const preview=document.getElementById(button.dataset.uploadSetting==='bannerImage'?'banner-preview':'about-preview');preview.src=uploaded.url;preview.classList.remove('hidden');toast('Image uploaded. Save settings to publish it.');}
            catch(error){toast(error.message,'error');}finally{button.disabled=false;}
        });
        form.onsubmit=async e=>{
            e.preventDefault();const fd=new FormData(form),values=Object.fromEntries(fd.entries());
            values.socials={instagram:values.instagram,facebook:values.facebook,whatsapp:values.whatsapp,tiktok:values.tiktok};
            delete values.instagram;delete values.facebook;delete values.whatsapp;delete values.tiktok;
            try{for(const key of keys){await api(`/owner/settings/${key}`,{method:'PUT',body:{value:values[key]??''}});}toast('Shop settings saved.');location.reload();}
            catch(error){toast(error.message,'error');}
        };
    });
}

/* -------------------------
   APPLICATION STARTUP
------------------------- */

async function startApp() {
    if (localStorage.getItem(THEME_KEY) === 'dark') {
        document.body.classList.add('dark');
    }

    await loadSettings();
    await loadCurrentUser();
    await loadFavourites();

    if (path.includes('/owner/')) {
        try {
            await initOwner();
        } catch (error) {
            document.body.innerHTML = errorState(error);
        }

        return;
    }

    if (path.includes('/customer/')) {
        await initCustomer();
        return;
    }

    if (path.includes('/pages/')) {
        if (path.endsWith('/products.html')) {
            categories = await getCategories();
            await initProducts();
        } else {
            await initStatic();
        }

        return;
    }

    if (path.endsWith('/index.html') ||
        path === '/' ||
        !path.split('/').pop().includes('.')) {
        await initHome();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    startApp().catch(error => {
        console.error('Application startup failed:', error);
        document.body.insertAdjacentHTML(
            'beforeend',
            `<div class="panel">${safe(error.message)}</div>`
        );
    });
});
