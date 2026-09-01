/* eslint-disable require-jsdoc */

const STANDARD_RECIPIENT_ROLES = new Set([
  "manager",
  "agent",
  "agent marketing",
  "agent marketting",
  "stagaire",
  "stagaire marketting",
]);

const ROTATION_ONLY_RECIPIENT_ROLES = new Set([
  "auditrice",
  "manager regionale",
]);

function roleOf(employee) {
  return String(
      (employee && (employee.role || employee.position)) || "",
  ).trim().toLowerCase();
}

function isRotationPlacement(employee) {
  return Boolean(
      employee &&
      employee.isRotation === true &&
      String(employee.rotationSourceLocationId || "").trim(),
  );
}

function isAllowedRecipient(employee) {
  const role = roleOf(employee);
  if (STANDARD_RECIPIENT_ROLES.has(role)) return true;
  return isRotationPlacement(employee) &&
    ROTATION_ONLY_RECIPIENT_ROLES.has(role);
}

function isFollowupManager(employee) {
  const role = roleOf(employee);
  if (role === "manager") return true;
  return isRotationPlacement(employee) && role === "manager regionale";
}

function isWorkingEmployee(employee) {
  if (!employee) return false;
  const raw = String(
      employee.status ||
      employee.workStatus ||
      employee.employmentStatus ||
      "",
  ).trim().toLowerCase();
  return ["travaille", "tavaille", "en travail", "working", "work"]
      .includes(raw);
}

function hasPhone(employee) {
  return (employee && (employee.phoneNumber || employee.telephone)) || "";
}

function empLocation(employee, fallback) {
  return String(
      employee.location ||
      employee.site ||
      employee.office ||
      employee.branch ||
      fallback ||
      "",
  ).trim();
}

module.exports = {
  empLocation,
  hasPhone,
  isAllowedRecipient,
  isFollowupManager,
  isRotationPlacement,
  isWorkingEmployee,
  roleOf,
};
