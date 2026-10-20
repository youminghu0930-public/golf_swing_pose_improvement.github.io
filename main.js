/* All displayed copy comes from materials/content.json. */
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function renderPage() {
  const response = await fetch('materials/content.json');
  if (!response.ok) throw new Error(`Content request failed: ${response.status}`);
  const { page, sections } = await response.json();
  document.title = page.title;
  document.querySelector('meta[name="description"]').content = page.description;

  const header = element('header');
  const navigationToggle = element('button', undefined, 'navigation-toggle');
  navigationToggle.setAttribute('aria-label', page.navigationToggle);
  navigationToggle.title = page.navigationToggle;
  const menuIcon = element('span', undefined, 'menu-icon');
  menuIcon.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) menuIcon.append(element('span'));
  navigationToggle.append(menuIcon);
  navigationToggle.type = 'button';
  const mobileNavigation = matchMedia('(max-width: 1000px)');
  const setNavigation = expanded => {
    navigationToggle.setAttribute('aria-expanded', String(expanded));
    header.dataset.expanded = String(expanded);
    const menu = header.querySelector('nav');
    if (menu) menu.inert = !expanded;
  };
  setNavigation(false);
  mobileNavigation.addEventListener('change', () => setNavigation(false));
  navigationToggle.setAttribute('aria-controls', 'section-navigation');
  const nav = element('nav');
  nav.id = 'section-navigation';
  nav.inert = true;
  nav.setAttribute('aria-label', page.navigationLabel);
  for (const section of sections) {
    const link = element('a', section.title);
    link.href = `#${section.id}`;
    link.addEventListener('click', () => { if (mobileNavigation.matches) setNavigation(false); });
    nav.append(link);
  }
  if (page.mainPage) {
    const link = element('a', page.mainPage.label, 'return-main-page');
    try {
      const url = new URL(page.mainPage.url);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported link');
      link.href = url.href;
    } catch { link.setAttribute('aria-disabled', 'true'); }
    nav.append(link);
  }
  navigationToggle.onclick = () => setNavigation(navigationToggle.getAttribute('aria-expanded') !== 'true');
  header.addEventListener('keydown', event => {
    if (event.key === 'Escape') { setNavigation(false); navigationToggle.focus(); }
  });
  header.append(navigationToggle, nav);

  const main = element('main');
  const demos = [];
  const hero = element('div', undefined, 'hero');
  hero.append(element('p', page.eyebrow, 'eyebrow'), element('h1', page.title));
  if (page.banner?.enabled !== false && page.banner?.video) {
    const banner = element('div', undefined, 'hero-banner');
    banner.setAttribute('role', 'group'); banner.setAttribute('aria-label', page.banner.label);
    banner.append(element('p', page.banner.loading, 'banner-loading'));
    hero.append(banner);
    const demoCopy = sections.find(section=>section.demo)?.demo;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      import('./hero-banner.js').then(module=>module.mountBanner(banner,page.banner,demoCopy)).catch(error=>{
        console.warn('Banner unavailable',error); banner.hidden=true;
      });
    }));
  }
  main.append(hero);
  if (page.role) main.append(element('p', page.role, 'hero-role'));

  for (const content of sections) {
    const section = element('section');
    section.id = content.id;
    const heading = element('h2', content.title);
    heading.id = `${content.id}-heading`;
    section.setAttribute('aria-labelledby', heading.id);
    const body = element('div', undefined, 'section-body');
    for (const paragraph of content.paragraphs || []) body.append(element('p', paragraph));
    if (content.items) {
      const list = element('ol');
      for (const item of content.items) list.append(element('li', item));
      body.append(list);
    }
    for (const subsection of content.subsections || []) {
      const group = element('div', undefined, 'content-subsection');
      group.append(element('h3', subsection.title));
      for (const paragraph of subsection.paragraphs || []) group.append(element('p', paragraph));
      if (subsection.items) {
        const list = element('ol');
        for (const item of subsection.items) list.append(element('li', item));
        group.append(list);
      }
      body.append(group);
    }
    if (content.metrics || content.metricGroups) {
      const metricGroups = element('div', undefined, 'metric-groups');
      for (const category of content.metricGroups || [{ metrics: content.metrics }]) {
        const group = element('div', undefined, 'metric-group');
        if (category.title) group.append(element('h3', category.title, 'metric-category'));
        const metrics = element('dl', undefined, 'metrics');
        for (const metric of category.metrics) {
          const item = element('div');
          item.append(element('dt', metric.label), element('dd', metric.value));
          metrics.append(item);
        }
        group.append(metrics); metricGroups.append(group);
      }
      body.prepend(metricGroups);
    }
    section.append(heading, body);
    if (content.demo) {
      let snapshotReady = Promise.resolve();
      if (content.demo.snapshots) {
        let resolveSnapshot;
        snapshotReady = new Promise(resolve => { resolveSnapshot = resolve; });
        section.append(element('h3', content.demo.snapshots.title, 'result-subheading'));
        const snapshots = element('div', undefined, 'snapshot-demo');
        const loading = element('p', content.demo.snapshots.loading, 'demo-loading');
        loading.setAttribute('role', 'status'); snapshots.append(loading); section.append(snapshots);
        demos.push({ demo: snapshots, copy: content.demo, modulePath: './snapshot-viewer.js', mount: 'mountSnapshots', error: content.demo.snapshots.error, settled: resolveSnapshot, rootMargin: '400px' });
        section.append(element('h3', content.demo.videoTitle, 'result-subheading'));
      }
      const demo = element('div', undefined, 'demo');
      const loading = element('p', content.demo.loadingDemo, 'demo-loading');
      loading.setAttribute('role', 'status');
      demo.append(loading);
      section.append(demo);
      demos.push({ demo, copy: content.demo, modulePath: './viewer.js', mount: 'mountViewer', error: content.demo.error, after: snapshotReady, rootMargin: '0px' });
    }
    main.append(section);
  }
  document.querySelector('#app').replaceChildren(header, main, element('footer', page.footer));
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  // Give the text page a complete paint before starting independent demo work.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const { demo, copy, modulePath, mount, error: errorText, settled, after = Promise.resolve(), rootMargin } of demos) {
      after.then(() => {
        const observer = new IntersectionObserver(entries => {
          if (!entries.some(entry => entry.isIntersecting)) return;
          observer.disconnect();
          import(modulePath).then(module => module[mount](demo, copy)).catch(error => {
            console.error(error);
            demo.replaceChildren(element('p', errorText, 'demo-loading'));
          }).finally(() => settled?.());
        }, { rootMargin });
        observer.observe(demo);
      });
    }
  }));
}

renderPage().catch(error => {
  // Keep operational diagnostics out of the centrally managed project copy.
  console.error(error);
  document.querySelector('#app').textContent = 'Unable to load page content. Please reload.';
});
