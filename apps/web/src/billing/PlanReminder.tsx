import { Alert, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { daysLeft, isOnTrial, isPaid, useSubscription } from './subscription';

/** A short note on the home screen during the trial or when Free checks run low. */
export function PlanReminder() {
  const { subscription: sub } = useSubscription();
  if (!sub || isPaid(sub)) return null;

  if (isOnTrial(sub) && sub.trial_ends_at) {
    const days = daysLeft(sub.trial_ends_at);
    return (
      <Alert
        severity="info"
        role="status"
        action={
          <Button component={RouterLink} to="/billing" color="inherit" size="small">
            {`${sub.plan_name} free trial: ${days} ${days === 1 ? 'day' : 'days'} left`}
          </Button>
        }
      >
        Unlimited checks during your trial.
      </Alert>
    );
  }

  if (sub.monthly_checks === null) return null;
  const left = Math.max(0, sub.monthly_checks - sub.checks_used);
  if (left > 3) return null;
  return (
    <Alert
      severity="warning"
      role="status"
      action={
        <Button component={RouterLink} to="/billing" color="inherit" size="small">
          See plans
        </Button>
      }
    >
      {left === 0
        ? 'No free checks left this month. Upgrade to keep checking.'
        : `${left} free ${left === 1 ? 'check' : 'checks'} left this month.`}
    </Alert>
  );
}
