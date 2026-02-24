
export interface Scenario {
  id: string;
  name: string;
  description: string;
  prompt: string; // The instruction to the Architect
  frequency: 'daily' | 'weekly' | 'manual';
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'UI_POLISH',
    name: 'UI Polish & Standardization',
    description: 'Scan CSS/Tailwind usage and enforce @4jp/design-system tokens.',
    prompt: 'Scan the codebase for hardcoded hex colors and replace them with design tokens from @4jp/design-system. Focus on "life-my--midst--in" first.',
    frequency: 'weekly'
  },
  {
    id: 'SECURE_CORE',
    name: 'Security Audit',
    description: 'Review package.json and API endpoints for vulnerabilities.',
    prompt: 'Analyze package.json files for outdated dependencies with known vulnerabilities and suggest upgrades. Check API routes for missing auth checks.',
    frequency: 'weekly'
  },
  {
    id: 'CHAOS_MONKEY',
    name: 'Chaos Monkey (Drift Test)',
    description: 'Introduce a minor, safe drift to test the NightWatchman recovery.',
    prompt: 'Introduce a harmless comment drift in a README file to verify if the NightWatchman detects it.',
    frequency: 'manual'
  }
];
