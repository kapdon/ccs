import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { OpenRouterQuickStart } from '@/components/profiles/openrouter-quick-start';
import { render, screen } from '@tests/setup/test-utils';

vi.mock('@/hooks/use-openrouter-models', () => ({
  useOpenRouterReady: () => ({
    modelCount: 318,
    isLoading: false,
  }),
}));

describe('OpenRouterQuickStart', () => {
  const props = {
    onOpenRouterClick: vi.fn(),
    onAlibabaCodingPlanClick: vi.fn(),
    onCliproxyClick: vi.fn(),
    onCustomClick: vi.fn(),
  };

  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('prompts the user to select an existing API profile instead of showing the empty-state copy', () => {
    render(<OpenRouterQuickStart hasProfiles profileCount={1} {...props} />);

    expect(screen.getByRole('heading', { name: 'Select an API profile' })).toBeInTheDocument();
    expect(screen.getByText('1 profile')).toBeInTheDocument();
    expect(screen.getByText(/You already have 1 profile in this workspace\./)).toBeInTheDocument();
    expect(screen.queryByText('No API profiles yet')).not.toBeInTheDocument();
  });

  it('keeps the original empty-state title when no API profiles exist', () => {
    render(<OpenRouterQuickStart hasProfiles={false} profileCount={0} {...props} />);

    expect(screen.getByRole('heading', { name: 'No API profiles yet' })).toBeInTheDocument();
    expect(screen.getAllByText('Recommended')).not.toHaveLength(0);
  });
});
