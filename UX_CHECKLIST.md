# UX Checklist — Actionable Design Principles

**Sources (principles only, not book summaries):**  
*Don’t Make Me Think* (Krug) · *Laws of UX* (Yablonski) · *Refactoring UI* (Wathan & Schoger) · *Designing Interfaces* (Tidwell)

**How to use:** Treat each item as a pass/fail check during design review or QA.  
**Format:** Rule → Reason → Example → Common mistakes → How to verify

---

## Navigation

### N1 — Self-evident destinations
- **Rule:** Every nav label must name the destination in the user’s words; no clever or internal jargon.
- **Reason:** Users scan; they don’t read. Unclear labels force thinking.
- **Example:** “Inbound orders” not “Receipts pipeline.”
- **Common mistakes:** Product-team slang; overlapping labels (“Orders” vs “OMS Orders” with no distinction).
- **How to verify:** Cover icons; can a new user predict the page from the label alone?

### N2 — Clear “you are here”
- **Rule:** The current section must be visually obvious in the sidebar and any sub-nav.
- **Reason:** Orientation is a prerequisite for confidence (wayfinding).
- **Example:** Active sidebar item uses distinct fill + accent indicator; breadcrumbs or page title match.
- **Common mistakes:** Active state too subtle; multiple items look selected; title ≠ nav label.
- **How to verify:** Screenshot with text blurred—can you still spot the active section?

### N3 — Persistent primary navigation
- **Rule:** Global nav stays available across primary workflows; don’t hide the escape hatch.
- **Reason:** Users need a reliable home base (habit, Jakob’s Law / consistency).
- **Example:** Sidebar always visible on desktop; mobile menu one tap away.
- **Common mistakes:** Full-screen wizards with no way back; nav that disappears on scroll without affordance.
- **How to verify:** From any deep page, time-to-home ≤ 1 click (desktop) / 2 taps (mobile).

### N4 — Group related destinations
- **Rule:** Cluster nav by user mental model (task/domain), with short section labels.
- **Reason:** Chunking reduces cognitive load (Hick’s Law: fewer meaningful choices).
- **Example:** Warehouse → Inbound / Outbound / Products; Billing → Plans / Invoices.
- **Common mistakes:** Flat list of 20+ peers; grouping by org chart instead of tasks.
- **How to verify:** Card-sort or ask: “Where would you look for X?” — matches your groups ≥ 80%.

### N5 — One primary path per task
- **Rule:** For a given goal, one obvious primary entry; secondary paths are quiet.
- **Reason:** Competing CTAs create hesitation (Hick’s Law).
- **Example:** “New inbound” is the only strong green button on the inbound list.
- **Common mistakes:** Three equally loud buttons in the header; duplicate create flows in nav and page.
- **How to verify:** Five-second test: “What would you click to create?” — same answer from ≥ 4/5 people.

---

## Forms

### F1 — Labels outside the field
- **Rule:** Visible labels above (or beside) inputs; placeholders are hints, not labels.
- **Reason:** Placeholders disappear on type and hurt accessibility/scanability.
- **Example:** Label “Expected arrival” + optional placeholder “YYYY-MM-DD.”
- **Common mistakes:** Placeholder-only fields; labels that vanish into the value.
- **How to verify:** Fill the form—every field still has a visible label.

### F2 — Match field length to expected input
- **Rule:** Control width should approximate content length (short for codes, wide for notes).
- **Reason:** Affordances communicate format (*Refactoring UI* / form design patterns).
- **Example:** SKU ~ 20ch; notes full width.
- **Common mistakes:** Every input full-bleed; tiny fields for addresses.
- **How to verify:** Does width “look like” the data type without reading the label?

### F3 — Inline errors next to the problem
- **Rule:** Show error text adjacent to the invalid field; summarize at top only if many errors.
- **Reason:** Users fix what they can see (Krug: don’t make them hunt).
- **Example:** Red border + “Quantity must be greater than 0” under the quantity field.
- **Common mistakes:** Toast-only errors; clearing the form on fail; generic “Invalid input.”
- **How to verify:** Submit empty/invalid form—can you fix every error without scrolling randomly?

### F4 — Sensible defaults and progressive disclosure
- **Rule:** Pre-fill known values; hide advanced options until needed.
- **Reason:** Reduces decisions and empty-field anxiety (Hick’s Law, progressive disclosure).
- **Example:** Default warehouse from user context; “Advanced” collapsed.
- **Common mistakes:** Forcing re-entry of known company/warehouse; dumping 30 fields at once.
- **How to verify:** Happy-path create uses ≤ minimum required fields on first screen.

