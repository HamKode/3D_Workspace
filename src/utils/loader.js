export const hideLoader = () => {
  const loadingContainer = document.getElementById('loading-container')
  if (!loadingContainer) return
  loadingContainer.classList.add('fade-out')
  setTimeout(() => loadingContainer.remove(), 750)
}
