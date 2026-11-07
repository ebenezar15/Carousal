// Onboarding sample so the app produces something good on first launch (Phase 5 expands this).
export const SAMPLE_CONTENT = `# 5 habits that make remote teams faster

Remote work fails when teams copy the office. The fastest distributed teams run on writing, not meetings.

## Write decisions down
Every decision gets a short written record: what we chose, why, and who owns it. Nobody has to be in the room to stay in the loop.

## Default to async
Status updates belong in a shared doc, not a call. Save live time for debate and relationships.

## The weekly ritual
- Monday: goals posted by noon
- Wednesday: blockers flagged in one thread
- Friday: wins and lessons shared

## Measure output, not hours
Teams that track shipped work instead of online time report 30% fewer late-night messages.

> Clear writing is clear thinking made visible. — Team handbook

## Start small
Pick one meeting this week and replace it with a written update. Review what you gained next Friday.`;

/** One-click onboarding samples (original content; work fully offline with the built-in rules). */
export const SAMPLES: { id: string; label: string; emoji: string; preset: string; tone: 'professional' | 'playful' | 'bold' | 'educational'; text: string }[] = [
  { id: 'remote', label: 'Remote team habits', emoji: '🏠', preset: 'instagram-portrait-4x5', tone: 'professional', text: SAMPLE_CONTENT },
  {
    id: 'psalm23',
    label: 'Psalm 23 devotional',
    emoji: '🐑',
    preset: 'instagram-portrait-4x5',
    tone: 'educational',
    // Scripture quoted from the King James Version (public domain).
    text: `# The Lord is my shepherd

When life feels loud and uncertain, Psalm 23 reminds us who is leading us.

> "The LORD is my shepherd; I shall not want." — Psalm 23:1

## He gives rest
He makes us lie down in green pastures and leads us beside still waters. Rest is not laziness; it is trust.

## He walks with us in the dark
Even in the darkest valley we are not alone. His presence is our comfort, not the absence of trouble.

## The daily rhythm of the sheep
- Listen to his voice
- Follow where he leads
- Rest when he says rest
- Trust him in the valley

> "Surely goodness and mercy shall follow me all the days of my life." — Psalm 23:6

## Prayer
Lord, be my shepherd today. Quiet my worries, lead me to rest, and walk with me through every valley. Amen.`,
  },
  {
    id: 'pricing',
    label: 'Pricing lessons (LinkedIn PDF)',
    emoji: '💡',
    preset: 'linkedin-document-portrait-4x5',
    tone: 'bold',
    text: `# 4 pricing mistakes that quietly cost you customers

Most founders set a price once and never touch it again. That single decision shapes who buys, who stays and who churns.

## Charging for hours, not outcomes
Customers don't buy your time. They buy the result. Price the outcome and the conversation changes.

## Too many options
- Three tiers beat seven
- Name each tier after who it's for
- Highlight one recommended plan

## Hiding the price
Teams that publish prices see 40% fewer unqualified sales calls.

## Never raising it
Review pricing every year. Grandfather loyal customers, then charge new ones what you're worth.`,
  },
  {
    id: 'study',
    label: 'Study tips (TikTok)',
    emoji: '📚',
    preset: 'tiktok-photo-9x16',
    tone: 'playful',
    text: `# How to study less and remember more

Re-reading feels productive. It isn't. Your brain learns by pulling information out, not pushing it in.

1. Quiz yourself before you feel ready
2. Space sessions over several days
3. Mix topics instead of blocking them
4. Teach it to a friend in two minutes

> The best way to learn is to try to remember. — Learning science, simplified

Start tonight: close your notes and write down everything you remember about one topic.`,
  },
];
