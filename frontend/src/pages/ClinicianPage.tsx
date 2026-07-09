import { Link } from 'react-router-dom';
import { useClinicianAlerts } from '../hooks/useClinicianAlerts';

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low'
};

const ALERT_TYPE_LABEL: Record<string, string> = {
  safety_trigger: 'Safety alert',
  context_cap: 'Long conversation'
};

export function ClinicianPage() {
  const { alerts, isLoading, acknowledge, isAcknowledging } = useClinicianAlerts();

  return (
    <div className="clinician-page">
      <h1>Pending clinical alerts</h1>
      {isLoading && <p>Loading alerts...</p>}
      {!isLoading && alerts.length === 0 && <p className="empty-state">No pending alerts right now.</p>}

      <div className="alert-list">
        {alerts.map((alert) => (
          <article key={alert.id} className={`alert-card alert-card-${alert.priority} alert-card-${alert.alert_type}`}>
            <div className="alert-card-header">
              <span className="alert-type-label">{ALERT_TYPE_LABEL[alert.alert_type] || alert.alert_type}</span>
              <span className="alert-priority">{PRIORITY_LABEL[alert.priority] || alert.priority}</span>
              <span className="alert-time">{new Date(alert.created_at).toLocaleString()}</span>
            </div>
            <p className="alert-user">{alert.user_name}</p>
            <p>{alert.message}</p>
            {alert.context && <p className="alert-context">"{alert.context}"</p>}
            <div className="alert-card-actions">
              {alert.session_id && (
                <Link to={`/clinician/sessions/${alert.session_id}`} className="alert-view-link">
                  View conversation
                </Link>
              )}
              <button type="button" onClick={() => acknowledge(alert.id)} disabled={isAcknowledging}>
                Acknowledge
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
