(function () {
    const data = window.TRAVEL_DATA;
    const root = document.getElementById("app");

    if (!data || !root) {
        return;
    }

    const storageKey = "akatsuki-travel-2026-state";
    const body = document.body;
    const page = body.dataset.page || "home";
    const forcedMemberView = body.dataset.auth === "member";
    const defaultExploreCollection = body.dataset.collection || "city";
    const amenityOrder = ["Air Conditioning", "Wifi", "Gym", "Pool", "Kitchen", "Workspace"];
    const propertyOrder = ["House", "Hotel", "Flat", "Villa", "Guest Suite"];
    const toastState = { timer: null };
    let state = loadState();

    if (forcedMemberView && !state.auth.loggedIn) {
        state.auth.loggedIn = true;
        saveState();
    }

    const ui = {
        mobileMenuOpen: false,
        explore: initExploreFilters()
    };

    root.addEventListener("click", handleClick);
    root.addEventListener("submit", handleSubmit);
    root.addEventListener("input", handleInput);
    root.addEventListener("change", handleChange);

    renderPage();

    function loadState() {
        const defaults = {
            auth: {
                loggedIn: false,
                email: data.defaultProfile.email
            },
            profile: { ...data.defaultProfile },
            favorites: [],
            cart: [],
            security: {
                password: "Travel2026!"
            }
        };

        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) {
                return defaults;
            }

            const parsed = JSON.parse(raw);
            return {
                auth: { ...defaults.auth, ...(parsed.auth || {}) },
                profile: { ...defaults.profile, ...(parsed.profile || {}) },
                favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
                cart: Array.isArray(parsed.cart) ? parsed.cart : [],
                security: { ...defaults.security, ...(parsed.security || {}) }
            };
        } catch (error) {
            return defaults;
        }
    }

    function saveState() {
        localStorage.setItem(storageKey, JSON.stringify(state));
    }

    function getIsMember() {
        return state.auth.loggedIn || forcedMemberView;
    }

    function getRoutes(memberView = getIsMember()) {
        return {
            home: memberView ? "signingHomepage.html" : "homePage.html",
            detail: memberView ? "signpage3.html" : "page3.html",
            favorites: memberView ? "FavLogin.html" : "Fav.html",
            login: "login.html",
            signup: "signup.html",
            cart: "Cart.html",
            profile: "Profile.html",
            security: "Security.html",
            explore: {
                city: memberView ? "signPage2.html" : "page2.html",
                coast: memberView ? "signpage2_2.html" : "page2_2.html",
                signature: memberView ? "signpage2_3.html" : "page2_3.html"
            }
        };
    }

    function getDefaultExploreFilters() {
        return {
            collection: defaultExploreCollection,
            search: "",
            checkIn: "",
            checkOut: "",
            guests: 0,
            maxPrice: 500,
            types: new Set(),
            amenities: new Set(),
            sort: "recommended"
        };
    }

    function initExploreFilters() {
        const params = new URLSearchParams(window.location.search);
        const guests = Number(params.get("guests") || "0");
        const maxPrice = Number(params.get("maxPrice") || "500");
        const types = (params.get("types") || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        const amenities = (params.get("amenities") || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        const defaults = getDefaultExploreFilters();

        return {
            ...defaults,
            search: params.get("location") || params.get("search") || defaults.search,
            checkIn: params.get("checkIn") || defaults.checkIn,
            checkOut: params.get("checkOut") || defaults.checkOut,
            guests: Number.isFinite(guests) ? guests : defaults.guests,
            maxPrice: Number.isFinite(maxPrice) ? maxPrice : defaults.maxPrice,
            types: new Set(types),
            amenities: new Set(amenities),
            sort: params.get("sort") || defaults.sort
        };
    }

    function getStay(slug) {
        return data.stays.find((stay) => stay.slug === slug) || data.stays[0];
    }

    function getCollectionMeta(collectionId) {
        return data.collections.find((item) => item.id === collectionId) || data.collections[0];
    }

    function getCollectionStays(collectionId) {
        return data.stays.filter((stay) => stay.collection === collectionId);
    }

    function formatMoney(value) {
        return `$${Number(value).toLocaleString("en-US")}`;
    }

    function getFavoriteCount() {
        return state.favorites.length;
    }

    function getCartCount() {
        return state.cart.length;
    }

    function isFavorite(stayId) {
        return state.favorites.includes(stayId);
    }

    function isInCart(stayId) {
        return state.cart.some((item) => item.id === stayId);
    }

    function averageScore(stay) {
        return stay.rating * 40 + stay.reviews / 8 - stay.price / 15;
    }

    function applyStayFilters(stays, filters) {
        const searchTerm = filters.search.trim().toLowerCase();
        const results = stays.filter((stay) => {
            const matchesSearch =
                !searchTerm ||
                [stay.title, stay.subtitle, stay.location, stay.country, stay.badge, stay.type]
                    .join(" ")
                    .toLowerCase()
                    .includes(searchTerm);
            const matchesGuests = !filters.guests || stay.guests >= filters.guests;
            const matchesPrice = stay.price <= filters.maxPrice;
            const matchesType = !filters.types.size || filters.types.has(stay.type);
            const matchesAmenities =
                !filters.amenities.size ||
                [...filters.amenities].every((amenity) => stay.amenities.includes(amenity));

            return matchesSearch && matchesGuests && matchesPrice && matchesType && matchesAmenities;
        });

        results.sort((left, right) => {
            switch (filters.sort) {
                case "price-low":
                    return left.price - right.price;
                case "price-high":
                    return right.price - left.price;
                case "rating":
                    return right.rating - left.rating || right.reviews - left.reviews;
                default:
                    return averageScore(right) - averageScore(left);
            }
        });

        return results;
    }

    function getCartTotals() {
        const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.nights, 0);
        const serviceFee = subtotal * 0.11;
        const taxes = subtotal * 0.07;
        return {
            subtotal,
            serviceFee,
            taxes,
            total: subtotal + serviceFee + taxes
        };
    }

    function getInitials() {
        const first = state.profile.firstName?.trim()?.[0] || "A";
        const last = state.profile.lastName?.trim()?.[0] || "T";
        return `${first}${last}`.toUpperCase();
    }

    function formatDate(dateString) {
        if (!dateString) {
            return "Flexible";
        }

        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        }).format(new Date(dateString));
    }

    function getDefaultDates() {
        const start = new Date();
        start.setDate(start.getDate() + 9);
        const end = new Date(start);
        end.setDate(end.getDate() + 3);
        return {
            checkIn: start.toISOString().slice(0, 10),
            checkOut: end.toISOString().slice(0, 10),
            nights: 3
        };
    }

    function countNights(checkIn, checkOut) {
        if (!checkIn || !checkOut) {
            return 3;
        }

        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diff = Math.round((end - start) / 86400000);
        return diff > 0 ? diff : 3;
    }

    function createStayBooking(stay, overrides) {
        const defaults = getDefaultDates();
        const checkIn = overrides.checkIn || defaults.checkIn;
        const checkOut = overrides.checkOut || defaults.checkOut;
        const guests = Number(overrides.guests || stay.guests || 2);
        const nights = countNights(checkIn, checkOut);

        return {
            id: stay.slug,
            title: stay.title,
            subtitle: stay.subtitle,
            image: stay.image,
            location: stay.location,
            price: stay.price,
            guests,
            checkIn,
            checkOut,
            nights
        };
    }

    function syncExploreQuery() {
        if (page !== "explore") {
            return;
        }

        const params = new URLSearchParams();
        if (ui.explore.search) {
            params.set("location", ui.explore.search);
        }
        if (ui.explore.checkIn) {
            params.set("checkIn", ui.explore.checkIn);
        }
        if (ui.explore.checkOut) {
            params.set("checkOut", ui.explore.checkOut);
        }
        if (ui.explore.guests) {
            params.set("guests", String(ui.explore.guests));
        }
        if (ui.explore.maxPrice < 500) {
            params.set("maxPrice", String(ui.explore.maxPrice));
        }
        if (ui.explore.types.size) {
            params.set("types", [...ui.explore.types].join(","));
        }
        if (ui.explore.amenities.size) {
            params.set("amenities", [...ui.explore.amenities].join(","));
        }
        if (ui.explore.sort !== "recommended") {
            params.set("sort", ui.explore.sort);
        }

        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        window.history.replaceState({}, "", nextUrl);
    }

    function chooseCollectionBySearch(searchTerm) {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            return defaultExploreCollection;
        }

        const matchedStay = data.stays.find((stay) =>
            [stay.location, stay.country, stay.subtitle, stay.title].join(" ").toLowerCase().includes(term)
        );

        if (matchedStay) {
            return matchedStay.collection;
        }

        const matchedDestination = data.destinations.find((destination) =>
            [destination.name, destination.region].join(" ").toLowerCase().includes(term)
        );

        return matchedDestination ? matchedDestination.collection : defaultExploreCollection;
    }

    function rerender(preserveScroll = false) {
        const scrollTop = window.scrollY;
        renderPage();
        if (preserveScroll) {
            window.scrollTo({ top: scrollTop });
        }
    }

    function showToast(message) {
        const toast = document.getElementById("toast");
        if (!toast) {
            return;
        }

        toast.textContent = message;
        toast.dataset.open = "true";

        window.clearTimeout(toastState.timer);
        toastState.timer = window.setTimeout(() => {
            toast.dataset.open = "false";
        }, 2200);
    }

    function toggleFavorite(stayId) {
        if (isFavorite(stayId)) {
            state.favorites = state.favorites.filter((id) => id !== stayId);
            showToast("Removed from favorites.");
        } else {
            state.favorites = [...state.favorites, stayId];
            showToast("Saved to favorites.");
        }
        saveState();
    }

    function addToCart(stayId, bookingOverrides) {
        const stay = getStay(stayId);
        const booking = createStayBooking(stay, bookingOverrides || {});
        const existingIndex = state.cart.findIndex((item) => item.id === stayId);

        if (existingIndex >= 0) {
            state.cart[existingIndex] = booking;
        } else {
            state.cart = [...state.cart, booking];
        }

        saveState();
        showToast("Added to cart.");
    }

    function removeCartItem(stayId) {
        state.cart = state.cart.filter((item) => item.id !== stayId);
        saveState();
        showToast("Removed from cart.");
    }

    function logout() {
        state.auth.loggedIn = false;
        saveState();
        window.location.href = "homePage.html";
    }

    function icon(name, classes) {
        const className = classes || "h-5 w-5";
        const icons = {
            menu: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/></svg>`,
            close: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>`,
            search: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="m20 20-3.5-3.5"/></svg>`,
            calendar: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path stroke-linecap="round" d="M8 3v4M16 3v4M3 10h18"/></svg>`,
            users: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 4.13a3.5 3.5 0 0 1 0 6.74"/></svg>`,
            heart: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 20.8-1.1-1C5.2 14.6 2 11.8 2 8.3A4.8 4.8 0 0 1 6.9 3.4c1.9 0 3.8.9 5.1 2.4a6.7 6.7 0 0 1 5.1-2.4A4.8 4.8 0 0 1 22 8.3c0 3.5-3.2 6.3-8.9 11.5Z"/></svg>`,
            heartFilled: `<svg class="${className}" viewBox="0 0 24 24" fill="currentColor"><path d="m12 20.8-1.1-1C5.2 14.6 2 11.8 2 8.3A4.8 4.8 0 0 1 6.9 3.4c1.9 0 3.8.9 5.1 2.4a6.7 6.7 0 0 1 5.1-2.4A4.8 4.8 0 0 1 22 8.3c0 3.5-3.2 6.3-8.9 11.5Z"/></svg>`,
            cart: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path stroke-linecap="round" d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h9.5a1 1 0 0 0 1-.8L21 7H7"/></svg>`,
            user: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>`,
            spark: `<svg class="${className}" viewBox="0 0 24 24" fill="currentColor"><path d="M11 2h2l1.7 5.3L20 9v2l-5.3 1.7L13 18h-2l-1.7-5.3L4 11V9l5.3-1.7L11 2Z"/></svg>`,
            map: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18 3 20V6l6-2 6 2 6-2v14l-6 2-6-2Z"/><path d="M9 4v14"/><path d="M15 6v14"/></svg>`,
            star: `<svg class="${className}" viewBox="0 0 24 24" fill="currentColor"><path d="m12 17.3-5.2 3.1 1.4-5.9L3.5 10l6-.5L12 4l2.5 5.5 6 .5-4.7 4.5 1.4 5.9z"/></svg>`,
            shield: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v6c0 4.9-3 8.6-7 9-4-.4-7-4.1-7-9V6l7-3Z"/><path stroke-linecap="round" d="m9.5 12 1.7 1.7L14.8 10"/></svg>`,
            logout: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path stroke-linecap="round" d="m16 17 5-5-5-5"/><path stroke-linecap="round" d="M21 12H9"/></svg>`,
            instagram: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1"/></svg>`,
            x: `<svg class="${className}" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 3H21l-6.9 7.9L22 21h-6.2l-4.8-6.2L5.6 21H3.5l7.4-8.5L2 3h6.3l4.3 5.6z"/></svg>`,
            youtube: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="6" width="19" height="12" rx="3"/><path fill="currentColor" stroke="none" d="m10 9 5 3-5 3z"/></svg>`,
            linkedin: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6.5 8.5v9"/><path d="M11 12.5v5"/><path d="M11 12.5a3 3 0 0 1 6 0v5"/><circle cx="6.5" cy="5.5" r="1"/></svg>`,
            arrowRight: `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" d="M5 12h14"/><path stroke-linecap="round" d="m13 6 6 6-6 6"/></svg>`
        };

        return icons[name] || "";
    }

    function navLink(label, href, active) {
        return `<a href="${href}" class="rounded-full px-4 py-2 text-sm font-semibold transition ${
            active
                ? "bg-white/90 text-ink shadow-sm"
                : "text-white/86 hover:bg-white/12 hover:text-white lg:text-slate-800 lg:hover:bg-brand-50 lg:hover:text-brand-700"
        }">${label}</a>`;
    }

    function renderNav() {
        const member = getIsMember();
        const routes = getRoutes(member);
        const current = {
            home: page === "home",
            explore: page === "explore",
            detail: page === "details",
            favorites: page === "favorites",
            cart: page === "cart",
            profile: page === "profile" || page === "security"
        };

        return `
            <header class="${page === "home" ? "absolute inset-x-0 top-0 z-40" : "sticky top-0 z-40"}">
                <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6">
                    <div class="${page === "home" ? "glass-panel" : "surface-card"} rounded-[28px] px-4 py-3 sm:px-6">
                        <div class="flex items-center justify-between gap-4">
                            <a href="${routes.home}" class="flex items-center gap-3">
                                <div class="flex h-11 w-11 items-center justify-center rounded-2xl accent-gradient text-sm font-black text-white shadow-lg">A</div>
                                <div>
                                    <p class="font-display text-lg font-bold ${page === "home" ? "text-white" : "text-ink"}">Akatsuki Travel</p>
                                    <p class="text-xs uppercase tracking-[0.32em] ${page === "home" ? "text-white/70" : "text-slate-500"}">Travel in 2026</p>
                                </div>
                            </a>
                            <button type="button" data-action="toggle-menu" class="flex h-11 w-11 items-center justify-center rounded-2xl ${
                                page === "home" ? "bg-white/10 text-white" : "bg-brand-50 text-brand-700"
                            } lg:hidden">
                                ${ui.mobileMenuOpen ? icon("close") : icon("menu")}
                            </button>
                            <div class="${ui.mobileMenuOpen ? "flex" : "hidden"} absolute left-4 right-4 top-[86px] z-50 flex-col gap-4 rounded-[26px] bg-slate-900/95 p-4 text-white shadow-float lg:static lg:flex lg:w-auto lg:flex-1 lg:flex-row lg:items-center lg:justify-between lg:bg-transparent lg:p-0 lg:text-inherit lg:shadow-none">
                                <nav class="flex flex-col gap-2 lg:flex-row lg:items-center">
                                    ${navLink("Popular Places", routes.home, current.home)}
                                    ${navLink("Travel Outside", routes.explore.city, current.explore)}
                                    ${navLink("Online Packages", routes.detail, current.detail)}
                                    ${navLink("Favourite", routes.favorites, current.favorites)}
                                </nav>
                                <div class="flex flex-col gap-2 lg:flex-row lg:items-center">
                                    <a href="${routes.cart}" class="flex items-center gap-2 rounded-full ${
                                        current.cart ? "bg-white text-ink" : "bg-white/10 text-white lg:bg-slate-900/5 lg:text-slate-700"
                                    } px-4 py-2 text-sm font-semibold transition">
                                        ${icon("cart", "h-4 w-4")}
                                        Cart
                                        <span class="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-white">${getCartCount()}</span>
                                    </a>
                                    ${
                                        member
                                            ? `
                                                <a href="${routes.profile}" class="flex items-center gap-3 rounded-full bg-white/10 px-2 py-2 text-sm font-semibold text-white transition lg:bg-slate-900/5 lg:text-slate-800">
                                                    <span class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-black text-white">${getInitials()}</span>
                                                    <span>${state.profile.firstName}</span>
                                                </a>
                                                <button type="button" data-action="logout" class="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-50">
                                                    ${icon("logout", "h-4 w-4")}
                                                    Logout
                                                </button>
                                            `
                                            : `
                                                <a href="${routes.login}" class="rounded-full px-4 py-2 text-sm font-semibold ${
                                                    page === "home" ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-brand-50"
                                                }">Login</a>
                                                <a href="${routes.signup}" class="rounded-full accent-gradient px-5 py-2 text-sm font-bold text-white shadow-lg">Start free</a>
                                            `
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
        `;
    }

    function renderFooter() {
        const routes = getRoutes();
        return `
            <footer class="pb-10 pt-6">
                <div class="mx-auto max-w-7xl px-4 sm:px-6">
                    <div class="surface-card overflow-hidden rounded-[32px] p-8 sm:p-10">
                        <div class="grid gap-10 lg:grid-cols-[1.25fr,0.8fr,0.8fr]">
                            <div class="space-y-4">
                                <span class="chip chip-active">${icon("spark", "h-4 w-4")} Rebuilt for responsive travel planning</span>
                                <h2 class="font-display text-3xl font-bold text-ink sm:text-4xl">The old static travel concept now behaves like a real product.</h2>
                                <p class="max-w-2xl text-base leading-7 text-slate-600">Favorites, cart items, profile settings, search filters, and booking details now work together across the project instead of sitting as disconnected static screens.</p>
                            </div>
                            <div class="space-y-3">
                                <p class="text-sm font-extrabold uppercase tracking-[0.3em] text-slate-500">Explore</p>
                                <a class="block text-sm font-semibold text-slate-700 hover:text-brand-700" href="${routes.home}">Popular places</a>
                                <a class="block text-sm font-semibold text-slate-700 hover:text-brand-700" href="${routes.explore.city}">Travel outside</a>
                                <a class="block text-sm font-semibold text-slate-700 hover:text-brand-700" href="${routes.detail}">Online packages</a>
                                <a class="block text-sm font-semibold text-slate-700 hover:text-brand-700" href="${routes.favorites}">Favorites</a>
                            </div>
                            <div class="space-y-4">
                                <p class="text-sm font-extrabold uppercase tracking-[0.3em] text-slate-500">Follow</p>
                                <div class="flex flex-wrap gap-3">
                                    ${data.socials
                                        .map((social) => {
                                            const iconName = social.key === "x" ? "x" : social.key;
                                            return `<a href="${social.url}" target="_blank" rel="noreferrer" class="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white transition hover:scale-105 hover:bg-brand-600">${icon(
                                                iconName,
                                                "h-5 w-5"
                                            )}</a>`;
                                        })
                                        .join("")}
                                </div>
                                <p class="text-sm text-slate-500">Copyright 2026 Akatsuki Travel. Same concept, rebuilt with a cleaner system.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        `;
    }

    function renderShell(content) {
        return `
            ${renderNav()}
            <main>${content}</main>
            ${renderFooter()}
            <div id="toast" data-open="false" class="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-float"></div>
        `;
    }

    function renderAuthLayout(content) {
        return `
            <main>${content}</main>
            <div id="toast" data-open="false" class="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-float"></div>
        `;
    }

    function renderHeroPreviewCards(routes) {
        const previewStays = data.stays.slice(0, 3);
        return `
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                ${previewStays
                    .map(
                        (stay, index) => `
                            <a href="${routes.detail}?stay=${stay.slug}" class="surface-card floating-card fade-up delay-${Math.min(
                                index + 1,
                                3
                            )} flex items-center gap-4 rounded-[28px] p-4">
                                <img src="${stay.image}" alt="${stay.subtitle}" class="h-24 w-24 rounded-2xl object-cover sm:h-28 sm:w-28">
                                <div class="min-w-0">
                                    <p class="text-xs font-extrabold uppercase tracking-[0.28em] text-brand-700">${stay.badge}</p>
                                    <h3 class="mt-2 font-display text-lg font-bold text-ink">${stay.subtitle}</h3>
                                    <p class="mt-1 text-sm text-slate-500">${stay.location}</p>
                                    <div class="mt-3 flex items-center gap-3 text-sm font-semibold text-slate-600">
                                        <span class="inline-flex items-center gap-1 text-amber-500">${icon("star", "h-4 w-4")} ${stay.rating}</span>
                                        <span>${formatMoney(stay.price)}/night</span>
                                    </div>
                                </div>
                            </a>
                        `
                    )
                    .join("")}
            </div>
        `;
    }

    function renderHomePage() {
        const routes = getRoutes();
        return `
            <section class="hero-shell relative isolate overflow-hidden pb-20 pt-28 text-white sm:pb-28 sm:pt-32">
                <div class="hero-inner-glow absolute inset-0"></div>
                <div class="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
                    <div class="fade-up space-y-8">
                        <div class="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90">
                            ${icon("spark", "h-4 w-4")}
                            Reimagined travel experience for 2026
                        </div>
                        <div class="space-y-6">
                            <h1 class="max-w-3xl text-balance font-display text-5xl font-black leading-[0.95] sm:text-6xl lg:text-7xl">Find Your Next Stay with a sharper layout, smarter search, and real booking flows.</h1>
                            <p class="max-w-2xl text-lg leading-8 text-white/78">The original travel idea is still here: flights, hotels, curated packages, and favorite places. The difference is that the experience now feels current, connected, and responsive across screens.</p>
                        </div>
                        <div class="grid gap-4 sm:grid-cols-3">
                            <div class="glass-panel rounded-[26px] px-5 py-4">
                                <p class="text-sm text-white/70">Curated stays</p>
                                <p class="mt-2 font-display text-3xl font-bold">14+</p>
                            </div>
                            <div class="glass-panel rounded-[26px] px-5 py-4">
                                <p class="text-sm text-white/70">Collections</p>
                                <p class="mt-2 font-display text-3xl font-bold">3</p>
                            </div>
                            <div class="glass-panel rounded-[26px] px-5 py-4">
                                <p class="text-sm text-white/70">Responsive pages</p>
                                <p class="mt-2 font-display text-3xl font-bold">All</p>
                            </div>
                        </div>
                        <form data-form="hero-search" class="glass-panel rounded-[34px] p-5 sm:p-6">
                            <div class="grid gap-4 md:grid-cols-[1.3fr,1fr,1fr,0.8fr,auto] md:items-end">
                                <div>
                                    <label class="label text-white/72">${icon("search", "h-4 w-4")} Location</label>
                                    <input class="form-control bg-white text-ink" type="text" name="location" placeholder="Where are you going?">
                                </div>
                                <div>
                                    <label class="label text-white/72">${icon("calendar", "h-4 w-4")} Check in</label>
                                    <input class="form-control bg-white text-ink" type="date" name="checkIn">
                                </div>
                                <div>
                                    <label class="label text-white/72">${icon("calendar", "h-4 w-4")} Check out</label>
                                    <input class="form-control bg-white text-ink" type="date" name="checkOut">
                                </div>
                                <div>
                                    <label class="label text-white/72">${icon("users", "h-4 w-4")} Guests</label>
                                    <select class="form-control bg-white text-ink" name="guests">
                                        <option value="1">1 guest</option>
                                        <option value="2">2 guests</option>
                                        <option value="3">3 guests</option>
                                        <option value="4">4 guests</option>
                                        <option value="5">5 guests</option>
                                        <option value="6">6 guests</option>
                                    </select>
                                </div>
                                <button type="submit" class="inline-flex h-[58px] items-center justify-center gap-2 rounded-2xl accent-gradient px-6 text-sm font-extrabold text-white shadow-lg transition hover:scale-[1.01]">
                                    Search
                                    ${icon("arrowRight", "h-4 w-4")}
                                </button>
                            </div>
                        </form>
                    </div>
                    <div class="fade-in">${renderHeroPreviewCards(routes)}</div>
                </div>
            </section>

            <section class="pb-6 pt-14">
                <div class="mx-auto max-w-7xl px-4 sm:px-6">
                    <div class="mb-8 flex items-end justify-between gap-4">
                        <div>
                            <p class="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-700">Popular places</p>
                            <h2 class="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">Exclusives still using your original travel imagery.</h2>
                        </div>
                        <a href="${routes.explore.city}" class="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 sm:inline-flex">
                            Explore all stays
                            ${icon("arrowRight", "h-4 w-4")}
                        </a>
                    </div>
                    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        ${data.destinations
                            .map(
                                (destination, index) => `
                                    <a href="${getRoutes().explore[destination.collection]}?location=${encodeURIComponent(
                                        destination.name
                                    )}" class="surface-card floating-card fade-up delay-${Math.min(index + 1, 3)} overflow-hidden rounded-[28px]">
                                        <div class="relative">
                                            <img src="${destination.image}" alt="${destination.name}" class="h-56 w-full object-cover">
                                            <div class="absolute inset-x-4 top-4 flex items-center justify-between">
                                                <span class="chip chip-active">${destination.region}</span>
                                                <span class="chip bg-slate-950 text-white">${formatMoney(destination.priceFrom)}</span>
                                            </div>
                                        </div>
                                        <div class="space-y-3 p-5">
                                            <div>
                                                <h3 class="font-display text-2xl font-bold text-ink">${destination.name}</h3>
                                                <p class="mt-2 text-sm leading-6 text-slate-600">${destination.description}</p>
                                            </div>
                                            <span class="inline-flex items-center gap-2 text-sm font-bold text-brand-700">
                                                Search stays
                                                ${icon("arrowRight", "h-4 w-4")}
                                            </span>
                                        </div>
                                    </a>
                                `
                            )
                            .join("")}
                    </div>
                </div>
            </section>

            <section class="py-10">
                <div class="mx-auto max-w-7xl px-4 sm:px-6">
                    <div class="mb-8 flex items-end justify-between gap-4">
                        <div>
                            <p class="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-700">Trending</p>
                            <h2 class="mt-3 font-display text-3xl font-bold text-ink">Destination moods for fast trip planning.</h2>
                        </div>
                    </div>
                    <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                        ${data.hotspots
                            .map(
                                (spot) => `
                                    <a href="${getRoutes().explore[spot.collection]}?location=${encodeURIComponent(
                                        spot.name
                                    )}" class="surface-card floating-card overflow-hidden rounded-[28px]">
                                        <img src="${spot.image}" alt="${spot.name}" class="h-60 w-full object-cover">
                                        <div class="p-5">
                                            <h3 class="font-display text-2xl font-bold text-ink">${spot.name}</h3>
                                            <p class="mt-2 text-sm text-slate-500">${spot.subtitle}</p>
                                        </div>
                                    </a>
                                `
                            )
                            .join("")}
                    </div>
                </div>
            </section>

            <section class="py-10">
                <div class="mx-auto max-w-7xl px-4 sm:px-6">
                    <div class="package-shell overflow-hidden rounded-[36px] p-8 text-white sm:p-12">
                        <div class="max-w-3xl space-y-5">
                            <p class="text-sm font-extrabold uppercase tracking-[0.3em] text-white/70">Online packages</p>
                            <h2 class="font-display text-4xl font-black sm:text-5xl">From static promo blocks to a cleaner package experience.</h2>
                            <p class="max-w-2xl text-lg leading-8 text-white/78">The package page now opens with real stay data, booking controls, map links, related recommendations, and a direct path into cart.</p>
                            <a href="${routes.detail}?stay=santorini-suite" class="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-ink shadow-lg transition hover:bg-brand-50">
                                Open a package
                                ${icon("arrowRight", "h-4 w-4")}
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <section class="py-10">
                <div class="mx-auto max-w-7xl px-4 sm:px-6">
                    <div class="mb-8">
                        <p class="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-700">Traveler stories</p>
                        <h2 class="mt-3 font-display text-3xl font-bold text-ink">Proof that the redesigned project is more usable than the 2022 version.</h2>
                    </div>
                    <div class="grid gap-5 lg:grid-cols-3">
                        ${data.stories
                            .map(
                                (story) => `
                                    <article class="surface-card stay-card overflow-hidden rounded-[30px]">
                                        <div class="story-image relative">
                                            <img src="${story.image}" alt="${story.name}" class="h-72 w-full object-cover">
                                            <div class="absolute inset-x-5 bottom-5 z-10">
                                                <p class="text-sm font-semibold text-white/75">${story.name}</p>
                                                <h3 class="mt-2 font-display text-2xl font-bold text-white">${story.title}</h3>
                                            </div>
                                        </div>
                                        <div class="p-6">
                                            <p class="text-base leading-7 text-slate-600">"${story.quote}"</p>
                                        </div>
                                    </article>
                                `
                            )
                            .join("")}
                    </div>
                </div>
            </section>
        `;
    }

    function renderExploreFilterGroup(title, type, options, selectedValues, counts) {
        return `
            <div class="space-y-3">
                <h3 class="font-display text-xl font-bold text-ink">${title}</h3>
                <div class="space-y-3">
                    ${options
                        .map((option) => {
                            const checked = selectedValues.has(option);
                            const count = counts[option] || 0;
                            return `
                                <label class="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-brand-200">
                                    <span class="flex items-center gap-3">
                                        <input type="checkbox" class="range-accent h-4 w-4 rounded" data-filter-group="${type}" value="${option}" ${
                                            checked ? "checked" : ""
                                        }>
                                        <span class="text-sm font-semibold text-slate-700">${option}</span>
                                    </span>
                                    <span class="text-sm font-bold text-slate-400">${count}</span>
                                </label>
                            `;
                        })
                        .join("")}
                </div>
            </div>
        `;
    }

    function renderStayCard(stay) {
        const routes = getRoutes();
        return `
            <article class="surface-card stay-card overflow-hidden rounded-[32px]">
                <div class="relative">
                    <img src="${stay.image}" alt="${stay.subtitle}" class="h-72 w-full object-cover">
                    <div class="absolute inset-x-5 top-5 flex items-center justify-between gap-4">
                        <span class="chip chip-active">${stay.badge}</span>
                        <button type="button" data-action="favorite" data-stay-id="${stay.slug}" class="flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-brand-600 shadow-lg transition hover:scale-105">
                            ${isFavorite(stay.slug) ? icon("heartFilled", "h-5 w-5") : icon("heart", "h-5 w-5")}
                        </button>
                    </div>
                </div>
                <div class="space-y-5 p-6">
                    <div class="flex items-start justify-between gap-5">
                        <div class="space-y-2">
                            <p class="text-xs font-extrabold uppercase tracking-[0.28em] text-brand-700">${stay.type}</p>
                            <h3 class="font-display text-2xl font-bold text-ink">${stay.subtitle}</h3>
                            <p class="text-sm text-slate-500">${stay.location}</p>
                        </div>
                        <div class="rounded-2xl bg-brand-50 px-3 py-2 text-right">
                            <div class="inline-flex items-center gap-1 text-sm font-bold text-amber-500">${icon("star", "h-4 w-4")} ${stay.rating}</div>
                            <p class="text-xs font-semibold text-slate-500">${stay.reviews} reviews</p>
                        </div>
                    </div>
                    <p class="text-sm leading-7 text-slate-600">${stay.description}</p>
                    <div class="flex flex-wrap gap-2">
                        ${stay.amenities
                            .slice(0, 4)
                            .map((amenity) => `<span class="chip">${amenity}</span>`)
                            .join("")}
                    </div>
                    <div class="flex items-end justify-between gap-5">
                        <div>
                            <p class="text-sm text-slate-500">From</p>
                            <div class="flex items-baseline gap-2">
                                <span class="font-display text-3xl font-bold text-ink">${formatMoney(stay.price)}</span>
                                <span class="text-sm font-semibold text-slate-500">/ night</span>
                            </div>
                        </div>
                        <div class="flex flex-wrap justify-end gap-2">
                            <button type="button" data-action="add-to-cart" data-stay-id="${stay.slug}" class="rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
                                ${isInCart(stay.slug) ? "Update cart" : "Add to cart"}
                            </button>
                            <a href="${routes.detail}?stay=${stay.slug}" class="inline-flex items-center gap-2 rounded-full accent-gradient px-4 py-3 text-sm font-extrabold text-white shadow-lg">
                                View stay
                                ${icon("arrowRight", "h-4 w-4")}
                            </a>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    function renderExplorePage() {
        const collection = getCollectionMeta(ui.explore.collection);
        const collectionStays = getCollectionStays(ui.explore.collection);
        const typeCounts = propertyOrder.reduce((counts, type) => {
            counts[type] = collectionStays.filter((stay) => stay.type === type).length;
            return counts;
        }, {});
        const amenityCounts = amenityOrder.reduce((counts, amenity) => {
            counts[amenity] = collectionStays.filter((stay) => stay.amenities.includes(amenity)).length;
            return counts;
        }, {});
        const routes = getRoutes();

        return `
            <section class="pb-8 pt-28 sm:pt-32">
                <div class="mx-auto max-w-7xl px-4 sm:px-6">
                    <div class="surface-card overflow-hidden rounded-[36px] p-8 sm:p-10">
                        <div class="grid gap-8 lg:grid-cols-[1fr,0.8fr] lg:items-end">
                            <div class="space-y-5">
                                <p class="text-sm font-extrabold uppercase tracking-[0.3em] text-brand-700">${collection.eyebrow}</p>
                                <h1 class="font-display text-4xl font-black text-ink sm:text-5xl">Travel Outside with real filtering, richer cards, and modern responsive layout.</h1>
                                <p class="max-w-2xl text-lg leading-8 text-slate-600">${collection.description}</p>
                            </div>
                            <div class="flex flex-wrap gap-3 lg:justify-end">
                                ${data.collections
                                    .map((item) => {
                                        const href = routes.explore[item.id];
                                        const active = item.id === collection.id;
                                        return `<a href="${href}" class="rounded-full px-5 py-3 text-sm font-extrabold transition ${
                                            active
                                                ? "accent-gradient text-white shadow-lg"
                                                : "border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700"
                                        }">${item.label}</a>`;
                                    })
                                    .join("")}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="pb-16">
                <div class="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[320px,1fr]">
                    <aside class="surface-card h-fit rounded-[32px] p-6 lg:sticky lg:top-28">
                        <div class="mb-6 flex items-center justify-between">
                            <div>
                                <p class="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-700">Filters</p>
                                <h2 class="mt-2 font-display text-2xl font-bold text-ink">Make the results behave.</h2>
                            </div>
                            <button type="button" data-action="clear-filters" class="rounded-full border border-slate-200 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500 transition hover:border-brand-300 hover:text-brand-700">Reset</button>
                        </div>
                        <div class="space-y-6">
                            <div>
                                <label class="label">${icon("search", "h-4 w-4")} Search</label>
                                <input class="form-control" data-filter-text="search" type="text" value="${ui.explore.search}" placeholder="Search city, country, type">
                            </div>
                            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                                <div>
                                    <label class="label">${icon("calendar", "h-4 w-4")} Check in</label>
                                    <input class="form-control" data-filter-text="checkIn" type="date" value="${ui.explore.checkIn}">
                                </div>
                                <div>
                                    <label class="label">${icon("calendar", "h-4 w-4")} Check out</label>
                                    <input class="form-control" data-filter-text="checkOut" type="date" value="${ui.explore.checkOut}">
                                </div>
                            </div>
                            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                                <div>
                                    <label class="label">${icon("users", "h-4 w-4")} Guests</label>
                                    <select class="form-control" data-filter-select="guests">
                                        <option value="0"${ui.explore.guests === 0 ? " selected" : ""}>Any size</option>
                                        <option value="2"${ui.explore.guests === 2 ? " selected" : ""}>2+ guests</option>
                                        <option value="3"${ui.explore.guests === 3 ? " selected" : ""}>3+ guests</option>
                                        <option value="4"${ui.explore.guests === 4 ? " selected" : ""}>4+ guests</option>
                                        <option value="5"${ui.explore.guests === 5 ? " selected" : ""}>5+ guests</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="label">Sort</label>
                                    <select class="form-control" data-filter-select="sort">
                                        <option value="recommended"${ui.explore.sort === "recommended" ? " selected" : ""}>Recommended</option>
                                        <option value="price-low"${ui.explore.sort === "price-low" ? " selected" : ""}>Price: low to high</option>
                                        <option value="price-high"${ui.explore.sort === "price-high" ? " selected" : ""}>Price: high to low</option>
                                        <option value="rating"${ui.explore.sort === "rating" ? " selected" : ""}>Highest rated</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <div class="mb-3 flex items-center justify-between">
                                    <label class="label">Max price</label>
                                    <span id="price-value" class="chip chip-active">${formatMoney(ui.explore.maxPrice)}</span>
                                </div>
                                <input class="range-accent w-full" data-filter-range="maxPrice" type="range" min="120" max="500" step="5" value="${ui.explore.maxPrice}">
                            </div>
                            ${renderExploreFilterGroup("Property type", "type", propertyOrder, ui.explore.types, typeCounts)}
                            ${renderExploreFilterGroup("Amenities", "amenity", amenityOrder, ui.explore.amenities, amenityCounts)}
                        </div>
                    </aside>
                    <div class="space-y-6">
                        <div class="surface-card rounded-[32px] p-6">
                            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p id="results-count" class="text-sm font-bold uppercase tracking-[0.28em] text-brand-700">0 stays</p>
                                    <h2 class="mt-2 font-display text-3xl font-bold text-ink">${collection.label}</h2>
                                    <p id="results-summary" class="mt-2 text-sm leading-7 text-slate-600">Filters update the cards immediately and push the current state into the URL.</p>
                                </div>
                                <div class="chip">${icon("spark", "h-4 w-4")} Dynamic filtering enabled</div>
                            </div>
                            <div id="active-filters" class="mt-5 flex flex-wrap gap-2"></div>
                        </div>
                        <div id="explore-results" class="grid gap-5 xl:grid-cols-2"></div>
                    </div>
                </div>
            </section>
        `;
    }

    function renderDetailsPage() {
        const params = new URLSearchParams(window.location.search);
        const stay = getStay(params.get("stay"));
        const routes = getRoutes();
        const defaults = getDefaultDates();
        const relatedStays = data.stays
            .filter((item) => item.collection === stay.collection && item.slug !== stay.slug)
            .slice(0, 3);

        return `
            <section class="pb-10 pt-28 sm:pt-32">
                <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
                    <div class="surface-card rounded-[34px] p-7 sm:p-9">
                        <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div class="space-y-4">
                                <div class="chip chip-active">${stay.badge}</div>
                                <div>
                                    <p class="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-700">${stay.type}</p>
                                    <h1 class="mt-3 font-display text-4xl font-black text-ink sm:text-5xl">${stay.subtitle}</h1>
                                    <p class="mt-3 text-lg text-slate-600">${stay.location}</p>
                                </div>
                                <div class="flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
                                    <span class="chip">${icon("star", "h-4 w-4")} ${stay.rating} rating</span>
                                    <span class="chip">${stay.reviews} reviews</span>
                                    <span class="chip">${stay.guests} guests</span>
                                    <span class="chip">${stay.beds} beds</span>
                                    <span class="chip">${stay.baths} bath</span>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-3">
                                <button type="button" data-action="favorite" data-stay-id="${stay.slug}" class="rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
                                    ${isFavorite(stay.slug) ? "Saved" : "Save to favorites"}
                                </button>
                                <button type="button" data-action="add-to-cart" data-stay-id="${stay.slug}" class="rounded-full accent-gradient px-5 py-3 text-sm font-extrabold text-white shadow-lg">
                                    ${isInCart(stay.slug) ? "Update booking" : "Add to cart"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="grid gap-4 lg:grid-cols-[1.35fr,0.85fr]">
                        <div class="grid gap-4 sm:grid-cols-2">
                            <img src="${stay.gallery[0]}" alt="${stay.subtitle}" class="surface-card h-full min-h-[380px] rounded-[30px] object-cover sm:row-span-2">
                            ${stay.gallery
                                .slice(1, 5)
                                .map(
                                    (image) =>
                                        `<img src="${image}" alt="${stay.subtitle}" class="surface-card h-[180px] w-full rounded-[26px] object-cover">`
                                )
                                .join("")}
                        </div>
                        <aside class="surface-card h-fit rounded-[32px] p-6 lg:sticky lg:top-28">
                            <p class="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-700">Book this stay</p>
                            <div class="mt-4 flex items-end justify-between gap-4">
                                <div>
                                    <p class="text-sm text-slate-500">Nightly rate</p>
                                    <div class="flex items-baseline gap-2">
                                        <span class="font-display text-4xl font-black text-ink">${formatMoney(stay.price)}</span>
                                        <span class="text-sm font-semibold text-slate-500">/ night</span>
                                    </div>
                                </div>
                                <span class="chip">${stay.distance}</span>
                            </div>
                            <form data-form="detail-booking" data-stay-id="${stay.slug}" class="mt-6 space-y-4">
                                <div>
                                    <label class="label">${icon("calendar", "h-4 w-4")} Check in</label>
                                    <input class="form-control" type="date" name="checkIn" value="${params.get("checkIn") || defaults.checkIn}">
                                </div>
                                <div>
                                    <label class="label">${icon("calendar", "h-4 w-4")} Check out</label>
                                    <input class="form-control" type="date" name="checkOut" value="${params.get("checkOut") || defaults.checkOut}">
                                </div>
                                <div>
                                    <label class="label">${icon("users", "h-4 w-4")} Guests</label>
                                    <select class="form-control" name="guests">
                                        ${[1, 2, 3, 4, 5, 6]
                                            .map((guestCount) => {
                                                const selected = guestCount === stay.guests ? " selected" : "";
                                                return `<option value="${guestCount}"${selected}>${guestCount} guest${guestCount > 1 ? "s" : ""}</option>`;
                                            })
                                            .join("")}
                                    </select>
                                </div>
                                <button type="submit" class="inline-flex w-full items-center justify-center gap-2 rounded-2xl accent-gradient px-5 py-4 text-sm font-extrabold text-white shadow-lg">
                                    Reserve now
                                    ${icon("arrowRight", "h-4 w-4")}
                                </button>
                            </form>
                            <p class="mt-4 text-sm leading-7 text-slate-500">The booking is stored locally in cart so the project behaves like a connected front-end product even without a backend.</p>
                        </aside>
                    </div>

                    <div class="grid gap-6 lg:grid-cols-[1fr,0.9fr]">
                        <div class="surface-card rounded-[32px] p-7">
                            <h2 class="font-display text-3xl font-bold text-ink">What makes this stay worth opening in 2026?</h2>
                            <p class="mt-4 text-base leading-8 text-slate-600">${stay.description} ${stay.summary}</p>
                            <div class="mt-6 flex flex-wrap gap-2">
                                ${stay.amenities.map((amenity) => `<span class="chip">${amenity}</span>`).join("")}
                            </div>
                            <div class="mt-8 grid gap-4 sm:grid-cols-2">
                                <div class="rounded-[26px] bg-brand-50 p-5">
                                    <p class="text-sm font-extrabold uppercase tracking-[0.22em] text-brand-700">Hosted by</p>
                                    <h3 class="mt-3 font-display text-2xl font-bold text-ink">${stay.host}</h3>
                                    <p class="mt-2 text-sm leading-7 text-slate-600">Response rate 100%, fast check-in flow, and a clearer booking handoff than the old page.</p>
                                </div>
                                <div class="rounded-[26px] bg-slate-900 p-5 text-white">
                                    <p class="text-sm font-extrabold uppercase tracking-[0.22em] text-white/60">Map</p>
                                    <h3 class="mt-3 font-display text-2xl font-bold">${stay.location}</h3>
                                    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                        stay.location
                                    )}" target="_blank" rel="noreferrer" class="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-300">
                                        Open in Google Maps
                                        ${icon("arrowRight", "h-4 w-4")}
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div class="surface-card rounded-[32px] p-7">
                            <h2 class="font-display text-3xl font-bold text-ink">Why this page is better than the legacy package screen</h2>
                            <ul class="mt-6 space-y-4 text-sm leading-7 text-slate-600">
                                <li class="flex gap-3"><span class="mt-1 text-brand-600">${icon("shield", "h-4 w-4")}</span><span>The stay is selected dynamically from the current card instead of staying hardcoded on one static package.</span></li>
                                <li class="flex gap-3"><span class="mt-1 text-brand-600">${icon("shield", "h-4 w-4")}</span><span>Booking inputs now push real structured data into cart instead of doing nothing.</span></li>
                                <li class="flex gap-3"><span class="mt-1 text-brand-600">${icon("shield", "h-4 w-4")}</span><span>The layout scales from mobile to large screens without collapsing into fixed-position legacy blocks.</span></li>
                            </ul>
                            <div class="mt-8">
                                <img src="images/host.png" alt="${stay.host}" class="h-20 w-20 rounded-3xl object-cover">
                            </div>
                        </div>
                    </div>

                    <div class="space-y-6">
                        <div class="flex items-end justify-between gap-4">
                            <div>
                                <p class="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-700">Related stays</p>
                                <h2 class="mt-3 font-display text-3xl font-bold text-ink">Keep exploring the same collection.</h2>
                            </div>
                            <a href="${routes.explore[stay.collection]}" class="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 sm:inline-flex">
                                Back to listing
                                ${icon("arrowRight", "h-4 w-4")}
                            </a>
                        </div>
                        <div class="grid gap-5 xl:grid-cols-3">
                            ${relatedStays.map((relatedStay) => renderStayCard(relatedStay)).join("")}
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    function renderEmptyState(title, copy, ctaLabel, href) {
        return `
            <div class="surface-card rounded-[34px] p-8 text-center sm:p-12">
                <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-50 text-brand-700">${icon("spark", "h-6 w-6")}</div>
                <h2 class="mt-6 font-display text-3xl font-bold text-ink">${title}</h2>
                <p class="mx-auto mt-4 max-w-xl text-base leading-8 text-slate-600">${copy}</p>
                <a href="${href}" class="mt-8 inline-flex items-center gap-2 rounded-full accent-gradient px-5 py-3 text-sm font-extrabold text-white shadow-lg">
                    ${ctaLabel}
                    ${icon("arrowRight", "h-4 w-4")}
                </a>
            </div>
        `;
    }

    function renderFavoritesPage() {
        const favoriteStays = state.favorites.map(getStay).filter(Boolean);
        return `
            <section class="pb-16 pt-28 sm:pt-32">
                <div class="mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
                    <div class="surface-card rounded-[34px] p-7 sm:p-9">
                        <p class="text-sm font-extrabold uppercase tracking-[0.3em] text-brand-700">Favourite</p>
                        <h1 class="mt-3 font-display text-4xl font-black text-ink sm:text-5xl">Saved places that now actually persist.</h1>
                        <p class="mt-4 max-w-3xl text-lg leading-8 text-slate-600">The heart buttons are no longer decorative. Favorites are stored locally, rendered here, and linked back to details and cart.</p>
                    </div>
                    ${
                        favoriteStays.length
                            ? `<div class="grid gap-5 xl:grid-cols-3">${favoriteStays.map((stay) => renderStayCard(stay)).join("")}</div>`
                            : renderEmptyState(
                                  "No saved stays yet.",
                                  "Open Travel Outside, tap the heart icon on any card, and it will show up here immediately.",
                                  "Browse stays",
                                  getRoutes().explore.city
                              )
                    }
                </div>
            </section>
        `;
    }

    function renderCartPage() {
        const totals = getCartTotals();
        return `
            <section class="pb-16 pt-28 sm:pt-32">
                <div class="mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
                    <div class="surface-card rounded-[34px] p-7 sm:p-9">
                        <p class="text-sm font-extrabold uppercase tracking-[0.3em] text-brand-700">Cart</p>
                        <h1 class="mt-3 font-display text-4xl font-black text-ink sm:text-5xl">A real booking shortlist, not an empty page.</h1>
                        <p class="mt-4 max-w-3xl text-lg leading-8 text-slate-600">Each item stores dates, guests, nightly pricing, and totals so the flow feels connected from listing to checkout summary.</p>
                    </div>
                    ${
                        state.cart.length
                            ? `
                                <div class="grid gap-6 lg:grid-cols-[1fr,0.42fr]">
                                    <div class="space-y-4">
                                        ${state.cart
                                            .map(
                                                (item) => `
                                                    <article class="surface-card overflow-hidden rounded-[30px]">
                                                        <div class="grid gap-5 p-5 sm:grid-cols-[220px,1fr] sm:p-6">
                                                            <img src="${item.image}" alt="${item.subtitle}" class="h-56 w-full rounded-[26px] object-cover">
                                                            <div class="flex flex-col justify-between gap-5">
                                                                <div>
                                                                    <p class="text-xs font-extrabold uppercase tracking-[0.28em] text-brand-700">${item.location}</p>
                                                                    <h2 class="mt-3 font-display text-2xl font-bold text-ink">${item.subtitle}</h2>
                                                                    <p class="mt-3 text-sm leading-7 text-slate-600">${item.guests} guests · ${item.nights} nights · ${formatDate(
                                                    item.checkIn
                                                )} to ${formatDate(item.checkOut)}</p>
                                                                </div>
                                                                <div class="flex flex-wrap items-end justify-between gap-4">
                                                                    <div>
                                                                        <p class="text-sm text-slate-500">Booking total</p>
                                                                        <div class="flex items-baseline gap-2">
                                                                            <span class="font-display text-3xl font-bold text-ink">${formatMoney(
                                                                                item.price * item.nights
                                                                            )}</span>
                                                                            <span class="text-sm font-semibold text-slate-500">${formatMoney(item.price)}/night</span>
                                                                        </div>
                                                                    </div>
                                                                    <div class="flex gap-2">
                                                                        <a href="${getRoutes().detail}?stay=${item.id}" class="rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">Edit</a>
                                                                        <button type="button" data-action="remove-cart" data-stay-id="${item.id}" class="rounded-full bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700">Remove</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </article>
                                                `
                                            )
                                            .join("")}
                                    </div>
                                    <aside class="surface-card h-fit rounded-[30px] p-6 lg:sticky lg:top-28">
                                        <h2 class="font-display text-3xl font-bold text-ink">Summary</h2>
                                        <div class="mt-6 space-y-4 text-sm text-slate-600">
                                            <div class="flex items-center justify-between"><span>Subtotal</span><span class="font-bold text-ink">${formatMoney(totals.subtotal)}</span></div>
                                            <div class="flex items-center justify-between"><span>Service fee</span><span class="font-bold text-ink">${formatMoney(totals.serviceFee)}</span></div>
                                            <div class="flex items-center justify-between"><span>Taxes</span><span class="font-bold text-ink">${formatMoney(totals.taxes)}</span></div>
                                            <div class="border-t border-slate-200 pt-4 text-base font-bold text-ink">
                                                <div class="flex items-center justify-between"><span>Total</span><span>${formatMoney(totals.total)}</span></div>
                                            </div>
                                        </div>
                                        <button type="button" data-action="checkout" class="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl accent-gradient px-5 py-4 text-sm font-extrabold text-white shadow-lg">
                                            Checkout
                                            ${icon("arrowRight", "h-4 w-4")}
                                        </button>
                                        <button type="button" data-action="clear-cart" class="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-5 py-4 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">Clear cart</button>
                                    </aside>
                                </div>
                            `
                            : renderEmptyState(
                                  "Your cart is empty.",
                                  "Add a stay from the listing page or from any package detail page and the pricing summary will appear here.",
                                  "Start exploring",
                                  getRoutes().explore.city
                              )
                    }
                </div>
            </section>
        `;
    }

    function renderAuthBenefits() {
        return `
            <div class="hidden rounded-[36px] bg-white/10 p-8 text-white shadow-float backdrop-blur xl:flex xl:flex-col">
                <p class="text-sm font-extrabold uppercase tracking-[0.3em] text-white/65">Why this rebuild matters</p>
                <h2 class="mt-6 font-display text-5xl font-black leading-tight">Your old travel concept now behaves like a modern front-end demo.</h2>
                <div class="mt-8 grid gap-4">
                    <div class="glass-panel rounded-[28px] p-5">
                        <p class="text-sm text-white/70">Persistent favorites</p>
                        <p class="mt-2 text-lg font-bold">Heart a stay once and keep it across pages.</p>
                    </div>
                    <div class="glass-panel rounded-[28px] p-5">
                        <p class="text-sm text-white/70">Real filters</p>
                        <p class="mt-2 text-lg font-bold">Property type, price, amenities, and guests all affect the results.</p>
                    </div>
                    <div class="glass-panel rounded-[28px] p-5">
                        <p class="text-sm text-white/70">Responsive layout</p>
                        <p class="mt-2 text-lg font-bold">Cards, forms, and page sections scale cleanly from mobile to desktop.</p>
                    </div>
                </div>
            </div>
        `;
    }

    function renderLoginPage() {
        const next = new URLSearchParams(window.location.search).get("next") || "signingHomepage.html";
        return `
            <section class="auth-shell min-h-screen px-4 py-8 sm:px-6">
                <div class="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-6 xl:grid-cols-[1.08fr,0.92fr]">
                    ${renderAuthBenefits()}
                    <div class="surface-card my-auto rounded-[36px] p-8 sm:p-10">
                        <a href="homePage.html" class="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-brand-700">${icon("arrowRight", "h-4 w-4 rotate-180")} Back to site</a>
                        <p class="mt-8 text-sm font-extrabold uppercase tracking-[0.28em] text-brand-700">Login</p>
                        <h1 class="mt-3 font-display text-4xl font-black text-ink">Welcome back.</h1>
                        <p class="mt-4 text-base leading-8 text-slate-600">Sign in to keep your shortlist, cart, and profile settings on the current device.</p>
                        <form data-form="login" data-next="${next}" class="mt-8 space-y-4">
                            <div>
                                <label class="label">${icon("user", "h-4 w-4")} Email</label>
                                <input class="form-control" type="email" name="email" placeholder="traveler@akatsuki.travel" value="${state.auth.email || state.profile.email}">
                            </div>
                            <div>
                                <label class="label">${icon("shield", "h-4 w-4")} Password</label>
                                <input id="login-password" class="form-control" type="password" name="password" placeholder="Enter your password">
                            </div>
                            <label class="flex items-center gap-3 text-sm font-semibold text-slate-500">
                                <input type="checkbox" class="range-accent h-4 w-4 rounded" data-action="toggle-password" data-target="login-password">
                                Show password
                            </label>
                            <button type="submit" class="inline-flex w-full items-center justify-center gap-2 rounded-2xl accent-gradient px-5 py-4 text-sm font-extrabold text-white shadow-lg">
                                Login
                                ${icon("arrowRight", "h-4 w-4")}
                            </button>
                        </form>
                        <div class="mt-6 rounded-[24px] bg-brand-50 p-5 text-sm leading-7 text-slate-600">
                            Demo flow: any valid-looking email and password will sign in locally and redirect to the signed-in homepage.
                        </div>
                        <p class="mt-6 text-sm text-slate-500">Need an account? <a href="signup.html" class="font-bold text-brand-700">Create one here</a>.</p>
                    </div>
                </div>
            </section>
        `;
    }

    function renderSignupPage() {
        return `
            <section class="auth-shell min-h-screen px-4 py-8 sm:px-6">
                <div class="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-6 xl:grid-cols-[1.08fr,0.92fr]">
                    ${renderAuthBenefits()}
                    <div class="surface-card my-auto rounded-[36px] p-8 sm:p-10">
                        <a href="homePage.html" class="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-brand-700">${icon("arrowRight", "h-4 w-4 rotate-180")} Back to site</a>
                        <p class="mt-8 text-sm font-extrabold uppercase tracking-[0.28em] text-brand-700">Sign up</p>
                        <h1 class="mt-3 font-display text-4xl font-black text-ink">Build your traveler profile.</h1>
                        <p class="mt-4 text-base leading-8 text-slate-600">Create a local demo account to unlock the signed-in pages, profile editing, and shortlist persistence.</p>
                        <form data-form="signup" class="mt-8 grid gap-4 sm:grid-cols-2">
                            <div>
                                <label class="label">First name</label>
                                <input class="form-control" type="text" name="firstName" placeholder="First name" value="${state.profile.firstName}">
                            </div>
                            <div>
                                <label class="label">Last name</label>
                                <input class="form-control" type="text" name="lastName" placeholder="Last name" value="${state.profile.lastName}">
                            </div>
                            <div class="sm:col-span-2">
                                <label class="label">Email</label>
                                <input class="form-control" type="email" name="email" placeholder="traveler@akatsuki.travel" value="${state.profile.email}">
                            </div>
                            <div>
                                <label class="label">Phone</label>
                                <input class="form-control" type="tel" name="phone" placeholder="+20 100 555 2026" value="${state.profile.phone}">
                            </div>
                            <div>
                                <label class="label">Home airport</label>
                                <input class="form-control" type="text" name="homeAirport" placeholder="CAI" value="${state.profile.homeAirport}">
                            </div>
                            <div class="sm:col-span-2">
                                <label class="label">Travel style</label>
                                <input class="form-control" type="text" name="travelStyle" placeholder="Hybrid city and resort stays" value="${state.profile.travelStyle}">
                            </div>
                            <div class="sm:col-span-2">
                                <label class="label">Password</label>
                                <input id="signup-password" class="form-control" type="password" name="password" placeholder="Create a password">
                            </div>
                            <label class="sm:col-span-2 flex items-center gap-3 text-sm font-semibold text-slate-500">
                                <input type="checkbox" class="range-accent h-4 w-4 rounded" data-action="toggle-password" data-target="signup-password">
                                Show password
                            </label>
                            <button type="submit" class="sm:col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl accent-gradient px-5 py-4 text-sm font-extrabold text-white shadow-lg">
                                Create account
                                ${icon("arrowRight", "h-4 w-4")}
                            </button>
                        </form>
                        <p class="mt-6 text-sm text-slate-500">Already have an account? <a href="login.html" class="font-bold text-brand-700">Sign in</a>.</p>
                    </div>
                </div>
            </section>
        `;
    }

    function renderProfileSidebar(activePage) {
        const routes = getRoutes();
        return `
            <aside class="surface-card h-fit rounded-[30px] p-6">
                <div class="flex items-center gap-4">
                    <div class="flex h-16 w-16 items-center justify-center rounded-3xl accent-gradient text-xl font-black text-white">${getInitials()}</div>
                    <div>
                        <p class="font-display text-2xl font-bold text-ink">${state.profile.firstName} ${state.profile.lastName}</p>
                        <p class="text-sm text-slate-500">${state.profile.email}</p>
                    </div>
                </div>
                <div class="mt-8 space-y-2">
                    <a href="${routes.profile}" class="block rounded-2xl px-4 py-3 text-sm font-bold transition ${
                        activePage === "profile" ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                    }">Profile</a>
                    <a href="${routes.security}" class="block rounded-2xl px-4 py-3 text-sm font-bold transition ${
                        activePage === "security" ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                    }">Security</a>
                    <button type="button" data-action="logout" class="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-600 transition hover:bg-slate-50">
                        ${icon("logout", "h-4 w-4")}
                        Logout
                    </button>
                </div>
            </aside>
        `;
    }

    function renderProfilePage() {
        return `
            <section class="pb-16 pt-28 sm:pt-32">
                <div class="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[280px,1fr]">
                    ${renderProfileSidebar("profile")}
                    <div class="space-y-6">
                        <div class="surface-card rounded-[32px] p-7">
                            <p class="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-700">Profile</p>
                            <h1 class="mt-3 font-display text-4xl font-black text-ink">Edit account details.</h1>
                            <p class="mt-4 max-w-3xl text-base leading-8 text-slate-600">This replaces the old fixed form with a cleaner responsive layout and real local persistence.</p>
                        </div>
                        <form data-form="profile" class="surface-card rounded-[32px] p-7">
                            <div class="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label class="label">First name</label>
                                    <input class="form-control" type="text" name="firstName" value="${state.profile.firstName}">
                                </div>
                                <div>
                                    <label class="label">Last name</label>
                                    <input class="form-control" type="text" name="lastName" value="${state.profile.lastName}">
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="label">Email</label>
                                    <input class="form-control" type="email" name="email" value="${state.profile.email}">
                                </div>
                                <div>
                                    <label class="label">Phone</label>
                                    <input class="form-control" type="tel" name="phone" value="${state.profile.phone}">
                                </div>
                                <div>
                                    <label class="label">Home airport</label>
                                    <input class="form-control" type="text" name="homeAirport" value="${state.profile.homeAirport}">
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="label">Travel style</label>
                                    <input class="form-control" type="text" name="travelStyle" value="${state.profile.travelStyle}">
                                </div>
                            </div>
                            <button type="submit" class="mt-6 inline-flex items-center gap-2 rounded-2xl accent-gradient px-5 py-4 text-sm font-extrabold text-white shadow-lg">
                                Save profile
                                ${icon("arrowRight", "h-4 w-4")}
                            </button>
                        </form>
                    </div>
                </div>
            </section>
        `;
    }

    function renderSecurityPage() {
        return `
            <section class="pb-16 pt-28 sm:pt-32">
                <div class="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[280px,1fr]">
                    ${renderProfileSidebar("security")}
                    <div class="space-y-6">
                        <div class="surface-card rounded-[32px] p-7">
                            <p class="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-700">Security</p>
                            <h1 class="mt-3 font-display text-4xl font-black text-ink">Update the password flow.</h1>
                            <p class="mt-4 max-w-3xl text-base leading-8 text-slate-600">The legacy page was only a visual shell. This version validates inputs and stores a demo password locally.</p>
                        </div>
                        <form data-form="security" class="surface-card rounded-[32px] p-7">
                            <div class="grid gap-4">
                                <div>
                                    <label class="label">Current password</label>
                                    <input class="form-control" type="password" name="currentPassword" placeholder="Enter current password">
                                </div>
                                <div>
                                    <label class="label">New password</label>
                                    <input class="form-control" type="password" name="newPassword" placeholder="Enter new password">
                                </div>
                                <div>
                                    <label class="label">Confirm password</label>
                                    <input class="form-control" type="password" name="confirmPassword" placeholder="Confirm new password">
                                </div>
                            </div>
                            <div class="mt-6 rounded-[24px] bg-brand-50 p-5 text-sm leading-7 text-slate-600">
                                Use at least 8 characters. The update stays local because the project does not include a backend.
                            </div>
                            <button type="submit" class="mt-6 inline-flex items-center gap-2 rounded-2xl accent-gradient px-5 py-4 text-sm font-extrabold text-white shadow-lg">
                                Save password
                                ${icon("arrowRight", "h-4 w-4")}
                            </button>
                        </form>
                    </div>
                </div>
            </section>
        `;
    }

    function renderExploreResults() {
        const resultsNode = document.getElementById("explore-results");
        if (!resultsNode) {
            return;
        }

        const results = applyStayFilters(getCollectionStays(ui.explore.collection), ui.explore);
        const resultCount = document.getElementById("results-count");
        const resultSummary = document.getElementById("results-summary");
        const activeFiltersNode = document.getElementById("active-filters");
        const priceValue = document.getElementById("price-value");

        if (resultCount) {
            resultCount.textContent = `${results.length} stay${results.length === 1 ? "" : "s"}`;
        }

        if (resultSummary) {
            const detailBits = [];
            if (ui.explore.search) {
                detailBits.push(`matching "${ui.explore.search}"`);
            }
            if (ui.explore.guests) {
                detailBits.push(`for ${ui.explore.guests}+ guests`);
            }
            if (ui.explore.checkIn || ui.explore.checkOut) {
                detailBits.push(`between ${formatDate(ui.explore.checkIn)} and ${formatDate(ui.explore.checkOut)}`);
            }
            resultSummary.textContent = detailBits.length
                ? `Showing stays ${detailBits.join(" ")}.`
                : "Filter by search, dates, price, guest count, property type, or amenities.";
        }

        if (priceValue) {
            priceValue.textContent = formatMoney(ui.explore.maxPrice);
        }

        if (activeFiltersNode) {
            const chips = [];
            if (ui.explore.search) {
                chips.push({ label: `Search: ${ui.explore.search}`, key: "search" });
            }
            if (ui.explore.guests) {
                chips.push({ label: `${ui.explore.guests}+ guests`, key: "guests" });
            }
            if (ui.explore.maxPrice < 500) {
                chips.push({ label: `Under ${formatMoney(ui.explore.maxPrice)}`, key: "maxPrice" });
            }
            [...ui.explore.types].forEach((value) => chips.push({ label: value, key: "type", value }));
            [...ui.explore.amenities].forEach((value) => chips.push({ label: value, key: "amenity", value }));

            activeFiltersNode.innerHTML = chips.length
                ? chips
                      .map(
                          (chip) => `
                            <button type="button" data-action="remove-filter" data-filter-key="${chip.key}" data-filter-value="${chip.value || ""}" class="chip chip-active">
                                ${chip.label}
                                ${icon("close", "h-3.5 w-3.5")}
                            </button>
                        `
                      )
                      .join("")
                : `<span class="text-sm text-slate-400">No active filters yet.</span>`;
        }

        resultsNode.innerHTML = results.length
            ? results.map((stay) => renderStayCard(stay)).join("")
            : renderEmptyState(
                  "No stays matched the current filters.",
                  "Try raising the max price, removing one of the amenity filters, or switching to another collection.",
                  "Reset filters",
                  getRoutes().explore[ui.explore.collection]
              );
    }

    function hydratePage() {
        if (page === "explore") {
            renderExploreResults();
            syncExploreQuery();
        }
    }

    function renderPage() {
        let content = "";
        let useAuthLayout = false;

        switch (page) {
            case "home":
                content = renderHomePage();
                break;
            case "explore":
                content = renderExplorePage();
                break;
            case "details":
                content = renderDetailsPage();
                break;
            case "favorites":
                content = renderFavoritesPage();
                break;
            case "cart":
                content = renderCartPage();
                break;
            case "login":
                content = renderLoginPage();
                useAuthLayout = true;
                break;
            case "signup":
                content = renderSignupPage();
                useAuthLayout = true;
                break;
            case "profile":
                content = renderProfilePage();
                break;
            case "security":
                content = renderSecurityPage();
                break;
            default:
                content = renderHomePage();
        }

        root.innerHTML = useAuthLayout ? renderAuthLayout(content) : renderShell(content);

        if (window.tailwind && typeof window.tailwind.refresh === "function") {
            window.tailwind.refresh();
        }

        hydratePage();
    }

    function handleClick(event) {
        const target = event.target.closest("[data-action]");
        if (!target) {
            return;
        }

        const action = target.dataset.action;

        if (action === "toggle-menu") {
            ui.mobileMenuOpen = !ui.mobileMenuOpen;
            rerender();
            return;
        }

        if (action === "favorite") {
            const stayId = target.dataset.stayId;
            toggleFavorite(stayId);
            rerender(true);
            return;
        }

        if (action === "add-to-cart") {
            const stayId = target.dataset.stayId;
            const bookingOverrides = {};
            if (page === "explore") {
                bookingOverrides.checkIn = ui.explore.checkIn;
                bookingOverrides.checkOut = ui.explore.checkOut;
                bookingOverrides.guests = ui.explore.guests || undefined;
            }
            addToCart(stayId, bookingOverrides);
            rerender(true);
            return;
        }

        if (action === "remove-cart") {
            removeCartItem(target.dataset.stayId);
            rerender(true);
            return;
        }

        if (action === "clear-cart") {
            state.cart = [];
            saveState();
            showToast("Cart cleared.");
            rerender();
            return;
        }

        if (action === "checkout") {
            showToast("Checkout flow simulated successfully.");
            return;
        }

        if (action === "logout") {
            logout();
            return;
        }

        if (action === "clear-filters") {
            ui.explore = getDefaultExploreFilters();
            rerender(true);
            return;
        }

        if (action === "remove-filter") {
            const key = target.dataset.filterKey;
            const value = target.dataset.filterValue;

            if (key === "search" || key === "maxPrice" || key === "guests") {
                if (key === "search") {
                    ui.explore.search = "";
                }
                if (key === "maxPrice") {
                    ui.explore.maxPrice = 500;
                }
                if (key === "guests") {
                    ui.explore.guests = 0;
                }
            } else if (key === "type") {
                ui.explore.types.delete(value);
            } else if (key === "amenity") {
                ui.explore.amenities.delete(value);
            }

            rerender(true);
            return;
        }

        if (action === "toggle-password") {
            const targetInput = document.getElementById(target.dataset.target);
            if (targetInput) {
                targetInput.type = target.checked ? "text" : "password";
            }
        }
    }

    function handleSubmit(event) {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        const formName = form.dataset.form;
        if (!formName) {
            return;
        }

        event.preventDefault();

        if (formName === "hero-search") {
            const formData = new FormData(form);
            const location = String(formData.get("location") || "");
            const checkIn = String(formData.get("checkIn") || "");
            const checkOut = String(formData.get("checkOut") || "");
            const guests = String(formData.get("guests") || "2");
            const collection = chooseCollectionBySearch(location);
            const routes = getRoutes();
            const params = new URLSearchParams();
            if (location) {
                params.set("location", location);
            }
            if (checkIn) {
                params.set("checkIn", checkIn);
            }
            if (checkOut) {
                params.set("checkOut", checkOut);
            }
            params.set("guests", guests);
            window.location.href = `${routes.explore[collection]}?${params.toString()}`;
            return;
        }

        if (formName === "detail-booking") {
            const formData = new FormData(form);
            addToCart(form.dataset.stayId, {
                checkIn: String(formData.get("checkIn") || ""),
                checkOut: String(formData.get("checkOut") || ""),
                guests: String(formData.get("guests") || "")
            });
            rerender(true);
            return;
        }

        if (formName === "login") {
            const formData = new FormData(form);
            const email = String(formData.get("email") || "").trim();
            const password = String(formData.get("password") || "").trim();
            if (!email || !password) {
                showToast("Enter email and password.");
                return;
            }

            state.auth.loggedIn = true;
            state.auth.email = email;
            state.profile.email = email;
            saveState();
            showToast("Logged in.");
            window.location.href = form.dataset.next || "signingHomepage.html";
            return;
        }

        if (formName === "signup") {
            const formData = new FormData(form);
            const password = String(formData.get("password") || "").trim();
            if (password.length < 8) {
                showToast("Use at least 8 characters for the password.");
                return;
            }

            state.profile = {
                firstName: String(formData.get("firstName") || "").trim() || state.profile.firstName,
                lastName: String(formData.get("lastName") || "").trim() || state.profile.lastName,
                email: String(formData.get("email") || "").trim() || state.profile.email,
                phone: String(formData.get("phone") || "").trim() || state.profile.phone,
                homeAirport: String(formData.get("homeAirport") || "").trim() || state.profile.homeAirport,
                travelStyle: String(formData.get("travelStyle") || "").trim() || state.profile.travelStyle
            };
            state.security.password = password;
            state.auth.loggedIn = true;
            state.auth.email = state.profile.email;
            saveState();
            showToast("Account created.");
            window.location.href = "signingHomepage.html";
            return;
        }

        if (formName === "profile") {
            const formData = new FormData(form);
            state.profile = {
                firstName: String(formData.get("firstName") || "").trim() || state.profile.firstName,
                lastName: String(formData.get("lastName") || "").trim() || state.profile.lastName,
                email: String(formData.get("email") || "").trim() || state.profile.email,
                phone: String(formData.get("phone") || "").trim() || state.profile.phone,
                homeAirport: String(formData.get("homeAirport") || "").trim() || state.profile.homeAirport,
                travelStyle: String(formData.get("travelStyle") || "").trim() || state.profile.travelStyle
            };
            state.auth.email = state.profile.email;
            saveState();
            showToast("Profile saved.");
            rerender(true);
            return;
        }

        if (formName === "security") {
            const formData = new FormData(form);
            const currentPassword = String(formData.get("currentPassword") || "");
            const newPassword = String(formData.get("newPassword") || "");
            const confirmPassword = String(formData.get("confirmPassword") || "");

            if (currentPassword !== state.security.password) {
                showToast("Current password is incorrect.");
                return;
            }
            if (newPassword.length < 8) {
                showToast("New password must be at least 8 characters.");
                return;
            }
            if (newPassword !== confirmPassword) {
                showToast("New password and confirmation do not match.");
                return;
            }

            state.security.password = newPassword;
            saveState();
            form.reset();
            showToast("Password updated.");
        }
    }

    function handleInput(event) {
        if (page !== "explore") {
            return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        if (target.matches("[data-filter-text='search']")) {
            ui.explore.search = target.value;
            renderExploreResults();
            syncExploreQuery();
        }

        if (target.matches("[data-filter-text='checkIn']")) {
            ui.explore.checkIn = target.value;
            renderExploreResults();
            syncExploreQuery();
        }

        if (target.matches("[data-filter-text='checkOut']")) {
            ui.explore.checkOut = target.value;
            renderExploreResults();
            syncExploreQuery();
        }

        if (target.matches("[data-filter-range='maxPrice']")) {
            ui.explore.maxPrice = Number(target.value);
            renderExploreResults();
            syncExploreQuery();
        }
    }

    function handleChange(event) {
        if (page !== "explore") {
            return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        if (target.matches("[data-filter-select='guests']")) {
            ui.explore.guests = Number(target.value);
            renderExploreResults();
            syncExploreQuery();
        }

        if (target.matches("[data-filter-select='sort']")) {
            ui.explore.sort = target.value;
            renderExploreResults();
            syncExploreQuery();
        }

        if (target.matches("[data-filter-group='type']")) {
            if (target.checked) {
                ui.explore.types.add(target.value);
            } else {
                ui.explore.types.delete(target.value);
            }
            renderExploreResults();
            syncExploreQuery();
        }

        if (target.matches("[data-filter-group='amenity']")) {
            if (target.checked) {
                ui.explore.amenities.add(target.value);
            } else {
                ui.explore.amenities.delete(target.value);
            }
            renderExploreResults();
            syncExploreQuery();
        }
    }
})();
