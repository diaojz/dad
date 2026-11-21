const domain = document.querySelector('#domain');
const months = document.querySelectorAll('.month');

domain.addEventListener('change', () => {
  for (const month of months) {
    const entries = [...month.querySelectorAll('[data-domain]')];
    for (const entry of entries) {
      entry.hidden = Boolean(domain.value && entry.dataset.domain !== domain.value);
    }
    month.hidden = entries.every(entry => entry.hidden);
  }
});