### F5 — Primary submit is obvious and protected
- **Rule:** One primary submit; destructive actions are separate and confirmed.
- **Reason:** Prevents accidental commits; aligns with Fitts’s Law (big target for main action).
- **Example:** “Create order” emerald; “Cancel” quiet text/secondary.
- **Common mistakes:** Submit and Cancel same visual weight; Enter submits destructive action.
- **How to verify:** Blindfold color—primary still wins by weight/position; Cancel never looks primary.

---

## Tables

### T1 — Scan-friendly columns
- **Rule:** Left-align text; right-align numbers; keep ID/status early; truncate with title tooltip.
- **Reason:** Tables are scanned, not read (*Designing Interfaces* data patterns).
- **Example:** Order # | Status | Client | Date | Amount (right) | Actions.
- **Common mistakes:** Centered everything; wrapping long IDs; status buried at the end.
- **How to verify:** Squint test—can you find a row’s status and key ID in < 1s?

### T2 — Row as the unit of action
- **Rule:** Clicking a row opens detail (if that’s the main task); row actions don’t fight row click.
- **Reason:** Matches expectation for admin/list UIs (Jakob’s Law).
- **Example:** Row click → detail; ⋮ menu `stopPropagation` for secondary actions.
- **Common mistakes:** Only tiny “View” links; accidental navigation when opening menus.
- **How to verify:** Click empty cell vs menu—behaviors are intentional and consistent across lists.

### T3 — Sticky header for long lists
- **Rule:** Keep column headers visible while scrolling the body.
- **Reason:** Orientation while scanning large datasets.
- **Example:** `thead` sticky inside scroll container.
- **Common mistakes:** Headers scroll away; horizontal scroll without sticky first column when needed.
- **How to verify:** Scroll mid-table—column meaning still readable.

### T4 — Stable empty and loading rows
- **Rule:** Loading and empty states use the same table chrome (don’t jump layout).
- **Reason:** Avoid layout shift and confusion (“did the page break?”).
- **Example:** Skeleton rows or single empty-state row spanning columns with clear CTA.
- **Common mistakes:** Blank white void; spinner replacing the whole page including filters.
- **How to verify:** Throttle network—filters stay; table region shows loading, then data/empty.

---

## Search

### S1 — Search looks like search
- **Rule:** Use a clear field + magnifying-glass affordance; placeholder states scope (“orders, SKUs…”).
- **Reason:** Standard patterns are recognized instantly (Jakob’s Law).
- **Example:** Topbar search with icon + “Search orders, products, invoices…”
- **Common mistakes:** Icon-only with no field until click (on desktop); vague “Search…”
- **How to verify:** First-time user points to “where would you search?” without prompting.

### S2 — Fast feedback
- **Rule:** Results update quickly (debounce ~200–300ms) or on Enter if server-heavy; show “no results.”
- **Reason:** Immediate feedback builds trust (feedback loops / Doherty threshold ~≤400ms feel).
- **Example:** Type → spinner in field → results list or empty message.
- **Common mistakes:** No indication search ran; silent failure; requiring full page reload.
- **How to verify:** Type nonsense—see explicit empty state; type known ID—hit appears promptly.

### S3 — Scoped vs global is clear
- **Rule:** Distinguish page/list search from global jump; don’t mix results without labels.
- **Reason:** Ambiguous scope causes wrong expectations.
- **Example:** List search filters the table; ⌘K opens “Quick jump” to pages.
- **Common mistakes:** One box that sometimes filters and sometimes navigates with no explanation.
- **How to verify:** Label or grouping makes scope obvious in the UI copy.

---

## Filters

### FL1 — Filters are visible when they matter
- **Rule:** Common filters are on the page (not buried); advanced filters progressive.
- **Reason:** Hidden filters = unused filters (Krug: obvious beats clever).
- **Example:** Status + date range always visible; rarely used fields behind “More filters.”
- **Common mistakes:** All filters in a modal by default; 12 filters always expanded.
- **How to verify:** Can you apply the top 3 filter use-cases without opening a drawer/modal?

### FL2 — Applied state is obvious
- **Rule:** Show which filters are active and how many results they yield; easy reset.
- **Reason:** Users forget constraints and think data is “missing.”
- **Example:** Chips “Status: Draft ×” + “Reset filters” + “Showing 3 of 120.”
- **Common mistakes:** Filters persist with no indicator; reset clears search but not dates silently.
- **How to verify:** Apply filters, navigate away and back—state is clear; reset returns to default list.

