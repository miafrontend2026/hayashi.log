/**
 * Lightweight virtual scroll for large vocab lists.
 * Only renders items visible in the viewport + buffer.
 */
const VirtualList = (() => {
  let container = null;
  let spacer = null;
  let itemHeight = 60;
  let items = [];
  let renderItem = null;
  let buffer = 10; // extra items above/below viewport
  let lastStart = -1;
  let lastEnd = -1;
  let scrollParent = null;
  let rafId = null;

  function init(cfg) {
    container = cfg.container;
    items = cfg.items || [];
    itemHeight = cfg.itemHeight || 60;
    renderItem = cfg.renderItem;
    buffer = cfg.buffer || 10;
    scrollParent = cfg.scrollParent || window;

    // Setup container
    container.style.position = 'relative';
    container.innerHTML = '';

    // Spacer to hold total height
    spacer = document.createElement('div');
    spacer.style.height = (items.length * itemHeight) + 'px';
    spacer.style.position = 'relative';
    container.appendChild(spacer);

    lastStart = -1;
    lastEnd = -1;

    // Bind scroll
    scrollParent.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // Initial render
    onScroll();
  }

  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      render();
    });
  }

  function render() {
    if (!container || !items.length) return;

    const containerRect = container.getBoundingClientRect();
    const viewportH = window.innerHeight;

    // How far is the container top from viewport top (negative = scrolled past)
    const offsetTop = containerRect.top;
    // The visible region inside the container
    const visibleStart = Math.max(0, -offsetTop);
    const visibleEnd = visibleStart + viewportH;

    let start = Math.floor(visibleStart / itemHeight) - buffer;
    let end = Math.ceil(visibleEnd / itemHeight) + buffer;
    start = Math.max(0, start);
    end = Math.min(items.length, end);

    // Skip if range unchanged
    if (start === lastStart && end === lastEnd) return;
    lastStart = start;
    lastEnd = end;

    // Remove old items
    const oldItems = spacer.querySelectorAll('.vl-item');
    oldItems.forEach(el => el.remove());

    // Render visible items
    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const el = document.createElement('div');
      el.className = 'vl-item';
      el.style.position = 'absolute';
      el.style.top = (i * itemHeight) + 'px';
      el.style.left = '0';
      el.style.right = '0';
      el.innerHTML = renderItem(items[i], i);
      frag.appendChild(el);
    }
    spacer.appendChild(frag);
  }

  function destroy() {
    if (scrollParent) {
      scrollParent.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    container = null;
    spacer = null;
    items = [];
    lastStart = -1;
    lastEnd = -1;
  }

  function isActive() {
    return container !== null;
  }

  return { init, destroy, isActive };
})();
