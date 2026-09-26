import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import {
  BookmarkIcon,
  CalendarIcon,
  CameraIcon,
  ChatIcon,
  CheckIcon,
  FileTextIcon,
  GraduationIcon,
  MapPinIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
} from "../components/Icons";
import ImageCropper from "../components/ImageCropper";
import InstitutionLogo from "../components/InstitutionLogo";
import LoadingState from "../components/LoadingState";
import PostCard from "../components/PostCard";
import UserList from "../components/UserList";
import VerifiedBadge from "../components/VerifiedBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { t } from "../i18n/en";
import { errorCode, errorMessage } from "../lib/errors";
import { formatCount, formatDate } from "../lib/format";
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
import type { PostView, ProfileImageKind, ProfileView, PublicUser } from "../types";

type Tab = "posts" | "saved" | "followers" | "following";

type ProfileState =
  | { status: "loading" }
  | { status: "ready"; profile: ProfileView }
  | { status: "not-found" }
  | { status: "error" };

function ProfileHeader({
  profile,
  isOwn,
  onFollowToggle,
  onImage,
  pending,
  tab,
  onTab,
}: {
  profile: ProfileView;
  isOwn: boolean;
  onFollowToggle: () => void;
  onImage: (file: File, kind: ProfileImageKind) => void;
  pending: boolean;
  tab: Tab;
  onTab: (tab: Tab) => void;
}) {
  const { user, stats, isFollowing } = profile;
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const facts: { key: string; icon: ReactNode; value: string }[] = [
    {
      key: "school",
      // InstitutionLogo falls back to an initial tile, so a school typed in by
      // hand still gets a mark next to its name.
      icon: <InstitutionLogo name={user.school} domain={user.schoolDomain} className="h-5 w-5" />,
      value: user.school,
    },
    { key: "grade", icon: <GraduationIcon className="h-4 w-4" />, value: user.grade ?? "" },
    { key: "field", icon: <FileTextIcon className="h-4 w-4" />, value: user.fieldOfStudy },
    { key: "country", icon: <MapPinIcon className="h-4 w-4" />, value: user.country },
    {
      key: "joined",
      icon: <CalendarIcon className="h-4 w-4" />,
      value: t.profile.joined(formatDate(user.createdAt)),
    },
  ].filter((fact) => fact.value);

  const counts: { label: string; value: string; tab?: Tab }[] = [
    { label: t.profile.posts, value: formatCount(stats.posts) },
    { label: t.profile.followers, value: formatCount(stats.followers), tab: "followers" },
    { label: t.profile.followingLabel, value: formatCount(stats.following), tab: "following" },
    { label: t.profile.rating, value: stats.averageRating ? stats.averageRating.toFixed(1) : t.profile.noRating },
  ];

  return (
    <section className="card animate-rise overflow-hidden">
      {/* Banner */}
      <div className="relative h-28 sm:h-44">
        {user.bannerUrl ? (
          <img src={user.bannerUrl} alt={t.profile.bannerAlt(user.displayName)} className="h-full w-full object-cover" />
        ) : (
          <div className="bg-brand-50 ruled-paper h-full w-full" aria-hidden="true">
            <span className="bg-logo-ribbon animate-ribbon absolute top-0 right-6 h-14 w-5 [clip-path:polygon(0_0,100%_0,100%_100%,50%_80%,0_100%)] sm:right-10 sm:h-20 sm:w-7" />
          </div>
        )}
        {isOwn && (
          <button
            type="button"
            onClick={() => bannerInput.current?.click()}
            className="press bg-surface/90 text-ink-900 hover:bg-surface absolute top-3 right-3 flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold shadow-sm backdrop-blur"
          >
            <CameraIcon className="h-4 w-4" />
            {t.profile.changeBanner}
          </button>
        )}
      </div>

      <div className="px-4 pb-5 sm:px-6">
        <div className="relative z-10 -mt-12 flex items-end justify-between gap-3 sm:-mt-14">
          <div className="relative">
            <Avatar user={user} size="xl" className="ring-surface ring-4" />
            {isOwn && (
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                aria-label={t.settings.avatarChange}
                className="press bg-surface border-line text-ink-700 hover:text-ink-900 absolute right-0 bottom-0 flex h-9 w-9 items-center justify-center rounded-full border shadow-sm"
              >
                <CameraIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 gap-2">
            {isOwn ? (
              <Link to="/settings" className="btn-secondary h-10">
                <SettingsIcon className="h-4 w-4" />
                {t.profile.edit}
              </Link>
            ) : (
              <>
                <Link
                  to={`/messages/${user.username}`}
                  aria-label={`${t.profile.message} ${user.displayName}`}
                  className="btn-secondary h-10 px-3 sm:px-4"
                >
                  <ChatIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.profile.message}</span>
                </Link>
                <button
                  type="button"
                  onClick={onFollowToggle}
                  disabled={pending}
                  aria-pressed={isFollowing}
                  className={isFollowing ? "btn-secondary h-10 min-w-28" : "btn-primary h-10 min-w-28"}
                >
                  {isFollowing ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                  {isFollowing ? t.profile.following : t.profile.follow}
                </button>
              </>
            )}
          </div>
        </div>

        <h1 className="text-ink-900 mt-3 flex items-center gap-2 text-2xl font-display font-extrabold tracking-tight">
          <span className="min-w-0 break-words">{user.displayName}</span>
          {user.verified && <VerifiedBadge className="h-5 w-5" />}
        </h1>
        <p className="text-ink-500">@{user.username}</p>
        {user.bio && <p className="text-ink-700 mt-3 max-w-2xl whitespace-pre-line">{user.bio}</p>}

        <ul className="text-ink-500 mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {facts.map(({ key, icon, value }) => (
            <li key={key} className="flex items-center gap-1.5">
              {icon}
              {value}
            </li>
          ))}
        </ul>

        <dl className="border-line mt-5 grid grid-cols-2 gap-y-3 border-t pt-4 text-center sm:max-w-lg sm:grid-cols-4 sm:text-left">
          {counts.map((item) =>
            item.tab ? (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => onTab(item.tab as Tab)}
                  className="press hover:text-accent rounded-lg px-1 py-0.5"
                >
                  <dt className="text-ink-500 text-xs font-medium sm:text-sm">{item.label}</dt>
                  <dd className="text-ink-900 text-lg font-bold">{item.value}</dd>
                </button>
              </div>
            ) : (
              <div key={item.label} className="px-1 py-0.5">
                <dt className="text-ink-500 text-xs font-medium sm:text-sm">{item.label}</dt>
                <dd className="text-ink-900 text-lg font-bold">{item.value}</dd>
              </div>
            ),
          )}
        </dl>
      </div>

      {isOwn && (
        <>
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
              if (file) onImage(file, "avatar");
            }}
          />
          <input
            ref={bannerInput}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onImage(file, "banner");
            }}
          />
        </>
      )}
      {/* `tab` keeps the header in sync with the list below */}
      <span className="sr-only">{tab}</span>
    </section>
  );
}

