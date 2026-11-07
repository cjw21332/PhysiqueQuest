// Count only individually graded provider events; missed events remain ungraded.
export function createProviderRepQuality() {
  let last=0, clean=0, graded=0;
  return {
    update(count, grade) {
      if (!Number.isSafeInteger(count) || count < 0 || count > 10000) return {total:last,clean,graded};
      if (count <= last) return {total:last,clean,graded};
      last=count;
      if (typeof grade === 'string' && /^[A-F]$/.test(grade)) { graded++; if (grade === 'A' || grade === 'B') clean++; }
      return {total:last,clean,graded};
    },
  };
}
