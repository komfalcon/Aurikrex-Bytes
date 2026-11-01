import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BookOpen, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  FEED_VIEW_MODE_KEY,
  FeedViewMode,
  FeedViewModeControl,
  getInitialFeedViewMode,
  getReadPostIds,
  PostCard,
  PublicLayout,
} from "./SharedLayout";

const DEFAULT_CATEGORIES = ["Tech", "AI", "Science", "Innovation", "Crypto"];

export function Archive() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [page, setPage] = useState(1);
  const [accumulatedPosts, setAccumulatedPosts] = useState<any[]>([]);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [localReadIds, setLocalReadIds] = useState<Set<number>>(() => getReadPostIds());

  const session = trpc.reader.session.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const savePreference = trpc.reader.setFeedPreference.useMutation();
  const markPostRead = trpc.reader.markPostRead.useMutation({
    onSuccess: () => {
      void utils.reader.dashboard.invalidate();
      void utils.publicPosts.archive.invalidate();
    },
  });
  const [viewMode, setViewMode] = useState<FeedViewMode>(getInitialFeedViewMode);
  const effectiveViewMode: FeedViewMode = viewMode;

  const changeViewMode = (mode: FeedViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(FEED_VIEW_MODE_KEY, mode);
    if (session.data) {
      savePreference.mutate({ feedViewMode: mode, onboardingCompleted: true });
    }
  };

  const facetsQuery = trpc.publicPosts.archiveFacets.useQuery();
  const categories = useMemo(() => {
    const fromDb = facetsQuery.data?.categories ?? [];
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromDb]));
  }, [facetsQuery.data?.categories]);

  const archive = trpc.publicPosts.archive.useQuery({
    query,
    page,
    pageSize: 12,
    category: selectedCategory || undefined,
  });

  useEffect(() => {
    if (!archive.data?.posts) return;
    if (page === 1) {
      setAccumulatedPosts(archive.data.posts);
    } else {
      setAccumulatedPosts(prev => {
        const seen = new Set(prev.map((p: any) => p.id));
        const incoming = archive.data.posts.filter((p: any) => !seen.has(p.id));
        return [...prev, ...incoming];
      });
    }
  }, [archive.data?.posts, page]);

  const resetPagination = () => {
    setPage(1);
    setAccumulatedPosts([]);
  };

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    resetPagination();
  };

  const updateCategory = (nextCat: string) => {
    setSelectedCategory(prev => (prev === nextCat ? "" : nextCat));
    resetPagination();
  };

  const clearAllFilters = () => {
    setQuery("");
    setSelectedCategory("");
    resetPagination();
  };

  const nextPage = archive.data?.nextPage ?? null;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || nextPage === null || archive.isFetching) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !archive.isFetching && nextPage !== null) {
          setPage(nextPage);
        }
      },
      { rootMargin: "380px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextPage, archive.isFetching]);

  const displayPosts = accumulatedPosts.length > 0 ? accumulatedPosts : (archive.data?.posts ?? []);
  const hasActiveFilters = Boolean(query.trim() || selectedCategory);

  return (
    <PublicLayout
      seo={{
        title: "The Library · Past Editions — Aurikrex Bytes Archive",
        description:
          "Browse and search the complete library of past Aurikrex Bytes editions by category or keyword.",
        path: "/archive",
      }}
    >
      <main className="container page-main">
        <div className="page-intro archive-library-intro">
          <span className="eyebrow">
            <BookOpen size={13} /> The Library · Past Editions
          </span>
          <h1>Archive Library</h1>
          <p>
            This is the full searchable library of past Bytes — not today’s finite morning drop.{" "}
            {session.data ? (
              <Link href="/dashboard" className="inline-link">
                Return to Today&apos;s Drop <ArrowRight size={14} />
              </Link>
            ) : null}
          </p>
        </div>

        <div className="search-wrap">
          <Search size={18} />
          <input
            value={query}
            onChange={e => updateQuery(e.target.value)}
            placeholder="Search headlines, technologies, or publishers..."
            aria-label="Search the archive"
          />
          {query && (
            <button onClick={() => updateQuery("")} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="archive-facets-bar">
          <div className="brand-filter-chips" role="group" aria-label="Filter by category">
            <button
              type="button"
              className={`brand-chip ${!selectedCategory ? "active" : ""}`}
              onClick={() => {
                setSelectedCategory("");
                resetPagination();
              }}
            >
              All Categories
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                className={`brand-chip ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => updateCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="archive-view-toggle">
          <FeedViewModeControl value={viewMode} onChange={changeViewMode} />
        </div>

        {hasActiveFilters && (
          <div className="search-results-info">
            <span>
              Filtering library
              {selectedCategory ? <> · Category: <strong>{selectedCategory}</strong></> : null}
              {query ? <> · Query: <strong>&ldquo;{query}&rdquo;</strong></> : null}
            </span>
            <button className="text-button" onClick={clearAllFilters}>
              Clear filters
            </button>
          </div>
        )}

        {archive.isLoading && page === 1 && displayPosts.length === 0 ? (
          <div className={`skeleton-grid skeleton-grid-${effectiveViewMode}`}>
            <div />
            <div />
            <div />
          </div>
        ) : displayPosts.length ? (
          <>
            <div className={`post-grid post-grid-${effectiveViewMode} archive-grid archive-view-${effectiveViewMode}`}>
              {displayPosts.map((post: any) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isRead={Boolean(post.isRead || localReadIds.has(post.id))}
                  onMarkRead={postId => {
                    setLocalReadIds(prev => new Set(prev).add(postId));
                    if (session.data) {
                      markPostRead.mutate({ postId, timeZone: "Africa/Lagos" });
                    }
                  }}
                />
              ))}
            </div>
            <div ref={loadMoreRef} className="px-infinite-scroll-status" aria-live="polite">
              {archive.isFetching && page > 1 ? (
                <span className="px-infinite-loading-pill">
                  <span className="px-infinite-dot" />
                  <span>Loading more past Bytes…</span>
                </span>
              ) : nextPage !== null ? (
                <span className="px-infinite-loading-pill">
                  <span className="px-infinite-dot" />
                  <span>Scroll for older editions in the library</span>
                </span>
              ) : (
                <span className="px-infinite-end-label">
                  All {displayPosts.length} archived Bytes loaded
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Search size={24} />
            <h2>No stories found matching your filter</h2>
            <p>Try clearing a category filter, or searching for another term.</p>
            {hasActiveFilters && (
              <button className="button button-outline" onClick={clearAllFilters}>
                Clear filters &amp; view full library
              </button>
            )}
          </div>
        )}
      </main>
    </PublicLayout>
  );
}