### FL3 — Apply vs instant filter intentionally
- **Rule:** Instant for cheap filters; explicit Apply for expensive multi-field queries.
- **Reason:** Prevents thrashing and race conditions; matches user mental model.
- **Example:** Status dropdown applies immediately; complex date+client+status uses Apply.
- **Common mistakes:** Every keystroke hits API; Apply button with only one control.
- **How to verify:** Document the rule per page; network tab matches the rule.

---

## Dashboard

### D1 — Answer “what needs attention?” first
- **Rule:** Above the fold: KPIs and alerts that drive action—not decoration.
- **Reason:** Dashboards are for monitoring and deciding (*Designing Interfaces*).
- **Example:** Open orders, overdue invoices, capacity warnings before charts of vanity metrics.
- **Common mistakes:** Hero illustration, dense charts, no next action.
- **How to verify:** Five-second test: “What should you do next?” yields a concrete answer.

### D2 — Each widget has one job
- **Rule:** One question per card/chart; link to the operational list for detail.
- **Reason:** Cognitive load and aesthetic-usability: clarity beats density soup.
- **Example:** “Active orders” card → click through to filtered orders list.
- **Common mistakes:** Mega-card mixing billing + warehouse + tasks with no hierarchy.
- **How to verify:** Remove the widget title—users can still say what it measures.

### D3 — Trends need context
- **Rule:** Charts include comparison or time range; raw numbers need units.
- **Reason:** Numbers without context aren’t actionable.
- **Example:** “12 open inbound” + sparkline 7 days; “90,000 SYP” labeled.
- **Common mistakes:** Chart with no axes meaning; percent without baseline.
- **How to verify:** Ask “is this good or bad?”—UI should help answer.

---

## Cards

### C1 — Card = one contained topic
- **Rule:** Use cards to group related content; don’t nest cards inside cards.
- **Reason:** Flat hierarchy scans faster (*Refactoring UI*).
- **Example:** Filter bar card + table card as siblings, not table card inside filter card.
- **Common mistakes:** Triple borders; every element wrapped in a card.
- **How to verify:** Remove borders—structure still holds via spacing; cards only where grouping helps.

### C2 — Elevation means interactivity or priority
- **Rule:** Stronger shadow/border for interactive or primary surfaces; static content flatter.
- **Reason:** Visual affordance (signifiers).
- **Example:** Hover-lift on clickable KPI cards; static detail sections flatter.
- **Common mistakes:** All cards same heavy shadow; clickable cards look inert.
- **How to verify:** Non-clickable and clickable cards are distinguishable without cursor change alone.

---

## Hierarchy

### H1 — One focal point per view
- **Rule:** Establish a clear visual primary (page title or primary KPI/CTA).
- **Reason:** Users decide in glances; competition causes freeze.
- **Example:** Title + one emerald CTA; secondary actions outlined/ghost.
- **Common mistakes:** Multiple large headings of equal weight; rainbow of equal buttons.
- **How to verify:** Squint/blur—only one element dominates.

### H2 — Size, weight, color—in that order
- **Rule:** Prefer typography scale and weight before color to show importance.
- **Reason:** Color alone fails accessibility and overloads (*Refactoring UI*).
- **Example:** `text-xl font-bold` title; `text-xs text-slate-500` subtitle.
- **Common mistakes:** Red/green/blue all used for hierarchy; tiny bold text fighting large light text.
- **How to verify:** Greyscale screenshot still shows clear hierarchy.

---

## Spacing

### SP1 — Consistent spacing scale
- **Rule:** Use a fixed scale (e.g. 4/8/12/16/24/32)—no one-off 13px gaps.
- **Reason:** Rhythm creates calm and predictability (*Refactoring UI*).
- **Example:** Section gaps `space-y-5` (20/24); card padding 16–24px.
- **Common mistakes:** Random margins; cramped labels vs huge empty regions.
- **How to verify:** Overlay spacing markers—gaps snap to the scale.

### SP2 — Related closer, unrelated farther
- **Rule:** Group by proximity (Gestalt): label near field; sections separated more.
- **Reason:** Proximity communicates structure without lines.
- **Example:** Label 4–8px above input; next field group 16–24px away.
- **Common mistakes:** Equal gaps everywhere; label closer to previous field than its input.
- **How to verify:** Cover labels—groups still read as clusters.

