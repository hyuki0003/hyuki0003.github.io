#!/usr/bin/env python3
"""Build the pre-rendered website from content/site.json using Python's standard library.

The generated website needs no Python, package installation, backend, or build service.
Run `python3 build.py` after updating the content file or templates.
"""
from __future__ import annotations

import html
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / 'content' / 'site.json'


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def external(url: str) -> str:
    if urlparse(url).scheme not in ('https', 'mailto'):
        raise ValueError(f'Unsupported external URL: {url}')
    return esc(url)


def icon(name: str, css: str = '') -> str:
    paths = {
        'arrow': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
        'external': '<path d="M6 18 18 6M6 6h12v12"/>',
        'moon': '<path d="M20.4 14.3A8.5 8.5 0 0 1 9.7 3.6a8.5 8.5 0 1 0 10.7 10.7Z"/>',
        'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
        'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
        'close': '<path d="m6 6 12 12M6 18 18 6"/>',
        'copy': '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
        'search': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
        'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
        'grid': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        'layers': '<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
        'orbit': '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)"/><ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(-35 12 12)"/>',
        'down': '<path d="m6 9 6 6 6-6"/>',
        'back': '<path d="M19 12H5m6-6-6 6 6 6"/>',
    }
    return f'<svg class="icon {esc(css)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths[name]}</svg>'


def authors(paper: dict) -> str:
    return ', '.join(f'<strong>{esc(a)}</strong>' if a == 'D.-H. Lee' else esc(a) for a in paper['authors'])


def badge(value: str) -> str:
    style = 'accent' if value in ('Oral presentation', 'Award') else 'neutral'
    if value in ('Under review', 'In progress'):
        style = 'pending'
    return f'<span class="badge {style}">{esc(value)}</span>'


def bibtex(paper: dict) -> str:
    author_list = []
    for name in paper['authors']:
        if name == 'et al.':
            author_list.append('others')
        else:
            pieces = name.rsplit(' ', 1)
            author_list.append(f'{pieces[1]}, {pieces[0]}' if len(pieces) == 2 else name)
    fields = [('title', paper['title']), ('author', ' and '.join(author_list)), ('year', str(paper['year']))]
    kind = paper.get('citation_type', 'misc')
    if kind == 'inproceedings':
        fields.append(('booktitle', paper['venue']))
        if 'Oral presentation' in paper.get('badges', []):
            fields.append(('note', 'Oral presentation'))
    elif kind == 'mastersthesis':
        fields.append(('school', paper['venue']))
    elif kind == 'unpublished':
        # Never represent a submitted/in-progress manuscript as an accepted article.
        fields.append(('note', f"{paper['status']}; venue listed in author profile: {paper['venue']}"))
    elif 'application_number' in paper:
        fields.append(('note', f"Patent application {paper['application_number']}; filed {paper['date']}"))
    def tex_escape(value: str) -> str:
        return value.replace('&', r'\&').replace('%', r'\%').replace('#', r'\#').replace('_', r'\_')
    body = ',\n'.join(f'  {key} = {{{tex_escape(value)}}}' for key, value in fields)
    key = re.sub(r'[^a-zA-Z0-9]', '', paper['id']) + str(paper['year'])
    return f'@{kind}{{{key},\n{body}\n}}'


def art(kind: str, large: bool = False) -> str:
    # Purely decorative visuals; these are not paper figures or scientific plots.
    if kind == 'dialog':
        return f'''<div class="work-art dialog-art {'large-art' if large else ''}" aria-hidden="true">
          <div class="art-grid"></div><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div>
          <div class="speech speech-one"><i></i><i></i><i></i></div><div class="speech speech-two"><i></i><i></i></div><div class="speech speech-three"><i></i><i></i><i></i></div>
          <span class="art-label">01 / MULTIMODAL LEARNING</span><span class="art-note">connection &amp; context</span>
        </div>'''
    return f'''<div class="work-art video-art {'large-art' if large else ''}" aria-hidden="true">
      <div class="art-grid"></div><div class="video-frame frame-back"></div><div class="video-frame frame-mid"></div>
      <div class="video-frame frame-front"><div class="pixel-grid">{''.join('<i></i>' for _ in range(36))}</div><span class="frame-corner c1"></span><span class="frame-corner c2"></span></div>
      <span class="art-label">02 / REMOTE PHYSIOLOGICAL SENSING</span><span class="art-note">patterns in motion</span>
    </div>'''


