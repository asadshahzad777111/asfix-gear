export const STAFF_ROLES = ['super_admin', 'admin', 'editor'];

export function isCustomer(user) {
  return Boolean(user?.active && !user?.blocked && user.role === 'customer');
}

export function isSuperAdmin(user) {
  return Boolean(user?.active && !user?.blocked && user.role === 'super_admin');
}

export function isStaff(user) {
  return Boolean(user?.active && !user?.blocked && STAFF_ROLES.includes(user.role));
}

export function canViewSalesReport(user) {
  return isStaff(user);
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

/**
 * A Super Admin can edit/delete any product. Every other staff role may only
 * touch products they personally added — mirrors the backend check in
 * backend/routes/products.js so the UI hides actions that would 403 anyway.
 */
export function canEditProduct(user, product) {
  if (!isStaff(user)) return false;
  if (user.role === 'super_admin') return true;
  return product?.created_by != null && String(product.created_by) === String(user.id);
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