### SP3 — Don’t stretch sparse UIs
- **Rule:** Constrain content width (`max-w-7xl` / readable measure); don’t force sparse tables full ultrawide without purpose.
- **Reason:** Long line lengths and sparse rows hurt scanning.
- **Example:** Page content centered max width; tables scroll horizontally if needed.
- **Common mistakes:** Single sentence spanning 2000px; huge empty columns.
- **How to verify:** On 1440px+ screen, content still feels intentional, not deserted.

---

## Typography

### TY1 — Limited type scale
- **Rule:** 4–6 sizes max for UI (e.g. xs/sm/base/lg/xl/2xl).
- **Reason:** Too many sizes destroy hierarchy (*Refactoring UI*).
- **Example:** Page title xl; body sm/base; meta xs.
- **Common mistakes:** Every block a custom size; decorative fonts in data UI.
- **How to verify:** Inventory computed font sizes on a page—count unique sizes ≤ 6.

### TY2 — Readable body and tabular numbers
- **Rule:** Body ≥ 14px equivalent; use tabular nums for columns of numbers.
- **Reason:** Legibility and alignment for ops data.
- **Example:** `text-sm` tables; `tabular-nums` on quantities/money.
- **Common mistakes:** 11px body; proportional nums making amounts dance.
- **How to verify:** Zoom 100% on laptop—comfortable reading; number columns align.

### TY3 — Sentence case for UI chrome
- **Rule:** Prefer sentence case for labels/buttons; reserve ALL CAPS for rare small overlines.
- **Reason:** ALL CAPS is harder to read (Krug).
- **Example:** “Create order” not “CREATE ORDER.”
- **Common mistakes:** Screaming buttons; mixed Title Case And SCREAMING.
- **How to verify:** Grep UI copy for unnecessary all-caps.

---

## Colors

### CO1 — Gray first, color second
- **Rule:** Build UI in neutrals; add brand/semantic color for status and primary actions.
- **Reason:** Color scarcity makes meaning stronger (*Refactoring UI*).
- **Example:** Slate surfaces; emerald only for primary CTA and success; rose for danger.
- **Common mistakes:** Every icon a different hue; decorative gradients competing with status.
- **How to verify:** Count distinct hues on a screen—keep semantic set small (brand, success, warning, danger, info).

### CO2 — Status color + text/shape
- **Rule:** Never rely on color alone for status; pair with label and/or icon/dot pattern.
- **Reason:** Accessibility (color vision) + clarity.
- **Example:** Badge “Completed” with green bg + text + dot.
- **Common mistakes:** Red/green dots with no text; link color = visited = brand chaos.
- **How to verify:** Simulate greyscale—statuses still distinguishable.

### CO3 — Sufficient contrast
- **Rule:** Text/icon contrast meets WCAG AA against its background (4.5:1 body, 3:1 large/UI).
- **Reason:** Legibility for all users.
- **Example:** `text-slate-700` on white; avoid `text-slate-400` for primary content.
- **Common mistakes:** Muted gray labels on gray backgrounds; emerald text on emerald tint too light.
- **How to verify:** Contrast checker on title, body, caption, and badge text.

---

## Accessibility

### A1 — Keyboard complete
- **Rule:** All actions reachable via keyboard; visible focus ring; logical tab order.
- **Reason:** Accessibility and power-user efficiency.
- **Example:** Skip link to main; focus styles on buttons/inputs/links; Esc closes modal.
- **Common mistakes:** `outline: none` without replacement; focus trapped incorrectly; unreachable ⋮ menus.
- **How to verify:** Unplug mouse—complete a create + filter + open detail flow.

### A2 — Semantic structure and names
- **Rule:** Real headings (`h1` once), labels tied to inputs, buttons named (not icon-only without `aria-label`).
- **Reason:** Screen readers and SEO of structure.
- **Example:** Icon bell button `aria-label="Notifications"`; table headers in `th`.
- **Common mistakes:** Clickable `div`s; multiple `h1`s; empty buttons.
- **How to verify:** Accessibility tree / axe scan; headings outline makes sense.

### A3 — Don’t ship motion that harms
- **Rule:** Respect `prefers-reduced-motion`; avoid essential info only in animation.
- **Reason:** Vestibular and attention accessibility.
- **Example:** Fade optional; status text always present.
- **Common mistakes:** Infinite pulsing as only “loading” cue; parallax on data pages.
- **How to verify:** OS reduced-motion on—UI still usable and understandable.

