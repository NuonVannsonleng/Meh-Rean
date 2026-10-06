import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import ContributionGraph from "../components/ContributionGraph";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import {
  BookmarkIcon,
  CalendarIcon,
  CameraIcon,
  ChatIcon,
  FileTextIcon,
  GraduationIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  CheckIcon,
  UserIcon,
} from "../components/Icons";
import ImageCropper from "../components/ImageCropper";
import InstitutionLogo from "../components/InstitutionLogo";
import LoadingState from "../components/LoadingState";
import NoteRow from "../components/NoteRow";
import UserList from "../components/UserList";
import VerifiedBadge from "../components/VerifiedBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { t } from "../i18n/en";
import { errorCode, errorMessage } from "../lib/errors";
import { formatCount, formatDate } from "../lib/format";
import { normalizeText as normalizeSearch } from "../lib/institutions";
import { subjectCategory } from "../lib/subjects";
import {
  followUser,
  getFeed,
  getFollowers,
  getFollowing,
  getProfile,
  unfollowUser,
  updateProfile,
  uploadProfileImage,
} from "../services/api";
import { SUBJECTS, type PostView, type ProfileImageKind, type ProfileView, type PublicUser, type Subject } from "../types";

type Tab = "overview" | "notes" | "saved" | "followers" | "following";

type ProfileState =
  | { status: "loading" }
  | { status: "ready"; profile: ProfileView }
  | { status: "not-found" }
  | { status: "error" };

// ---- Header ----

