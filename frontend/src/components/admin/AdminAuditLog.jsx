import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { useTranslation } from '../../context/LanguageContext';

const ACTIONS = ['all', 'bill_create', 'stock_adjust', 'product_delete'];

function actionLabel(action, t) {
  if (action === 'bill_create') return t('admin.auditBillCreate');
  if (action === 'stock_adjust') return t('admin.auditStockAdjust');
  if (action === 'product_delete') return t('admin.auditProductDelete');
  return t('admin.auditAllActions');
}

export default function AdminAuditLog() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [action, setAction] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const staffOptions = useMemo(() => {
    const byId = new Map();
    for (const log of logs) {
      if (log.actor_user_id == null) continue;
      byId.set(String(log.actor_user_id), log.actor_name || `#${log.actor_user_id}`);
    }
    return [...byId.entries()];
  }, [logs]);

  const loadLogs = async (nextAction = action) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAuditLogs({ action: nextAction === 'all' ? '' : nextAction });
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t('admin.auditLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(action);
  }, [action]);

  return (
    <div className="wp-postbox">
      <div className="wp-postbox-head">{t('admin.auditTitle')}</div>
      <div className="wp-postbox-body">
        <p className="field-hint">{t('admin.auditSub')}</p>
        <div className="wp-filter-bar">
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTIONS.map((item) => (
              <option key={item} value={item}>{actionLabel(item, t)}</option>
            ))}
          </select>
          <button type="button" className="wp-button wp-button--secondary" onClick={() => loadLogs(action)}>
            {t('sales.refresh')}
          </button>
        </div>
        {staffOptions.length > 0 ? (
          <p className="field-hint">
            {t('admin.auditStaffSeen')}: {staffOptions.map(([, name]) => name).join(', ')}
          </p>
        ) : null}
        {error ? <div className="alert alert-error">{error}</div> : null}
        {loading ? (
          <div className="wp-loading">{t('common.loading')}</div>
        ) : logs.length === 0 ? (
          <div className="wp-empty">{t('admin.auditEmpty')}</div>
        ) : (
          <div className="wp-table-wrap">
            <table className="wp-table">
              <thead>
                <tr>
                  <th>{t('admin.auditWhen')}</th>
                  <th>{t('admin.auditAction')}</th>
                  <th>{t('admin.auditWho')}</th>
                  <th>{t('admin.auditSummary')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.at ? new Date(log.at).toLocaleString() : '-'}</td>
                    <td>{actionLabel(log.action, t)}</td>
                    <td>
                      <strong>{log.actor_name || '-'}</strong>
                      <br />
                      <small>{log.actor_role || '-'}</small>
                    </td>
                    <td>
                      {log.summary || '-'}
                      {log.details?.order_ref ? <small><br />{t('admin.counterBillNo')}: {log.details.order_ref}</small> : null}
                      {log.details?.before_stock != null ? (
                        <small>
                          <br />
                          {t('admin.auditStockChange')}: {log.details.before_stock} {'->'} {log.details.after_stock}
                        </small>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
