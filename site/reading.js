const progress = document.querySelector('.reading-progress');
const paper = document.querySelector('.letter-paper');

function updateProgress() {
  const readingDistance = Math.max(1, paper.getBoundingClientRect().bottom + window.scrollY - window.innerHeight);
  progress.style.transform = `scaleX(${Math.min(1, window.scrollY / readingDistance)})`;
}

window.addEventListener('scroll', updateProgress, { passive: true });
window.addEventListener('resize', updateProgress);
document.fonts.ready.then(updateProgress);
updateProgress();