def resource_links(paper: dict) -> str:
    links = []
    for key, label in [('paper_url', 'Paper'), ('code_url', 'Code')]:
        if paper.get(key):
            links.append(f'<a class="text-link" href="{external(paper[key])}" target="_blank" rel="noopener noreferrer">{label}{icon("external")}</a>')
    return ''.join(links)


def cite_button(paper: dict, cls: str = 'cite-button') -> str:
    return f'<button type="button" class="{cls} js-only" data-cite="{esc(paper["id"])}" aria-label="View BibTeX citation for {esc(paper["title"])}">{icon("copy")}<span>BibTeX</span></button>'


def header(prefix: str, active: str = '') -> str:
    def nav(href: str, text: str, key: str) -> str:
        current = ' aria-current="page"' if active == key else ''
        return f'<a href="{prefix}{href}"{current}>{text}</a>'
    # Avoid dependencies or external requests, including font and icon CDNs.
    return f'''<a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header"><div class="container header-inner">
      <a class="brand" href="{prefix}index.html" aria-label="Dong-Hyuk Lee — home"><span class="monogram">dh<span>.</span></span><span class="brand-name">Dong-Hyuk Lee<span>AI RESEARCHER</span></span></a>
      <nav id="site-nav" class="site-nav" aria-label="Main navigation">
        {nav('introduction.html','Introduction','introduction')}{nav('cv.html','CV','cv')}{nav('publications.html','Publication','publications')}{nav('research.html','Research','research')}
        <a class="nav-contact" href="{prefix}contact.html">Get in touch {icon('external')}</a>
      </nav>
      <div class="header-controls"><button class="icon-button theme-toggle js-only" type="button" aria-label="Switch to dark theme" title="Switch theme">{icon('moon','moon-icon')}{icon('sun','sun-icon')}</button>
      <button class="icon-button menu-toggle js-only" type="button" aria-label="Open navigation" aria-controls="site-nav" aria-expanded="false">{icon('menu','menu-icon')}{icon('close','close-icon')}</button></div>
    </div></header>'''


def footer(profile: dict, prefix: str, full: bool = True) -> str:
    social = ''.join(f'<a href="{external(link["url"])}" target="_blank" rel="noopener noreferrer">{esc(link["label"])}{icon("external")}</a>' for link in profile['links'])
    contact = f'''<section id="contact" class="contact-section"><div class="container contact-inner">
      <div class="contact-top"><span class="eyebrow"><span class="live-dot"></span> OPEN TO RESEARCH COLLABORATION</span><span class="contact-number">05 / CONTACT</span></div>
      <h2>Let’s talk <em>research.</em></h2><p>{esc(profile['collaboration'])}</p>
      <div class="email-row"><a class="email-link" href="mailto:{esc(profile['email'])}">{esc(profile['email'])}{icon('external')}</a><button type="button" class="icon-button copy-email js-only" data-copy-text="{esc(profile['email'])}" aria-label="Copy email address">{icon('copy')}</button></div>
      <div class="contact-bottom"><div class="social-links">{social}</div><a class="back-top" href="#top">Back to top ↑</a></div>
    </div></section>''' if full else ''
    return contact + f'''<footer class="site-footer"><div class="container footer-inner"><span>© {profile['updated_iso'][:4]} {esc(profile['name'])}</span><span>Last updated {esc(profile['updated'])}</span><a href="{external(profile['links'][0]['url'])}" target="_blank" rel="noopener noreferrer">GitHub {icon('external')}</a></div></footer>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <dialog id="citation-dialog" aria-labelledby="citation-title"><div class="dialog-heading"><span class="eyebrow">CITATION</span><button type="button" class="icon-button close-dialog" aria-label="Close citation">{icon('close')}</button></div><h2 id="citation-title">BibTeX</h2><p class="citation-note">Basic metadata from the author profile. Volume, pages, and DOI were not provided. Manuscripts are not presented as accepted publications.</p><pre id="citation-code" tabindex="0"></pre><button type="button" class="button primary" id="copy-citation">{icon('copy')} Copy BibTeX</button></dialog>'''


