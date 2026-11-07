'use client';

import type { HealthLevel, MessagingHealth } from '@/types/delivery-stats';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';
import { percent } from '../../components/DeliveryStatsSummary';

const tone = (level: HealthLevel) =>
  level === 'critical' ? 'danger' : level === 'warning' ? 'warning' : 'success';

const precise = (value: number) => `${(value * 100).toFixed(2)}%`;

export default function MessagingHealthPanel({
  health,
}: {
  health: MessagingHealth;
}) {
  const classes = useManagementClasses();
  const { email, sms } = health;
  return (
    <ManagementSection
      title={`Sending health · last ${health.windowDays} days`}
      description="SES reviews the account at a 5% hard bounce rate or a 0.1% complaint rate and can pause all email."
    >
      {!health.emailEventsConfigured && (
        <div className="mb-4">
          <ManagementAlert tone="warning">
            SES delivery events are not configured for this deployment. Email
            bounces and complaints are not recorded.
          </ManagementAlert>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">
              {precise(email.bounceRate)}
            </span>
            <ManagementBadge tone={tone(email.bounceLevel)}>
              {email.bounceLevel}
            </ManagementBadge>
          </div>
          <div className={`text-xs ${classes.mutedText}`}>
            Email hard bounce rate · {email.hardBounces} of {email.sent}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">
              {precise(email.complaintRate)}
            </span>
            <ManagementBadge tone={tone(email.complaintLevel)}>
              {email.complaintLevel}
            </ManagementBadge>
          </div>
          <div className={`text-xs ${classes.mutedText}`}>
            Email complaint rate · {email.complaints} of {email.sent}
          </div>
        </div>
        <div>
          <div className="text-lg font-bold">
            {percent(sms.failed, sms.sent)}
          </div>
          <div className={`text-xs ${classes.mutedText}`}>
            SMS failure rate · {sms.failed} of {sms.sent}
          </div>
        </div>
      </div>
    </ManagementSection>
  );
}
