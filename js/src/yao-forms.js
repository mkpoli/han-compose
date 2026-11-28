// @ts-check
/** One choice per construction of the upper turn. GlyphWiki names are source identities. */
export const u26201Forms = [
  { id: 'detached', text: '幺󠄀', witnesses: ['u5e7a-j'] },
  { id: 'folded', text: '&VR-5E7A-02;', witnesses: ['u5e7a-g', 'u5e7a-h', 'u5e7a-t', 'u5e7a-var-002'] },
  { id: 'returning', text: '&VR-5E7A-03;', witnesses: ['u5e7a-itaiji-009'] },
].map(form => ({...form, aliases: form.witnesses.map(name => '&GW-' + name + ';')}))

const byName = new Map(u26201Forms.flatMap(form =>
  [form.id, form.text, ...form.witnesses, ...form.aliases].map(key => /** @type {const} */ ([key, form]))))

/** @param {string} idOrText */
export const resolveYaoForm = idOrText => byName.get(idOrText)