def page(title: str, body: str, data: dict, prefix: str = '', active: str = '', canonical_path: str = '', full_footer: bool = True) -> str:
    profile = data['profile']
    description = profile['intro']
    canonical = profile['site_url'].rstrip('/') + '/' + canonical_path
    template = (ROOT/'templates/base.html').read_text(encoding='utf-8')
    values = {
        'TITLE': esc(title), 'DESCRIPTION': esc(description), 'PREFIX': prefix,
        'CANONICAL': esc(canonical), 'HEADER': header(prefix, active), 'BODY': body,
        'FOOTER': footer(profile, prefix, full_footer),
        'SCHEMA': json.dumps({'@context':'https://schema.org','@type':'Person','name':profile['name'],'url':profile['site_url'],'jobTitle':profile['role'],'sameAs':[x['url'] for x in profile['links']]}, ensure_ascii=False).replace('</','<\\/'),
    }
    for key, value in values.items():
        template = template.replace('{{' + key + '}}', value)
    template = template.replace('</head>', f'<link rel="stylesheet" href="{prefix}assets/universe.css">\n<script src="{prefix}assets/universe.js" defer></script>\n<script>document.documentElement.dataset.theme="dark"</script>\n</head>')
    template = template.replace('<body id="top">', '<body id="top" class="universe-site' + (' universe-home' if not canonical_path else '') + '">')
    template = template.replace('<span class="brand-name">Dong-Hyuk Lee<span>AI RESEARCHER</span></span>', '<span class="brand-name">Latent<span>BY DONG-HYUK LEE</span></span>')
    template = template.replace('<div class="header-controls">', '<div class="header-controls"><button class="space-motion" type="button" aria-label="Pause space motion" aria-pressed="false" hidden>Ⅱ</button>')
    template = template.replace('<meta name="theme-color" content="#f6f5f1">', '<meta name="theme-color" content="#050b10">')
    if not canonical_path:
        template = template.replace('<script src="assets/universe.js"', '<script src="assets/planet.js" defer></script>\n<script src="assets/universe.js"')
        template = template.replace('</head>', '<link rel="preload" as="image" href="assets/space/latent-atmosphere.webp">\n</head>')
    # Keep HTML, controls, and shaders in sync for returning visitors.
    for asset in ("assets/universe.css", "assets/universe.js", "assets/planet.js"):
        digest = hashlib.sha256((ROOT / asset).read_bytes()).hexdigest()[:10]
        template = template.replace(asset + '"', asset + "?v=" + digest + '"')
    return template


