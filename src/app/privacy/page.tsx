import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '../components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy | Sundai Club',
  description:
    'How Sundai Club collects, uses, and protects personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="This policy explains what information Sundai Club collects, why we use it, and the choices available to you when you use our website, attend our events, or take part in a Sundai chapter."
    >
      <section aria-labelledby="privacy-scope">
        <h2 id="privacy-scope">1. Scope</h2>
        <p>
          This Privacy Policy applies to the Sundai Club website, accounts,
          event registration tools, chapter services, and related communications
          (together, the “Services”). It does not apply to third-party websites
          or services that have their own privacy policies.
        </p>
      </section>

      <section aria-labelledby="privacy-collect">
        <h2 id="privacy-collect">2. Information we collect</h2>
        <p>We can collect the following categories of information:</p>
        <ul>
          <li>
            <strong>Account information:</strong> your name, email address,
            profile image, account identifier, and authentication information
            supplied by our account provider.
          </li>
          <li>
            <strong>Profile and community information:</strong> your biography,
            affiliations, skills, links, chapter membership, event
            participation, and other details that you add to your profile.
          </li>
          <li>
            <strong>Projects and other content:</strong> project descriptions,
            images, links, team information, event materials, application
            answers, and other content that you submit.
          </li>
          <li>
            <strong>Event and communication information:</strong> registrations,
            attendance-related activity where offered, contact details, message
            preferences, consent records, and communications with Sundai or
            event organizers.
          </li>
          <li>
            <strong>Safety and administration information:</strong> organizer
            notes, application decisions, reports, moderation records, and audit
            records used to operate the community and events.
          </li>
          <li>
            <strong>Technical information:</strong> IP address, device and
            browser type, pages viewed, referring pages, approximate location
            derived from IP address, cookies, and similar usage data.
          </li>
        </ul>
        <p>
          We collect information from you, from people who organize Sundai
          chapters and events, automatically when you use the Services, and from
          service providers that support the Services.
        </p>
      </section>

      <section aria-labelledby="privacy-use">
        <h2 id="privacy-use">3. How we use information</h2>
        <p>We use information to:</p>
        <ul>
          <li>provide, secure, maintain, and improve the Services;</li>
          <li>
            create accounts and display the profile and project information that
            you publish;
          </li>
          <li>
            process event applications and manage chapters, events, and project
            teams;
          </li>
          <li>
            send service, event, safety, and optional promotional messages;
          </li>
          <li>
            measure how people use the Services and improve community programs;
          </li>
          <li>
            prevent abuse, enforce our rules, and protect people and property;
            and
          </li>
          <li>meet legal obligations and resolve disputes.</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-disclose">
        <h2 id="privacy-disclose">4. How we disclose information</h2>
        <p>We can disclose information in these circumstances:</p>
        <ul>
          <li>
            <strong>Public and community features.</strong> Profile fields,
            projects, team membership, and other content that you choose to
            publish can be visible to other users or the public.
          </li>
          <li>
            <strong>Chapter and event organizers.</strong> Authorized organizers
            can receive application, registration, contact, and participation
            information needed to run their chapter or event.
          </li>
          <li>
            <strong>Service providers.</strong> Vendors can process information
            for authentication, hosting, storage, analytics, email, SMS,
            security, and other operational services under their applicable
            terms and safeguards.
          </li>
          <li>
            <strong>Legal and safety reasons.</strong> We can disclose
            information when reasonably necessary to comply with law, respond to
            legal process, investigate abuse, or protect rights, safety, and
            property.
          </li>
          <li>
            <strong>Organizational changes.</strong> Information can be
            transferred as part of a merger, financing, reorganization, or
            transfer of all or part of the Services, subject to applicable law.
          </li>
          <li>
            <strong>At your direction.</strong> We can disclose information when
            you ask us to or give us consent.
          </li>
        </ul>
        <p>We do not sell your personal information for money.</p>
      </section>

      <section aria-labelledby="privacy-messages">
        <h2 id="privacy-messages">5. Email and text messages</h2>
        <p>
          You can receive operational messages that are necessary for your
          account or event participation. We send optional marketing email or
          text messages as permitted by law and based on the preferences or
          consent that you provide. Message frequency can vary. Message and data
          rates can apply. You can opt out of marketing email through the
          unsubscribe link. You can opt out of text messages by replying STOP.
          Reply HELP for help. An opt-out does not stop messages that are
          necessary to complete a request or protect the Services.
        </p>
      </section>

      <section aria-labelledby="privacy-cookies">
        <h2 id="privacy-cookies">6. Cookies and analytics</h2>
        <p>
          We and our providers use cookies and similar technologies to keep you
          signed in, remember settings, protect the Services, understand site
          use, and measure performance. Your browser can let you block or delete
          cookies. Some features might not work correctly if you block necessary
          cookies.
        </p>
      </section>

      <section aria-labelledby="privacy-retention">
        <h2 id="privacy-retention">7. Retention and security</h2>
        <p>
          We keep personal information only for as long as reasonably necessary
          for the purposes in this policy. Retention periods depend on the type
          of information, account and event needs, safety and audit
          requirements, backup cycles, and legal obligations. We use reasonable
          administrative, technical, and physical safeguards. No system is
          completely secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">8. Your choices and privacy rights</h2>
        <p>
          You can update some account and profile information through the
          Services. You can also ask us to access, correct, delete, or provide a
          copy of your personal information, or object to or restrict some
          processing. Your rights depend on where you live. We can verify your
          identity before we act on a request. We will not discriminate against
          you for exercising a privacy right.
        </p>
        <p>
          Send privacy requests to{' '}
          <a href="mailto:team@sundai.club">team@sundai.club</a>. We can retain
          information when required by law or when a valid safety,
          fraud-prevention, or operational reason applies.
        </p>
      </section>

      <section aria-labelledby="privacy-children">
        <h2 id="privacy-children">9. Children</h2>
        <p>
          The Services are not directed to children under 13, and we do not
          knowingly collect personal information from a child under 13 without
          the consent or other process required by law. Contact us if you
          believe that a child under 13 supplied personal information to us.
        </p>
      </section>

      <section aria-labelledby="privacy-international">
        <h2 id="privacy-international">10. International use</h2>
        <p>
          Sundai and its providers can process information in the United States
          and other countries. These countries can have data protection laws
          that differ from the laws where you live. We use legally required
          protections for data transfers where applicable.
        </p>
      </section>

      <section aria-labelledby="privacy-updates">
        <h2 id="privacy-updates">11. Changes to this policy</h2>
        <p>
          We can update this policy as the Services or legal requirements
          change. We will post the new version here and change the date above.
          We will provide additional notice when required by law.
        </p>
      </section>

      <section aria-labelledby="privacy-contact">
        <h2 id="privacy-contact">12. Contact us</h2>
        <p>
          For questions or requests about this policy, email{' '}
          <a href="mailto:team@sundai.club">team@sundai.club</a>. For the rules
          that apply to use of the Services, read our{' '}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