export default function Profile() {
  const { username = "" } = useParams<{ username: string }>();
  const [params, setParams] = useSearchParams();
  const { user, setUser } = useAuth();
  const { notify } = useToast();
  const requireAuth = useRequireAuth();
  const isOwn = user?.username === username.toLowerCase();

  const requested = params.get("tab");
  const tab: Tab =
    requested === "followers" || requested === "following" || (requested === "saved" && isOwn)
      ? (requested as Tab)
      : "posts";

  const [state, setState] = useState<ProfileState>({ status: "loading" });
  const [posts, setPosts] = useState<PostView[] | null>(null);
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
    setPosts(null);
    setPeople(null);
    setListError(false);
    try {
      if (tab === "followers") setPeople(await getFollowers(username));
      else if (tab === "following") setPeople(await getFollowing(username));
      else setPosts(await getFeed(tab === "saved" ? { savedOnly: true } : { authorUsername: username }));
    } catch {
      setListError(true);
    }
  }, [tab, username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, user]);

  useEffect(() => {
    loadList();
  }, [loadList, user?.id]);

  const setTab = (next: Tab) => setParams(next === "posts" ? {} : { tab: next }, { replace: true });

  const toggleFollow = async () => {
    if (!requireAuth() || state.status !== "ready" || pending) return;
    const wasFollowing = state.profile.isFollowing;
    setPending(true);
    try {
      const updated = wasFollowing ? await unfollowUser(username) : await followUser(username);
      setState({ status: "ready", profile: updated });
      notify(
        wasFollowing
          ? t.profile.unfollowed(updated.user.displayName)
          : t.profile.followed(updated.user.displayName),
      );
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
      <div className="container-page max-w-3xl py-6 sm:py-10">
        <LoadingState count={1} variant="block" />
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <div className="container-page max-w-3xl py-6 sm:py-10">
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "posts", label: t.profile.tabPosts },
    ...(isOwn ? [{ id: "saved" as const, label: t.profile.tabSaved }] : []),
    { id: "followers", label: t.profile.tabFollowers },
    { id: "following", label: t.profile.tabFollowing },
  ];

  const emptyFor = (): { title: string; body: string; icon: React.ReactNode } => {
    if (tab === "saved")
      return { title: t.profile.emptySavedTitle, body: t.profile.emptySavedBody, icon: <BookmarkIcon className="h-6 w-6" /> };
    if (tab === "followers")
      return { title: t.profile.emptyFollowers, body: t.profile.emptyFollowersBody, icon: <UserIcon className="h-6 w-6" /> };
    if (tab === "following")
      return { title: t.profile.emptyFollowing, body: t.profile.emptyFollowingBody, icon: <UserIcon className="h-6 w-6" /> };
    return isOwn
      ? { title: t.profile.emptyOwnTitle, body: t.profile.emptyOwnBody, icon: <FileTextIcon className="h-6 w-6" /> }
      : { title: t.profile.emptyOtherTitle, body: t.profile.emptyOtherBody, icon: <FileTextIcon className="h-6 w-6" /> };
  };

  const empty = emptyFor();
  const showingPeople = tab === "followers" || tab === "following";
  const list = showingPeople ? people : posts;

  return (
    <div className="container-page max-w-3xl space-y-5 py-6 sm:py-10">
      <ProfileHeader
        profile={state.profile}
        isOwn={isOwn}
        pending={pending}
        onFollowToggle={toggleFollow}
        onImage={(file, kind) => setCropping({ file, kind })}
        tab={tab}
        onTab={setTab}
      />

      {cropping && (
        <ImageCropper
          file={cropping.file}
          kind={cropping.kind}
          onCancel={() => setCropping(null)}
          onDone={applyImage}
        />
      )}

      <nav aria-label={t.profile.tabsLabel} className="border-line flex gap-1 overflow-x-auto border-b">
        {tabs.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setTab(item.id)}
              className={`press relative h-11 shrink-0 px-4 text-sm font-semibold ${
                active ? "text-accent" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {item.label}
              {active && <span className="bg-brand-600 animate-fade absolute inset-x-2 -bottom-px h-0.5 rounded-full" />}
            </button>
          );
        })}
      </nav>

      {listError ? (
        <ErrorState onRetry={loadList} />
      ) : list === null ? (
        <LoadingState count={2} variant={showingPeople ? "block" : "post"} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          body={empty.body}
          action={
            isOwn && tab === "posts" ? (
              <Link to="/create" className="btn-primary">
                <PlusIcon className="h-4 w-4" />
                {t.feed.composerAction}
              </Link>
            ) : undefined
          }
        />
      ) : showingPeople ? (
        <UserList people={people ?? []} />
      ) : (
        <div className="space-y-4">
          {(posts ?? []).map((post, index) => (
            <PostCard
              key={`${post.id}-${user?.id ?? "guest"}`}
              post={post}
              index={index}
              onChange={(next) => {
                if (tab === "saved" && !next.saved) {
                  setPosts((current) => current?.filter((item) => item.id !== next.id) ?? null);
                }
              }}
              onDeleted={(id) => {
                setPosts((current) => current?.filter((item) => item.id !== id) ?? null);
                loadProfile();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
