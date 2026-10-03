import { createHash } from 'node:crypto';

export const SECTION_ORDER = [
  'meeting_story', 'first_impressions', 'personal_worlds', 'discoveries',
  'everyday_memories', 'words_about_each_other', 'care_preferences',
  'small_gestures', 'everyday_rhythm', 'personal_rhythm', 'shared_activities',
  'shared_rituals', 'team_experiments', 'small_agreements', 'next_chapter'
];
const TEXT_TYPES = new Set(['short_text', 'long_text']);
const unique = values => new Set(values).size === values.length;
const exactMembers = (ids, members) => Array.isArray(ids) && ids.length === members.length &&
  unique(ids) && ids.every(id => members.includes(id));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const fail = code => { throw new Error(code); };

export function catalogBindings(catalogs) {
  const bindings = {};
  for (const catalog of catalogs) {
    for (const card of [...catalog.cards, ...catalog.reserveCards, ...catalog.dates]) {
      if (bindings[card.id]) fail('DUPLICATE_CATALOG_ID');
      const section = card.bookBinding?.section ?? card.bookSection;
      const fields = card.fields ?? card.outputFields;
      const explicit = card.bookBinding?.fields;
      const textFields = fields.filter(f => TEXT_TYPES.has(f.type) && (!explicit || explicit.includes(f.id)));
      bindings[card.id] = {
        section, month: catalog.month,
        fields: Object.fromEntries(textFields.map(f => [f.id, { label: f.label, maxLength: f.maxLength }])),
        eligible: SECTION_ORDER.includes(section)
      };
    }
  }
  // Separate coauthored record, never converted automatically from one person's answer.
  bindings['joint-agreement-v1'] = {
    section: 'small_agreements', month: 3, eligible: true,
    fields: { statement: { label: 'Наша договорённость', maxLength: 600 },
      review_on: { label: 'Когда пересмотрим', maxLength: 100 } }
  };
  return bindings;
}

export function assembleBook(input, bindings) {
  const { spaceId, memberIds, displayNames, providedPaidDays, milestone = 3,
    templateVersion = 'text-book-v1', sources, approvals = [] } = input;
  if (!nonempty(spaceId) || !Array.isArray(memberIds) || memberIds.length !== 2 ||
    !unique(memberIds) || !memberIds.every(nonempty)) fail('INVALID_SPACE_MEMBERS');
  if (![2, 3].includes(milestone) || !Number.isFinite(providedPaidDays) ||
    providedPaidDays < milestone * 30) fail('MILESTONE_NOT_EARNED');
  if (!nonempty(templateVersion) || !Array.isArray(sources)) fail('INVALID_INPUT');
  const members = [...memberIds].sort();
  const names = members.map(id => {
    const name = displayNames?.[id];
    if (!nonempty(name) || name.length > 100) fail('INVALID_DISPLAY_NAME');
    return { id, name };
  });
  const seen = new Set(), entries = [];
  for (const s of sources) {
    if (!nonempty(s.id) || seen.has(s.id)) fail('DUPLICATE_OR_INVALID_SOURCE');
    seen.add(s.id);
    if (s.spaceId !== spaceId) fail('FOREIGN_SPACE');
    if (s.visibility !== 'revealed') fail('SOURCE_NOT_REVEALED');
    if (!Number.isInteger(s.revision) || s.revision < 1) fail('INVALID_REVISION');
    const authors = s.authorIds;
    if (!Array.isArray(authors) || ![1, 2].includes(authors.length) ||
      !unique(authors) || !authors.every(id => members.includes(id))) fail('FOREIGN_AUTHOR');
    const binding = bindings[s.cardId];
    if (!binding) fail('UNKNOWN_CARD');
    if (binding.month > milestone) fail('SOURCE_FROM_FUTURE_STAGE');
    // Editor-only prompts are not story material, even when submitted.
    if (!binding.eligible) continue;
    if (s.cardId === 'joint-agreement-v1' && !exactMembers(authors, members)) fail('JOINT_NEEDS_TWO_AUTHORS');
    if (authors.length === 2 && (s.cardId !== 'joint-agreement-v1' ||
      !exactMembers(s.confirmedBy, members))) fail('JOINT_NOT_CONFIRMED');
    const selection = s.selection;
    if (!selection) continue;
    if (selection.revoked === true) fail('SELECTION_REVOKED');
    if (selection.revision !== s.revision) fail('STALE_SELECTION');
    if (!exactMembers(selection.selectedBy, authors)) fail('SELECTION_NOT_BY_AUTHORS');
    if (!Array.isArray(selection.fieldIds) || !unique(selection.fieldIds)) fail('INVALID_FIELD_SELECTION');
    const fields = [];
    // Catalog ordering makes selected fields stable across input permutations.
    for (const fieldId of selection.fieldIds) if (!binding.fields[fieldId]) fail('FIELD_NOT_ALLOWED');
    for (const [fieldId, rule] of Object.entries(binding.fields)) {
      if (!selection.fieldIds.includes(fieldId)) continue;
      const value = s.values?.[fieldId];
      if (value === undefined || value === null || value === '') continue;
      if (typeof value !== 'string' || value.length > rule.maxLength) fail('INVALID_FIELD_TEXT');
      if (!value.trim()) continue;
      fields.push({ fieldId, label: rule.label, text: value });
    }
    if (fields.length) entries.push({
      sourceId: s.id, sourceRevision: s.revision, cardId: s.cardId,
      authorIds: [...authors].sort(), section: binding.section, fields
    });
  }
  entries.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) ||
    (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0));
  const sections = SECTION_ORDER.map(id => ({ id, entries: entries.filter(e => e.section === id) }))
    .filter(s => s.entries.length);
  const payload = { schemaVersion: 1, spaceId, members: names, milestone, templateVersion, sections };
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const approvedMemberIds = [...new Set(approvals
    .filter(a => members.includes(a.memberId) && a.digest === digest && a.active === true)
    .map(a => a.memberId))].sort();
  return {
    payload, digest, approvedMemberIds,
    status: entries.length === 0 ? 'empty' : approvedMemberIds.length === 2 ? 'approved' : 'draft',
    exportable: entries.length > 0 && approvedMemberIds.length === 2,
    requiresServerRevalidation: true
  };
}
