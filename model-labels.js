// UI wording stays in content.json; model identifiers come from pose folders.
export function comparisonLabels(copy, models = {}) {
  const name = models.before?.replace(/^yolo/i, 'YOLO');
  return {
    before: name ? copy.modelTag.replace(/\{(label|model)\}/g, (_, key) => key === 'label' ? copy.before : name) : copy.before,
    after: copy.after,
  };
}
