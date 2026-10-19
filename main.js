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
  const nav = element('nav');
  nav.setAttribute('aria-label', page.navigationLabel);
  for (const section of sections) {
    const link = element('a', section.title);
    link.href = `#${section.id}`;
    nav.append(link);
  }
  header.append(nav);

  const main = element('main');
  const demos = [];
  const hero = element('div', undefined, 'hero');
  hero.append(element('p', page.eyebrow, 'eyebrow'), element('h1', page.title));
  main.append(hero);

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
    if (content.metrics) {
      const metrics = element('dl', undefined, 'metrics');
      for (const metric of content.metrics) {
        const group = element('div');
        group.append(element('dt', metric.label), element('dd', metric.value));
        metrics.append(group);
      }
      body.append(metrics);
    }
    section.append(heading, body);
    if (content.demo) {
      if (content.demo.snapshots) {
        section.append(element('h3', content.demo.snapshots.title, 'result-subheading'));
        const snapshots = element('div', undefined, 'snapshot-demo');
        const loading = element('p', content.demo.snapshots.loading, 'demo-loading');
        loading.setAttribute('role', 'status'); snapshots.append(loading); section.append(snapshots);
        demos.push({ demo: snapshots, copy: content.demo, modulePath: './snapshot-viewer.js', mount: 'mountSnapshots', error: content.demo.snapshots.error });
        section.append(element('h3', content.demo.videoTitle, 'result-subheading'));
      }
      const demo = element('div', undefined, 'demo');
      const loading = element('p', content.demo.loadingDemo, 'demo-loading');
      loading.setAttribute('role', 'status');
      demo.append(loading);
      section.append(demo);
      demos.push({ demo, copy: content.demo, modulePath: './viewer.js', mount: 'mountViewer', error: content.demo.error });
    }
    main.append(section);
  }
  document.querySelector('#app').replaceChildren(header, main, element('footer', page.footer));
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  // Give the text page a complete paint before starting independent demo work.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const { demo, copy, modulePath, mount, error: errorText } of demos) {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        import(modulePath).then(module => module[mount](demo, copy)).catch(error => {
          console.error(error);
          demo.replaceChildren(element('p', errorText, 'demo-loading'));
        });
      }, { rootMargin: '400px' });
      observer.observe(demo);
    }
  }));
}

renderPage().catch(error => {
  // Keep operational diagnostics out of the centrally managed project copy.
  console.error(error);
  document.querySelector('#app').textContent = 'Unable to load page content. Please reload.';
});
