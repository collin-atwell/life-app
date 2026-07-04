// Step-by-step instructions for finding each provider's secret iCal address,
// plus detection of the most common wrong-link pastes.

export const PROVIDER_GUIDES: Record<string, { label: string; steps: string[]; looksLike: string }> = {
  apple: {
    label: ' Apple / iCloud',
    steps: [
      'On your iPhone, open the Calendar app',
      'Tap "Calendars" at the bottom of the screen',
      'Find the calendar you want under the ICLOUD heading and tap the ⓘ next to it (only iCloud calendars can be linked — Gmail/work calendars listed in the Apple app won\'t offer this)',
      'Scroll down and turn ON "Public Calendar"',
      'Tap "Share Link…" → "Copy"',
      'Paste it below — webcal:// links work as-is',
    ],
    looksLike: 'webcal://p12-caldav.icloud.com/published/2/…',
  },
  google: {
    label: 'Google',
    steps: [
      'On a computer, open calendar.google.com',
      'Click the ⚙️ gear (top right) → "Settings"',
      'In the left sidebar under "Settings for my calendars", click your calendar\'s name',
      'Scroll down to the "Integrate calendar" section',
      'Copy the "Secret address in iCal format" (click the copy icon next to it)',
    ],
    looksLike: 'https://calendar.google.com/calendar/ical/…/private-…/basic.ics',
  },
  outlook: {
    label: 'Outlook',
    steps: [
      'On a computer, open outlook.com (or outlook.office.com for work)',
      'Click the ⚙️ gear → "Calendar" → "Shared calendars"',
      'Under "Publish a calendar": choose your calendar + "Can view all details", click "Publish"',
      'Copy the ICS link (not the HTML one)',
    ],
    looksLike: 'https://outlook.live.com/owa/calendar/…/calendar.ics',
  },
  other: {
    label: 'Work / other app',
    steps: [
      'Most scheduling tools (Calendly, Teamup, work rota apps, university timetables…) offer "Export", "Subscribe", or "Add to calendar"',
      'Look for an option called "iCal", "ICS", or "calendar feed URL"',
      'Copy that address and paste it below — if it starts with webcal:// or ends in .ics, it\'ll work',
    ],
    looksLike: 'https://…/something.ics or webcal://…',
  },
};

/** Catch the most common wrong-link pastes before hitting the network. */
export function linkProblem(u: string): string | null {
  const url = u.trim();
  if (/icloud\.com\/calendar/i.test(url)) return 'That\'s the iCloud calendar *website* address. You need the Public Calendar share link — it starts with webcal://…caldav.icloud.com/published/. Follow the Apple steps.';
  if (/calendar\.google\.com/i.test(url) && !/\.ics(\?|$)/i.test(url)) return 'That looks like the Google Calendar *webpage*. You need the "Secret address in iCal format" from the calendar\'s settings — it ends in .ics.';
  if (/supabase\.co/i.test(url)) return 'That\'s your Supabase address, not a calendar link — paste your calendar\'s iCal feed URL instead.';
  if (!/^(webcal|https?):\/\//i.test(url)) return 'The link should start with webcal:// or https:// — copy the whole address.';
  return null;
}
