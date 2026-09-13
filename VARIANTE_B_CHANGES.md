# Variante B — Änderungen

- Eigenen Username/Password-Login entfernt.
- `/api/auth.js` entfernt.
- `/api/_session.js` entfernt.
- `WALLET_LOGIN_USER`, `WALLET_LOGIN_PASSWORD`, `WALLET_SESSION_SECRET` nicht mehr erforderlich.
- `/api/endpoints.js` benötigt keine lokale Login-Session mehr.
- Circle Email OTP ist jetzt der direkte Login.
- Nach erfolgreicher OTP-Verifizierung wird automatisch nach einer bestehenden Wallet gesucht.
- Existiert eine Wallet, wird sie sofort angezeigt.
- Existiert noch keine Wallet, werden Initialisierung und Wallet-Erstellung angeboten.
- `Sign Out / Reset` löscht die Circle-Tokens aus dem Browser-Speicher dieser Sitzung.
