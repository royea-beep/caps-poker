// CAPS Poker Legal Pages — Privacy Policy + Terms of Service
// Round 52: App Store + GDPR compliant. Hosted as Supabase Edge Function.
// URL pattern:
//   /functions/v1/legal              -> index (links to both)
//   /functions/v1/legal/privacy      -> privacy policy
//   /functions/v1/legal/terms        -> terms of service
//   /functions/v1/legal/cookies      -> cookie/SDK disclosure
// All return responsive HTML, no auth required.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const LAST_UPDATED = 'May 2, 2026';
const APP_NAME = 'CAPS Poker';
const SUPPORT_EMAIL = 'support@caps.app';
const COMPANY_NAME = 'Royea Empire';
const JURISDICTION = 'Israel';

const SHARED_STYLES = `
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;color:#222;margin:0;padding:0;line-height:1.6;}
  .wrap{max-width:780px;margin:0 auto;padding:32px 20px 60px;}
  header{padding:24px 20px;border-bottom:1px solid #e5e7eb;background:#fafbfc;}
  header .wrap{padding:0;max-width:780px;margin:0 auto;}
  header h1{margin:0;font-size:22px;color:#111;}
  header .nav{margin-top:8px;font-size:14px;}
  header .nav a{color:#0066cc;text-decoration:none;margin-right:14px;}
  header .nav a:hover{text-decoration:underline;}
  h1.title{font-size:32px;margin:0 0 6px;color:#111;}
  .meta{color:#6b7280;font-size:14px;margin-bottom:32px;}
  h2{font-size:20px;margin:32px 0 12px;color:#111;border-bottom:1px solid #e5e7eb;padding-bottom:6px;}
  h3{font-size:16px;margin:20px 0 8px;color:#222;}
  p{margin:8px 0;}
  ul{padding-left:24px;margin:8px 0;}
  li{margin:4px 0;}
  code{background:#f3f4f6;padding:1px 6px;border-radius:3px;font-size:13px;}
  .toc{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px 20px;margin:20px 0 32px;}
  .toc ol{margin:6px 0;padding-left:24px;}
  .toc a{color:#0066cc;text-decoration:none;}
  .contact-box{background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;margin:20px 0;border-radius:4px;}
  footer{text-align:center;color:#9ca3af;font-size:13px;padding:24px;border-top:1px solid #e5e7eb;margin-top:40px;}
  footer a{color:#9ca3af;}
  @media(prefers-color-scheme: dark){
    body{background:#0f1419;color:#d8e1ec;}
    header{background:#1a2332;border-color:#2a3a4f;}
    header h1, h1.title, h2, h3{color:#fff;}
    .meta{color:#7a8a9a;}
    h2{border-color:#2a3a4f;}
    code{background:#1a2332;color:#fbbf24;}
    .toc{background:#1a2332;border-color:#2a3a4f;}
    .contact-box{background:#1e3a5f;border-color:#3b82f6;}
    footer{border-color:#2a3a4f;color:#5a6a7a;}
    a{color:#60a5fa;}
    header .nav a{color:#60a5fa;}
  }
`;

function shell(title: string, content: string): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="en"><head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">',
    '<title>' + title + ' · ' + APP_NAME + '</title>',
    '<meta name="robots" content="index,follow">',
    '<style>', SHARED_STYLES, '</style>',
    '</head><body>',
    '<header><div class="wrap">',
    '<h1>' + APP_NAME + '</h1>',
    '<div class="nav">',
    '<a href="/functions/v1/legal/privacy">Privacy Policy</a>',
    '<a href="/functions/v1/legal/terms">Terms of Service</a>',
    '<a href="/functions/v1/legal/cookies">Data &amp; SDKs</a>',
    '<a href="mailto:' + SUPPORT_EMAIL + '">Contact</a>',
    '</div></div></header>',
    '<div class="wrap">', content, '</div>',
    '<footer>© ' + new Date().getFullYear() + ' ' + COMPANY_NAME + ' · ',
    '<a href="mailto:' + SUPPORT_EMAIL + '">' + SUPPORT_EMAIL + '</a></footer>',
    '</body></html>'
  ].join('');
}

