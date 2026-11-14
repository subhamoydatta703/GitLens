import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from 'react';
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Bookmark, Check,
  ChevronDown, ChevronRight, Code2, ExternalLink, FileCode2, FileText,
  FolderGit2, GitBranch, Github, Info, Layers3, LoaderCircle, Menu, Target,
  Plus, Search, ShieldCheck, Sparkles, Trash2, Users, X,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { exampleWorkspace } from './data/example';
import { fetchWorkspace, generateAnalysis, defaultApiBase } from './lib/api';
import { normalizeUsername, readSavedReports, technologies, reportHeadings, reportHeadingEntries } from './lib/analysis';
import type { AnalysisContext, View, Workspace } from './types';

const emptyContext: AnalysisContext = { target_roles: [], goals: null, additional_information: null };
const viewNames: Record<View, string> = { landing: 'Home', overview: 'Overview', repositories: 'Repositories', insights: 'AI insights', example: 'Example', saved: 'Saved reports' };
const navItems: { view: View; asset: string; label: string }[] = [
  { view: 'overview', asset: 'reports', label: 'Overview' },
  { view: 'repositories', asset: 'library', label: 'Repositories' },
  { view: 'insights', asset: 'people', label: 'AI insights' },
  { view: 'example', asset: 'activity', label: 'Example' },
];

function Prose({ children, compact = false, headingPrefix }: { children: string; compact?: boolean; headingPrefix?: string }) {
  const headingIds = new Map(reportHeadingEntries(children).map((entry, index) => [entry.line, `${headingPrefix}-${index}`]));
  return <div className={`prose ${compact ? 'prose-compact' : ''}`}><Markdown remarkPlugins={[remarkGfm]} components={{
    h2: ({ children, node }) => <h2 id={headingPrefix ? headingIds.get(node?.position?.start.line ?? 0) : undefined}>{children}</h2>,
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  }}>{children}</Markdown></div>;
}

function Panel({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      requestAnimationFrame(() => { if (opener?.isConnected && !document.querySelector('dialog[open]')) opener.focus(); });
    };
  }, []);
  return <dialog ref={ref} className="dialog" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="dialog-title">
    <div className="dialog-heading"><div><h2 id="dialog-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
    {children}
  </dialog>;
}

function ContextForm({ context, onSave, onClose }: { context: AnalysisContext; onSave: (value: AnalysisContext) => void; onClose: () => void }) {
  const [roles, setRoles] = useState(context.target_roles);
  const [customRole, setCustomRole] = useState('');
  const [error, setError] = useState('');
  const suggestions = [...new Set(['Backend Engineer', 'Frontend Engineer', 'Full-stack Engineer', 'AI Application Engineer', 'DevOps Engineer', ...roles])];
  function toggle(role: string) {
    if (roles.includes(role)) { setRoles(roles.filter((item) => item !== role)); setError(''); }
    else if (roles.length < 5) { setRoles([...roles, role]); setError(''); }
    else setError('Choose up to five target roles.');
  }
  function addRole() {
    const role = customRole.trim();
    if (!role) return;
    if (!roles.includes(role) && roles.length < 5) { setRoles([...roles, role]); setCustomRole(''); setError(''); }
    else setError('Choose up to five distinct roles.');
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const pending = customRole.trim();
    const finalRoles = pending && !roles.includes(pending) ? [...roles, pending] : roles;
    if (finalRoles.length > 5) { setError('Choose up to five target roles.'); return; }
    onSave({ target_roles: finalRoles, goals: String(data.get('goals') || '').trim() || null, additional_information: String(data.get('additional') || '').trim() || null });
  }
  return <form onSubmit={submit} className="context-form">
    <div className="context-fields"><fieldset><legend>What roles are you exploring? <span>Optional · up to 5</span></legend>
      <div className="role-choices">{suggestions.map((role) => <button type="button" key={role} aria-pressed={roles.includes(role)} className={`role-choice ${roles.includes(role) ? 'chosen' : ''}`} onClick={() => toggle(role)}>{roles.includes(role) ? <Check size={14} /> : <Plus size={14} />}{role}</button>)}</div>
      <div className="custom-role"><input aria-label="Another target role" maxLength={100} value={customRole} onChange={(event) => setCustomRole(event.target.value)} placeholder="Or add another role" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addRole(); } }} /><button type="button" className="button secondary" onClick={addRole}>Add</button></div>
    </fieldset>
    <label className="field">Your goals <span>What would make this analysis useful?</span><textarea name="goals" maxLength={2000} rows={3} defaultValue={context.goals || ''} placeholder="I'm preparing a portfolio for backend engineering roles…" /></label>
    <label className="field">What should we know about your work?<span>Include project names, existing features, your contributions, or constraints.</span><textarea name="additional" maxLength={12000} rows={5} defaultValue={context.additional_information || ''} placeholder="In my API project, I already implemented Redis-backed rate limiting and integration tests. Those files aren't included in the fetched data…" /></label>
    <div className="context-note"><ShieldCheck size={17} /><p>Your context is treated as self-reported information. It helps the analysis distinguish missing evidence from missing features.</p></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    </div><div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" type="submit">Apply context <Check size={16} /></button></div>
  </form>;
}

