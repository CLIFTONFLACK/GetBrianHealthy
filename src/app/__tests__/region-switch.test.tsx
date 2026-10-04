import test from "node:test";
import assert from "node:assert/strict";
import { RegionSwitch } from "../region-switch.tsx";
import { setRegion } from "../region-actions.ts";

type El = { type: unknown; props: Record<string, unknown> };

function buttons(region: "US" | "GB"): El[] {
  const form = RegionSwitch({ region }) as unknown as El;
  const kids = form.props.children as El[];
  const group = kids[1];
  return group.props.children as El[];
}

test("RegionSwitch posts to the setRegion server action", () => {
  const form = RegionSwitch({ region: "US" }) as unknown as El;
  assert.equal(form.type, "form");
  assert.equal(form.props.action, setRegion);
});

test("RegionSwitch offers one submit button per region, named region, with value US then GB", () => {
  const bs = buttons("US");
  assert.deepEqual(bs.map((b) => b.props.value), ["US", "GB"]);
  assert.deepEqual(bs.map((b) => b.props.name), ["region", "region"]);
  assert.deepEqual(bs.map((b) => b.props.type), ["submit", "submit"]);
});

test("RegionSwitch labels the buttons with the country names", () => {
  assert.deepEqual(buttons("US").map((b) => b.props.children), ["United States", "United Kingdom"]);
});

test("RegionSwitch marks only the current region as pressed (US)", () => {
  assert.deepEqual(buttons("US").map((b) => b.props["aria-pressed"]), [true, false]);
});

test("RegionSwitch marks only the current region as pressed (GB)", () => {
  assert.deepEqual(buttons("GB").map((b) => b.props["aria-pressed"]), [false, true]);
});