def research_and_cv(data: dict) -> dict:
    p = data['profile']
    statement_lines = []
    for line in p['headline'].splitlines():
        parts = line.rsplit(' ', 1)
        statement_lines.append(f'{esc(parts[0])} <em>{esc(parts[1])}</em>' if len(parts) == 2 else f'<em>{esc(line)}</em>')
    statement = '<br>'.join(statement_lines)
    research = ''.join(f'''<article class="research-card"><div class="research-card-top"><span class="small-number">{esc(r['id'])}</span>{icon(r['symbol'])}</div><h3>{esc(r['title'])}</h3><p>{esc(r['description'])}</p><span class="research-label">{esc(r['label'])}</span></article>''' for r in data['research'])
    works = []
    for paper in data['publications']:
        if not paper.get('featured'):
            continue
        badges = ''.join(badge(b) for b in paper['badges'])
        works.append(f'''<article class="work-card"><a class="art-link" href="projects/{paper['id']}.html" tabindex="-1" aria-hidden="true">{art(paper['art'])}</a><div class="work-body"><div class="work-meta"><span>{paper['venue']} <span class="meta-divider">/</span> {paper['year']}</span>{badges}</div><h3><a href="projects/{paper['id']}.html">{esc(paper['title'])}</a></h3><p class="authors">{authors(paper)}</p><div class="work-actions"><a class="text-link" href="projects/{paper['id']}.html">Explore this work {icon('external')}</a>{cite_button(paper)}</div></div></article>''')
    def news_row(n: dict) -> str:
        return f'<li class="news-row"><time datetime="{n["date"].replace(".","-")}">{n["date"]}</time><div><span class="news-label">{esc(n["label"])}</span><p>{esc(n["text"])}</p></div></li>'
    news = ''.join(news_row(n) for n in data['news'][:4])
    older = ''.join(news_row(n) for n in data['news'][4:])
    career = ''.join(f'''<article class="career-item"><span class="timeline-dot"></span><p class="period">{esc(c['period'])}</p><h4>{esc(c['position'])}</h4><a class="organization" href="{external(c['url'])}" target="_blank" rel="noopener noreferrer">{esc(c['organization'])}{icon('external')}</a><p class="career-detail">{esc(c['detail'])}</p><p class="career-description">{esc(c['description'])}</p></article>''' for c in data['career'])
    education = ''.join(f'''<article class="education-item"><span class="degree">{esc(e['degree'])}</span><div><h4>{esc(e['field'])}</h4><p>{esc(e['institution'])}</p>{f'<p class="education-detail">{esc(e["detail"])}</p>' if e['detail'] else ''}</div></article>''' for e in data['education'])
    stack = ''.join(f'<div class="stack-row"><span>{esc(s["category"])}</span><p>{" · ".join(esc(x) for x in s["items"])}</p></div>' for s in data['stack'])
    keywords = ''.join(f'<span>{esc(t)}</span>' for t in data['keywords'])
    return {'research': f'''      <section class="section research-section" id="research" aria-labelledby="research-title"><div class="container"><div class="section-heading"><div><span class="eyebrow section-index">01 / RESEARCH</span><h2 id="research-title">A common thread.<br><em>Across different signals.</em></h2></div><p>From facial videos and conversations<br class="desktop-break"> to wearable biosignals and ECGs.</p></div><div class="research-grid">{research}</div><div class="keyword-strip">{keywords}</div></div></section>
      <section class="section selected-section container" id="selected-work" aria-labelledby="work-title"><div class="section-heading"><div><span class="eyebrow section-index">02 / SELECTED WORK</span><h2 id="work-title">Ideas into <em>research.</em></h2></div><a class="text-link" href="publications.html">All publications {icon('arrow')}</a></div><div class="works-grid">{''.join(works)}</div><a class="archive-note" href="publications.html#group-manuscript"><span class="archive-dot"></span><span>Also exploring global-local contrastive learning, cross-modal alignment, and wearable physiomarkers.</span>{icon('arrow')}</a></section>
      <section class="section news-section" aria-labelledby="news-title"><div class="container split-section"><div class="section-intro"><span class="eyebrow section-index">03 / LATEST</span><h2 id="news-title">Along<br><em>the way.</em></h2><p>Research updates &amp; milestones.</p></div><div class="news-list-wrap"><ol class="news-list">{news}</ol><details class="older-news"><summary>Earlier updates {icon('down')}</summary><ol class="news-list">{older}</ol></details></div></div></section>
''', 'cv': f'''      <section class="section background-section container" id="background" aria-labelledby="background-title"><div class="section-heading"><div><span class="eyebrow section-index">04 / BACKGROUND</span><h2 id="background-title">A little <em>about me.</em></h2></div></div><p class="about-copy">{esc(p['about'])}</p><div class="background-grid"><div><h3 class="subheading">Experience</h3><div class="career-list">{career}</div></div><div><h3 class="subheading">Education</h3><div class="education-list">{education}</div></div></div><details class="toolkit"><summary><span>Tools I work with</span><span class="toolkit-preview">Python · PyTorch · Ray · MLflow</span>{icon('down')}</summary><div class="stack-list">{stack}</div></details></section>
'''}