function RepositoryTable({ workspace, query, limit }: { workspace: Workspace; query: string; limit?: number }) {
  const repositories = workspace.repositories;
  const filtered = repositories.filter(({ repo }) => repo.toLowerCase().includes(query.toLowerCase())).slice(0, limit);
  return filtered.length ? <div className="table-scroll"><table><thead><tr><th scope="col">Repository</th><th scope="col">Declared technologies</th><th scope="col">Evidence</th><th scope="col"><span className="sr-only">Open repository</span></th></tr></thead><tbody>{filtered.map(({ repo, default_branch }) => {
    const files = workspace.tech.filter((file) => file.repo === repo);
    const stack = technologies(files);
    return <tr key={repo}><td><div className="repo-name"><div className="repo-icon"><FolderGit2 size={18} /></div><div><span className="repo-title">{workspace.sample ? repo : <a href={`https://github.com/${workspace.username}/${encodeURIComponent(repo)}`} target="_blank" rel="noopener noreferrer">{repo}</a>}</span><span><GitBranch size={11} />{default_branch || 'Branch not supplied'}</span></div></div></td><td data-label="Technologies"><div className="tags">{stack.slice(0, 3).map((tech) => <span className="tag" key={tech}>{tech}</span>)}{stack.length > 3 && <details className="more-technologies"><summary aria-label={`Additional technologies for ${repo}`}><span className="more-count">+{stack.length - 3} more</span><span className="less-label">Show less</span></summary><div>{stack.slice(3).map((name) => <span className="tag" key={name}>{name}</span>)}</div></details>}{!stack.length && <span className="muted">No manifest evidence</span>}</div></td><td data-label="Project evidence"><span className="evidence-count"><span className={`status-dot ${files.length ? '' : 'gray'}`} />{files.length} {files.length === 1 ? 'file' : 'files'}</span></td><td className="repo-row-action">{!workspace.sample && <a className="icon-button" aria-label={`Open ${repo} on GitHub`} href={`https://github.com/${workspace.username}/${encodeURIComponent(repo)}`} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={17} /></a>}</td></tr>;
  })}</tbody></table></div> : <div className="empty-state"><FolderGit2 size={30} /><h3>{query ? 'No matching repositories' : 'No repositories available'}</h3><p>{query ? 'Try a different repository name.' : 'This user has no repositories in the returned repository list.'}</p></div>;
}

function Footprint({ workspace, onSelect }: { workspace: Workspace; onSelect: (repo: string) => void }) {
  const [measure, setMeasure] = useState('technologies');
  const names = [...new Set(workspace.tech.map((file) => file.repo))];
  const data = names.map((name) => {
    const files = workspace.tech.filter((file) => file.repo === name);
    return { name, count: measure === 'files' ? files.length : technologies(files).length };
  }).sort((a, b) => b.count - a.count).slice(0, 8);
  const max = Math.max(4, ...data.map((d) => d.count));
  return <Panel title="Repository footprint" subtitle="A closer look at your project evidence" className="footprint-panel" action={<label className="chart-select"><span className="sr-only">Chart measure</span><select value={measure} onChange={(event) => setMeasure(event.target.value)}><option value="technologies">Technologies</option><option value="files">Files</option></select><ChevronDown size={12} /></label>}>
    {data.length ? <><div className="chart"><div className="chart-axis">{[max, Math.round(max / 2), 0].map((v) => <span key={v}>{v}</span>)}</div><div className="chart-plot"><div className="chart-grid"><i /><i /><i /></div><div className="chart-bars">{data.map(({ name, count }) => <button key={name} onClick={() => onSelect(name)} title={`${name}: ${count} ${measure}`} aria-label={`${name}: ${count} ${measure}. View repository.`}><div className="bar-track"><div className="bar" style={{ '--bar-size': `${count / max * 100}%` } as CSSProperties}><span>{count}</span></div></div><span className="bar-label">{name}</span></button>)}</div></div></div><p className="chart-caption"><span className="legend-dot" />{measure === 'files' ? 'Fetched technical files' : 'Recognized declared technologies'} · counts, not proficiency scores</p></> : <div className="empty-state small"><Layers3 size={28} /><p>No supported technical files are available for this profile.</p></div>}
  </Panel>;
}

