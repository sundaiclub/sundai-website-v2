import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '../components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service | Sundai Club',
  description:
    'Terms that apply when you use Sundai Club services and attend its events.',
};

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="These Terms govern your use of the Sundai Club website, accounts, chapters, events, project tools, and related services."
    >
      <section aria-labelledby="terms-acceptance">
        <h2 id="terms-acceptance">1. Acceptance of these Terms</h2>
        <p>
          By accessing or using the Services, you agree to these Terms and our{' '}
          <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do
          not use the Services. If you use the Services for an organization, you
          confirm that you can bind that organization to these Terms.
        </p>
      </section>

      <section aria-labelledby="terms-eligibility">
        <h2 id="terms-eligibility">2. Eligibility and accounts</h2>
        <p>
          You must be at least 13 years old to use the Services. If you are not
          old enough to agree to these Terms under the law where you live, a
          parent or legal guardian must agree for you. You must give accurate
          account information, protect your sign-in credentials, and promptly
          tell us about unauthorized account use. You are responsible for
          activity on your account.
        </p>
      </section>

      <section aria-labelledby="terms-community">
        <h2 id="terms-community">3. Community and event participation</h2>
        <p>
          Event admission, chapter membership, organizer roles, schedules,
          locations, and program content can change. Registration does not
          guarantee admission unless we expressly state otherwise. You must
          follow event-specific rules, venue rules, safety instructions, and
          reasonable directions from organizers. You are responsible for your
          travel, equipment, belongings, and conduct.
        </p>
        <p>
          Some events involve building, demonstrations, or experimental
          technology. Use good judgment and do not operate equipment or software
          in an unsafe or unlawful way.
        </p>
      </section>

      <section aria-labelledby="terms-conduct">
        <h2 id="terms-conduct">4. Acceptable use</h2>
        <p>You must not use the Services to:</p>
        <ul>
          <li>
            break a law, infringe another person’s rights, or facilitate harm;
          </li>
          <li>
            harass, threaten, discriminate against, impersonate, or exploit
            anyone;
          </li>
          <li>
            publish malicious code or content that is deceptive, unlawful, or
            abusive;
          </li>
          <li>access accounts, systems, or data without permission;</li>
          <li>
            scrape, probe, disrupt, overload, or bypass limits or security
            controls;
          </li>
          <li>
            send spam or collect personal information without a lawful basis; or
          </li>
          <li>
            misrepresent a project, affiliation, event result, or your
            authority.
          </li>
        </ul>
        <p>
          You must respect the privacy, confidentiality, and intellectual
          property of other participants. Do not publish another person’s
          private information, image, or work without the permission that the
          law requires.
        </p>
      </section>

      <section aria-labelledby="terms-content">
        <h2 id="terms-content">5. Your content and projects</h2>
        <p>
          You keep ownership of content that you submit. You confirm that you
          have the rights needed to submit it and that it complies with these
          Terms.
        </p>
        <p>
          You give Sundai a worldwide, non-exclusive, royalty-free license to
          host, store, reproduce, format, display, and distribute your content
          as needed to operate, secure, improve, and promote the Services,
          Sundai events, and the Sundai community. This license lets us, for
          example, show a public project page or feature a project in an event
          recap. It does not change the license that applies to source code in
          an external repository. The license ends when the content is deleted
          from active systems, except for reasonable backups, prior authorized
          uses, and records that we must retain.
        </p>
        <p>
          Collaborative projects can involve separate agreements among team
          members. Sundai does not decide ownership among collaborators. Agree
          on ownership, licenses, confidentiality, and credit before you
          contribute sensitive or valuable work.
        </p>
      </section>

      <section aria-labelledby="terms-sundai-property">
        <h2 id="terms-sundai-property">6. Sundai materials</h2>
        <p>
          The Services, site design, software, branding, and materials supplied
          by Sundai or its licensors are protected by intellectual property
          laws. Except for rights expressly granted in these Terms, Sundai and
          its licensors keep all rights in these materials. You can use them
          only as needed for your personal, non-commercial use of the Services
          unless we give written permission for another use.
        </p>
      </section>

      <section aria-labelledby="terms-communications">
        <h2 id="terms-communications">7. Communications</h2>
        <p>
          We can send account, registration, event, safety, and service messages
          to the contact details that you provide. If you consent to optional
          marketing email or text messages, you can withdraw that consent at any
          time. Use the unsubscribe link in an email or reply STOP to a text
          message. Message and data rates can apply. Consent to marketing
          messages is not a condition of using the Services.
        </p>
      </section>

      <section aria-labelledby="terms-third-party">
        <h2 id="terms-third-party">8. Third-party services</h2>
        <p>
          The Services can link to or integrate with third-party websites,
          repositories, venues, tools, and services. Their terms and privacy
          policies apply to your use of them. Sundai does not control and is not
          responsible for third-party services, content, security, or
          availability.
        </p>
      </section>

      <section aria-labelledby="terms-enforcement">
        <h2 id="terms-enforcement">9. Content removal and account action</h2>
        <p>
          We can review, restrict, remove, or preserve content, and we can
          suspend or end access to the Services, when we reasonably believe this
          is needed to enforce these Terms, protect the community, respond to
          legal requirements, or prevent harm. You can stop using the Services
          at any time. Provisions that by their nature should continue after
          termination will remain in effect.
        </p>
      </section>

      <section aria-labelledby="terms-disclaimer">
        <h2 id="terms-disclaimer">10. Disclaimers</h2>
        <p>
          To the maximum extent permitted by law, the Services and events are
          provided “as is” and “as available.” Sundai disclaims all warranties,
          express or implied, including warranties of merchantability, fitness
          for a particular purpose, title, and non-infringement. We do not
          promise that the Services will be uninterrupted, secure, error-free,
          or suitable for your purpose, or that user content, projects, advice,
          or event information will be accurate.
        </p>
        <p>
          Nothing in these Terms excludes a warranty or right that cannot
          lawfully be excluded.
        </p>
      </section>

      <section aria-labelledby="terms-liability">
        <h2 id="terms-liability">11. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Sundai and its organizers,
          officers, volunteers, affiliates, and service providers will not be
          liable for indirect, incidental, special, consequential, exemplary, or
          punitive damages, or for loss of profits, data, goodwill, or business
          opportunity, arising from the Services or events.
        </p>
        <p>
          To the maximum extent permitted by law, their total liability for all
          claims related to the Services or events will not exceed the greater
          of US $100 or the amount that you paid Sundai to use the applicable
          Service during the 12 months before the event that caused the claim.
          These limits do not apply where the law does not permit them.
        </p>
      </section>

      <section aria-labelledby="terms-indemnity">
        <h2 id="terms-indemnity">12. Indemnity</h2>
        <p>
          To the extent permitted by law, you will defend, indemnify, and hold
          harmless Sundai and its organizers, officers, volunteers, and
          affiliates from third-party claims, losses, and reasonable costs that
          arise from your content, your conduct, your violation of these Terms,
          or your violation of another person’s rights.
        </p>
      </section>

      <section aria-labelledby="terms-law">
        <h2 id="terms-law">13. Governing law and disputes</h2>
        <p>
          The laws of the Commonwealth of Massachusetts, without regard to
          conflict of law rules, govern these Terms. The state and federal
          courts located in Massachusetts will have exclusive jurisdiction over
          disputes, except where applicable consumer law gives you the right to
          bring a claim elsewhere. Before filing a claim, you and Sundai agree
          to make a good-faith effort to resolve the dispute informally for 30
          days after written notice.
        </p>
      </section>

      <section aria-labelledby="terms-general">
        <h2 id="terms-general">14. General terms</h2>
        <p>
          These Terms and the policies they reference are the entire agreement
          about the Services. If one provision is unenforceable, the remaining
          provisions remain effective. A failure to enforce a provision is not a
          waiver. You cannot transfer these Terms without our written
          permission. We can transfer them as part of an organizational change
          or operation of the Services.
        </p>
      </section>

      <section aria-labelledby="terms-changes">
        <h2 id="terms-changes">15. Changes to these Terms</h2>
        <p>
          We can update these Terms as the Services or legal requirements
          change. We will post the updated version and change the date above. We
          will give additional notice when required by law. Your continued use
          after updated Terms take effect means that you accept them.
        </p>
      </section>

      <section aria-labelledby="terms-contact">
        <h2 id="terms-contact">16. Contact us</h2>
        <p>
          Questions or notices about these Terms can be sent to{' '}
          <a href="mailto:team@sundai.club">team@sundai.club</a>.
        </p>
      </section>
    </LegalPage>
  );
}
