type Reason = { label: string; hint?: string };

const CHECK_TWILIO =
  'Open Twilio Console > Monitor > Logs > Errors for the send time.';

const REASONS: Record<string, Reason> = {
  // Our queue and adapters
  PROVIDER_UNAVAILABLE: {
    label: 'Provider not configured',
    hint: 'Set the SES or Twilio environment variables for this deployment.',
  },
  PROVIDER_ERROR: {
    label: 'Provider error with no saved code',
    hint: `Older sends did not save the provider code. ${CHECK_TWILIO}`,
  },
  SES_PROVIDER_ERROR: { label: 'SES error' },
  SEND_OUTCOME_UNKNOWN: {
    label: 'Worker stopped before saving the result',
    hint: 'Some of these may have been sent. Check SES before resending.',
  },
  // SES send API errors
  MessageRejected: {
    label: 'SES rejected the message',
    hint: 'See the example message. It is often an unverified sender or a suppressed address.',
  },
  Throttling: { label: 'SES rate limit reached' },
  ThrottlingException: { label: 'SES rate limit reached' },
  TooManyRequestsException: { label: 'SES rate limit reached' },
  AccountSendingPausedException: {
    label: 'SES sending is paused for the account',
    hint: 'Check the SES reputation dashboard. AWS pauses sending after high bounce or complaint rates.',
  },
  SendingPausedException: {
    label: 'SES sending is paused for this configuration set',
  },
  MailFromDomainNotVerifiedException: {
    label: 'Sender domain is not verified',
  },
  ConfigurationSetDoesNotExistException: {
    label: 'SES configuration set is missing',
    hint: 'Check AWS_SES_CONFIGURATION_SET for this deployment.',
  },
  NotFoundException: {
    label: 'SES configuration set is missing',
    hint: 'Check AWS_SES_CONFIGURATION_SET for this deployment.',
  },
  AccessDeniedException: {
    label: 'The app cannot send through SES',
    hint: 'The IAM user needs ses:SendEmail on the identity and the configuration set.',
  },
  TimeoutError: { label: 'SES request timed out' },
  // SES events
  Reject: { label: 'Rejected by SES (virus detected)' },
  RenderingFailure: { label: 'Email template could not be rendered' },
  'Bounce.Permanent.General': {
    label: 'Hard bounce: the receiving server refused it',
    hint: 'The address will never accept mail. SES suppresses it automatically.',
  },
  'Bounce.Permanent.NoEmail': {
    label: 'Email address does not exist',
    hint: 'Ask the member to update their email address.',
  },
  'Bounce.Permanent.Suppressed': {
    label: 'Address is on the SES global suppression list',
    hint: 'It bounced recently for another sender. The member should use another address.',
  },
  'Bounce.Permanent.OnAccountSuppressionList': {
    label: 'Address is on our SES suppression list',
    hint: 'It bounced or complained before. Remove it from the SES suppression list only if the member confirms it works.',
  },
  'Bounce.Transient.General': {
    label: 'Soft bounce: temporary delivery failure',
    hint: 'The receiving server refused it for now. Later sends may work.',
  },
  'Bounce.Transient.MailboxFull': { label: 'Mailbox is full' },
  'Bounce.Transient.MessageTooLarge': { label: 'Message is too large' },
  'Bounce.Transient.ContentRejected': {
    label: 'Receiving server rejected the content',
    hint: 'Often a spam filter. Check links and wording.',
  },
  'Bounce.Transient.AttachmentRejected': {
    label: 'Receiving server rejected an attachment',
  },
  'Bounce.Undetermined.Undetermined': {
    label: 'Bounced for an unknown reason',
  },
  // Twilio error codes
  '20003': {
    label: 'Twilio authentication failed',
    hint: 'Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
  },
  '20429': {
    label: 'Twilio rate limit (too many requests at once)',
    hint: 'Sends now retry and limit concurrent requests. Resend to the failed members.',
  },
  '21211': { label: 'Invalid phone number' },
  '21408': {
    label: 'SMS to this country is not enabled',
    hint: 'Enable the country in Twilio Messaging geographic permissions.',
  },
  '21606': { label: 'Sending number cannot send SMS' },
  '21610': {
    label: 'Recipient replied STOP',
    hint: 'Twilio blocks these until the member texts START.',
  },
  '21612': { label: 'Phone number cannot receive SMS from this sender' },
  '21614': { label: 'Not a mobile number' },
  '21617': { label: 'Message is too long' },
  '30003': { label: 'Phone is unreachable or off' },
  '30004': { label: 'Message blocked by the recipient or carrier' },
  '30005': { label: 'Unknown or inactive phone number' },
  '30006': { label: 'Landline or unreachable carrier' },
  '30007': {
    label: 'Filtered by the carrier as spam',
    hint: 'Carriers filter unregistered senders and some link domains. Check A2P 10DLC registration.',
  },
  '30008': { label: 'Unknown carrier error' },
  '30032': { label: 'Toll-free number is not verified' },
  '30034': {
    label: 'Sending number is not registered for A2P 10DLC',
    hint: 'Register the brand and campaign in Twilio, then add the number to the campaign.',
  },
};

export function deliveryFailureReason(code: string | null) {
  if (!code) return { label: 'Unknown reason', hint: null };
  const known = REASONS[code];
  if (known) return { label: known.label, hint: known.hint ?? null };
  if (code.startsWith('Bounce.Permanent.'))
    return { label: 'Hard bounce', hint: REASONS['Bounce.Permanent.General'].hint! };
  if (code.startsWith('Bounce.Transient.'))
    return { label: 'Soft bounce', hint: null };
  return /^\d+$/.test(code)
    ? {
        label: `Twilio error ${code}`,
        hint: `Look up https://www.twilio.com/docs/api/errors/${code}`,
      }
    : { label: code, hint: null };
}

const GENERIC_MESSAGES = new Set([
  'Message delivery failed.',
  'Email send failed.',
  'SES delivery failed.',
  'Email delivery is unavailable.',
  'SMS delivery is unavailable.',
]);

// Removes email addresses and phone numbers from a provider message.
export function failureExample(message: string | null | undefined) {
  if (!message || GENERIC_MESSAGES.has(message)) return null;
  return message
    .replace(/[^\s<>()"']+@[^\s<>()"']+/g, '[email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]')
    .slice(0, 300);
}
