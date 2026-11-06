import test from "node:test";
import assert from "node:assert/strict";
import Link from "next/link";
import { signToken } from "../../newsletter.ts";

// The confirm page imports the server action and the newsletter helpers, both of
// which are real here: neither needs the network or the Next runtime to build the
// page. Reading the token only needs the configured secret, set per test.
const SECRET = "a".repeat(32);
const GUIDE_PDF = "/downloads/energy-strength-calm.pdf";

type El = { type: unknown; props: Record<string, unknown> };

let ConfirmPage: (props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<unknown>;
let confirmSubscription: unknown;

test.before(async () => {
  const page = await import("../page.tsx");
  ConfirmPage = page.default as unknown as typeof ConfirmPage;
  ({ confirmSubscription } = await import("../../actions.ts"));
});

const ENV_KEYS = ["RESEND_API_KEY", "RESEND_SEGMENT_ID", "RESEND_GUIDE_SEGMENT_ID", "NEWSLETTER_SECRET", "NEWSLETTER_FROM"] as const;

let savedEnv: Record<string, string | undefined>;

test.beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_SEGMENT_ID = "seg_123";
  process.env.RESEND_GUIDE_SEGMENT_ID = "seg_guide";
  process.env.NEWSLETTER_SECRET = SECRET;
  process.env.NEWSLETTER_FROM = "Brian <brian@getbrian.xyz>";
});

test.afterEach(() => {
  for (const key of ENV_KEYS) {
    const v = savedEnv[key];
    if (v === undefined) delete process.env[key];
    else process.env[key] = v;
  }
});

async function render(params: Record<string, string | undefined>): Promise<unknown> {
  return ConfirmPage({ searchParams: Promise.resolve(params) });
}

/** Walks the page's output: host elements, plus every function component except Link. */
function expand(node: unknown, onEl: (el: El) => void, onText: (s: string) => void): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (typeof node === "string") return onText(node);
  if (typeof node === "number") return onText(String(node));
  if (Array.isArray(node)) {
    for (const child of node) expand(child, onEl, onText);
    return;
  }
  if (typeof node === "object" && "type" in node) {
    const el = node as El;
    onEl(el);
    if (typeof el.type === "function" && el.type !== Link) {
      try {
        expand((el.type as (p: unknown) => unknown)(el.props), onEl, onText);
        return;
      } catch {
        // needs React context: use what it was handed instead
      }
    }
    if (el.props && "children" in el.props) expand(el.props.children, onEl, onText);
  }
}

function elements(tree: unknown): El[] {
  const out: El[] = [];
  expand(tree, (el) => out.push(el), () => {});
  return out;
}

function text(tree: unknown): string {
  const out: string[] = [];
  expand(tree, () => {}, (s) => out.push(s));
  return out.join(" ");
}

// ---------------------------------------------------------------------------
// After a guide sign-up is confirmed
// ---------------------------------------------------------------------------

test("the guide done page links the PDF as a download", async () => {
  const tree = await render({ done: "guide" });
  const links = elements(tree).filter((el) => el.type === "a" && el.props.href === GUIDE_PDF);
  assert.equal(links.length, 1);
  assert.equal(links[0].props.download, true);
});

test("the guide done page offers no confirm form", async () => {
  const tree = await render({ done: "guide" });
  assert.equal(elements(tree).filter((el) => el.type === "form").length, 0);
});

test("the guide done page says the guide is ready", async () => {
  const tree = await render({ done: "guide" });
  assert.match(text(tree), /Your guide is ready/);
});

test("the updates done page carries no PDF link", async () => {
  const tree = await render({ done: "1" });
  assert.equal(elements(tree).filter((el) => el.props.href === GUIDE_PDF).length, 0);
  assert.match(text(tree), /You're on the list/);
});

// ---------------------------------------------------------------------------
// Before the reader presses the button
// ---------------------------------------------------------------------------

test("a guide token shows the guide button, with the token in a hidden field and the confirm action", async () => {
  const token = signToken("reader@example.com", Date.now(), SECRET, "guide");
  const tree = await render({ t: token });
  const form = elements(tree).find((el) => el.type === "form");
  assert.ok(form, "a confirm form must be shown");
  assert.equal(form.props.action, confirmSubscription);
  const hidden = elements(tree).find((el) => el.type === "input" && el.props.name === "t");
  assert.equal(hidden?.props.value, token);
  assert.match(text(tree), /Confirm and get my guide/);
  assert.doesNotMatch(text(tree), /Confirm my email/);
});

test("an updates token shows the updates button and no guide wording", async () => {
  const token = signToken("reader@example.com", Date.now(), SECRET);
  const tree = await render({ t: token });
  assert.match(text(tree), /Confirm my email/);
  assert.doesNotMatch(text(tree), /guide/i);
});

test("the error page shows no confirm form and says the link did not work", async () => {
  const token = signToken("reader@example.com", Date.now(), SECRET, "guide");
  const tree = await render({ t: token, error: "1" });
  assert.equal(elements(tree).filter((el) => el.type === "form").length, 0);
  assert.match(text(tree), /That link didn't work/);
});
