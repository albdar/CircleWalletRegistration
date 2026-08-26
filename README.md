# Circle Wallet Test

Kleine Vanilla-JavaScript-Testanwendung für **Circle User-Controlled Wallets** mit:

- E-Mail OTP
- Circle Web SDK
- Smart Contract Account (`SCA`)
- Ethereum Sepolia (`ETH-SEPOLIA`)
- Vercel Serverless API
- Anzeige der Wallet-Adresse
- optionaler Anzeige des USDC-Bestands

## 1. Voraussetzungen

- Node.js 22 oder neuer
- Circle Developer Account
- Circle Standard API Key
- Circle User-Controlled Wallet App ID
- im Circle Configurator eingerichtetes Email OTP / SMTP

## 2. Projekt entpacken

In Git Bash oder PowerShell in den Projektordner wechseln.

```bash
cd circle-wallet-test
```

## 3. Umgebungsvariablen anlegen

`.env.example` nach `.env.local` kopieren.

### Git Bash

```bash
cp .env.example .env.local
```

### PowerShell

```powershell
Copy-Item .env.example .env.local
```

Danach `.env.local` bearbeiten:

```text
CIRCLE_API_KEY=DEIN_ECHTER_CIRCLE_API_KEY
VITE_CIRCLE_APP_ID=DEINE_CIRCLE_APP_ID
CIRCLE_BLOCKCHAIN=ETH-SEPOLIA
CIRCLE_BASE_URL=https://api.circle.com
```

**Wichtig:** `CIRCLE_API_KEY` darf niemals mit `VITE_` beginnen. Variablen mit `VITE_` werden in den Browser-Build übernommen.

## 4. Abhängigkeiten installieren

```bash
npm install
```

## 5. Lokal starten

Da das Projekt Vercel Serverless Functions unter `/api` verwendet, lokal über Vercel Dev starten:

```bash
npm run dev
```

Beim ersten Start kann Vercel nach Login bzw. Projektverknüpfung fragen.

Danach die von Vercel angezeigte lokale URL öffnen, typischerweise:

```text
http://localhost:3000
```

## 6. Testablauf

1. E-Mail-Adresse eingeben.
2. `OTP senden` anklicken.
3. OTP-Mail öffnen.
4. `OTP bestätigen` anklicken.
5. OTP in der von Circle geöffneten Oberfläche eingeben.
6. `User initialisieren` anklicken.
7. `Wallet erstellen` anklicken und die Circle Challenge bestätigen.
8. Nach erfolgreicher Erstellung wird die Wallet-Adresse angezeigt.

Bei einem bereits initialisierten Circle User lädt die Anwendung dessen vorhandene Wallet.

## 7. Circle Console prüfen

Nach erfolgreicher Wallet-Erstellung:

```text
Circle Developer Console
→ Wallets
→ User Controlled
→ Users
```

Dort sollte der Benutzer bzw. die Wallet sichtbar sein.

## 8. Deployment auf Vercel

Das Projekt kann direkt auf Vercel deployed werden.

In Vercel unter:

```text
Project
→ Settings
→ Environment Variables
```

diese Variablen setzen:

```text
CIRCLE_API_KEY
VITE_CIRCLE_APP_ID
CIRCLE_BLOCKCHAIN=ETH-SEPOLIA
CIRCLE_BASE_URL=https://api.circle.com
```

Danach neu deployen.

## 9. Sicherheit

- API Key nur im Backend verwenden.
- `.env.local` nicht nach Git pushen.
- `userToken`, `encryptionKey`, `deviceEncryptionKey` nicht loggen.
- Für diesen Test werden Session-Schlüssel nur im Arbeitsspeicher des Browser-Tabs gehalten.
- Bei einem Reload muss deshalb erneut per E-Mail OTP authentifiziert werden.

## 10. Nächster Integrationsschritt

Wenn dieser Test funktioniert, kann die Circle Wallet mit dem bestehenden Marketplace verbunden werden:

```text
Circle User
    ↓
SCA Wallet
    ↓
PartnerRegistry
    ↓
TradeEscrowMarketplace
    ↓
approve / payOrder / confirmReceipt / ...
```

Danach kann optional Circle Gas Station für Gas Sponsoring ergänzt werden.