function Landing({ username, setUsername, inputRef, onSubmit, fetching, error, showExample, cancel }: {
  username: string; setUsername: (value: string) => void; inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (event: FormEvent) => void; fetching: boolean; error: string;
  showExample: () => void; cancel: () => void;
}) {
  return <div className="landing-page">
    <a href="#landing-main" className="skip-link">Skip to content</a>
    <header className="landing-nav"><a href="#" className="brand" aria-label="GitLens home"><span className="brand-icon"><Code2 size={26} strokeWidth={2.5} /></span><span>gitlens<span className="brand-period">.</span></span></a><nav aria-label="Landing navigation"><a href="#how-it-works">How it works</a><button className="button secondary" onClick={showExample}>View example <ArrowUpRight size={16} /></button></nav></header>
    <main id="landing-main" className="landing-main">
      <section className="landing-hero"><div className="landing-copy"><span className="landing-kicker"><span className="status-dot" />UNDERSTAND YOUR WORK. PLAN YOUR NEXT STEP.</span><h1>Your GitHub tells a story.<br /><span>See the bigger picture.</span></h1><p>Explore your projects, understand your technical strengths, and identify practical steps toward your career goals.</p>
        <form className="landing-form" onSubmit={onSubmit}><label htmlFor="landing-username">Start with your GitHub username</label><div className="landing-input-row"><Github size={22} /><input id="landing-username" ref={inputRef} aria-invalid={Boolean(error)} aria-describedby={error ? "username-error" : "username-hint"} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Your username or GitHub profile URL" autoComplete="off" spellCheck={false} maxLength={200} disabled={fetching} /><button className="button primary" type="submit" disabled={fetching}>{fetching ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={18} />}<span>{fetching ? 'Loading profile…' : 'Explore my GitHub'}</span></button></div><p id="username-hint"><ShieldCheck size={15} />Public profile data. No sign-in required.</p></form>
        {fetching && <div className="fetch-status" role="status"><LoaderCircle className="spin" size={16} /><span>Fetching your GitHub profile…</span><button className="text-button" onClick={cancel}>Cancel</button></div>}
        {error && <div className="error-banner" role="alert"><Info size={18} /><div><strong>We couldn’t load that profile</strong><p id="username-error">{error}</p></div></div>}
        <div className="landing-example-link"><span>Preview the experience</span><button className="text-button" onClick={showExample}>View a sample portfolio review <ArrowRight size={15} /></button></div>
      </div><section className="landing-visual portfolio-review-panel" aria-labelledby="review-panel-title">
        <div className="review-panel-top"><span className="review-panel-mark"><Code2 size={19} /></span><span className="small-label">YOUR PORTFOLIO REVIEW</span></div>
        <h2 id="review-panel-title">Turn your projects<br />into a clear next step.</h2>
        <p className="review-panel-description">A closer look at your work, with recommendations that connect to your goals.</p>
        <div className="review-outcomes">
          <div className="review-outcome"><span className="review-outcome-icon blue"><Layers3 size={22} /></span><div><span className="review-category">PROJECT EVIDENCE</span><h3>Understand your technical strengths</h3><p>See the technologies and engineering choices reflected in your repositories.</p></div></div>
          <div className="review-outcome"><span className="review-outcome-icon violet"><Target size={22} /></span><div><span className="review-category">CAREER DIRECTION</span><h3>Connect your work to relevant roles</h3><p>Explore role alignment and the capabilities you can demonstrate more clearly.</p></div></div>
          <div className="review-outcome"><span className="review-outcome-icon green"><Sparkles size={22} /></span><div><span className="review-category">PRACTICAL RECOMMENDATIONS</span><h3>Know what to improve—and why</h3><p>Get specific actions, their relevance to your goals, and clear completion criteria.</p></div></div>
        </div>
        <div className="review-context-note"><Users size={18} /><p>Your experience adds context. Include contributions and work that your repositories don’t show.</p></div>
      </section></section>
      <section id="how-it-works" className="landing-steps"><div className="landing-section-heading"><span className="small-label">HOW IT WORKS</span><h2>From your GitHub profile to a focused development plan.</h2></div><div className="landing-step-grid">{[
        { number: '01', icon: Github, title: 'Load your profile', text: 'Enter your username. See your actual GitHub details and repository list as they arrive.' },
        { number: '02', icon: Layers3, title: 'Explore your work', text: 'Review your public projects, the technologies they use, and the available project documentation.' },
        { number: '03', icon: Sparkles, title: 'Get personalized recommendations', text: 'Add your goals and existing work, then generate AI insights with reasons and practical next steps.' },
      ].map(({ number, icon: Icon, title, text }) => <article className="landing-step" key={number}><div><span className="role-symbol blue"><Icon size={23} /></span><span className="step-number">{number}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <footer className="page-footer"><span><Code2 size={17} />GitLens<span className="footer-divider">/</span>Understand your portfolio. Plan your next step.</span><a href="#how-it-works">How it works <ArrowUpRight size={14} /></a></footer>
    </main>
  </div>;
}

function Overview({ workspace, onRepositories, onAnalyze, loading }: {
  workspace: Workspace; onRepositories: (repo?: string) => void; onAnalyze: () => void; loading: boolean;
}) {
  const profile = workspace.profile!;
  const reposReady = workspace.repositoriesLoaded !== false;
  const techReady = workspace.techLoaded !== false;
  const stats = [
    { title: 'Repositories', value: reposReady ? workspace.repositories.length : '—', icon: FolderGit2, detail: reposReady ? 'Public repositories' : loading ? 'Fetching repository list…' : 'Repository list unavailable', tone: 'blue' },
    { title: 'Followers', value: profile.followers, icon: Users, detail: 'GitHub profile followers', tone: 'violet' },
    { title: 'Following', value: profile.following, icon: Github, detail: 'GitHub accounts followed', tone: 'cyan' },
    { title: 'Technologies', value: techReady ? technologies(workspace.tech).length : '—', icon: Code2, detail: techReady ? 'Recognized in fetched manifests' : loading ? 'Fetching technical files…' : 'Technical files unavailable', tone: 'blue' },
    { title: 'Evidence files', value: techReady ? workspace.tech.length : '—', icon: FileCode2, detail: techReady ? 'Fetched manifests & configuration' : loading ? 'Fetching technical files…' : 'Technical files unavailable', tone: 'amber' },
    { title: 'Data source', value: workspace.sample ? 'Demo' : 'GitHub', icon: ShieldCheck, detail: workspace.sample ? 'Invented example information' : 'Public profile and project data', tone: 'green' },
  ];
  return <>
    <section className="panel profile-summary">
      <span className="profile-mark">{workspace.sample ? <span className="sample-initials">JE</span> : <Github size={28} />}</span>
      <div><span className="small-label">{workspace.sample ? 'FICTIONAL PROFILE' : 'GITHUB PROFILE'}</span><h2>{profile.name || profile.login}</h2><p>{profile.bio || 'This GitHub profile has no public bio.'}</p>{!workspace.sample && <a className="text-button" href={`https://github.com/${profile.login}`} target="_blank" rel="noopener noreferrer">View GitHub profile <ArrowUpRight size={15} /></a>}</div>
    </section>
    <div className="dashboard-top"><div className="stat-grid">{stats.map(({ title, value, icon: Icon, detail, tone }) => <div className="stat-card" key={title}><div className="stat-top"><span>{title}</span><span className={`stat-icon ${tone}`}><Icon size={16} /></span></div><strong className={typeof value === 'string' && value.length > 3 ? 'text-value' : ''}>{value}</strong><p>{detail}</p></div>)}</div>{techReady ? <Footprint workspace={workspace} onSelect={onRepositories} /> : <Panel title="Repository footprint" subtitle="Technical files load independently of your profile."><div className="empty-state small">{loading ? <LoaderCircle className="spin" size={28} /> : <Info size={28} />}<p>{loading ? 'Fetching supported manifest and configuration files…' : 'Project details are temporarily unavailable. Your profile is still available.'}</p></div></Panel>}</div>
    <Panel title="Repository explorer" subtitle={workspace.sample ? 'Invented projects for this example' : 'Public repositories and available project evidence'} action={<button className="text-button" onClick={() => onRepositories()}>View repositories <ArrowRight size={14} /></button>}>
      {reposReady ? <RepositoryTable workspace={workspace} query="" limit={4} /> : <div className="empty-state small">{loading && <LoaderCircle className="spin" size={26} />}<p>{loading ? 'Fetching repositories…' : 'Repository list unavailable. Reload the profile to try again.'}</p></div>}
    </Panel>
    <section className="panel insight-prompt"><span className="role-symbol blue"><Sparkles size={24} /></span><div><h2>{workspace.sample ? 'See an example AI response' : 'Ready for a deeper look?'}</h2><p>{workspace.sample ? 'Read a hand-written demonstration using only fictional data.' : 'Generate role-focused guidance from your fetched GitHub evidence and optional context.'}</p></div><button className="button primary" onClick={onAnalyze}>{workspace.sample ? 'View example report' : workspace.analysis ? 'View AI insights' : 'Explore AI insights'}<ArrowRight size={16} /></button></section>
  </>;
}

function FullReport({ workspace }: { workspace: Workspace }) {
  const headings = reportHeadings(workspace.analysis);
  return <article className="panel full-report"><div className="report-cover"><span className="eyebrow-tag"><Sparkles size={14} />{workspace.sample ? 'ILLUSTRATIVE PORTFOLIO REVIEW' : 'PERSONALIZED PORTFOLIO REVIEW'}</span><h2>{workspace.sample ? 'Portfolio review for Jordan Ellis' : `AI insights for ${workspace.profile?.name || workspace.username}`}</h2><p>{workspace.sample ? 'Jordan Ellis · sample portfolio' : `@${workspace.username}`}</p></div><details className="report-toc"><summary>Jump to a section <ChevronDown size={16} /></summary><nav aria-label="Report sections">{headings.map((heading, index) => <a href={`#report-heading-${index}`} key={index}>{heading}</a>)}</nav></details><div className="report-section"><Prose headingPrefix="report-heading">{workspace.analysis}</Prose></div><div className="report-source-note"><Info size={16} /><p>{workspace.sample ? 'This illustrative review uses fictional profile and project information.' : 'Review these AI-generated recommendations alongside your project work and experience.'}</p></div></article>;
}

function EmptyWorkspace({ view, focusInput, showExample }: { view: View; focusInput: () => void; showExample: () => void }) {
  const title = view === 'repositories' ? 'Your repositories belong here.' : view === 'insights' ? 'Your AI insights start with your profile.' : 'Start with your GitHub profile.';
  return <section className="panel welcome-panel"><span className="welcome-icon"><FolderGit2 size={38} /></span><span className="eyebrow-tag">YOUR PORTFOLIO</span><h2>{title}</h2><p>Enter a GitHub username above and load the profile. Explore your public profile, repositories, and project evidence in one place.</p><div className="welcome-actions"><button className="button primary" onClick={focusInput}>Enter a username <ArrowRight size={16} /></button><button className="button secondary" onClick={showExample}>Explore the example</button></div><div className="welcome-features"><span><Github size={18} />Real profile details</span><span><FolderGit2 size={18} />Actual repositories</span><span><Sparkles size={18} />AI insights on request</span></div></section>;
}

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedReport, setSelectedReport] = useState<Workspace | null>(null);
  const [username, setUsername] = useState('');
  const [context, setContext] = useState<AnalysisContext>(emptyContext);
  const [modal, setModal] = useState<'context' | 'help' | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [exampleTab, setExampleTab] = useState<'overview' | 'repositories' | 'insights'>('overview');
  const [exampleQuery, setExampleQuery] = useState('');
  const [saved, setSaved] = useState<Workspace[]>(readSavedReports);
  const apiBase = defaultApiBase();
  const [fetching, setFetching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const profileController = useRef<AbortController | null>(null);
  const analysisController = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { profileController.current?.abort(); analysisController.current?.abort(); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (!analyzing) return; const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000); return () => clearInterval(timer); }, [analyzing]);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)');
    const change = () => { setIsMobile(query.matches); if (!query.matches) setMobileOpen(false); };
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (view !== 'landing' && view !== 'example') document.getElementById('view-heading')?.focus();
  }, [view]);
  useEffect(() => {
    if (!mobileOpen || !isMobile) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => [...sidebar.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')].filter((node) => node.getClientRects().length > 0);
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    sidebar.addEventListener('keydown', onKeyDown);
    return () => {
      sidebar.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => { if (!document.querySelector('dialog[open]')) menuRef.current?.focus(); });
    };
  }, [mobileOpen, isMobile]);
  function navigate(next: View) {
    const hasProfile = workspace && !workspace.sample && workspace.profile;
    if (!hasProfile && next !== 'landing' && next !== 'example') next = 'landing';
    setView(next); setSelectedReport(null); setMobileOpen(false);
    if (next !== 'repositories') setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function focusInput() { inputRef.current?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  async function loadProfile(event: FormEvent) {
    event.preventDefault();
    let user: string;
    try { user = normalizeUsername(username); }
    catch (err) { setError((err as Error).message); focusInput(); return; }
    profileController.current?.abort(); analysisController.current?.abort(); analysisController.current = null;
    if (workspace?.username.toLowerCase() !== user.toLowerCase()) setContext(emptyContext);
    const current = new AbortController(); profileController.current = current;
    setWorkspace(null); setSelectedReport(null); setAnalyzing(false); setFetching(true); setError(''); navigate('landing');
    const timeout = setTimeout(() => current.abort('timeout'), 240000);
    try {
      let profileShown = false;
      await fetchWorkspace(apiBase, user, current.signal, (result) => {
        if (profileController.current !== current || current.signal.aborted) return;
        setWorkspace((previous) => ({ ...result, analysis: previous?.analysis || '', context: previous?.context || emptyContext }));
        if (!profileShown) { profileShown = true; setView('overview'); }
      });
      if (!current.signal.aborted) { setUsername(user); setToast('GitHub profile and available evidence loaded.'); }
    } catch (err) {
      if (profileController.current !== current) return;
      if (current.signal.aborted) {
        setError(current.signal.reason === 'timeout' ? 'Some GitHub data took too long to load. Reload the profile to try again.' : 'Profile loading was cancelled. Reload to fetch any missing data.');
      } else setError(err instanceof Error ? err.message : 'Could not load this GitHub profile.');
    } finally { clearTimeout(timeout); if (profileController.current === current) setFetching(false); }
  }
  async function runAnalysis() {
    if (!workspace) { focusInput(); return; }
    analysisController.current?.abort();
    const current = new AbortController(); analysisController.current = current;
    const user = workspace.username;
    const usedContext = { ...context, target_roles: [...context.target_roles] };
    const timeout = setTimeout(() => current.abort('timeout'), 240000);
    setError(''); setAnalyzing(true); setElapsed(0); navigate('insights');
    try {
      const analysis = await generateAnalysis(apiBase, user, usedContext, current.signal);
      if (current.signal.aborted || analysisController.current !== current) return;
      setWorkspace((previous) => previous?.username === user ? { ...previous, analysis, context: usedContext, createdAt: new Date().toISOString() } : previous);
      setToast('Your AI response is ready.');
    } catch (err) {
      if (analysisController.current !== current) return;
      if (current.signal.aborted) setError(current.signal.reason === 'timeout' ? 'AI analysis took longer than four minutes. Your GitHub data is still available.' : 'AI generation was cancelled. Your GitHub data is still available.');
      else setError(err instanceof Error ? err.message : 'AI analysis failed. Your GitHub data is still available.');
    } finally { clearTimeout(timeout); if (analysisController.current === current) setAnalyzing(false); }
  }
  const activeReport = selectedReport || workspace;
  const reportReady = Boolean(activeReport?.analysis && !activeReport.sample);
  function saveReport() {
    if (!activeReport?.analysis || activeReport.sample) return;
    const next = [activeReport, ...saved.filter((report) => report.username !== activeReport.username || report.createdAt !== activeReport.createdAt)].slice(0, 10);
    try { localStorage.setItem('gitlens.reports', JSON.stringify(next)); setSaved(next); setToast('Report saved in this browser.'); }
    catch { setToast('Browser storage is full or unavailable. Download the report instead.'); }
  }
  function download() {
    if (!activeReport?.analysis || activeReport.sample) return;
    const url = URL.createObjectURL(new Blob([`# GitLens · ${activeReport.username}\n\n${activeReport.analysis}`], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `gitlens-${activeReport.username}.md`; link.click(); URL.revokeObjectURL(url);
    setToast('Markdown report downloaded.');
  }
  function openSaved(report: Workspace) { navigate('insights'); setSelectedReport(report); }
  const contextCount = context.target_roles.length + Number(Boolean(context.goals)) + Number(Boolean(context.additional_information));
  const isSaved = activeReport && saved.some((report) => report.username === activeReport.username && report.createdAt === activeReport.createdAt);
  const displayedUser = view === 'insights' ? activeReport : workspace;

  const canEnterWorkspace = Boolean(workspace && !workspace.sample && workspace.profile
    && workspace.profile.login.toLowerCase() === workspace.username.toLowerCase());
  const exampleContent = (<>
          <div className="sample-banner"><Info size={18} /><p><strong>Sample portfolio.</strong> Explore a sample review for a fictional developer. The profile, projects, and recommendations are illustrative.</p><span className="sample-label">DEMO DATA</span></div>
          <div className="example-tabs" role="tablist" aria-label="Example sections" onKeyDown={(event) => {
            const tabs = ['overview', 'repositories', 'insights'] as const;
            const current = tabs.indexOf(exampleTab);
            let index = current;
            if (event.key === 'ArrowRight') index = (current + 1) % tabs.length;
            else if (event.key === 'ArrowLeft') index = (current + tabs.length - 1) % tabs.length;
            else if (event.key === 'Home') index = 0;
            else if (event.key === 'End') index = tabs.length - 1;
            else return;
            event.preventDefault(); setExampleTab(tabs[index]);
            document.getElementById(`example-tab-${tabs[index]}`)?.focus();
          }}>{(['overview', 'repositories', 'insights'] as const).map((tab) => <button key={tab} role="tab" aria-label={tab === 'insights' ? 'Example AI report' : tab === 'repositories' ? 'Example repositories' : 'Example overview'} id={`example-tab-${tab}`} aria-controls="example-panel" tabIndex={exampleTab === tab ? 0 : -1} aria-selected={exampleTab === tab} onClick={() => setExampleTab(tab)}>{tab === 'insights' ? 'AI report' : tab === 'repositories' ? 'Repositories' : 'Overview'}</button>)}</div>
          <details className="panel sample-review-context"><summary>Goals and experience included in this review <ChevronDown size={16} /></summary><div><span className="small-label">TARGET ROLES</span><div className="tags">{exampleWorkspace.context.target_roles.map((role) => <span className="tag" key={role}>{role}</span>)}</div><h3>Career goal</h3><p>{exampleWorkspace.context.goals}</p><h3>Experience and project contributions</h3><p>{exampleWorkspace.context.additional_information}</p></div></details>
          <div id="example-panel" role="tabpanel" aria-labelledby={`example-tab-${exampleTab}`} tabIndex={0}>
            {exampleTab === 'overview' && <Overview workspace={exampleWorkspace} loading={false} onRepositories={(repo) => { setExampleQuery(repo || ''); setExampleTab('repositories'); }} onAnalyze={() => setExampleTab('insights')} />}
            {exampleTab === 'repositories' && <Panel title="Fictional repositories" subtitle="Invented project names, branches, and dependency files" action={<label className="search-input"><Search size={16} /><input value={exampleQuery} onChange={(event) => setExampleQuery(event.target.value)} placeholder="Filter examples…" aria-label="Search example repositories" /></label>}><RepositoryTable workspace={exampleWorkspace} query={exampleQuery} /></Panel>}
            {exampleTab === 'insights' && <FullReport workspace={exampleWorkspace} />}
          </div>
        </>);
  if (view === 'example') return <div className="public-example-page">
    <a href="#example-main" className="skip-link">Skip to sample review</a>
    <header className="landing-nav"><button className="brand" aria-label="GitLens home" onClick={() => navigate('landing')}><span className="brand-icon"><Code2 size={26} /></span><span>gitlens<span className="brand-period">.</span></span></button><nav aria-label="Example navigation">{canEnterWorkspace && <button className="button secondary" onClick={() => navigate('overview')}>Back to your portfolio</button>}<button className="button primary" onClick={() => navigate('landing')}>Review your GitHub profile <ArrowRight size={16} /></button></nav></header>
    <main id="example-main" className="public-example-main"><div className="example-page-intro"><span className="eyebrow">SAMPLE PORTFOLIO REVIEW</span><h1>See your projects from a new perspective.</h1><p>Explore a fictional developer’s projects, technical evidence, and personalized recommendations.</p></div>{exampleContent}<footer className="page-footer"><span><Code2 size={17} />GitLens<span className="footer-divider">/</span>Understand your portfolio. Plan your next step.</span><button onClick={() => navigate('landing')}>Review your portfolio <ArrowRight size={14} /></button></footer></main>
  </div>;
  if (view === 'landing' || !canEnterWorkspace) return <>
    <Landing username={username} setUsername={setUsername} inputRef={inputRef} onSubmit={loadProfile}
      fetching={fetching} error={error} showExample={() => navigate('example')}
      cancel={() => profileController.current?.abort()} />
  </>;
  return <div className="app-shell">
    <a href="#main" className="skip-link">Skip to content</a>
    {mobileOpen && <button aria-hidden="true" tabIndex={-1} className="mobile-backdrop" onClick={() => setMobileOpen(false)} />}
    <aside id="workspace-navigation" ref={sidebarRef} className={`sidebar ${mobileOpen ? 'open' : ''}`} role={isMobile && mobileOpen ? "dialog" : undefined} aria-label="Workspace navigation" aria-modal={isMobile && mobileOpen ? true : undefined} aria-hidden={isMobile && !mobileOpen} inert={isMobile && !mobileOpen}><button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20} /></button>
      <a href="#" className="brand" aria-label="GitLens home" onClick={(event) => { event.preventDefault(); navigate('overview'); }}><span className="brand-icon"><Code2 size={23} strokeWidth={2.5} /></span><span>gitlens<span className="brand-period">.</span></span></a>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav aria-label="Main navigation">{navItems.map(({ view: itemView, asset, label }) => <button key={itemView} aria-label={label} className={`nav-item ${view === itemView ? 'active' : ''}`} onClick={() => navigate(itemView)} aria-current={view === itemView ? 'page' : undefined}><span className="figma-icon"><img src={`/assets/figma/${asset}.svg`} alt="" /></span>{label}{itemView === 'insights' && <span className="nav-ai">AI</span>}{view === itemView && <span className="nav-indicator" />}</button>)}<button aria-label="Saved reports" className={`nav-item ${view === 'saved' ? 'active' : ''}`} onClick={() => navigate('saved')} aria-current={view === 'saved' ? 'page' : undefined}><Bookmark size={19} />Saved reports{saved.length > 0 && <span className="nav-count">{saved.length}</span>}</button></nav>
      <div className="sidebar-support"><div className="workspace-label">RESOURCES</div><button className="nav-item" onClick={() => { setMobileOpen(false); setModal('help'); }}><span className="figma-icon"><img src="/assets/figma/help.svg" alt="" /></span>How it works<ArrowUpRight size={13} className="nav-end" /></button></div>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><Sparkles size={18} /></span><strong>More context. Better advice.</strong><p>Tell the AI about work that your fetched files don’t show.</p><button onClick={() => { setMobileOpen(false); setModal('context'); }}>Add your context <ArrowRight size={14} /></button></div><div className="workspace-owner"><span className="owner-avatar"><Github size={19} /></span><div><strong>Personal workspace</strong><span>No sign-in required</span></div><span className="online-dot" /></div></div>
    </aside>
    <div className="main-shell" inert={isMobile && mobileOpen}><header className="topbar"><div className="breadcrumb"><button ref={menuRef} className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="workspace-navigation" onClick={() => { setToast(''); setMobileOpen(true); }}><Menu size={21} /></button><span>Workspace</span><ChevronRight size={13} /><strong>{viewNames[view]}</strong></div><div className="topbar-right"><span className="private-note"><ShieldCheck size={14} />Grounded in your project work</span><button className="icon-button" aria-label="How GitLens works" onClick={() => { setMobileOpen(false); setModal('help'); }}><Info size={18} /></button><span className="top-avatar">GL</span></div></header>
      <main id="main">
        <div className="page-intro"><div><div className="eyebrow"><span />GITHUB PORTFOLIO ANALYSIS</div><h1>Your work, in perspective<span>.</span></h1><p>Load your GitHub profile. Explore your repositories. Generate insights when you’re ready.</p></div><span className="powered-by"><Sparkles size={14} />Insights powered by Gemini</span></div>
        <div className="loaded-profile-switcher"><span><Github size={18} />{workspace ? <>Workspace for <strong>@{workspace.username}</strong></> : 'No profile selected'}</span><button className="button secondary" onClick={() => { setError(''); navigate('landing'); }}>{workspace ? 'Change profile' : 'Load a GitHub profile'}<ArrowRight size={15} /></button></div>
        {error && <div className="error-banner" role="alert"><Info size={18} /><div><strong>That request couldn’t be completed</strong><p>{error}</p></div><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={17} /></button></div>}
        {fetching && <div className="fetch-status" role="status"><LoaderCircle className="spin" size={16} /><span>{workspace ? 'Profile loaded. Fetching repositories and technical evidence…' : 'Fetching this GitHub profile…'}</span><button className="text-button" onClick={() => profileController.current?.abort()}>Cancel</button></div>}
        <div className="section-toolbar"><div><h2 id="view-heading" tabIndex={-1}>{view === 'overview' ? 'Portfolio overview' : viewNames[view]}{view !== 'saved' && displayedUser && <span className="report-status"><span className="status-dot" />{selectedReport ? 'Saved response' : 'Profile loaded'}</span>}</h2><p>{view === 'saved' ? 'Your saved portfolio reviews, available in this browser.' : displayedUser ? <><a href={`https://github.com/${displayedUser.username}`} target="_blank" rel="noopener noreferrer">@{displayedUser.username}<ArrowUpRight size={12} /></a><span className="toolbar-dot">·</span>{view === 'insights' ? selectedReport ? 'Saved AI response' : 'Personalized recommendations' : 'Public GitHub profile and projects'}</> : 'Load a GitHub profile to explore your portfolio.'}</p></div>{view === 'insights' && reportReady && <div className="report-actions"><button className={`button secondary ${isSaved ? 'saved-button' : ''}`} onClick={saveReport}>{isSaved ? <Check size={15} /> : <Bookmark size={15} />}{isSaved ? 'Saved' : 'Save report'}</button><button className="button secondary download-button" onClick={download}><ArrowDownToLine size={15} /><span>Export report</span></button></div>}</div>
        {view !== 'saved' && workspace?.warnings.length ? <div className="warning-banner" role="status"><Info size={16} />{workspace.warnings.join(' ')} Other fetched data remains available.</div> : null}

        {(view === 'overview' || view === 'repositories' || view === 'insights') && !displayedUser && !fetching && <EmptyWorkspace view={view} focusInput={focusInput} showExample={() => navigate('example')} />}
        {view === 'overview' && workspace && <Overview workspace={workspace} loading={fetching} onRepositories={(repo) => { navigate('repositories'); setQuery(repo || ''); }} onAnalyze={() => navigate('insights')} />}
        {view === 'repositories' && workspace && <Panel title="Your GitHub repositories" subtitle="Explore this profile’s public repositories and available technical evidence." action={<label className="search-input"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a repository…" aria-label="Search repositories" /></label>}>{workspace.repositoriesLoaded === false ? <div className="empty-state"><FolderGit2 size={30} /><h3>{fetching ? 'Loading repositories…' : 'Repository list unavailable'}</h3><p>{fetching ? 'Loading this profile’s public repositories.' : 'Refresh the profile to try again.'}</p></div> : <RepositoryTable workspace={workspace} query={query} />}</Panel>}
        {view === 'insights' && activeReport && <>
          {!selectedReport && <section className="panel analysis-controls"><div><h2>{workspace?.analysis ? 'Update your AI insights' : 'Generate your AI insights'}</h2><p>Analyze @{workspace?.username} using your repository evidence and optional context.</p>{contextCount > 0 && <p className="context-summary"><Check size={14} />Context ready{context.target_roles.length ? ` · ${context.target_roles.join(', ')}` : ''}</p>}</div><div className="analysis-control-actions"><button className="button secondary" onClick={() => setModal('context')} disabled={analyzing}><Plus size={16} />Your context{contextCount > 0 && <span>({contextCount})</span>}</button><button className="button primary" onClick={runAnalysis} disabled={analyzing}>{analyzing ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{analyzing ? 'Generating…' : workspace?.analysis ? 'Regenerate AI insights' : 'Generate AI insights'}</button></div></section>}
          {selectedReport && <div className="sample-banner"><Info size={16} /><p>This is a saved response for @{selectedReport.username}. You can return to your current portfolio at any time.</p><button className="text-button" onClick={() => setSelectedReport(null)}>Return to current portfolio</button></div>}
          {analyzing && !selectedReport && <section className="panel ai-loading" role="status"><LoaderCircle className="spin" size={26} /><div><h2>Generating your AI response</h2><p>Your overview and repositories remain available while the model works. {elapsed}s elapsed.</p></div><button className="button secondary" onClick={() => analysisController.current?.abort()}>Cancel generation</button></section>}
          {activeReport.analysis ? <FullReport workspace={activeReport} /> : !analyzing && <section className="panel welcome-panel"><span className="welcome-icon"><Sparkles size={36} /></span><h2>No AI response yet.</h2><p>Add your goals and experience, then generate a personalized review of your portfolio.</p></section>}
        </>}
        {view === 'saved' && <Panel title="Your saved AI responses" subtitle={`${saved.length} of 10 browser-local report slots used`}>{saved.length ? <div className="saved-list">{saved.map((report) => <div className="saved-row" key={`${report.username}-${report.createdAt}`}><div className="repo-icon"><FileText size={21} /></div><button className="saved-open" onClick={() => openSaved(report)}><strong>{report.profile?.name || report.username}</strong><span>@{report.username} · {new Date(report.createdAt).toLocaleDateString()}</span></button><button className="icon-button" aria-label={`Delete saved report for ${report.username}`} onClick={() => { const next = saved.filter((item) => item !== report); try { localStorage.setItem('gitlens.reports', JSON.stringify(next)); setSaved(next); setToast('Saved report removed.'); } catch { setToast('Could not update browser storage.'); } }}><Trash2 size={17} /></button><button className="icon-button" aria-label={`Open report for ${report.username}`} onClick={() => openSaved(report)}><ArrowRight size={17} /></button></div>)}</div> : <div className="empty-state"><Bookmark size={34} /><h3>No saved AI responses yet.</h3><p>Generate a real analysis and choose Save report to keep it in this browser.</p><button className="button primary" onClick={() => navigate('insights')}>Go to AI insights <ArrowRight size={16} /></button></div>}</Panel>}
        <footer className="page-footer"><span><Code2 size={15} />GitLens<span className="footer-divider">/</span>Understand your portfolio. Plan your next step.</span><button onClick={() => { setMobileOpen(false); setModal('help'); }}>How the analysis works <ArrowUpRight size={12} /></button></footer>
      </main>
    </div>
    {toast && <div className="toast" role="status"><Check size={16} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={14} /></button></div>}
    {modal === 'context' && <Modal title="The rest of your story" subtitle="Help the analysis see beyond manifests and README files." onClose={() => setModal(null)}><ContextForm context={context} onClose={() => setModal(null)} onSave={(value) => { setContext(value); setModal(null); setToast('Context applied. Generate AI insights to include it.'); }} /></Modal>}
    {modal === 'help' && <Modal title="How GitLens works" subtitle="GitHub data and AI generation are separate steps." onClose={() => setModal(null)}><div className="help-content">{[
      { icon: Github, title: 'Load a real profile', text: 'Enter a GitHub username to see public profile details, repositories, and available project information.' },
      { icon: FolderGit2, title: 'Explore actual repositories', text: 'Browse public repositories, review their branches, and explore technologies identified in the available project files.' },
      { icon: Sparkles, title: 'Generate AI insights explicitly', text: 'Share your target roles, goals, and relevant experience. Generate a portfolio review with supporting evidence and practical recommendations.' },
      { icon: FileText, title: 'Try the fictional example', text: 'Explore a fictional developer’s portfolio to preview the overview, repository list, and recommendations before reviewing your own work.' },
      { icon: Bookmark, title: 'Save real reports', text: 'Save a portfolio review in this browser or download it as Markdown. Return to saved reviews without changing the profile you are exploring.' },
    ].map(({ icon: Icon, title, text }) => <div className="help-step" key={title}><span className="role-symbol blue"><Icon size={21} /></span><div><h3>{title}</h3><p>{text}</p></div></div>)}<a className="reference-link" href="https://www.figma.com/design/zLTK54f6Jmt1uPKyahS0XK/Analytics-Dashboard--Community-?node-id=0-1" target="_blank" rel="noopener noreferrer">Dashboard layout adapted from the Figma community template <ExternalLink size={13} /></a><div className="dialog-actions"><button className="button primary" onClick={() => setModal(null)}>Got it <Check size={16} /></button></div></div></Modal>}
  </div>;
}