---

## Responsiveness

### R1 — Prioritize tasks on small screens
- **Rule:** On mobile, keep primary task reachable; demote secondary columns/actions.
- **Reason:** Small viewport = stricter Hick/Fitts constraints.
- **Example:** Stack filters; table → cards or horizontal scroll with sticky key column; nav in drawer.
- **Common mistakes:** Desktop table squashed unreadable; sticky sidebars eating width.
- **How to verify:** 375px and 768px screenshots of top 5 workflows—task completable.

### R2 — Touch targets
- **Rule:** Interactive targets ≥ ~44×44px on touch UIs.
- **Reason:** Fitts’s Law / mobile guidelines.
- **Example:** Row action buttons padded; sidebar items comfortable height.
- **Common mistakes:** 24px icon hit areas; adjacent targets touching.
- **How to verify:** Thumb-reach test on device; no mis-taps in hallway test.

---

## Loading

### L1 — Immediate acknowledgment
- **Rule:** Any action > ~100ms shows pending state on the control or region.
- **Reason:** Feedback prevents double-submit and anxiety (Doherty threshold).
- **Example:** Button spinner + disabled; table skeleton; not full-page whiteout for small fetches.
- **Common mistakes:** No disabled state → double create; blocking overlay for tiny requests.
- **How to verify:** Slow 3G—every submit shows pending; only one request fires.

### L2 — Prefer skeletons that match layout
- **Rule:** Loading placeholders mirror final structure (cards/rows), not only a centered spinner.
- **Reason:** Perceived performance and orientation.
- **Example:** Dashboard KPI skeleton cards; table row skeletons.
- **Common mistakes:** Generic spinner erasing filters; layout jump when data arrives.
- **How to verify:** Filmstrip loading→loaded—positions stable (low CLS).

---

## Empty States

### E1 — Empty is a designed state
- **Rule:** Explain why it’s empty and offer the next best action.
- **Reason:** First-run and filtered-empty are different moments—both need guidance.
- **Example:** “No inbound orders yet” + “Create inbound”; filtered: “No matches” + “Reset filters.”
- **Common mistakes:** Blank table; same message for never-used vs filtered-out.
- **How to verify:** New account and over-filtered list each show appropriate copy + CTA.

### E2 — Don’t blame the user
- **Rule:** Neutral, helpful tone; avoid error styling for legitimate emptiness.
- **Reason:** Aesthetic-usability and trust.
- **Example:** Soft illustration/icon + calm text—not red alert.
- **Common mistakes:** Red “failed” for zero results; dead-end with no CTA.
- **How to verify:** Tone read-aloud—sounds like help, not failure.

---

## Notifications

### NT1 — Timely, actionable, scannable
- **Rule:** Title states what happened; body adds only needed detail; time is relative or local.
- **Reason:** Notifications are interruptive—optimize for scan (Krug).
- **Example:** “Inbound INB-… completed” + deep link; unread indicator.
- **Common mistakes:** Vague “Update”; walls of text; no mark-read.
- **How to verify:** Read titles only—understand event type and object.

### NT2 — Severity matches channel
- **Rule:** Use toasts for transient confirmations; inbox for durable events; modal only for blocking needs.
- **Reason:** Right interruptiveness (posture / attention).
- **Example:** Toast “Saved”; bell inbox for “invoice overdue”; modal for session expiry.
- **Common mistakes:** Modal for “copied”; toast for irreversible errors that require action.
- **How to verify:** Classify 10 notifications into toast/inbox/modal—no mismatches.

---

## Error Handling

### ER1 — Human, specific, recoverable
- **Rule:** Say what failed, why if known, and what to do next.
- **Reason:** Errors are moments of highest stress—clarity reduces support load.
- **Example:** “Couldn’t create order: SKU not found. Check the product or create it first.”
- **Common mistakes:** “Error 500”; swallowing errors; retry with no change.
- **How to verify:** Force API failure—message is understandable without engineering knowledge.

### ER2 — Preserve user input
- **Rule:** On failure, keep form values; highlight the problem.
- **Reason:** Punishing re-entry destroys trust.
- **Example:** Modal stays open with values; field-level error.
- **Common mistakes:** Closing modal on error; resetting the form.
- **How to verify:** Submit invalid create—input still there.

