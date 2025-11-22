import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { imapService } from "./services/imap.service.js";

const app = createApp();

// Start IMAP polling
imapService.startPolling();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend API listening on port ${env.port}`);
});
