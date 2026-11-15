import { useState } from 'react';
import { Info, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { reportCards, reportSections, reportTopics } from '../lib/report';
import type { Workspace } from '../types';

function ReportText({ text }: { text: string }) {
  return <div className="prose"><Markdown remarkPlugins={[remarkGfm]} components={{
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  }}>{text}</Markdown></div>;
}

export function PortfolioReport({ workspace }: { workspace: Workspace }) {
  const sections = reportSections(workspace.analysis);
  const topics = reportTopics.filter((topic) => sections.some((section) => section.topic === topic.id));
  const [selectedTopic, setSelectedTopic] = useState('overview');
  const [selectedGroup, setSelectedGroup] = useState('');
  const groups = [...new Set(sections.map((section) => section.group).filter(Boolean))];
  const topic = topics.find((item) => item.id === selectedTopic) || topics[0];
  const visible = sections.filter((section) => section.topic === topic?.id && (!selectedGroup || section.group === selectedGroup));

  return <article className="panel full-report structured-report">
    <div className="report-cover">
      <span className="eyebrow-tag"><Sparkles size={14} />{workspace.sample ? 'ILLUSTRATIVE PORTFOLIO REVIEW' : 'PERSONALIZED PORTFOLIO REVIEW'}</span>
      <h2>AI insights for {workspace.profile?.name || workspace.username}</h2>
      <p>@{workspace.username}{workspace.sample && ' · Fictional example'}</p>
      <p className="report-intro">Explore your project evidence, role alignment, and practical next steps.</p>
    </div>
    <div className="report-reader">
      <nav className="report-navigation" aria-label="Report sections">
        {topics.map((item) => <button key={item.id} aria-pressed={topic?.id === item.id} onClick={() => setSelectedTopic(item.id)}>{item.label}</button>)}
      </nav>
      <div className="report-content">
        <div className="report-content-heading">
          <div><span className="report-kicker">PORTFOLIO INSIGHTS</span><h3>{topic?.label || 'Your review'}</h3></div>
          {groups.length > 1 && <label className="report-group-filter">Repository group
            <select aria-label="Repository group" value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}>
              <option value="">All groups</option>
              {groups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>}
        </div>
        {groups.length > 1 && <p className="report-scope-note">Each group reviews a different set of repositories. Findings are shown together by topic.</p>}
        {visible.map((section, index) => <section className={`report-topic-section report-topic-${section.topic}`} key={`${section.group}-${index}`} aria-label={section.group ? `${section.title} — ${section.group}` : section.title}>
          {section.group && <p className="report-group-label">{section.group}</p>}
          <div className="report-card-grid">{reportCards(section.body).map((card, cardIndex) => <div className="report-insight-card" key={cardIndex}>
            {card.title && <h4>{card.title.replace(/\*\*/g, '')}</h4>}
            <ReportText text={card.body} />
          </div>)}</div>
        </section>)}
        {!visible.length && <p className="report-empty">This group has no findings in this section. Choose another section or view all groups.</p>}
      </div>
    </div>
    <div className="report-source-note"><Info size={16} /><p>{workspace.sample ? 'This illustrative review uses fictional profile and project information.' : 'AI guidance is based on the supplied evidence. Verify recommendations against your actual project work.'}</p></div>
  </article>;
}