function ProfileHeader({
  profile,
  isOwn,
  pending,
  onFollowToggle,
  onImage,
  onTab,
}: {
  profile: ProfileView;
  isOwn: boolean;
  pending: boolean;
  onFollowToggle: () => void;
  onImage: (file: File, kind: ProfileImageKind) => void;
  onTab: (tab: Tab) => void;
}) {
  const { user, stats, isFollowing } = profile;
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const facts: { key: string; icon: ReactNode; value: string }[] = [
    { key: "grade", icon: <GraduationIcon className="h-4 w-4" />, value: user.grade ?? "" },
    { key: "field", icon: <FileTextIcon className="h-4 w-4" />, value: user.fieldOfStudy },
    { key: "country", icon: <MapPinIcon className="h-4 w-4" />, value: user.country },
    { key: "joined", icon: <CalendarIcon className="h-4 w-4" />, value: t.profile.joined(formatDate(user.createdAt)) },
  ].filter((fact) => fact.value);

  const tiles: { label: string; value: string; tab?: Tab }[] = [
    { label: t.profile.notesStat, value: formatCount(stats.posts), tab: "notes" },
    { label: t.profile.helpfulStat, value: formatCount(stats.reactions) },
    { label: t.profile.followers, value: formatCount(stats.followers), tab: "followers" },
    { label: t.profile.followingLabel, value: formatCount(stats.following), tab: "following" },
    { label: t.profile.rating, value: stats.averageRating ? stats.averageRating.toFixed(1) : t.profile.noRating },
  ];

  const pickFile = (kind: ProfileImageKind) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onImage(file, kind);
  };

  return (
    <section className="card overflow-hidden">
      {/* The cover: the student's own banner, or the notebook look of the logo. */}
      <div className="relative h-28 sm:h-40">
        {user.bannerUrl ? (
          <img src={user.bannerUrl} alt={t.profile.bannerAlt(user.displayName)} className="h-full w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="bg-brand-50 ruled-paper relative h-full w-full">
            <span className="bg-logo-ribbon animate-ribbon absolute top-0 right-8 h-16 w-6 [clip-path:polygon(0_0,100%_0,100%_100%,50%_80%,0_100%)] sm:right-14 sm:h-24 sm:w-8" />
          </div>
        )}
        {isOwn && (
          <>
            <button
              type="button"
              onClick={() => bannerInput.current?.click()}
              className="press bg-surface/90 text-ink-900 hover:bg-surface absolute top-3 left-3 flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold shadow-sm backdrop-blur"
            >
              <CameraIcon className="h-4 w-4" />
              {t.profile.changeBanner}
            </button>
            <input ref={bannerInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pickFile("banner")} />
          </>
        )}
      </div>

      <div className="px-4 pb-5 sm:px-6">
        <div className="relative z-10 -mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
          <div className="relative">
            <Avatar user={user} size="xl" className="ring-surface ring-4" />
            {isOwn && (
              <>
                <button
                  type="button"
                  onClick={() => avatarInput.current?.click()}
                  aria-label={t.settings.avatarChange}
                  className="press bg-surface border-line text-ink-700 hover:text-ink-900 absolute right-0 bottom-0 flex h-9 w-9 items-center justify-center rounded-full border shadow-sm"
                >
                  <CameraIcon className="h-4 w-4" />
                </button>
                <input ref={avatarInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pickFile("avatar")} />
              </>
            )}
          </div>
          <div className="flex gap-2">
            {isOwn ? (
              <Link to="/settings" className="btn-secondary rounded-full">
                <SettingsIcon className="h-4 w-4" />
                {t.profile.edit}
              </Link>
            ) : (
              <>
                <Link to={`/messages/${user.username}`} aria-label={`${t.profile.message} ${user.displayName}`} className="btn-secondary rounded-full">
                  <ChatIcon className="h-4 w-4" />
                  <span className="hidden min-[380px]:inline">{t.profile.message}</span>
                </Link>
                <button
                  type="button"
                  onClick={onFollowToggle}
                  disabled={pending}
                  aria-pressed={isFollowing}
                  className={`${isFollowing ? "btn-secondary" : "btn-primary"} min-w-28 rounded-full`}
                >
                  {isFollowing ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                  {isFollowing ? t.profile.following : t.profile.follow}
                </button>
              </>
            )}
          </div>
        </div>

        <h1 className="text-ink-900 mt-3 flex items-center gap-2 text-2xl sm:text-3xl">
          <span className="min-w-0 wrap-break-word">{user.displayName}</span>
          {user.verified && <VerifiedBadge className="h-5 w-5" />}
        </h1>
        <p className="text-ink-500">@{user.username}</p>

        {user.school && (
          <Link
            to={`/?school=${encodeURIComponent(user.school)}`}
            className="press bg-surface-muted border-line text-ink-900 hover:bg-surface-hover mt-3 inline-flex max-w-full items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm font-medium"
          >
            <InstitutionLogo name={user.school} domain={user.schoolDomain} className="h-7 w-7 rounded-full p-0.5" />
            <span className="truncate">{user.school}</span>
          </Link>
        )}

        {user.bio && <p className="text-ink-700 mt-3 max-w-2xl whitespace-pre-line">{user.bio}</p>}

        <ul className="text-ink-500 mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {facts.map(({ key, icon, value }) => (
            <li key={key} className="flex items-center gap-1.5">
              {icon}
              {value}
            </li>
          ))}
        </ul>

        <dl className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {tiles.map((tile) => {
            const body = (
              <>
                <dd className="font-display text-ink-900 text-xl font-bold">{tile.value}</dd>
                <dt className="text-ink-500 text-xs font-medium">{tile.label}</dt>
              </>
            );
            return tile.tab ? (
              <div key={tile.label}>
                <button
                  type="button"
                  onClick={() => onTab(tile.tab as Tab)}
                  className="press bg-surface-muted hover:bg-surface-hover flex w-full flex-col-reverse items-center rounded-xl px-2 py-2.5"
                >
                  {body}
                </button>
              </div>
            ) : (
              <div key={tile.label} className="bg-surface-muted flex flex-col-reverse items-center rounded-xl px-2 py-2.5">
                {body}
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

// ---- Overview ----

function Overview({ posts, isOwn, name }: { posts: PostView[]; isOwn: boolean; name: string }) {
  // The notes others found most helpful, then the most discussed.
  const top = [...posts]
    .sort((a, b) => b.reactions.total - a.reactions.total || b.commentCount - a.commentCount)
    .slice(0, 4);
  return (
    <div className="space-y-8">
      <ContributionGraph dates={posts.map((post) => post.createdAt)} />
      <section aria-labelledby="top-notes-title">
        <h2 id="top-notes-title" className="font-display text-ink-900 mb-3 text-lg font-bold">
          {t.profile.popular}
        </h2>
        {top.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {top.map((post) => (
              <NoteRow key={post.id} post={post} showAuthor={false} />
            ))}
          </ul>
        ) : (
          <div className="card text-ink-500 px-4 py-10 text-center text-sm">
            {isOwn ? (
              <>
                <p>{t.profile.emptyOwnBody}</p>
                <Link to="/create" className="btn-primary mt-4">
                  <PlusIcon className="h-4 w-4" />
                  {t.nav.newNote}
                </Link>
              </>
            ) : (
              <p>{t.profile.emptyOtherShort(name)}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ---- Notes list ----

function NotesList({ posts, showAuthor }: { posts: PostView[]; showAuthor: boolean }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<Subject | "all">("all");
  const [sort, setSort] = useState<"recent" | "stars" | "name">("recent");

  const shown = useMemo(() => {
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
    const filtered = posts.filter(
      (post) =>
        (subject === "all" || subjectCategory(post.subject) === subject) &&
        terms.every((term) => normalizeSearch(`${post.title} ${post.body} ${post.tags.join(" ")}`).includes(term)),
    );
    return filtered.sort((a, b) =>
      sort === "stars"
        ? b.reactions.total - a.reactions.total
        : sort === "name"
          ? a.title.localeCompare(b.title)
          : b.createdAt.localeCompare(a.createdAt),
    );
  }, [posts, query, subject, sort]);

  const used = SUBJECTS.filter((value) => posts.some((post) => subjectCategory(post.subject) === value));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">{t.profile.findNote}</span>
          <SearchIcon className="text-ink-400 pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.profile.findNote}
            className="input pl-8"
          />
        </label>
        <label className="sr-only" htmlFor="notes-subject">
          {t.feed.subjectLabel}
        </label>
        <select
          id="notes-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value as Subject | "all")}
          className="btn-secondary cursor-pointer pr-2"
        >
          <option value="all">{t.profile.allSubjects}</option>
          {used.map((value) => (
            <option key={value} value={value}>
              {t.subjects[value]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="notes-sort">
          {t.feed.sortLabel}
        </label>
        <select
          id="notes-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
          className="btn-secondary cursor-pointer pr-2"
        >
          <option value="recent">{t.profile.sortRecent}</option>
          <option value="stars">{t.profile.sortHelpful}</option>
          <option value="name">{t.profile.sortName}</option>
        </select>
      </div>
      {shown.length ? (
        <ul className="mt-4 space-y-3">
          {shown.map((post) => (
            <NoteRow key={post.id} post={post} showAuthor={showAuthor} />
          ))}
        </ul>
      ) : (
        <p className="text-ink-500 py-10 text-center text-sm">{t.profile.noMatches}</p>
      )}
    </div>
  );
}

// ---- Page ----

export default function Profile() {
  const { username = "" } = useParams<{ username: string }>();
  const [params, setParams] = useSearchParams();
  const { user, setUser } = useAuth();
  const { notify } = useToast();
  const requireAuth = useRequireAuth();
  const isOwn = user?.username === username.toLowerCase();

  const requested = params.get("tab");
  const tab: Tab =
    requested === "notes" || requested === "followers" || requested === "following" || (requested === "saved" && isOwn)
      ? requested
      : "overview";

  const [state, setState] = useState<ProfileState>({ status: "loading" });
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [saved, setSaved] = useState<PostView[] | null>(null);
  const [people, setPeople] = useState<PublicUser[] | null>(null);
  const [listError, setListError] = useState(false);
  const [pending, setPending] = useState(false);
  const [cropping, setCropping] = useState<{ file: File; kind: ProfileImageKind } | null>(null);

  const loadProfile = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", profile: await getProfile(username) });
    } catch (error) {
      setState({ status: errorCode(error) === "NOT_FOUND" ? "not-found" : "error" });
    }
  }, [username]);

  const loadList = useCallback(async () => {
    setListError(false);
    try {
      if (tab === "followers" || tab === "following") {
        setPeople(null);
        setPeople(await (tab === "followers" ? getFollowers(username) : getFollowing(username)));
      } else if (tab === "saved") {
        setSaved(null);
        setSaved(await getFeed({ savedOnly: true }));
      } else {
        setPosts(await getFeed({ authorUsername: username }));
      }
    } catch {
      setListError(true);
    }
  }, [tab, username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, user]);

  useEffect(() => {
    setPosts(null);
  }, [username]);

  useEffect(() => {
    loadList();
  }, [loadList, user?.id]);

  const setTab = (next: Tab) => setParams(next === "overview" ? {} : { tab: next }, { replace: true });

  const toggleFollow = async () => {
    if (!requireAuth() || state.status !== "ready" || pending) return;
    const wasFollowing = state.profile.isFollowing;
    setPending(true);
    try {
      const updated = wasFollowing ? await unfollowUser(username) : await followUser(username);
      setState({ status: "ready", profile: updated });
      notify(wasFollowing ? t.profile.unfollowed(updated.user.displayName) : t.profile.followed(updated.user.displayName));
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const applyImage = async (dataUrl: string) => {
    const kind = cropping?.kind ?? "avatar";
    setCropping(null);
    if (!user) return;
    try {
      const url = await uploadProfileImage(kind, dataUrl);
      const next = await updateProfile({
        displayName: user.displayName,
        username: user.username,
        email: user.email,
        bio: user.bio,
        school: user.school,
        schoolDomain: user.schoolDomain,
        schoolCountry: user.schoolCountry,
        grade: user.grade,
        country: user.country,
        fieldOfStudy: user.fieldOfStudy,
        avatarUrl: kind === "avatar" ? url : user.avatarUrl,
        bannerUrl: kind === "banner" ? url : user.bannerUrl,
      });
      setUser(next);
      notify(t.settings.profileSaved);
      loadProfile();
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  if (state.status === "loading") {
    return (
      <div className="container-page py-6 xl:max-w-7xl">
        <LoadingState count={1} variant="block" />
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <div className="container-page max-w-3xl py-10">
        {state.status === "error" ? (
          <ErrorState onRetry={loadProfile} />
        ) : (
          <EmptyState
            icon={<UserIcon className="h-6 w-6" />}
            title={t.profile.notFoundTitle}
            body={t.profile.notFoundBody}
            action={
              <Link to="/" className="btn-primary">
                {t.notFound.action}
              </Link>
            }
          />
        )}
      </div>
    );
  }

  const { profile } = state;
  const tabs: { id: Tab; label: string; Icon: typeof UserIcon; count?: number }[] = [
    { id: "overview", label: t.profile.tabOverview, Icon: FileTextIcon },
    { id: "notes", label: t.profile.tabNotes, Icon: FileTextIcon, count: profile.stats.posts },
    ...(isOwn ? [{ id: "saved" as const, label: t.profile.tabSaved, Icon: BookmarkIcon }] : []),
    { id: "followers", label: t.profile.tabFollowers, Icon: UserIcon, count: profile.stats.followers },
    { id: "following", label: t.profile.tabFollowing, Icon: UserIcon, count: profile.stats.following },
  ];

  let content: ReactNode;
  if (listError) content = <ErrorState onRetry={loadList} />;
  else if (tab === "followers" || tab === "following") {
    content =
      people === null ? (
        <LoadingState count={2} variant="block" />
      ) : people.length === 0 ? (
        <EmptyState
          icon={<UserIcon className="h-6 w-6" />}
          title={tab === "followers" ? t.profile.emptyFollowers : t.profile.emptyFollowing}
          body={tab === "followers" ? t.profile.emptyFollowersBody : t.profile.emptyFollowingBody}
        />
      ) : (
        <UserList people={people} />
      );
  } else if (tab === "saved") {
    content =
      saved === null ? (
        <LoadingState count={2} variant="block" />
      ) : saved.length === 0 ? (
        <EmptyState icon={<BookmarkIcon className="h-6 w-6" />} title={t.profile.emptySavedTitle} body={t.profile.emptySavedBody} />
      ) : (
        <NotesList posts={saved} showAuthor />
      );
  } else if (posts === null) {
    content = <LoadingState count={2} variant="block" />;
  } else if (tab === "notes") {
    content =
      posts.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon className="h-6 w-6" />}
          title={isOwn ? t.profile.emptyOwnTitle : t.profile.emptyOtherTitle}
          body={isOwn ? t.profile.emptyOwnBody : t.profile.emptyOtherBody}
          action={
            isOwn ? (
              <Link to="/create" className="btn-primary">
                <PlusIcon className="h-4 w-4" />
                {t.nav.newNote}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <NotesList posts={posts} showAuthor={false} />
      );
  } else {
    content = <Overview posts={posts} isOwn={isOwn} name={profile.user.displayName} />;
  }

  return (
    <div className="container-page max-w-5xl space-y-5 py-6 sm:py-8">
      <ProfileHeader
        profile={profile}
        isOwn={isOwn}
        pending={pending}
        onFollowToggle={toggleFollow}
        onImage={(file, kind) => setCropping({ file, kind })}
        onTab={setTab}
      />

      <nav aria-label={t.profile.tabsLabel} className="scroll-row -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map(({ id, label, Icon, count }) => {
          const active = id === tab;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setTab(id)}
              className={`press inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${
                active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-700 hover:border-ink-400"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {count !== undefined && (
                <span className={`rounded-full px-1.5 text-xs leading-5 ${active ? "bg-white/20" : "bg-surface-hover"}`}>{formatCount(count)}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">{content}</div>

      {cropping && (
        <ImageCropper file={cropping.file} kind={cropping.kind} onCancel={() => setCropping(null)} onDone={applyImage} />
      )}
    </div>
  );
}
