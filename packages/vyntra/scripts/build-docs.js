#!/usr/bin/env node
// Writes the website's documentation (docs/*.html at the repository's root) as Markdown into this package's docs/,
// which npm ships: agents read it offline in node_modules/vyntra/docs, and `vyntra guide` prints it. One file per
// section: docs/guide/<id>.md, docs/api/<id>.md, docs/migrating/<id>.md, and docs/index.md listing them.
// `--check` fails when the files written would differ from those there (CI runs it).

const fs = require('node:fs');
const path = require('node:path');

const SITE = path.join(__dirname, '..', '..', '..', 'docs');
const OUT = path.join(__dirname, '..', 'docs');
const PAGES = [
  { file: 'guide.html', dir: 'guide', title: 'Guide' },
  { file: 'api.html', dir: 'api', title: 'API reference' },
  { file: 'migrating.html', dir: 'migrating', title: 'Migrating from Jest and Vitest' },
];
const VOID = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'path']);
const SKIP = new Set(['script', 'style', 'svg', 'button', 'nav', 'aside', 'header', 'footer']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

const decode = (text) =>
  text.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      return String.fromCodePoint(name[1] === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
    }
    return ENTITIES[name] ?? whole;
  });

// HTML into a tree of { tag, attrs, children } and strings: enough for these pages, which are well formed.
function parse(html) {
  const root = { tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  const token = /<!--[\s\S]*?-->|<\/([a-z0-9]+)\s*>|<([a-z0-9]+)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/gi;
  let match = token.exec(html);
  while (match) {
    const [whole, closing, opening, rawAttrs, text] = match;
    const top = stack.at(-1);
    if (text !== undefined) {
      top.children.push(decode(text));
    } else if (closing) {
      const index = stack.map((node) => node.tag).lastIndexOf(closing.toLowerCase());
      if (index > 0) {
        stack.length = index;
      }
    } else if (opening) {
      const attrs = Object.fromEntries(
        [...(rawAttrs ?? '').matchAll(/([^\s=]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, decode(value ?? '')])
      );
      const node = { tag: opening.toLowerCase(), attrs, children: [] };
      top.children.push(node);
      if (!VOID.has(node.tag) && !whole.endsWith('/>')) {
        stack.push(node);
      }
    }
    match = token.exec(html);
  }
  return root;
}

const find = (node, test) => {
  if (typeof node === 'string') {
    return null;
  }
  if (test(node)) {
    return node;
  }
  return node.children.reduce((found, child) => found ?? find(child, test), null);
};

const textOf = (node) => (typeof node === 'string' ? node : node.children.map(textOf).join(''));

// The topic of each anchor of the site, for links: '#projects' and 'guide.html#global-setup' lead to the files of
// the sections they are in.
function anchorsOf(pages) {
  const anchors = new Map();
  pages.forEach(({ page, sections }) => {
    sections.forEach((section) => {
      section.ids.forEach((id) => anchors.set(`${page.file}#${id}`, `${page.dir}/${section.id}.md`));
    });
    anchors.set(page.file, `${page.dir}/${sections[0].id}.md`);
  });
  return anchors;
}

class Renderer {
  constructor(page, anchors, from) {
    this.page = page;
    this.anchors = anchors;
    this.from = from;
  }

  link(href) {
    if (/^[a-z]+:/i.test(href)) {
      return href;
    }
    const [file, hash] = href.split('#');
    const key = hash ? `${file || this.page.file}#${hash}` : file;
    const target = this.anchors.get(key);
    if (!target) {
      return href;
    }
    return path.relative(path.dirname(this.from), target).split(path.sep).join('/');
  }

  inline(node) {
    if (typeof node === 'string') {
      return node.replace(/\s+/g, ' ');
    }
    if (SKIP.has(node.tag)) {
      return '';
    }
    const inner = () => node.children.map((child) => this.inline(child)).join('');
    switch (node.tag) {
      case 'code': {
        const text = textOf(node);
        return text.includes('`') ? `\`\` ${text} \`\`` : `\`${text}\``;
      }
      case 'strong':
      case 'b':
        return `**${inner().trim()}**`;
      case 'em':
      case 'i':
        return `*${inner().trim()}*`;
      case 'a':
        return `[${inner().trim()}](${this.link(node.attrs.href ?? '')})`;
      case 'br':
        return '\n';
      default:
        return inner();
    }
  }

  table(node) {
    const rows = [];
    const collect = (current) => {
      if (typeof current === 'string') {
        return;
      }
      if (current.tag === 'tr') {
        rows.push(
          current.children
            .filter((cell) => typeof cell !== 'string' && (cell.tag === 'td' || cell.tag === 'th'))
            .map((cell) => this.inline(cell).trim().replaceAll('|', '\\|'))
        );
      } else {
        current.children.forEach(collect);
      }
    };
    collect(node);
    if (rows.length === 0) {
      return '';
    }
    const [head, ...body] = rows;
    return [
      `| ${head.join(' | ')} |`,
      `| ${head.map(() => '---').join(' | ')} |`,
      ...body.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
  }

  list(node, ordered) {
    return node.children
      .filter((child) => typeof child !== 'string' && child.tag === 'li')
      .map((item, i) => `${ordered ? `${i + 1}.` : '-'} ${this.inline(item).trim()}`)
      .join('\n');
  }

  block(node) {
    if (typeof node === 'string') {
      return node.trim() ? node.replace(/\s+/g, ' ').trim() : '';
    }
    if (SKIP.has(node.tag)) {
      return '';
    }
    switch (node.tag) {
      case 'h1':
      case 'h2':
        return `# ${this.inline(node).trim()}`;
      case 'h3':
        return `## ${this.inline(node).trim()}`;
      case 'h4':
        return `### ${this.inline(node).trim()}`;
      case 'p':
        return this.inline(node).trim();
      case 'pre': {
        const code = find(node, (one) => one.tag === 'code') ?? node;
        const language = /language-([\w-]+)/.exec(code.attrs.class ?? '')?.[1] ?? 'text';
        const text = textOf(code).replace(/\n+$/, '');
        const fence = text.includes('```') ? '````' : '```';
        return `${fence}${language}\n${text}\n${fence}`;
      }
      case 'table':
        return this.table(node);
      case 'ul':
        return this.list(node, false);
      case 'ol':
        return this.list(node, true);
      default:
        return this.blocks(node.children);
    }
  }

  blocks(children) {
    return children
      .map((child) => this.block(child))
      .filter(Boolean)
      .join('\n\n');
  }
}

// The sections of a page: the content before the first h2 is its introduction, then one per h2 with what follows.
function sectionsOf(page) {
  const html = fs.readFileSync(path.join(SITE, page.file), 'utf8');
  const article = find(parse(html), (node) => node.tag === 'article');
  const sections = [];
  let current = { id: 'introduction', title: page.title, nodes: [], ids: [] };
  article.children.forEach((child) => {
    if (typeof child !== 'string' && child.tag === 'h2') {
      sections.push(current);
      current = { id: child.attrs.id, title: textOf(child).trim(), nodes: [child], ids: [child.attrs.id] };
      return;
    }
    if (typeof child !== 'string' && child.tag !== 'h1') {
      current.nodes.push(child);
      const collectIds = (node) => {
        if (typeof node !== 'string') {
          if (node.attrs.id) {
            current.ids.push(node.attrs.id);
          }
          node.children.forEach(collectIds);
        }
      };
      collectIds(child);
    }
  });
  sections.push(current);
  return sections.filter((section) => section.nodes.length > 0);
}

const summaryOf = (section, renderer) => {
  const elements = section.nodes.filter((node) => typeof node !== 'string');
  // A section of questions (the FAQ): its questions say more than the first answer.
  if (elements[1]?.tag === 'h3') {
    const questions = elements.filter((node) => node.tag === 'h3').map((node) => textOf(node).trim());
    return questions.slice(0, 3).join(' ');
  }
  const first = section.nodes.find((node) => typeof node !== 'string' && node.tag === 'p');
  const text = first
    ? renderer
        .inline(first)
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .trim()
    : '';
  const sentence = text.split(/(?<=\.)\s/)[0];
  return sentence.length > 140 ? `${sentence.slice(0, 139)}…` : sentence;
};

function build() {
  const pages = PAGES.map((page) => ({ page, sections: sectionsOf(page) }));
  const anchors = anchorsOf(pages);
  const files = new Map();
  const index = [
    '# vyntra documentation',
    '',
    'Read a topic with `vyntra guide <topic>`, or open its file here. Generated from the website; do not edit.',
  ];
  pages.forEach(({ page, sections }) => {
    index.push('', `## ${page.title}`, '');
    sections.forEach((section) => {
      const name = `${page.dir}/${section.id}.md`;
      const renderer = new Renderer(page, anchors, name);
      const body =
        section.id === 'introduction'
          ? `# ${page.title}\n\n${renderer.blocks(section.nodes)}`
          : renderer.blocks(section.nodes);
      files.set(name, `${body.replace(/\n{3,}/g, '\n\n').trim()}\n`);
      const topic = `${page.dir}/${section.id}`;
      index.push(`- [${section.title}](${name}) \`${topic}\`: ${summaryOf(section, renderer)}`);
    });
  });
  files.set('index.md', `${index.join('\n')}\n`);
  return files;
}

function main() {
  const files = build();
  const check = process.argv.includes('--check');
  const stale = [];
  const existing = new Set();
  const walk = (dir) =>
    fs.existsSync(dir) &&
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        existing.add(path.relative(OUT, full).split(path.sep).join('/'));
      }
    });
  walk(OUT);
  files.forEach((content, name) => {
    const file = path.join(OUT, name);
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (current !== content) {
      stale.push(name);
      if (!check) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
      }
    }
  });
  existing.forEach((name) => {
    if (!files.has(name)) {
      stale.push(`${name} (removed)`);
      if (!check) {
        fs.rmSync(path.join(OUT, name));
      }
    }
  });
  if (check && stale.length > 0) {
    process.stderr.write(`The Markdown docs are out of date (run pnpm build-docs): ${stale.join(', ')}\n`);
    process.exitCode = 1;
  } else if (!check) {
    process.stdout.write(`${files.size} files in docs/${stale.length > 0 ? `, ${stale.length} written` : ''}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { build, parse };