def home(data: dict) -> str:
    universe = (ROOT/'templates/universe.html').read_text(encoding='utf-8')
    return '<main id="main">' + universe.replace('PROFILE_INTRO', esc(data['profile']['intro'])) + '</main>'


def destination_heading(label: str, title: str, description: str) -> str:
    return f'<header class="destination-heading container"><a class="breadcrumb" href="index.html">{icon("back")} Back to the orbit</a><p class="eyebrow section-index">{esc(label)}</p><h1>{title}</h1><p class="destination-lead">{esc(description)}</p></header>'


def destinations(data: dict) -> dict:
    profile = data['profile']
    sections = research_and_cv(data)
    introduction = destination_heading('01 / INTRODUCTION', 'Across signals.<br><em>Beyond boundaries.</em>', profile['role'])
    introduction += f'<section class="introduction-copy container"><div><p class="eyebrow">DONG-HYUK LEE</p><h2>Learning representations.<br><em>Understanding signals.</em></h2></div><div><p>{esc(profile["about"])}</p><p>{esc(profile["intro"])}</p><div class="destination-actions"><a class="button primary" href="research.html">Explore research {icon("arrow")}</a><a class="text-link" href="cv.html">View CV {icon("external")}</a></div></div></section>'
    cv = destination_heading('02 / CV', 'Curriculum <em>vitae.</em>', 'Experience, education, and the tools behind my research.')
    cv += sections['cv'].replace('04 / BACKGROUND', 'ACADEMIC &amp; PROFESSIONAL BACKGROUND').replace('A little <em>about me.</em>', 'Experience &amp; <em>education.</em>')
    research = destination_heading('04 / RESEARCH', 'A shared <em>latent space.</em>', 'Representation learning across physiological signals and multimodal data.') + sections['research']
    contact = destination_heading('05 / CONTACT', 'Let’s <em>connect.</em>', 'Open to research collaboration and thoughtful conversations.')
    contact += footer(profile, '', full=True).split('<footer class="site-footer">')[0]
    return {'introduction': introduction, 'cv': cv, 'research': research, 'contact': contact}


def publication_record(paper: dict) -> str:
    searchable = ' '.join([paper['title'],paper['venue'],str(paper['year']),*paper['authors'],*paper['tags'],paper['status']])
    title = esc(paper['title'])
    if paper.get('page'):
        title = f'<a href="projects/{esc(paper["id"])}.html">{title}</a>'
    badges = ''.join(badge(v) for v in ([paper['status']] if paper['category'] in ('manuscript','other') else []) + paper['badges'])
    extra = f'<p class="patent-number">Application No. {esc(paper["application_number"])}</p>' if 'application_number' in paper else ''
    return f'''<article class="publication-record" id="{esc(paper['id'])}" data-category="{esc(paper['category'])}" data-search="{esc(searchable.casefold())}"><div class="record-year">{esc(paper.get('date',paper['year']))}</div><div class="record-main"><div class="record-meta"><span class="record-venue">{esc(paper['venue'])}</span>{badges}</div><h3>{title}</h3><p class="authors">{authors(paper)}</p>{extra}<div class="record-tags">{''.join(f'<span>{esc(t)}</span>' for t in paper['tags'])}</div></div><div class="record-actions">{resource_links(paper)}{cite_button(paper)}{'<a class="record-detail" href="projects/'+esc(paper['id'])+'.html" aria-label="Details for '+esc(paper['title'])+'">'+icon('external')+'</a>' if paper.get('page') else ''}</div></article>'''


