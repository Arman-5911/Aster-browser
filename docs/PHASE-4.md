# Phase 4 - productivity and customization

Version **0.4.0** implements all six Phase 4 areas: Notes, Reading Mode, Reading List, Command Palette, Start Page and Customization.

## Available now

- Browser menu or internal sidebar > **Notes**: create, edit, search and delete plain-text notes. Save explicitly before leaving the panel. Note bodies are rendered as text, never HTML. Deletion requires confirmation.
- Browser menu or internal sidebar > **Reading list**: save the current website, open saved URLs, mark read/unread, filter, search and remove entries. Saving the same URL updates its title without duplicating it or resetting read state. Articles are not downloaded for offline reading.
- Both collections belong to the current persistent workspace, survive restart and are shared with other windows using that workspace. Temporary containers expose empty collections and reject saving at the main-process boundary.
- Migration 4 adds notes and reading_list tables without removing previous browser data. Limits: 200 notes per workspace, 20,000 characters per note, and 500 reading entries. Collections are ordinary local SQLite records, not encrypted storage or cloud sync.
- **Reading Mode (F9):** extracts text from the current page's article or main content, with a body fallback. The local reader includes title, author where available, estimated reading time, serif/sans fonts, adjustable size and narrow/wide columns. Exit returns to the same live page. It needs at least 200 characters of usable text. Extraction runs in an isolated page world; the UI renders plain strings, never remote HTML, scripts, images or iframes. Article content is kept in memory and is discarded on navigation or tab closure. It is not added to the database or session checkpoint, including in private windows.
- **Command Palette (Ctrl+K):** searches browser actions, current-workspace tabs and all workspace names. Arrow keys select, Enter runs and Escape closes. An additional search/open action accepts a URL or search query through the existing validated navigation path. It works from website content as well as browser chrome. It hides native website views while open.
- **Start Page:** custom greeting, Plain/Sage/Sand background, optional recent history, optional bookmark previews and up to eight named HTTP/HTTPS quick links. Add, remove or move links up from Settings. Existing theme, accent, density, search engine and workspace theme controls remain available. Quick links can be replaced by removing and adding them.
- **Customization persistence:** reader and start-page settings survive restart. Partial settings updates merge in the main process so changes to different controls do not overwrite each other. Older preferences receive validated defaults without resetting their theme or browsing configuration.

## Validation

44 unit tests cover workspace-scoped editing/deletion, URL deduplication, read-state preservation, bounded command payloads, safe custom links, reader preferences and existing security rules. Eleven Electron scenarios cover the previous browser regressions plus note creation/editing through the UI, safe text rendering, reading-list controls, persistence, workspace isolation and rejection of private saves. The Phase 4 scenario also opens the reader and palette using keyboard events from a website, checks text extraction, changes reader/start settings and verifies them after restart.

## Practical limits

Reading Mode uses a conservative text extractor, not full publisher-specific parsing. Complex apps, PDFs, short pages, paywalls and dynamically rendered content may not produce a useful article. It does not bypass access controls or fetch a second copy of the page. Formatting is reduced to paragraphs; original links and images remain available by exiting to the source page. Notes require explicit Save before leaving the editor; unsaved drafts are not restored. Settings apply across windows, while notes and reading entries are workspace-scoped. Named sessions restore browsing layout, not copies of notes or reading-list records.

## Run

Close older Aster windows, then run `npm start`. Notes, Reading List, Reading Mode and Command Palette are in Browser menu. Start-page controls are in Settings; the new-tab footer also opens Settings via “Customize your space.”
