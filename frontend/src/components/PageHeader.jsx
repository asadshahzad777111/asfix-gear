import ConnectReveal from './motion/ConnectReveal';

export default function PageHeader({ eyebrow, title, subtitle, children, strapLabel }) {
  const strap = strapLabel || title;
  return (
    <header className="page-header" data-section-strap={strap || undefined}>
      <div className="container page-header-inner">
        <ConnectReveal from="line" className="page-header-connect">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </ConnectReveal>
        {children}
      </div>
    </header>
  );
}
