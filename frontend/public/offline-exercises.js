(() => {
  const $ = id => document.getElementById(id);
  let rows = [], filtered = [], page = 1, timer, previousSearch = { needle: '', matches: [] };
  const searchable = new WeakMap();
  const fields = { body: 'bodyParts', equipment: 'equipments', target: 'targetMuscles', secondary: 'secondaryMuscles' };
  function render() {
    const search = $('search').value.trim().toLowerCase();
    let candidates = rows;
    if (search) {
      candidates = search.startsWith(previousSearch.needle) && previousSearch.needle ? previousSearch.matches : rows;
      candidates = candidates.filter(row => { let text = searchable.get(row); if (text === undefined) { text = [row.name, ...(row.bodyParts || []), ...(row.equipments || []), ...(row.targetMuscles || []), ...(row.secondaryMuscles || []), ...(row.instructions || [])].join('\n').toLowerCase(); searchable.set(row, text); } return text.includes(search); });
      previousSearch = { needle: search, matches: candidates };
    }
    filtered = candidates.filter(row => Object.entries(fields).every(([id, field]) => !$(id).value || (row[field] || []).includes($(id).value)));
    const sort = $('sort').value;
    const key = row => sort === 'body' ? row.bodyParts?.[0] || '' : sort === 'equipment' ? row.equipments?.[0] || '' : row.name;
    filtered.sort((a, b) => (sort === 'name-desc' ? -1 : 1) * key(a).localeCompare(key(b), undefined, { sensitivity: 'base' }) || a._id.localeCompare(b._id));
    const pages = Math.max(1, Math.ceil(filtered.length / 12)); page = Math.min(page, pages);
    $('count').textContent = `${filtered.length} exercises`;
    $('items').replaceChildren(...filtered.slice((page - 1) * 12, page * 12).map(row => {
      const button = document.createElement('button'), name = document.createElement('strong'), meta = document.createElement('small');
      name.textContent = row.name; meta.textContent = [row.targetMuscle, row.equipment].filter(Boolean).join(' · '); button.append(name, meta); button.addEventListener('click', () => show(row)); return button;
    }));
    $('page').textContent = `Page ${page} of ${pages}`; $('previous').disabled = page <= 1; $('next').disabled = page >= pages;
  }
  function show(row) {
    $('name').textContent = row.name; $('metadata').textContent = [row.targetMuscle, row.equipment].filter(Boolean).join(' · ');
    $('instructions').replaceChildren(...(row.instructions || []).map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    const media = $('media'); media.replaceChildren();
    if (row.gifUrl) { const img = document.createElement('img'); img.alt = `Demonstration for ${row.name}`; img.loading = 'lazy'; img.onerror = () => { media.textContent = 'Demonstration unavailable offline.'; }; img.src = row.gifUrl; media.append(img); }
    else media.textContent = 'No demonstration available.';
    $('detail').showModal();
  }
  const request = indexedDB.open('physiquequest-exercise-catalog', 1);
  request.onupgradeneeded = () => { request.transaction.abort(); };
  request.onerror = () => { $('count').textContent = 'No saved exercise library is available. Connect to the internet to load it.'; };
  request.onsuccess = () => { const db = request.result; if (!db.objectStoreNames.contains('exercises')) { $('count').textContent = 'No saved exercises are available.'; db.close(); return; } const query = db.transaction('exercises').objectStore('exercises').getAll(); query.onsuccess = () => { rows = query.result; db.close(); for (const [id, field] of Object.entries(fields)) { const values = [...new Set(rows.flatMap(row => row[field] || []))].sort((a, b) => a.localeCompare(b)); for (const value of values) { const option = document.createElement('option'); option.value = value; option.textContent = value; $(id).append(option); } } render(); }; query.onerror = () => { db.close(); $('count').textContent = 'Saved exercises could not be opened.'; }; };
  $('search').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; render(); }, 250); });
  for (const id of [...Object.keys(fields), 'sort']) $(id).addEventListener('change', () => { page = 1; render(); });
  $('clear').addEventListener('click', () => { $('search').value = ''; for (const id of Object.keys(fields)) $(id).value = ''; $('sort').value = 'name-asc'; page = 1; render(); });
  $('previous').addEventListener('click', () => { page--; render(); }); $('next').addEventListener('click', () => { page++; render(); }); $('close').addEventListener('click', () => $('detail').close());
  window.addEventListener('online', () => { fetch('/manifest.webmanifest', { cache: 'no-store' }).then(response => { if (response.ok) location.assign('/exercises'); }).catch(() => {}); });
})();