function privacyContent(): string {
  return [
    '<h1 class="title">Privacy Policy</h1>',
    '<div class="meta">Last updated: ' + LAST_UPDATED + '</div>',
    '<div class="toc"><strong>Contents:</strong><ol>',
    '<li><a href="#info-collected">Information we collect</a></li>',
    '<li><a href="#how-we-use">How we use your information</a></li>',
    '<li><a href="#sharing">Sharing &amp; third parties</a></li>',
    '<li><a href="#retention">Data retention</a></li>',
    '<li><a href="#rights">Your rights (GDPR &amp; CCPA)</a></li>',
    '<li><a href="#deletion">Account deletion</a></li>',
    '<li><a href="#children">Children &amp; age requirement</a></li>',
    '<li><a href="#security">Security</a></li>',
    '<li><a href="#changes">Changes to this policy</a></li>',
    '<li><a href="#contact">Contact</a></li>',
    '</ol></div>',
    '<p>This Privacy Policy describes how ' + COMPANY_NAME + ' (“we”, “us”, “our”) collects, uses, and protects information when you use the ' + APP_NAME + ' mobile application (the “App”). By using the App, you agree to this Policy.</p>',

    '<h2 id="info-collected">1. Information we collect</h2>',
    '<h3>Account information</h3>',
    '<p>When you sign in, we collect:</p><ul>',
    '<li><strong>Authentication identifier</strong> (email or social-provider ID via Supabase Auth)</li>',
    '<li><strong>Display name</strong> you choose for in-game presence</li>',
    '<li><strong>Avatar URL</strong> if you upload or link a profile image</li>',
    '</ul>',
    '<h3>Game data</h3>',
    '<p>While playing, we record:</p><ul>',
    '<li>Hand history, chip balances, win/loss stats, achievements, daily missions, streaks</li>',
    '<li>Game session metadata (start/end time, table joined, results)</li>',
    '<li>Friend challenges and shared hands you create</li>',
    '</ul>',
    '<h3>Technical data</h3>',
    '<ul>',
    '<li><strong>Crash reports</strong> (device model, OS version, error trace) — to fix bugs</li>',
    '<li><strong>Push notification token</strong> if you opt into notifications</li>',
    '<li><strong>Analytics events</strong> (screen views, button taps) — to improve UX. No keystroke logging or location tracking.</li>',
    '<li><strong>Bug reports</strong> you submit via the in-app form</li>',
    '</ul>',
    '<h3>What we do NOT collect</h3>',
    '<ul>',
    '<li>We do not collect your precise location.</li>',
    '<li>We do not access your contacts, calendar, microphone, or camera (except for an avatar you choose to upload).</li>',
    '<li>We do not sell or rent your personal data to third parties.</li>',
    '<li>The App is not a real-money gambling product. Chips are virtual and have no monetary value.</li>',
    '</ul>',

    '<h2 id="how-we-use">2. How we use your information</h2><ul>',
    '<li>Operate the App and provide gameplay features</li>',
    '<li>Maintain leaderboards and matchmaking</li>',
    '<li>Send push notifications you opted into (challenges, daily rewards)</li>',
    '<li>Diagnose crashes and fix bugs</li>',
    '<li>Detect and prevent fraud or terms violations</li>',
    '<li>Communicate with you about your account or important changes</li>',
    '</ul>',

    '<h2 id="sharing">3. Sharing &amp; third parties</h2>',
    '<p>We share data only with the service providers necessary to operate the App:</p><ul>',
    '<li><strong>Supabase</strong> (database + authentication hosting) — stores your account and game data</li>',
    '<li><strong>Apple Push Notification Service / Firebase Cloud Messaging</strong> — only if you opt into push notifications</li>',
    '<li><strong>Crash reporting service</strong> — receives anonymized crash traces</li>',
    '</ul>',
    '<p>We do not sell your data, share it for cross-app advertising, or transfer it for purposes incompatible with this Policy.</p>',

    '<h2 id="retention">4. Data retention</h2>',
    '<ul>',
    '<li><strong>Account &amp; game data:</strong> retained while your account exists.</li>',
    '<li><strong>Crash reports:</strong> retained up to 90 days for debugging.</li>',
    '<li><strong>Analytics events:</strong> aggregated and retained up to 2 years; raw events purged after 12 months.</li>',
    '<li><strong>Audit logs:</strong> retained indefinitely for security compliance, but anonymized when you delete your account.</li>',
    '</ul>',

    '<h2 id="rights">5. Your rights (GDPR &amp; CCPA)</h2>',
    '<p>If you reside in the EEA, UK, or California, you have the right to:</p><ul>',
    '<li><strong>Access</strong> the personal data we hold about you</li>',
    '<li><strong>Correct</strong> inaccurate data</li>',
    '<li><strong>Delete</strong> your account and personal data (see Section 6)</li>',
    '<li><strong>Object</strong> to processing or withdraw consent</li>',
    '<li><strong>Data portability</strong> — request an export of your data</li>',
    '</ul>',
    '<p>To exercise these rights, email <a href="mailto:' + SUPPORT_EMAIL + '">' + SUPPORT_EMAIL + '</a>. We respond within 30 days.</p>',

    '<h2 id="deletion">6. Account deletion</h2>',
    '<p>You can delete your account at any time inside the App: <strong>Settings → Account → Delete Account</strong>.</p>',
    '<p>When you request deletion:</p><ul>',
    '<li>Your account is marked for deletion immediately and a 14-day grace period begins.</li>',
    '<li>You can sign back in within 14 days to cancel deletion and restore your account.</li>',
    '<li>After 14 days, all your personal data is permanently erased from our systems, except security audit records which are anonymized (your identity is removed but the action history is retained for compliance).</li>',
    '<li>Backups containing your data are rotated out within 30 days.</li>',
    '</ul>',

    '<h2 id="children">7. Children &amp; age requirement</h2>',
    '<p>The App is intended for users aged 17 and over. We do not knowingly collect data from children under 13. If we learn that a child under 13 has provided us personal information, we will delete it promptly. Parents who believe their child has used the App can email <a href="mailto:' + SUPPORT_EMAIL + '">' + SUPPORT_EMAIL + '</a>.</p>',

    '<h2 id="security">8. Security</h2>',
    '<p>We use industry-standard measures to protect your data, including TLS encryption in transit, encryption at rest, and Row-Level Security policies on our database. No method of transmission over the Internet is 100% secure, but we work to protect your information using reasonable practices.</p>',

    '<h2 id="changes">9. Changes to this policy</h2>',
    '<p>We may update this Policy. The “Last updated” date at the top reflects the most recent revision. Material changes will be notified via in-app notice. Continued use of the App after changes means you accept the updated Policy.</p>',

    '<h2 id="contact">10. Contact</h2>',
    '<div class="contact-box">',
    '<strong>Privacy questions or requests:</strong><br>',
    '✉️ <a href="mailto:' + SUPPORT_EMAIL + '">' + SUPPORT_EMAIL + '</a><br>',
    '🏢 ' + COMPANY_NAME + ', ' + JURISDICTION,
    '</div>'
  ].join('');
}

