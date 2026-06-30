import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PremiumButton from '../components/premium/PremiumButton';
import ProductCard from '../components/ProductCard';
import PageHeader from '../components/PageHeader';
import AddProductModal from '../components/AddProductModal';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useTranslation } from '../context/LanguageContext';

export default function Shop() {
  const { isStaff } = useAuth();
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showSaleOnly, setShowSaleOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [searchParams] = useSearchParams();

  const loadProducts = () => {
    setLoading(true);
    const params = {};
    if (activeCategory !== 'all') params.category = activeCategory;
    if (showSaleOnly) params.on_sale = 'true';
    if (search.trim()) params.search = search.trim();
    api.getProducts(params).then(setProducts).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [activeCategory, showSaleOnly, search]);

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
          <div className="filters-bar">
            <button type="button" className={`filter-btn ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>{t('shop.all')}</button>
            {categories.map((cat) => (
              <button key={cat} type="button" className={`filter-btn ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</button>
            ))}
            <button type="button" className={`filter-btn filter-sale ${showSaleOnly ? 'active' : ''}`} onClick={() => setShowSaleOnly((s) => !s)}>
              🏷️ {t('shop.sale')}
            </button>
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
