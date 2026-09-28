function setUpTopicMotion() {
  const topicRail = document.querySelector('.time-scope-rail');
  const topicToggle = topicRail?.querySelector('.time-scope-toggle');
  if (!topicRail || !topicToggle) return;
  if (topicRail.dataset.motionReady === 'true') return;

  topicRail.dataset.motionReady = 'true';
  topicToggle.addEventListener('click', () => {
    const paused = topicRail.classList.toggle('is-paused');
    topicToggle.setAttribute('aria-pressed', String(paused));
    topicToggle.setAttribute('aria-label', paused ? 'Play moving topics' : 'Pause moving topics');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setUpTopicMotion, { once: true });
} else {
  setUpTopicMotion();
}
