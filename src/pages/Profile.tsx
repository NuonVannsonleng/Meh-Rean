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
  StarIcon,
  UserIcon,
} from "../components/Icons";
import ImageCropper from "../components/ImageCropper";
import InstitutionLogo from "../components/InstitutionLogo";
import LoadingState from "../components/LoadingState";
import NoteRow, { SubjectMark } from "../components/NoteRow";
import UserList from "../components/UserList";
import VerifiedBadge from "../components/VerifiedBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { t } from "../i18n/en";
import { errorCode, errorMessage } from "../lib/errors";
import { formatCount, formatDate } from "../lib/format";
import { normalizeText as normalizeSearch } from "../lib/institutions";
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
import { SUBJECTS, type PostView, type ProfileView, type PublicUser, type Subject } from "../types";

type Tab = "overview" | "notes" | "saved" | "followers" | "following";

type ProfileState =
  | { status: "loading" }
  | { status: "ready"; profile: ProfileView }
  | { status: "not-found" }
  | { status: "error" };

// ---- Sidebar ----

function Sidebar({
  profile,
  isOwn,
  pending,
  onFollowToggle,
  onAvatar,
  onTab,
}: {
  profile: ProfileView;
  isOwn: boolean;
  pending: boolean;
  onFollowToggle: () => void;
  onAvatar: (file: File) => void;
  onTab: (tab: Tab) => void;
}) {
  const { user, stats, isFollowing } = profile;
  const avatarInput = useRef<HTMLInputElement>(null);

  const facts: { key: string; icon: ReactNode; value: string }[] = [
    {
      key: "school",
      // A typed-in school has no logo, so InstitutionLogo shows an initial.
      icon: <InstitutionLogo name={user.school} domain={user.schoolDomain} className="h-4 w-4 rounded-sm border-0 p-0" />,
      value: user.school,
    },
    { key: "grade", icon: <GraduationIcon className="h-4 w-4" />, value: user.grade ?? "" },
    { key: "field", icon: <FileTextIcon className="h-4 w-4" />, value: user.fieldOfStudy },
    { key: "country", icon: <MapPinIcon className="h-4 w-4" />, value: user.country },
    { key: "joined", icon: <CalendarIcon className="h-4 w-4" />, value: t.profile.joined(formatDate(user.createdAt)) },
  ].filter((fact) => fact.value);

  return (
    <aside aria-label={t.profile.aboutLabel} className="min-w-0">
      <div className="flex items-center gap-4 lg:block">
        <div className="relative shrink-0 lg:mb-4">
          <Avatar user={user} size="xl" className="border-line h-20 w-20 border text-2xl sm:h-24 sm:w-24 lg:h-auto lg:w-full lg:text-7xl lg:aspect-square" />
          {isOwn && (
            <>
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                aria-label={t.settings.avatarChange}
                className="press bg-surface border-line text-ink-700 hover:text-ink-900 absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm lg:right-[8%] lg:bottom-[8%] lg:h-9 lg:w-9"
              >
                <CameraIcon className="h-4 w-4" />
              </button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onAvatar(file);
                }}
              />
            </>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-ink-900 flex items-center gap-1.5 text-xl leading-tight font-semibold sm:text-2xl">
            <span className="min-w-0 wrap-break-word">{user.displayName}</span>
            {user.verified && <VerifiedBadge className="h-5 w-5" />}
          </h1>
          <p className="text-ink-500 text-lg leading-snug font-light sm:text-xl">{user.username}</p>
        </div>
      </div>

      {user.bio && <p className="text-ink-900 mt-4 text-[15px] whitespace-pre-line">{user.bio}</p>}

      <div className="mt-4 flex gap-2">
        {isOwn ? (
          <Link to="/settings" className="btn-secondary w-full">
            {t.profile.edit}
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={onFollowToggle}
              disabled={pending}
              aria-pressed={isFollowing}
              className="btn-secondary flex-1"
            >
              {isFollowing ? t.profile.unfollow : t.profile.follow}
            </button>
            <Link to={`/messages/${user.username}`} aria-label={`${t.profile.message} ${user.displayName}`} className="btn-secondary flex-1">
              <ChatIcon className="h-4 w-4" />
              {t.profile.message}
            </Link>
          </>
        )}
      </div>

      <p className="text-ink-500 mt-4 flex flex-wrap items-center gap-x-1 text-sm">
        <UserIcon className="h-4 w-4" />
        <button type="button" onClick={() => onTab("followers")} className="hover:text-ribbon-fg">
          <strong className="text-ink-900">{formatCount(stats.followers)}</strong> {t.profile.followersWord(stats.followers)}
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => onTab("following")} className="hover:text-ribbon-fg">
          <strong className="text-ink-900">{formatCount(stats.following)}</strong> {t.profile.followingWord}
        </button>
      </p>

      <ul className="border-line text-ink-700 mt-4 space-y-2 border-t pt-4 text-sm">
        {facts.map(({ key, icon, value }) => (
          <li key={key} className="flex items-center gap-2">
            <span className="text-ink-500 flex w-4 shrink-0 justify-center">{icon}</span>
            <span className="min-w-0 wrap-break-word">{value}</span>
          </li>
        ))}
      </ul>

      <dl className="border-line mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center">
        {[
          { label: t.profile.notesStat, value: formatCount(stats.posts) },
          { label: t.profile.starsStat, value: formatCount(stats.reactions) },
          { label: t.profile.rating, value: stats.averageRating ? stats.averageRating.toFixed(1) : t.profile.noRating },
        ].map((item) => (
          <div key={item.label}>
            <dd className="text-ink-900 text-base font-semibold">{item.value}</dd>
            <dt className="text-ink-500 text-xs">{item.label}</dt>
          </div>
        ))}
      </dl>
    </aside>
  );
}

