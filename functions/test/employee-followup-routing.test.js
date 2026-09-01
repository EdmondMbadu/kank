/* eslint-disable require-jsdoc */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isAllowedRecipient,
  isFollowupManager,
  isRotationPlacement,
} = require("../employee-followup-routing");

function rotationEmployee(role) {
  return {
    role,
    status: "Travaille",
    isRotation: true,
    rotationSourceLocationId: "matadi-kibala",
  };
}

test("permanent audit and regional roles remain excluded", () => {
  assert.equal(isAllowedRecipient({role: "Auditrice"}), false);
  assert.equal(isAllowedRecipient({role: "Manager Regionale"}), false);
});

test("explicit audit rotations receive destination follow-ups", () => {
  assert.equal(isAllowedRecipient(rotationEmployee("Auditrice")), true);
  assert.equal(isAllowedRecipient(rotationEmployee("Manager Regionale")), true);
});

test("rotation needs a source site before expanding role eligibility", () => {
  const incomplete = {role: "Auditrice", isRotation: true};
  assert.equal(isRotationPlacement(incomplete), false);
  assert.equal(isAllowedRecipient(incomplete), false);
});

test("rotated regional manager owns fallback, rotated auditor does not", () => {
  assert.equal(isFollowupManager({role: "Manager"}), true);
  assert.equal(
      isFollowupManager(rotationEmployee("Manager Regionale")),
      true,
  );
  assert.equal(isFollowupManager(rotationEmployee("Auditrice")), false);
  assert.equal(isFollowupManager({role: "Manager Regionale"}), false);
});

test("existing operational roles stay eligible without rotation", () => {
  [
    "Manager",
    "Agent",
    "Agent Marketing",
    "Agent Marketting",
    "Stagaire",
    "Stagaire Marketting",
  ].forEach((role) => assert.equal(isAllowedRecipient({role}), true, role));
});