function termsContent(): string {
  return [
    '<h1 class="title">Terms of Service</h1>',
    '<div class="meta">Last updated: ' + LAST_UPDATED + '</div>',
    '<div class="toc"><strong>Contents:</strong><ol>',
    '<li><a href="#acceptance">Acceptance</a></li>',
    '<li><a href="#eligibility">Eligibility</a></li>',
    '<li><a href="#account">Account</a></li>',
    '<li><a href="#virtual-currency">Virtual currency (Chips)</a></li>',
    '<li><a href="#purchases">In-app purchases</a></li>',
    '<li><a href="#conduct">User conduct</a></li>',
    '<li><a href="#content">User content</a></li>',
    '<li><a href="#ip">Intellectual property</a></li>',
    '<li><a href="#termination">Termination</a></li>',
    '<li><a href="#disclaimer">Disclaimer of warranties</a></li>',
    '<li><a href="#liability">Limitation of liability</a></li>',
    '<li><a href="#governing-law">Governing law</a></li>',
    '<li><a href="#changes">Changes to terms</a></li>',
    '<li><a href="#contact">Contact</a></li>',
    '</ol></div>',

    '<p>These Terms of Service (“Terms”) govern your use of ' + APP_NAME + ' (the “App”) provided by ' + COMPANY_NAME + ' (“we”, “us”). By using the App you agree to these Terms.</p>',

    '<h2 id="acceptance">1. Acceptance</h2>',
    '<p>Creating an account or using the App constitutes acceptance of these Terms and our Privacy Policy. If you do not agree, do not use the App.</p>',

    '<h2 id="eligibility">2. Eligibility</h2>',
    '<p>You must be at least 17 years old to use the App. By creating an account you represent that you meet this requirement.</p>',

    '<h2 id="account">3. Account</h2>',
    '<ul>',
    '<li>You are responsible for maintaining the security of your account credentials.</li>',
    '<li>One account per person. Multi-accounting to gain unfair advantage is prohibited.</li>',
    '<li>You must provide accurate information and notify us if your account is compromised.</li>',
    '</ul>',

    '<h2 id="virtual-currency">4. Virtual currency (Chips)</h2>',
    '<p><strong>Chips have no monetary value.</strong> Chips are a virtual in-game currency that:</p><ul>',
    '<li>Cannot be redeemed for real money or anything of monetary value</li>',
    '<li>Cannot be transferred between users for compensation</li>',
    '<li>Have no value outside the App</li>',
    '<li>May be revoked at our discretion if obtained through fraud, exploits, or violation of these Terms</li>',
    '</ul>',
    '<p>The App is for entertainment only. <strong>It is not a gambling service.</strong> Outcomes do not result in real-world prizes or winnings.</p>',

    '<h2 id="purchases">5. In-app purchases</h2>',
    '<p>You may purchase virtual chip packs through the Apple App Store or Google Play. All purchases are:</p><ul>',
    '<li>Final and non-refundable except where required by applicable law or platform refund policies (Apple, Google)</li>',
    '<li>For virtual goods that are immediately consumable upon delivery</li>',
    '<li>Subject to the payment terms of the platform you purchased through</li>',
    '</ul>',
    '<p>If chips are not credited after a successful purchase, contact <a href="mailto:' + SUPPORT_EMAIL + '">' + SUPPORT_EMAIL + '</a> within 30 days.</p>',

    '<h2 id="conduct">6. User conduct</h2>',
    '<p>You agree not to:</p><ul>',
    '<li>Use bots, scripts, or automation to play the game</li>',
    '<li>Reverse-engineer, modify, or attempt to extract source code</li>',
    '<li>Exploit bugs or game mechanics for unfair advantage; report bugs via the in-app form instead</li>',
    '<li>Harass, threaten, or abuse other users</li>',
    '<li>Post obscene, hateful, or illegal content (display names, chat, shared hands)</li>',
    '<li>Impersonate another person or misrepresent your identity</li>',
    '<li>Collude with other players to manipulate game outcomes</li>',
    '</ul>',
    '<p>Violation may result in chip forfeiture, account suspension, or permanent ban.</p>',

    '<h2 id="content">7. User content</h2>',
    '<p>By submitting content (display name, avatar, shared hands, bug reports), you grant us a non-exclusive license to use, display, and store that content for the purpose of operating the App. You retain ownership. We may remove content that violates these Terms.</p>',

    '<h2 id="ip">8. Intellectual property</h2>',
    '<p>The App, its design, code, graphics, sounds, and other assets are owned by ' + COMPANY_NAME + ' and protected by copyright. You receive a personal, non-transferable, non-exclusive license to use the App per these Terms. You may not copy, distribute, or create derivative works.</p>',

    '<h2 id="termination">9. Termination</h2>',
    '<ul>',
    '<li><strong>By you:</strong> You may delete your account anytime via Settings → Account → Delete Account.</li>',
    '<li><strong>By us:</strong> We may suspend or terminate accounts for violation of these Terms, with or without notice depending on severity.</li>',
    '<li><strong>Effect:</strong> Upon termination, your access ends and chips are forfeited (no refund). Sections that by nature should survive (IP, liability, governing law) survive termination.</li>',
    '</ul>',

    '<h2 id="disclaimer">10. Disclaimer of warranties</h2>',
    '<p>The App is provided <strong>“as is”</strong> without warranties of any kind, express or implied. We do not warrant that the App will be uninterrupted, error-free, or meet your specific requirements. To the fullest extent permitted by law, we disclaim all implied warranties including merchantability and fitness for a particular purpose.</p>',

    '<h2 id="liability">11. Limitation of liability</h2>',
    '<p>To the fullest extent permitted by applicable law, ' + COMPANY_NAME + ' shall not be liable for indirect, incidental, special, consequential, or punitive damages, including loss of chips, data, or business opportunity, arising from your use or inability to use the App. Our total liability for any claim shall not exceed the greater of (a) the amount you paid us in the 12 months prior to the claim or (b) USD $50.</p>',

    '<h2 id="governing-law">12. Governing law</h2>',
    '<p>These Terms are governed by the laws of ' + JURISDICTION + ', without regard to conflict-of-law principles. Disputes shall be resolved in the competent courts of ' + JURISDICTION + '.</p>',

    '<h2 id="changes">13. Changes to terms</h2>',
    '<p>We may modify these Terms. Material changes will be notified via in-app notice. Continued use after changes constitutes acceptance.</p>',

    '<h2 id="contact">14. Contact</h2>',
    '<div class="contact-box">',
    '✉️ <a href="mailto:' + SUPPORT_EMAIL + '">' + SUPPORT_EMAIL + '</a><br>',
    '🏢 ' + COMPANY_NAME + ', ' + JURISDICTION,
    '</div>'
  ].join('');
}

