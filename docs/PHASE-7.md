# Phase 7 - AI, research and study

Version 0.7.0 implements the Phase 7 prototype milestone: optional provider integration, page summarization and chat, research collections and study tools.

## Start

Run `npm start`. Open the browser menu and choose **AI assistant**, **Research** or **Study** from the internal sidebar, or find them with Ctrl+K. These tools use the trusted internal panel; return to the tab to continue browsing.

AI starts disabled. Open Provider settings, choose a provider, enter the full endpoint and a model you have available, then Save provider. A compatible chat API accepts HTTPS endpoints such as `https://api.openai.com/v1/chat/completions`; a running local Ollama installation can use `http://127.0.0.1:11434/api/chat` and an installed model name. Installing or downloading models is a separate user action. Enter a session API key if required; blank retains the existing key, Forget key removes it. Restarting the app forgets the key. Changing provider or destination clears the old key.

Capture page or selected text. Review and edit every excerpt before Preview request. Choose Summary, Chat, Explain, Translate (specify the language), Key points, Compare, Study notes or Flashcards. The preview shows destination, model and every message, including chat history. Only **Send reviewed request** starts a provider request. Cancel discards late responses. Responses render as text and never execute provider commands, HTML or tools. Check citations against the source; model answers are not verified facts.

## Research and study

- Save reviewed captured excerpts as research sources. Sources include title, sanitized URL, capture time and editable annotation. Select text on a website and capture it to preserve a focused excerpt.
- Load saved sources into AI context and choose Compare for multi-source work. Notes, reading list, reader and split-view workspace controls remain available from the learning navigation.
- Export research as a local Markdown file containing source excerpts, annotations and workspace notes. AI responses can be saved to Notes with their original source references.
- Create study workspaces, manual flashcards, flip cards and record reviews. AI flashcard responses are imported only after an explicit button click and strict JSON validation. Review counts are simple progress tracking, not a spaced-repetition algorithm.
- Start a 1-180 minute focus timer, optionally listing exact website origins to block in this window's workspace. Stop or timer completion records elapsed time locally. Closing the window records an interrupted session. Timers do not resume after restart. This is a focus aid, not parental-control or network enforcement; other windows, subresources and external apps are outside its scope.

## Data and security boundary

AI extraction runs in an isolated world. Page extraction skips forms, editable elements, inputs, scripts, frames, hidden elements and invisible ancestors. It captures at most 20,000 characters per source, five sources and 60,000 source characters per request. It does not provide PDF OCR, image understanding or access to closed shadow roots. Excerpts can still contain sensitive visible text: user review is required. Query strings and fragments are removed from source URLs.

IPC validates command shape and trusted sender. Preview IDs are generated in the main process, single use, and bound to provider configuration. Source changes invalidate previews. Workspace changes clear transient context. Chat includes bounded previous messages; total message content is capped at 100,000 characters.

Requests originate in the main process with no browser cookies and no redirects. HTTPS is required except explicit loopback HTTP. Only a user-configured endpoint receives the text; no silent uploads or automatic source following occur. Requests time out after 90 seconds, with at most two simultaneous provider requests, a 256 KB response ceiling and 60,000 answer characters. Provider errors are sanitized.

Provider configuration persists separately from ordinary theme/settings exports. Credentials stay in memory, never in snapshots or SQLite. Private containers cannot capture, transmit or save learning data. Research and study records are ordinary local SQLite data, not encrypted vault records. Limits: 40 saved sources, 200 flashcards and 100 focus sessions per workspace.

Caching is off by default. Opting in keeps up to 20 exact responses per workspace, keyed by provider configuration and complete messages. Cache reuse requires the same review/send flow; Clear AI cache removes these entries. Transient source text and chat disappear on restart unless explicitly saved. Provider-side retention depends on the provider; a client request cannot guarantee remote deletion.

## Validation and boundaries

Unit coverage exercises endpoint validation, prompt boundaries, single-use consent, key lifetime, destination changes, cache isolation, cancellation and bounded/redacted responses. Electron integration exercises visible-text extraction, no request before Send, exact transmitted messages, response saving, cache reuse, research annotations, flashcards, focus blocking, private restrictions and restart persistence.

Integration uses a local deterministic provider fixture. No paid cloud account or downloaded local model was available for live model-quality validation. Compatible providers must support the documented non-streaming chat request format; provider-specific adapters beyond compatible chat and Ollama are not included. The AI UI is an internal panel, not a native overlay alongside a live website. There is no autonomous web research, account sync, automated citation verification or independent security audit. Phase 8 remains separate.

API references: [OpenAI Chat Completions](https://developers.openai.com/api/reference/typescript/resources/chat/subresources/completions/methods/create), [Ollama Chat](https://docs.ollama.com/api/chat).

Verified on Windows: TypeScript and production build passed; 66 unit tests (including seven AI tests) and all 17 Electron integration scenarios passed. Abrupt-exit cleanup was corrected and crash recovery revalidated.
