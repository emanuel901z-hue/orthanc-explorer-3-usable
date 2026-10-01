/**
 * Human wording for a change-log action.
 *
 * The broker records actions as `verb.entity` codes (`update.setting`,
 * `import.ups_subscription`, `hl7.cancel-unknown`). They are identifiers, not
 * text — the audit page used to print them raw, so an operator read
 * "update.setting" where "Setting changed" was meant.
 *
 * The dot belongs to the code but i18next reads it as a path separator
 * (`broker.action_update.setting` would look for a nested object), so the key
 * uses an underscore. An unknown code falls back to the raw code — a new action
 * must never render as an empty cell.
 */
export function auditActionKey(action: string): string {
  return `broker.action_${(action || '').replace(/\./g, '_')}`;
}