function cookiesContent(): string {
  return [
    '<h1 class="title">Data &amp; SDKs</h1>',
    '<div class="meta">Last updated: ' + LAST_UPDATED + '</div>',
    '<p>The ' + APP_NAME + ' mobile app does not use browser cookies. Below is the list of third-party services and SDKs the app integrates with, what data each handles, and your control options.</p>',

    '<h2>Authentication &amp; database</h2>',
    '<h3>Supabase (auth + Postgres)</h3>',
    '<ul>',
    '<li><strong>Purpose:</strong> Account authentication, gameplay data storage</li>',
    '<li><strong>Data:</strong> Auth tokens (stored securely on-device via Expo SecureStore), game data (server-side)</li>',
    '<li><strong>Provider:</strong> Supabase, Inc. — <a href="https://supabase.com/privacy">privacy policy</a></li>',
    '</ul>',

    '<h2>Notifications</h2>',
    '<h3>Apple Push Notification Service (APNs) / Firebase Cloud Messaging (FCM)</h3>',
    '<ul>',
    '<li><strong>Purpose:</strong> Send push notifications you opt into</li>',
    '<li><strong>Data:</strong> Device push token (anonymized), notification payload</li>',
    '<li><strong>Control:</strong> Disable in iOS Settings → Notifications → ' + APP_NAME + ' (or Android equivalent)</li>',
    '</ul>',

    '<h2>Crash reporting</h2>',
    '<ul>',
    '<li><strong>Purpose:</strong> Capture app crashes for debugging</li>',
    '<li><strong>Data:</strong> Device model, OS version, app version, anonymized crash trace. <strong>No PII.</strong></li>',
    '<li><strong>Control:</strong> Crash reports cannot currently be opted out individually but contain no personal data.</li>',
    '</ul>',

    '<h2>Analytics</h2>',
    '<ul>',
    '<li><strong>Purpose:</strong> Understand which features are used and where users drop off, to improve UX</li>',
    '<li><strong>Data:</strong> Screen views, button taps, anonymized device class. <strong>No location, no keystrokes, no contact list.</strong></li>',
    '<li><strong>Storage:</strong> Aggregated. Raw events purged after 12 months.</li>',
    '</ul>',

    '<h2>What we do NOT use</h2>',
    '<ul>',
    '<li>No advertising SDKs</li>',
    '<li>No cross-app tracking</li>',
    '<li>No social media SDKs (Facebook, TikTok, etc.)</li>',
    '<li>No location tracking SDKs</li>',
    '<li>No microphone or camera access (except optional avatar upload)</li>',
    '</ul>',

    '<div class="contact-box">',
    'Questions? ✉️ <a href="mailto:' + SUPPORT_EMAIL + '">' + SUPPORT_EMAIL + '</a>',
    '</div>'
  ].join('');
}

