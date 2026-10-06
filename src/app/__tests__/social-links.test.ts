import test from "node:test";
import assert from "node:assert/strict";
import { socialLinks } from "../site.ts";

test("socialLinks lists only https links to the account pages themselves", () => {
  assert.ok(socialLinks.length > 0);
  for (const s of socialLinks) {
    const u = new URL(s.href);
    assert.equal(u.protocol, "https:");
    assert.ok(u.pathname.toLowerCase().includes(s.handle.replace("@", "").toLowerCase()), `${s.name} link must contain its handle`);
    assert.equal(u.search, "");
  }
});

test("socialLinks has one entry per network", () => {
  const names = socialLinks.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
});
