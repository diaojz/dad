const filters = document.querySelector('#domain');
const months = document.querySelectorAll('.month');

filters.hidden = false;
filters.addEventListener('click', event => {
  const selected = event.target.closest('button[data-filter]');
  if (!selected) return;
  for (const button of filters.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button === selected));
  }
  for (const month of months) {
    const entries = [...month.querySelectorAll('[data-domain]')];
    for (const entry of entries) {
      entry.hidden = Boolean(selected.dataset.filter && entry.dataset.domain !== selected.dataset.filter);
    }
    month.hidden = entries.every(entry => entry.hidden);
  }
});