// ---- Overview ----

function PinnedNote({ post }: { post: PostView }) {
  return (
    <li className="card flex flex-col p-4">
      <p className="flex items-center gap-2">
        <FileTextIcon className="text-ink-500 h-4 w-4 shrink-0" />
        <Link to={`/post/${post.id}`} className="text-ribbon-fg min-w-0 truncate text-sm font-semibold hover:underline">
          {post.title}
        </Link>
      </p>
      <p className="text-ink-500 mt-2 line-clamp-2 flex-1 text-xs">{post.body || t.note.noDescription}</p>
      <p className="text-ink-500 mt-3 flex items-center gap-4 text-xs">
        <SubjectMark subject={post.subject} />
        {post.reactions.total > 0 && (
          <span className="inline-flex items-center gap-1">
            <StarIcon className="h-3.5 w-3.5" />
            {formatCount(post.reactions.total)}
          </span>
        )}
      </p>
    </li>
  );
}

function Overview({ posts, isOwn, name }: { posts: PostView[]; isOwn: boolean; name: string }) {
  // The most useful notes first, as judged by stars and then discussion.
  const pinned = [...posts]
    .sort((a, b) => b.reactions.total - a.reactions.total || b.commentCount - a.commentCount)
    .slice(0, 6);
  return (
    <div className="space-y-8">
      <section aria-labelledby="pinned-title">
        <h2 id="pinned-title" className="text-ink-900 mb-2 text-base font-normal">
          {t.profile.popular}
        </h2>
        {pinned.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {pinned.map((post) => (
              <PinnedNote key={post.id} post={post} />
            ))}
          </ul>
        ) : (
          <div className="card text-ink-500 px-4 py-8 text-center text-sm">
            {isOwn ? (
              <>
                <p>{t.profile.emptyOwnBody}</p>
                <Link to="/create" className="btn-primary mt-3">
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
      <ContributionGraph dates={posts.map((post) => post.createdAt)} />
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
        (subject === "all" || post.subject === subject) &&
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

  const used = SUBJECTS.filter((value) => posts.some((post) => post.subject === value));

  return (
    <div>
      <div className="border-line flex flex-wrap items-center gap-2 border-b pb-4">
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
          <option value="stars">{t.profile.sortStars}</option>
          <option value="name">{t.profile.sortName}</option>
        </select>
      </div>
      {shown.length ? (
        <ul>
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
  const [cropping, setCropping] = useState<File | null>(null);

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

  const applyAvatar = async (dataUrl: string) => {
    setCropping(null);
    if (!user) return;
    try {
      const url = await uploadProfileImage("avatar", dataUrl);
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
        avatarUrl: url,
        bannerUrl: user.bannerUrl,
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
    <div>
      {/* Tabs run across the top, as on a code host's profile page. */}
      <nav aria-label={t.profile.tabsLabel} className="border-line bg-surface sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b">
        <div className="container-page flex gap-1 overflow-x-auto xl:max-w-7xl lg:pl-[calc(2rem+18rem+2rem)]">
          {tabs.map(({ id, label, Icon, count }) => {
            const active = id === tab;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(id)}
                className={`-mb-px flex h-12 shrink-0 items-center gap-2 border-b-2 px-2.5 text-sm ${
                  active ? "border-rule text-ink-900 font-semibold" : "text-ink-700 hover:border-line border-transparent"
                }`}
              >
                <Icon className="text-ink-500 h-4 w-4" />
                {label}
                {count !== undefined && <span className="counter">{formatCount(count)}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="container-page grid gap-8 py-6 lg:grid-cols-[18rem_minmax(0,1fr)] xl:max-w-7xl">
        <Sidebar
          profile={profile}
          isOwn={isOwn}
          pending={pending}
          onFollowToggle={toggleFollow}
          onAvatar={setCropping}
          onTab={setTab}
        />
        <div className="min-w-0">{content}</div>
      </div>

      {cropping && <ImageCropper file={cropping} kind="avatar" onCancel={() => setCropping(null)} onDone={applyAvatar} />}
    </div>
  );
}
