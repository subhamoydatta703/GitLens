import { reportHeadingEntries } from './analysis';

export const reportTopics = [
  { id: 'overview', label: 'Summary', match: /overview|summary/i },
  { id: 'projects', label: 'Project evidence', match: /technical evidence|projects/i },
  { id: 'strengths', label: 'Strengths', match: /strength/i },
  { id: 'roles', label: 'Role alignment', match: /role/i },
  { id: 'actions', label: 'Recommendations', match: /recommend|improvement/i },
  { id: 'priorities', label: 'Priorities', match: /order of work|priorit|next steps/i },
  { id: 'limits', label: 'Assessment limits', match: /limitation|assessment limits/i },
  { id: 'questions', label: 'Follow-up questions', match: /question/i },
  { id: 'other', label: 'Additional findings', match: /./ },
];

export function reportSections(markdown: string) {
  const lines = markdown.split('\n');
  const headings = reportHeadingEntries(markdown);
  const intro = lines.slice(0, headings[0] ? headings[0].line - 1 : lines.length).join('\n').trim();
  const sections = headings.map((heading, index) => ({ title: heading.title,
    body: lines.slice(heading.line, headings[index + 1] ? headings[index + 1].line - 1 : lines.length).join('\n').trim() }));
  if (intro) sections.unshift({ title: 'Overview', body: intro });
  let group = '';
  return sections.flatMap((section) => {
    if (/^Repository group \d+ of \d+$/i.test(section.title)) {
      group = section.title;
      if (!section.body.replace(/\n?---\s*$/, '').trim()) return [];
    }
    return [{ ...section, body: section.body.replace(/\n?---\s*$/, '').trim(), group,
      topic: reportTopics.find((topic) => topic.match.test(section.title))!.id }];
  });
}

export function reportCards(body: string) {
  const cards: { title: string; body: string }[] = [];
  let title = '';
  let lines: string[] = [];
  let fenced = false;
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const heading = !fenced && /^###\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      if (title || lines.join('\n').trim()) cards.push({ title, body: lines.join('\n').trim() });
      title = heading[1];
      lines = [];
    } else lines.push(line);
  }
  if (title || lines.join('\n').trim()) cards.push({ title, body: lines.join('\n').trim() });
  return cards;
}
