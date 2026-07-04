import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PremiumButton from '../components/premium/PremiumButton';
import ProductCard from '../components/ProductCard';
import PageHeader from '../components/PageHeader';
import AddProductModal from '../components/AddProductModal';
import { useAuth } from '../context/AuthContext';
import { api, ensureApiReady } from '../api/client';
import { SHOP_BRANDS } from '../config/products';
import { useTranslation } from '../context/LanguageContext';
import { startVisibilityPoll } from '../utils/visibilityPoll';
import { readProductsCache, writeProductsCache } from '../utils/productCache';
import { filterPublishedProducts } from '../utils/productStatus';
import ShopModelPicker from '../components/shop/ShopModelPicker';

const STOCK_POLL_MS = 25_000;

function productCacheKey(params) {
  return JSON.stringify(params);
}

export default function Shop() {
  const { isStaff } = useAuth();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(() => searchParams.get('category') || 'all');
  const [activeBrand, setActiveBrand] = useState(() => searchParams.get('brand') || 'all');
  const [showSaleOnly, setShowSaleOnly] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const requestIdRef = useRef(0);

  const activeBrandData = SHOP_BRANDS.find((b) => b.id === activeBrand);

  const buildParams = () => {
    const params = {};
    if (activeCategory !== 'all') params.category = activeCategory;
    if (activeBrand !== 'all') params.brand = activeBrand;
    if (showSaleOnly) params.on_sale = 'true';
    if (search.trim()) params.search = search.trim();
    return params;
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [searchParams]);

  const loadProducts = (silent = false) => {
    const params = buildParams();
    const cacheKey = productCacheKey(params);
    const requestId = ++requestIdRef.current;
    if (!silent) {
      const cached = readProductsCache(cacheKey);
      if (cached?.length) {
        setProducts(cached);
        setLoading(false);
      } else {
        setProducts([]);
        setLoading(true);
      }
    }
    setLoadError(null);
    const fetchProducts = () =>
      api
        .getProducts(params)
        .then((data) => {
          if (requestId !== requestIdRef.current) return;
          const published = filterPublishedProducts(data);
          setProducts(published);
          writeProductsCache(cacheKey, published);
          setLoadError(null);
        })
        .catch((err) => {
          console.error(err);
          setLoadError(err.message || t('shop.serverStarting'));
        })
        .finally(() => setLoading(false));

    if (silent) {
      fetchProducts();
      return;
    }
    ensureApiReady(90000)
      .then(fetchProducts)
      .catch((err) => {
        setLoadError(err.message || t('shop.serverStarting'));
        setLoading(false);
      });
  };

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    const cat = searchParams.get('category') || 'all';
    const brand = searchParams.get('brand') || 'all';
    const q = searchParams.get('search') || '';
    setActiveCategory(cat);
    setActiveBrand(brand);
    setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    // First fetch for these filters shows the loading state; the periodic
    // background refreshes after it stay silent so stock/price stay fresh
    // (offline sales, admin edits, another shopper checking out) without
    // flashing the spinner while someone is browsing.
    let isFirst = true;
    return startVisibilityPoll(() => {
      loadProducts(!isFirst);
      isFirst = false;
    }, STOCK_POLL_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activeBrand, showSaleOnly, search]);

  const handleCategorySelect = (cat) => {
    setActiveCategory(cat);
    setSearch('');
    const next = new URLSearchParams(searchParams);
    if (cat === 'all') next.delete('category');
    else next.set('category', cat);
    next.delete('search');
    setSearchParams(next, { replace: true });
  };

  const clearBrand = () => {
    setActiveBrand('all');
    setSearch('');
    const next = new URLSearchParams(searchParams);
    next.delete('brand');
    next.delete('search');
    setSearchParams(next, { replace: true });
  };

  const handleModelSelect = (model) => {
    setSearch(model);
    const next = new URLSearchParams(searchParams);
    if (activeBrand !== 'all') next.set('brand', activeBrand);
    next.set('search', model);
    setSearchParams(next, { replace: true });
  };

  const handleViewAllBrandModels = () => {
    setSearch('');
    const next = new URLSearchParams(searchParams);
    next.delete('search');
    setSearchParams(next, { replace: true });
  };

  const selectedModelLabel = activeBrandData && search.trim() ? search.trim() : '';

  const handleBrandSelect = (e) => {
    const value = e.target.value;
    setActiveBrand(value);
    const next = new URLSearchParams(searchParams);
    if (value === 'all') {
      next.delete('brand');
      next.delete('search');
      setSearch('');
    } else {
      next.set('brand', value);
      next.delete('search');
      setSearch('');
    }
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (isStaff && searchParams.get('add') === '1') setAddOpen(true);
  }, [searchParams, isStaff]);

  const handleProductAdded = () => {
    loadProducts();
    api.getCategories().then(setCategories).catch(console.error);
  };

  return (
    <>
      <PageHeader
        eyebrow={`🛍️ ${t('shop.eyebrow')}`}
        title={t('shop.title')}
        subtitle={t('shop.subtitle')}
      >
        {isStaff && (
          <PremiumButton className="btn btn-primary page-add-btn" onClick={() => setAddOpen(true)}>
            ➕ {t('shop.addProduct')}
          </PremiumButton>
        )}
      </PageHeader>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {activeBrandData && (
            <div className="active-brand-chip">
              {t('shop.showingBrand', { brand: activeBrandData.label })}
              <button type="button" onClick={clearBrand} aria-label={t('shop.clearBrand')}>✕</button>
            </div>
          )}
          <div className="filters-bar">
            <button type="button" className={`filter-btn ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => handleCategorySelect('all')}>{t('shop.all')}</button>
            {categories.map((cat) => (
              <button key={cat} type="button" className={`filter-btn ${activeCategory === cat ? 'active' : ''}`} onClick={() => handleCategorySelect(cat)}>{cat}</button>
            ))}
            <button type="button" className={`filter-btn filter-sale ${showSaleOnly ? 'active' : ''}`} onClick={() => setShowSaleOnly((s) => !s)}>
              🏷️ {t('shop.sale')}
            </button>
            <select className="filter-btn filter-brand-select" value={activeBrand} onChange={handleBrandSelect} aria-label={t('shop.filterByBrand')}>
              <option value="all">{t('shop.allBrands')}</option>
              {SHOP_BRANDS.map((b) => (
                <option key={b.id} value={b.id}>{b.icon} {b.label}</option>
              ))}
            </select>
            {activeBrandData && (
              <ShopModelPicker
                brand={activeBrandData}
                selectedModel={selectedModelLabel}
                onSelectModel={handleModelSelect}
                onViewAllBrand={handleViewAllBrandModels}
              />
            )}
            <div className="search-box">
              <input type="search" placeholder={t('shop.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {isStaff && (
              <button type="button" className="filter-btn filter-add" onClick={() => setAddOpen(true)}>+ {t('nav.addProduct')}</button>
            )}
          </div>

          {loadError && products.length === 0 ? (
            <div className="empty-state">
              <p>{t('shop.serverStarting')}</p>
              <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => loadProducts()}>
                {t('shop.retryLoad')}
              </button>
            </div>
          ) : loading && products.length === 0 ? (
            <div className="loading">{t('shop.loadingProducts')}</div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <p>{t('shop.emptyCategory')}</p>
              {isStaff && (
                <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setAddOpen(true)}>
                  ➕ {t('shop.addProductShort')}
                </button>
              )}
            </div>
          ) : (
            <div className="products-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} inGrid />
              ))}
            </div>
          )}
        </div>
      </section>

      {isStaff && (
        <>
          <button type="button" className="fab-add" onClick={() => setAddOpen(true)} title={t('shop.addProduct')}>
            <span className="fab-icon">+</span>
            <span className="fab-label">{t('nav.addProduct')}</span>
          </button>
          <AddProductModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={handleProductAdded} />
        </>
      )}
    </>
  );
}
