export const STAFF_ROLES = ['super_admin', 'admin', 'editor'];

export function isSuperAdmin(user) {
  return Boolean(user?.active && !user?.blocked && user.role === 'super_admin');
}

export function isStaff(user) {
  return Boolean(user?.active && !user?.blocked && STAFF_ROLES.includes(user.role));
}

export function canManageTeam(user) {
  return isSuperAdmin(user);
}

export function canManageProducts(user) {
  return isStaff(user);
}

export function canDeleteProducts(user) {
  return Boolean(user?.active && !user?.blocked && ['super_admin', 'admin'].includes(user.role));
}

export function canManageAdmins(user) {
  return canManageTeam(user);
}

export function canManageBookings(user) {
  return isStaff(user);
}

export function canManageShopSettings(user) {
  return Boolean(user?.active && !user?.blocked && ['super_admin', 'admin'].includes(user.role));
}

export function canUpdateOrderStatus(user) {
  return isStaff(user);
}

export function roleLabel(role) {
  const labels = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    editor: 'Staff Editor',
  };
  return labels[role] || role;
}

export function isValidStaffGmail(email) {
  return /^[^\s@]+@gmail\.com$/i.test(String(email || '').trim());
}
