# WealthBoard security operating policy

Owner and security contact: Douglas Dweck, Owner, ddweck@ebillity.com.
Scope: private use for the owner's own financial accounts. Effective on owner adoption.

## Access
Only the configured, email-verified owner may access financial APIs, after password sign-in and authenticator verification. Authenticator sessions expire after eight hours by default, or after 30 days when the owner chooses Remember this device. Signing out clears remembered access. This option was introduced September 11, 2026, after the initial Plaid questionnaire submission. Five failed code attempts trigger a 15-minute lockout. Codes cannot be replayed. The owner confirms MFA on GitHub, Netlify, Neon and Plaid, and device encryption, automatic updates and malware protection. Recheck these controls quarterly and when access changes. Do not share credentials. Review vendor account access quarterly; revoke unneeded access immediately.

## Data and encryption
Use HTTPS for all application/provider traffic. Store Plaid tokens and authenticator secrets encrypted with AES-256-GCM. Keep the encryption/signing secret only in the hosting environment; rotating it requires a planned token/key migration. Do not log credentials, access tokens, authenticator seeds, codes or complete bank responses. Use Neon-managed encryption at rest and encrypted backups. Keep financial data out of public repositories and test artifacts.

## Maintenance
Review dependency alerts weekly and after security notifications. GitHub Actions runs type checks, regression tests and a production dependency audit; Dependabot checks weekly. Triage critical findings within 24 hours and high findings within seven days; assess impact, patch, test and deploy. Record exceptions with rationale and revisit weekly. Check Netlify sync/security logs weekly and investigate repeated authentication failures or unexplained activity. These processes require ongoing owner action; adding configuration alone is not evidence of a sustained program.

## Software lifecycle management
Review the software inventory at least monthly and whenever a runtime, framework or provider changes. Record vendor support sources, support deadlines and an upgrade owner. The security workflow checks the executing Node.js runtime against the official Node.js release schedule, checks the installed Next.js major against the reviewed inventory, and fails when a support or inventory-review deadline expires. It warns within 90 days of a deadline. Plan replacements before vendor support ends; do not treat a clean vulnerability scan as evidence that unsupported software is safe. Review transitive dependencies through Dependabot and vulnerability alerts. Separately review owner computers, browsers and provider-managed services; the application check does not scan or establish the support status of those systems. Record gaps and corrective actions before attesting organization-wide coverage.

## Retention and deletion
Retain daily history and sync logs for the duration of active dashboard use, until owner-requested deletion. Review continued need annually. Intraday history is capped at 365 days by price-sync maintenance. Keep current balances/holdings until correction or deletion. Authenticated deletion revokes Plaid Items first and then removes financial records. Preserve the owner login/MFA configuration so deletion does not create an account-takeover or lockout condition. Provider backup/log copies expire under their retention settings. Never claim immediate removal from third-party backups.

## Incident response
On suspected unauthorized access: restrict access, preserve relevant security logs, investigate scope, revoke compromised sessions/credentials and affected Plaid Items, rotate credentials using a planned migration, and verify restoration. Notify Plaid and any affected party as required by the applicable agreement and law. Record cause, timeline, containment and remediation. Do not claim that a suspected incident is resolved without verification.

## Recovery
Maintain protected authenticator backups. For lost MFA, verify the owner's identity using existing administrative accounts before resetting enrollment. Never disable MFA based solely on an unverified email. Test database recovery on an isolated branch quarterly; do not overwrite production to test backups.
