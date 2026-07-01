import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PremiumButton from '../components/premium/PremiumButton';
import ProductCard from '../components/ProductCard';
import PageHeader from '../components/PageHeader';
import AddProductModal from '../components/AddProductModal';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { SHOP_BRANDS } from '../config/products';
import { useTranslation } from '../context/LanguageContext';
import { startVisibilityPoll } from '../utils/visibilityPoll';

const STOCK_POLL_MS = 25_000;

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
  const [addOpen, setAddOpen] = useState(false);

  const activeBrandData = SHOP_BRANDS.find((b) => b.id === activeBrand);

  const loadProducts = (silent = false) => {
    if (!silent) setLoading(true);
    const params = {};
    if (activeCategory !== 'all') params.category = activeCategory;
    if (activeBrand !== 'all') params.brand = activeBrand;
    if (showSaleOnly) params.on_sale = 'true';
    if (search.trim()) params.search = search.trim();
    api.getProducts(params).then(setProducts).catch(console.error).finally(() => setLoading(false));
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

  const clearBrand = () => {
    setActiveBrand('all');
    const next = new URLSearchParams(searchParams);
    next.delete('brand');
    setSearchParams(next, { replace: true });
  };

  const handleBrandSelect = (e) => {
    const value = e.target.value;
    setActiveBrand(value);
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('brand');
    else next.set('brand', value);
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
            <button type="button" className={`filter-btn ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>{t('shop.all')}</button>
            {categories.map((cat) => (
              <button key={cat} type="button" className={`filter-btn ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</button>
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
            <div className="search-box">
              <input type="search" placeholder={t('shop.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {isStaff && (
              <button type="button" className="filter-btn filter-add" onClick={() => setAddOpen(true)}>+ {t('nav.addProduct')}</button>
            )}
          </div>

          {loading ? (
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
