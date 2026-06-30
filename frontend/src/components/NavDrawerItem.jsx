import { Link, NavLink } from 'react-router-dom';

function ItemContent({ icon, label, endIcon = '›' }) {
  return (
    <>
      <span className="nav-drawer-item-glow" aria-hidden="true" />
      <span className="nav-drawer-item-icon" aria-hidden="true">{icon}</span>
      <span className="nav-drawer-item-label">{label}</span>
      <span className="nav-drawer-item-arrow" aria-hidden="true">{endIcon}</span>
    </>
  );
}

export function NavDrawerLink({ to, end, icon, label, onClick, className = '' }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `nav-drawer-item ${isActive ? 'active' : ''} ${className}`.trim()
      }
      onClick={onClick}
    >
      <ItemContent icon={icon} label={label} />
    </NavLink>
  );
}

export function NavDrawerAnchor({ href, icon, label, className = '', onClick, target, rel }) {
  return (
    <a
      href={href}
      className={`nav-drawer-item ${className}`.trim()}
      onClick={onClick}
      target={target}
      rel={rel}
    >
      <ItemContent icon={icon} label={label} />
    </a>
  );
}

export function NavDrawerButton({ icon, label, className = '', onClick, type = 'button' }) {
  return (
    <button type={type} className={`nav-drawer-item ${className}`.trim()} onClick={onClick}>
      <ItemContent icon={icon} label={label} />
    </button>
  );
}

export function NavDrawerAdminLink({ to, icon, label, onClick }) {
  return (
    <Link to={to} className="nav-drawer-item nav-admin" onClick={onClick}>
      <ItemContent icon={icon} label={label} />
    </Link>
  );
}