### ER3 — Distinguish system vs validation vs empty
- **Rule:** Use different patterns: inline validation, page Alert for system errors, empty state for zero data.
- **Reason:** Wrong pattern mis-trains users.
- **Example:** `@ds` Alert for load failure with Retry; empty state for zero rows.
- **Common mistakes:** Empty state on network failure; alert for “0 results.”
- **How to verify:** Three scenarios (validation/system/empty) each look different.

---

## Modals

### M1 — Modals for focused, short tasks
- **Rule:** Use modals for confirmations and small forms; not for primary multi-step workflows.
- **Reason:** Modal posture interrupts; overuse traps users (*Designing Interfaces*).
- **Example:** Confirm delete; create with ≤ ~7 fields. Long wizards → full page or drawer.
- **Common mistakes:** Entire “create order” wizard in a tiny modal; nested modals.
- **How to verify:** If scrolling inside modal is heavy, promote to page/drawer.

### M2 — Clear dismiss and commit
- **Rule:** Explicit Cancel/Close; Esc and backdrop dismiss only if safe (non-destructive, no data loss without confirm).
- **Reason:** Prevent accidental loss.
- **Example:** Dirty form → confirm before close; delete confirm requires explicit button.
- **Common mistakes:** Backdrop closes mid-edit with no warn; no focus trap.
- **How to verify:** Keyboard-only open/close; focus returns to trigger; dirty guard works.

### M3 — One primary action
- **Rule:** Modal footer: primary commit + secondary cancel; danger styled for destructive.
- **Reason:** Hick’s Law inside a constrained surface.
- **Example:** “Delete” danger + “Keep order” secondary.
- **Common mistakes:** Three equal buttons; primary on the left in LTR confusingly swapped without care.
- **How to verify:** Blur test—only one filled button.

---

## Drawers

### DR1 — Drawers for detail without losing list context
- **Rule:** Use drawers to inspect/edit an entity while the list remains underneath.
- **Reason:** Preserves context and speeds compare/iterate (*Designing Interfaces* overlays).
- **Example:** Product quick-view drawer from products table.
- **Common mistakes:** Drawer that navigates away anyway; drawer wider than viewport with no purpose.
- **How to verify:** Open drawer—list still conceptually “there”; close returns seamlessly.

### DR2 — Same rules as modals for focus and dismiss
- **Rule:** Trap focus; Esc closes; clear header with title + close control.
- **Reason:** Accessibility parity with modals.
- **Example:** Sticky drawer header “Product details” + X.
- **Common mistakes:** No close button; content under topbar inaccessible.
- **How to verify:** Keyboard pass; scroll locks body appropriately.

---

## Data Density

### DD1 — Density matches task expertise
- **Rule:** Ops tables can be denser than marketing pages; still keep row height tappable and readable.
- **Reason:** Experts prefer information density; novices need air (*Refactoring UI* balance).
- **Example:** Admin tables compact `py-3`; client marketing dashboards more spacious.
- **Common mistakes:** Spreadsheet cram with 10px rows; or huge padding wasting monitor in ops tools.
- **How to verify:** User role test—ops users aren’t scrolling excessively; no mis-clicks.

### DD2 — Progressive disclosure beats wall-of-data
- **Rule:** Show key columns by default; secondary columns optional/responsive hide.
- **Reason:** Hick’s Law on columns; mobile survival.
- **Example:** Default: ID, status, date, client; “Columns” to add weight/volume.
- **Common mistakes:** 15 columns by default; horizontal scroll as the only strategy with no priority.
- **How to verify:** Default viewport shows decision-critical columns without scroll (desktop).

### DD3 — Align and compare
- **Rule:** Numbers aligned; same units column-wide; sparklines/bars only if they aid comparison.
- **Reason:** Tables exist for comparison.
- **Example:** Money column right-aligned with consistent currency formatting.
- **Common mistakes:** Mixed units; bars without scale; sorting on formatted strings broken.
- **How to verify:** Pick two rows—compare amount/status in < 2s.

---

## Cross-cutting quick gate (ship check)

Before release of any Admin/Client screen:

1. [ ] Can a new user name the page purpose in 5 seconds?  
2. [ ] Is there one obvious primary action?  
3. [ ] Do empty, loading, and error states each look different and helpful?  
4. [ ] Keyboard-only path works?  
5. [ ] Greyscale hierarchy still works?  
6. [ ] Forest/legacy colors aren’t sneaking past the design system?  
7. [ ] Mobile/tablet critical path works?

---

*Checklist only—no book summaries. Apply alongside `DESIGN_SYSTEM_REPORT.md` when auditing EMDAD Admin vs Client Portal.*
