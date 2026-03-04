import { describe, expect, it } from 'bun:test';
import {
  COPILOT_SUBCOMMANDS,
  COPILOT_SUBCOMMAND_TOKENS,
  isLikelyCopilotFlagAlias,
  normalizeCopilotSubcommand,
} from '../../../src/copilot/constants';

describe('copilot command aliases', () => {
  it('normalizes all supported flag aliases', () => {
    for (const subcommand of COPILOT_SUBCOMMANDS) {
      expect(normalizeCopilotSubcommand(`--${subcommand}`)).toBe(subcommand);
    }
  });

  it('keeps canonical subcommands unchanged', () => {
    for (const subcommand of COPILOT_SUBCOMMANDS) {
      expect(normalizeCopilotSubcommand(subcommand)).toBe(subcommand);
    }
  });

  it('returns unknown tokens unchanged', () => {
    expect(normalizeCopilotSubcommand('--unknown')).toBe('--unknown');
    expect(normalizeCopilotSubcommand('unknown')).toBe('unknown');
  });

  it('detects likely mistyped command aliases for entrypoint routing', () => {
    expect(isLikelyCopilotFlagAlias('--statu')).toBe(true);
    expect(isLikelyCopilotFlagAlias('--enabl')).toBe(true);
    expect(isLikelyCopilotFlagAlias('--print')).toBe(false);
    expect(isLikelyCopilotFlagAlias('--')).toBe(false);
  });

  it('exposes complete routing token list for ccs entrypoint', () => {
    for (const subcommand of COPILOT_SUBCOMMANDS) {
      expect(COPILOT_SUBCOMMAND_TOKENS).toContain(subcommand);
      expect(COPILOT_SUBCOMMAND_TOKENS).toContain(`--${subcommand}`);
    }
    expect(COPILOT_SUBCOMMAND_TOKENS).toContain('help');
    expect(COPILOT_SUBCOMMAND_TOKENS).toContain('--help');
    expect(COPILOT_SUBCOMMAND_TOKENS).toContain('-h');
  });
});