def publications(data: dict) -> str:
    categories = [('all','All records'),('international','International'),('domestic','Domestic'),('manuscript','Manuscripts'),('other','Thesis & patent')]
    groups = [('international','International conferences'),('domestic','Domestic conferences'),('manuscript','Ongoing manuscripts'),('other','Thesis & patent')]
    pills = []
    for key, title in categories:
        count = len(data['publications']) if key == 'all' else sum(p['category']==key for p in data['publications'])
        pills.append(f'<button type="button" class="filter-pill" data-filter="{key}" aria-pressed="{"true" if key=="all" else "false"}">{title}<span>{count}</span></button>')
    records = []
    for key, title in groups:
        items = [p for p in data['publications'] if p['category']==key]
        note = '<p class="group-note">Work in progress or under review; not accepted journal publications. Venue labels and statuses follow the supplied profile.</p>' if key == 'manuscript' else ''
        records.append(f'<section class="record-group" data-group="{key}" aria-labelledby="group-{key}"><h2 id="group-{key}" class="group-heading">{title}<span>{len(items):02d}</span></h2>{note}{"".join(publication_record(p) for p in items)}</section>')
    return f'''<main id="main" class="container publications-main"><section class="archive-hero"><a class="breadcrumb" href="index.html">{icon('back')} Back to home</a><p class="eyebrow section-index">RESEARCH ARCHIVE</p><h1>Publications <em>&amp; more.</em></h1><p>Conference papers, ongoing manuscripts, a thesis, and a patent application.<br>Each at its own stage of the research process.</p></section><div class="archive-controls js-only"><div class="archive-toolbar"><label class="search-box" for="publication-search"><span class="sr-only">Search publications</span>{icon('search')}<input id="publication-search" type="search" placeholder="Search title, author, topic, or year…" autocomplete="off"><span class="search-key" aria-hidden="true">/</span></label><p class="result-count" id="result-count" role="status" aria-live="polite">{len(data['publications'])} records</p></div><div class="filter-bar" role="group" aria-label="Filter publications">{''.join(pills)}</div></div><div class="publication-groups">{''.join(records)}</div><div id="no-results" class="no-results" hidden>{icon('search')}<h2>No matching records.</h2><p>Try a different title, year, or research topic.</p><button class="button secondary" type="button" id="reset-filters">Clear search &amp; filters</button></div><p class="archive-provenance">Titles, author order, and status labels are based on the author’s profile. Bibliographic details may be incomplete.</p></main>'''


