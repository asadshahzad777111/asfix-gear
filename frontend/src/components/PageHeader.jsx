export default function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-header">
      <div className="container page-header-inner">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
