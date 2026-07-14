import { Link } from 'react-router-dom';
import { useClinicianAlerts } from '../hooks/useClinicianAlerts';
import { useStudySurveySummary } from '../hooks/useStudySurveySummary';
import { SECTION_LABELS } from '../constants/surveyScales';

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
  const { summary, questions, isLoading: isLoadingSurvey } = useStudySurveySummary();

  const summaryByKey = new Map(summary.map((row) => [row.questionKey, row]));

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

      <h2>Feasibility survey results</h2>
      {isLoadingSurvey && <p>Loading survey results...</p>}
      {!isLoadingSurvey && summary.length === 0 && <p className="empty-state">No survey responses yet.</p>}
      {!isLoadingSurvey && summary.length > 0 && (
        <div className="survey-summary-table-wrap">
          <table className="survey-summary-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Question</th>
                <th>Avg rating</th>
                <th>Responses</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => {
                const row = summaryByKey.get(question.key);
                return (
                  <tr key={question.key}>
                    <td>{SECTION_LABELS[question.section] || question.section}</td>
                    <td>{question.text}</td>
                    <td>{row?.averageRating !== null && row?.averageRating !== undefined ? row.averageRating.toFixed(1) : '--'}</td>
                    <td>{row?.responseCount ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
