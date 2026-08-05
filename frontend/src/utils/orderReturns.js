/** Helpers to link POS returns with their original sale bills. */

export function isReturnOrder(order) {
  return order?.source === 'counter_return' || order?.transaction_type === 'return';
}

export function returnRefundAmount(order) {
  const explicit = Number(order?.return_amount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return Math.abs(Number(order?.total_amount) || 0);
}

/** Line / order profit with correct sign for returns (reverses sale profit). */
export function orderLineFinancials(item, { isReturn = false } = {}) {
  const qty = Number(item?.qty) || 1;
  const sign = isReturn ? -1 : 1;
  const saleLine = Number(item?.price || 0) * qty * sign;
  const costLine = Number(item?.cost_price || 0) * qty * sign;
  return {
    qty,
    saleLine,
    costLine,
    profitLine: saleLine - costLine,
  };
}

export function orderProfitTotals(order) {
  const isReturn = isReturnOrder(order);
  const sign = isReturn ? -1 : 1;
  const items = Array.isArray(order?.items) ? order.items : [];
  const costTotal = items.reduce(
    (sum, item) => sum + Number(item.cost_price || 0) * (Number(item.qty) || 1),
    0,
  ) * sign;
  const saleTotal = Number.isFinite(Number(order?.total_amount))
    ? Number(order.total_amount)
    : items.reduce((sum, item) => sum + Number(item.price || 0) * (Number(item.qty) || 1), 0) * sign;
  return {
    saleTotal,
    costTotal,
    profitTotal: saleTotal - costTotal,
    isReturn,
  };
}

/**
 * Attach linked_returns / returned_amount / net_amount onto sale orders.
 * @param {object[]} orders - usually the full admin orders list
 */
export function enrichOrdersWithReturns(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const returnsByOriginal = new Map();

  for (const order of list) {
    if (!isReturnOrder(order)) continue;
    const key = String(order.original_order_id ?? '');
    if (!key) continue;
    if (!returnsByOriginal.has(key)) returnsByOriginal.set(key, []);
    returnsByOriginal.get(key).push(order);
  }

  for (const [, returns] of returnsByOriginal) {
    returns.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  return list.map((order) => {
    if (isReturnOrder(order)) return order;
    const linked = returnsByOriginal.get(String(order.id)) || [];
    if (!linked.length) return order;
    const returnedAmount = linked.reduce((sum, row) => sum + returnRefundAmount(row), 0);
    const originalTotal = Number(order.total_amount) || 0;
    return {
      ...order,
      linked_returns: linked,
      returned_amount: returnedAmount,
      net_amount: originalTotal - returnedAmount,
    };
  });
}

/**
 * Build display rows: sale + nested returns together; orphan returns alone.
 * When a return is in `filtered` but its parent is not, parent is still pulled in from `allOrders`.
 */
export function buildAdminOrderRows(filtered, allOrders) {
  const all = enrichOrdersWithReturns(Array.isArray(allOrders) ? allOrders : filtered);
  const byId = new Map(all.map((o) => [String(o.id), o]));
  const filteredList = Array.isArray(filtered) ? filtered : [];
  const filteredIds = new Set(filteredList.map((o) => String(o.id)));

  const parentIds = new Set();
  for (const order of filteredList) {
    if (isReturnOrder(order)) {
      if (order.original_order_id != null && byId.has(String(order.original_order_id))) {
        parentIds.add(String(order.original_order_id));
      }
    } else {
      parentIds.add(String(order.id));
    }
  }

  const parents = [...parentIds]
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  const rows = [];
  const shownReturnIds = new Set();

  for (const parent of parents) {
    const enrichedParent = byId.get(String(parent.id)) || parent;
    rows.push({ kind: 'sale', order: enrichedParent, depth: 0 });

    const children = enrichedParent.linked_returns || [];
    const parentInFilter = filteredIds.has(String(parent.id));
    for (const child of children) {
      if (!parentInFilter && !filteredIds.has(String(child.id))) continue;
      rows.push({ kind: 'return', order: child, depth: 1, parent: enrichedParent });
      shownReturnIds.add(String(child.id));
    }
  }

  const orphans = filteredList
    .filter((o) => isReturnOrder(o) && !shownReturnIds.has(String(o.id)))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  for (const order of orphans) {
    rows.push({ kind: 'return', order, depth: 0, parent: null });
  }

  return rows;
}