def project(paper: dict, data: dict) -> str:
    other = next(p for p in data['publications'] if p.get('page') and p['id'] != paper['id'])
    context = ''.join(f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>' for k,v in paper['context'].items())
    return f'''<main id="main" class="container project-main"><a class="breadcrumb" href="../publications.html">{icon('back')} Research archive</a><section class="project-hero"><div class="project-kicker"><span class="eyebrow">{esc(paper['venue'])} / {paper['year']}</span>{''.join(badge(b) for b in paper['badges'])}</div><h1>{esc(paper['title'])}</h1><p class="authors project-authors">{authors(paper)}</p><div class="project-actions">{resource_links(paper)}<a class="button primary" href="#citation">View citation {icon('down')}</a><a class="text-link" href="mailto:{esc(data['profile']['email'])}">Contact the author {icon('external')}</a></div></section>{art(paper['art'],True)}<div class="project-details"><div><span class="eyebrow section-index">RESEARCH CONTEXT</span><h2>At a <em>glance.</em></h2><p class="context-note">Research topics and publication information from the author’s profile. The illustration above is decorative, not a model architecture or experimental result.</p></div><dl class="context-list">{context}<div><dt>Venue</dt><dd>{esc(paper['venue'])} {paper['year']}</dd></div><div><dt>Type</dt><dd>{esc(paper['status'])}</dd></div></dl></div><section class="citation-section" id="citation"><div class="section-heading"><div><span class="eyebrow section-index">REFERENCE</span><h2>Cite this <em>work.</em></h2></div>{cite_button(paper)}</div><pre class="inline-citation">{esc(bibtex(paper))}</pre><p class="citation-note">Basic citation metadata. Volume, pages, DOI, paper URL, and code URL were not supplied in the profile and have not been inferred.</p></section><a class="next-work" href="{other['id']}.html"><span class="eyebrow">ANOTHER RESEARCH DIRECTION</span><strong>{esc(other['title'])}</strong>{icon('arrow')}</a></main>'''


def validate(data: dict) -> None:
    if not isinstance(data.get('profile'), dict) or not isinstance(data.get('publications'), list):
        raise ValueError('site.json must contain a profile object and publications list.')
    seen = set()
    categories = {'international','domestic','manuscript','other'}
    for paper in data['publications']:
        for key in ('id','category','year','venue','title','authors','status','badges','tags'):
            if key not in paper:
                raise ValueError(f'Missing publication field {key}: {paper.get("id", "unknown")}')
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', paper['id']) or paper['id'] in seen:
            raise ValueError(f'Invalid or duplicated publication id: {paper["id"]}')
        seen.add(paper['id'])
        if paper['category'] not in categories:
            raise ValueError(f'Invalid category for {paper["id"]}')
        if not isinstance(paper['authors'], list) or not paper['authors']:
            raise ValueError(f'Authors must be a nonempty list for {paper["id"]}')
        for key in ('paper_url', 'code_url'):
            if paper.get(key): external(paper[key])
    profile=data['profile']
    if '@' not in profile['email'] or any(c in profile['email'] for c in '\r\n<>"'):
        raise ValueError('Invalid email address.')
    for link in profile['links']: external(link['url'])


def main() -> None:
    try:
        data = json.loads(DATA_FILE.read_text(encoding='utf-8'))
        validate(data)
    except (OSError, json.JSONDecodeError, ValueError, KeyError, TypeError) as exc:
        raise SystemExit(f'Cannot build website: {exc}') from exc
    p = data['profile']
    (ROOT/'index.html').write_text(page(f"Latent — {p['name']}",home(data),data,full_footer=False),encoding='utf-8')
    for name, body in destinations(data).items():
        title = 'CV' if name == 'cv' else name.title()
        (ROOT/(name+'.html')).write_text(page(f"{title} — {p['name']}", '<main id="main" class="destination-page">'+body+'</main>', data, active=name, canonical_path=name+'.html', full_footer=False), encoding='utf-8')
    (ROOT/'publications.html').write_text(page(f"Publications — {p['name']}",publications(data),data,active='publications',canonical_path='publications.html',full_footer=False),encoding='utf-8')
    project_dir=ROOT/'projects'
    project_dir.mkdir(exist_ok=True)
    for paper in data['publications']:
        if paper.get('page'):
            path=f"projects/{paper['id']}.html"
            (ROOT/path).write_text(page(f"{paper['title']} — {p['name']}",project(paper,data),data,prefix='../',active='publications',canonical_path=path,full_footer=False),encoding='utf-8')
    not_found='''<main id="main" class="container not-found"><span class="eyebrow">404 / PAGE NOT FOUND</span><h1>A little <em>off track.</em></h1><p>This page does not exist. Let’s return to the research.</p><a class="button primary" href="/index.html">Back to home →</a></main>'''
    (ROOT/'404.html').write_text(page(f"Page not found — {p['name']}",not_found,data,prefix='/',full_footer=False,canonical_path='404.html'),encoding='utf-8')
    # Local JS data avoids fetch/CORS restrictions when opening index.html directly.
    citations={item['id']:{'title':item['title'],'bibtex':bibtex(item)} for item in data['publications']}
    (ROOT/'assets/citations.js').write_text('"use strict";\nwindow.PROFILE_CITATIONS = '+json.dumps(citations,ensure_ascii=False,indent=2).replace('</','<\\/')+';\n',encoding='utf-8')
    paths=['','introduction.html','cv.html','publications.html','research.html','contact.html']+[f"projects/{p['id']}.html" for p in data['publications'] if p.get('page')]
    sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'<url><loc>{esc(data["profile"]["site_url"].rstrip("/")+"/"+path)}</loc><lastmod>{esc(data["profile"]["updated_iso"])}</lastmod></url>\n' for path in paths)+'</urlset>\n'
    (ROOT/'sitemap.xml').write_text(sitemap,encoding='utf-8')
    (ROOT/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+data['profile']['site_url'].rstrip('/')+'/sitemap.xml\n',encoding='utf-8')
    print(f'Built orbit home, 4 destination pages, archive, {sum(bool(p.get("page")) for p in data["publications"])} project pages, 404, citations, and sitemap. {len(data["publications"])} records.')


if __name__ == '__main__':
    main()