function indexContent(): string {
  return [
    '<h1 class="title">' + APP_NAME + ' — Legal</h1>',
    '<div class="meta">Last updated: ' + LAST_UPDATED + '</div>',
    '<p>Choose a document:</p>',
    '<ul>',
    '<li><a href="/functions/v1/legal/privacy"><strong>Privacy Policy</strong></a> — What data we collect and how we use it</li>',
    '<li><a href="/functions/v1/legal/terms"><strong>Terms of Service</strong></a> — Rules for using the App</li>',
    '<li><a href="/functions/v1/legal/cookies"><strong>Data &amp; SDKs</strong></a> — Third-party services and what data each handles</li>',
    '</ul>',
    '<div class="contact-box">',
    '✉️ <a href="mailto:' + SUPPORT_EMAIL + '">' + SUPPORT_EMAIL + '</a> · ',
    '🏢 ' + COMPANY_NAME + ', ' + JURISDICTION,
    '</div>'
  ].join('');
}

Deno.serve((req: Request) => {
  const url = new URL(req.url);
  // Strip the function prefix so /functions/v1/legal/privacy => /privacy
  const path = url.pathname.replace(/^\/functions\/v1\/legal/, '').replace(/^\/legal/, '') || '/';
  
  let title: string;
  let content: string;
  
  if (path === '/privacy' || path === '/privacy/') {
    title = 'Privacy Policy';
    content = privacyContent();
  } else if (path === '/terms' || path === '/terms/') {
    title = 'Terms of Service';
    content = termsContent();
  } else if (path === '/cookies' || path === '/cookies/' || path === '/data') {
    title = 'Data & SDKs';
    content = cookiesContent();
  } else if (path === '/' || path === '') {
    title = 'Legal';
    content = indexContent();
  } else {
    return new Response('Not found. Try /privacy, /terms, /cookies, or /', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
  
  return new Response(shell(title, content), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    }
  });
});
