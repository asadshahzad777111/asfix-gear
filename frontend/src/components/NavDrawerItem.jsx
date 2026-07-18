import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export const DRAWER_TEXT_LIGHT = '#18181b';
export const DRAWER_TEXT_DARK = '#f4f4f5';
export const DRAWER_ACCENT = '#ff6a2b';

function drawerLabelStyle(resolved, accent = false) {
  const color = accent ? DRAWER_ACCENT : resolved === 'dark' ? DRAWER_TEXT_DARK : DRAWER_TEXT_LIGHT;
  return {
    color,
    WebkitTextFillColor: color,
    opacity: 1,
    visibility: 'visible',
  };
}

export function drawerItemStyle(resolved, accent = false) {
  const color = accent ? DRAWER_ACCENT : resolved === 'dark' ? DRAWER_TEXT_DARK : DRAWER_TEXT_LIGHT;
  return {
    color,
    WebkitTextFillColor: color,
    opacity: 1,
    visibility: 'visible',
  };
}

function ItemContent({ icon, label, endIcon = '›', accent = false }) {
  const { resolved } = useTheme();
  return (
    <>
      <span className="nav-drawer-item-glow" aria-hidden="true" />
      <span className="nav-drawer-item-icon" aria-hidden="true">{icon}</span>
      <span className="nav-drawer-item-label" style={drawerLabelStyle(resolved, accent)}>
        {label}
      </span>
      <span className="nav-drawer-item-arrow" aria-hidden="true">{endIcon}</span>
    </>
  );
}

export function NavDrawerLink({ to, end, icon, label, onClick, className = '', accent = false }) {
  const { resolved } = useTheme();
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `nav-drawer-item ${isActive ? 'active' : ''} ${className}`.trim()
      }
      style={drawerItemStyle(resolved, accent)}
      onClick={onClick}
    >
      <ItemContent icon={icon} label={label} accent={accent} />
    </NavLink>
  );
}

export function NavDrawerAnchor({ href, icon, label, className = '', onClick, target, rel, accent = false }) {
  const { resolved } = useTheme();
  return (
    <a
      href={href}
      className={`nav-drawer-item ${className}`.trim()}
      style={drawerItemStyle(resolved, accent)}
      onClick={onClick}
      target={target}
      rel={rel}
    >
      <ItemContent icon={icon} label={label} accent={accent} />
    </a>
  );
}

export function NavDrawerButton({ icon, label, className = '', onClick, type = 'button' }) {
  const { resolved } = useTheme();
  return (
    <button
      type={type}
      className={`nav-drawer-item ${className}`.trim()}
      style={drawerItemStyle(resolved)}
      onClick={onClick}
    >
      <ItemContent icon={icon} label={label} />
    </button>
  );
}

export function NavDrawerAdminLink({ to, icon, label, onClick }) {
  const { resolved } = useTheme();
  return (
    <Link
      to={to}
      className="nav-drawer-item nav-admin"
      style={drawerItemStyle(resolved)}
      onClick={onClick}
    >
      <ItemContent icon={icon} label={label} />
    </Link>
  );
}
