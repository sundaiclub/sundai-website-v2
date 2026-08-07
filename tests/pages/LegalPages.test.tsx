import { render, screen } from '../utils/test-utils';
import PrivacyPolicyPage, {
  metadata as privacyMetadata,
} from '../../src/app/privacy/page';
import TermsOfServicePage, {
  metadata as termsMetadata,
} from '../../src/app/terms/page';

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

describe('Legal pages', () => {
  it('renders the Privacy Policy with contact and policy navigation', () => {
    render(<PrivacyPolicyPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: '2. Information we collect',
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'team@sundai.club' })
    ).not.toHaveLength(0);
    expect(
      screen.getAllByRole('link', { name: 'Terms of Service' })[0]
    ).toHaveAttribute('href', '/terms');
    expect(privacyMetadata.title).toBe('Privacy Policy | Sundai Club');
  });

  it('renders the Terms of Service with its core terms and policy navigation', () => {
    render(<TermsOfServicePage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Terms of Service' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '4. Acceptable use' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Privacy Policy' })[0]
    ).toHaveAttribute('href', '/privacy');
    expect(termsMetadata.title).toBe('Terms of Service | Sundai Club');
  });
});
