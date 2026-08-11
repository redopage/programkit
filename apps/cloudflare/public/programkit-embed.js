;(() => {
  const selector = '[data-programkit-embed]'

  function mount(container) {
    if (!(container instanceof HTMLElement) || container.dataset.programkitMounted === 'true')
      return

    const src = container.dataset.src
    if (!src) return

    const iframe = document.createElement('iframe')
    iframe.src = src
    iframe.title = container.dataset.title || 'Public event program'
    iframe.loading = 'lazy'
    iframe.style.cssText = [
      'display:block',
      'width:100%',
      `min-height:${container.dataset.height || '720px'}`,
      'border:0',
      'border-radius:16px',
      'background:#fff',
    ].join(';')
    iframe.setAttribute('allow', 'clipboard-write')

    container.dataset.programkitMounted = 'true'
    container.replaceChildren(iframe)
  }

  function mountAll(root = document) {
    root.querySelectorAll(selector).forEach(mount)
  }

  mountAll()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountAll(), { once: true })
  }

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        if (node.matches(selector)) mount(node)
        mountAll(node)
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true })
})()
