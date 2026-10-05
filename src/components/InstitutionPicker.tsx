import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { t } from "../i18n/en";
import {
  guessSchoolCountry,
  loadInstitutions,
  loadSchoolCountries,
  loadSchools,
  normalizeText,
  rememberSchoolCountry,
  searchInstitutions,
  type InstitutionData,
  type InstitutionSelection,
  type SchoolCountry,
} from "../lib/institutions";
import { searchSuggestions } from "../services/api";
import { INSTITUTION_KINDS, type InstitutionKind, type SchoolSummary } from "../types";
import { describedBy, FieldShell, TextField } from "./FormField";
import { ChevronDownIcon, CloseIcon, GraduationIcon, SearchIcon } from "./Icons";
import InstitutionLogo from "./InstitutionLogo";
import RadioGroup from "./RadioGroup";

interface ManualFormProps {
  countries: string[];
  initialKind: InstitutionKind;
  initialCountry: string;
  onBack: () => void;
  onDone: (selection: InstitutionSelection) => void;
}

/** For a school that is not in any list: typed in, with its country and kind. */
function ManualForm({ countries, initialKind, initialCountry, onBack, onDone }: ManualFormProps) {
  const countryId = useId();
  const kindName = useId();
  const [name, setName] = useState("");
  const [country, setCountry] = useState(countries.includes(initialCountry) ? initialCountry : "");
  const [kind, setKind] = useState<InstitutionKind>(initialKind);
  const [errors, setErrors] = useState<{ name?: string; country?: string }>({});

  const submit = () => {
    const found = {
      name: name.trim() ? undefined : t.institution.manualNameRequired,
      country: country.trim() ? undefined : t.institution.manualCountryRequired,
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    onDone({ name: name.trim(), domain: null, country: country.trim(), kind });
  };

  return (
    // A plain block, not a form: the picker itself sits inside the sign-up and
    // settings forms, and forms cannot be nested.
    <div className="space-y-5 px-4 py-4 sm:px-5">
      <TextField
        label={t.institution.manualNameLabel}
        value={name}
        onChange={(value) => {
          setName(value);
          setErrors((current) => ({ ...current, name: undefined }));
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          submit();
        }}
        placeholder={t.institution.manualNamePlaceholder}
        error={errors.name}
        autoFocus
      />
      {countries.length ? (
        <FieldShell id={countryId} label={t.institution.manualCountryLabel} error={errors.country}>
          <select
            id={countryId}
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setErrors((current) => ({ ...current, country: undefined }));
            }}
            aria-invalid={errors.country ? true : undefined}
            aria-describedby={describedBy(countryId, errors.country)}
            className="input cursor-pointer"
          >
            <option value="" disabled>
              {t.institution.manualCountryPlaceholder}
            </option>
            {countries.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </FieldShell>
      ) : (
        // The country list comes from the same file as the schools, so if that
        // download failed the country is typed in instead.
        <TextField
          label={t.institution.manualCountryLabel}
          value={country}
          onChange={(value) => {
            setCountry(value);
            setErrors((current) => ({ ...current, country: undefined }));
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            submit();
          }}
          placeholder={t.institution.manualCountryTypePlaceholder}
          autoComplete="country-name"
          error={errors.country}
        />
      )}
      <RadioGroup
        name={kindName}
        legend={t.institution.manualKindLabel}
        options={INSTITUTION_KINDS.map((value) => ({ value, label: t.institution.kinds[value] }))}
        value={kind}
        onChange={setKind}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onBack} className="btn-secondary">
          {t.institution.manualBack}
        </button>
        <button type="button" onClick={submit} className="btn-primary">
          {t.institution.manualSave}
        </button>
      </div>
    </div>
  );
}

interface DialogProps {
  initialKind: InstitutionKind;
  onClose: () => void;
  onSelect: (selection: InstitutionSelection) => void;
}

/** A row in the results: a listed school, or one other students typed in. */
interface Choice {
  key: string;
  name: string;
  detail: string;
  domain: string | null;
  country: string;
  community: boolean;
}

function InstitutionDialog({ initialKind, onClose, onSelect }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const countryId = useId();

  const [kind, setKind] = useState<InstitutionKind>(initialKind);
  const [universities, setUniversities] = useState<InstitutionData | null>(null);
  const [universitiesFailed, setUniversitiesFailed] = useState(false);
  const [schoolCountries, setSchoolCountries] = useState<SchoolCountry[] | null>(null);
  const [country, setCountry] = useState<SchoolCountry | null>(null);
  const [schools, setSchools] = useState<{ code: string; data: InstitutionData } | null>(null);
  const [schoolsFailed, setSchoolsFailed] = useState(false);
  const [community, setCommunity] = useState<SchoolSummary[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    inputRef.current?.focus();

    let live = true;
    loadInstitutions()
      .then((loaded) => live && setUniversities(loaded))
      .catch(() => live && setUniversitiesFailed(true));
    loadSchoolCountries()
      .then((loaded) => {
        if (!live) return;
        setSchoolCountries(loaded);
        setCountry((current) => current ?? guessSchoolCountry(loaded));
      })
      .catch(() => live && setSchoolsFailed(true));
    return () => {
      live = false;
    };
  }, []);

  // One country's high schools at a time.
  useEffect(() => {
    if (kind !== "high-school" || !country || schools?.code === country.code) return;
    let live = true;
    setSchoolsFailed(false);
    loadSchools(country)
      .then((data) => live && setSchools({ code: country.code, data }))
      .catch(() => live && setSchoolsFailed(true));
    return () => {
      live = false;
    };
  }, [kind, country, schools?.code]);

  const highSchool = kind === "high-school";
  const data = highSchool ? (schools?.code === country?.code ? schools?.data : null) : universities;
  const failed = highSchool ? schoolsFailed : universitiesFailed;
  const trimmed = query.trim();
  const { matches, total } = useMemo(
    () => (data && trimmed ? searchInstitutions(data, trimmed) : { matches: [], total: 0 }),
    [data, trimmed],
  );

  // Schools other students typed in by hand, so the list grows with use.
  useEffect(() => {
    setCommunity([]);
    if (!highSchool || !country || trimmed.length < 2) return;
    let live = true;
    const timer = window.setTimeout(() => {
      searchSuggestions(trimmed, "schools", t.subjects)
        .then((result) => live && setCommunity(result.schools.filter((school) => school.country === country.name)))
        .catch(() => {});
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [highSchool, country, trimmed]);

  const choices: Choice[] = useMemo(() => {
    const listed = matches.map((item) => ({
      key: `${item.domain}-${item.name}-${item.place ?? ""}`,
      name: item.name,
      detail: highSchool ? [item.otherName, item.place].filter(Boolean).join(" · ") || item.country : item.country,
      domain: item.domain || null,
      country: item.country,
      community: false,
    }));
    const known = new Set(listed.map((item) => normalizeText(item.name)));
    const added = community
      .filter((school) => !known.has(normalizeText(school.name)))
      .slice(0, 8)
      .map((school) => ({
        key: `community-${school.name}`,
        name: school.name,
        detail: t.institution.studentCount(school.students),
        domain: null,
        country: school.country,
        community: true,
      }));
    return [...listed, ...added];
  }, [matches, community, highSchool]);

  useEffect(() => setActive(0), [trimmed, kind, country?.code]);

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const choose = (selection: InstitutionSelection) => {
    onSelect(selection);
    dialogRef.current?.close();
  };

  const pick = (choice: Choice) => choose({ name: choice.name, domain: choice.domain, country: choice.country, kind });

  const switchKind = (next: InstitutionKind) => {
    setKind(next);
    inputRef.current?.focus();
  };

  // The "not listed" row sits after the matches, so it is always reachable.
  const optionCount = choices.length + 1;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter always stops here: the picker is used inside the sign-up and
    // settings forms, which must not submit from the dialog.
    if (event.key === "Enter") {
      event.preventDefault();
      if (!data) return;
      const choice = choices[active];
      if (choice) pick(choice);
      else setManual(true);
      return;
    }
    if (!data) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % optionCount);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + optionCount) % optionCount);
    }
  };

  const firstCommunity = choices.findIndex((choice) => choice.community);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={t.institution.dialogTitle}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-ink-900/25 backdrop:backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="bg-surface animate-page flex h-full flex-col pt-[env(safe-area-inset-top)] sm:mx-auto sm:mt-16 sm:h-auto sm:max-h-[min(40rem,calc(100dvh-6rem))] sm:w-[min(36rem,calc(100vw-2rem))] sm:rounded-md sm:border sm:border-line sm:pt-0 sm:shadow-2xl [@media(max-height:500px)]:sm:mt-3 [@media(max-height:500px)]:sm:max-h-[calc(100dvh-1.5rem)]">
        <div className="border-line flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4">
          {manual ? (
            <h2 className="text-ink-900 flex-1 truncate text-base font-semibold">{t.institution.manualTitle}</h2>
          ) : (
            <>
              <SearchIcon className="text-ink-400 h-5 w-5" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={data !== null}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={data ? `${listId}-${active}` : undefined}
                aria-label={highSchool ? t.institution.searchSchoolsLabel : t.institution.searchLabel}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={
                  highSchool
                    ? t.institution.searchSchoolsPlaceholder(country?.name ?? "")
                    : t.institution.searchUniversitiesPlaceholder
                }
                autoComplete="off"
                enterKeyHint="search"
                className="text-ink-900 placeholder:text-ink-400 h-10 min-w-0 flex-1 bg-transparent text-base outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t.institution.clear}
                  className="icon-btn animate-pop h-8 w-8"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t.institution.close}
            className="text-ink-700 hover:bg-surface-hover press rounded-lg px-2.5 py-1.5 text-sm font-medium"
          >
            <span aria-hidden="true" className="sm:hidden">
              {t.common.cancel}
            </span>
            <kbd aria-hidden="true" className="border-line text-ink-500 hidden rounded-md border px-1.5 py-0.5 text-xs font-medium sm:inline">
              Esc
            </kbd>
          </button>
        </div>

        {!manual && (
          <div className="border-line flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4">
            <div role="radiogroup" aria-label={t.institution.kindLabel} className="bg-surface-hover flex rounded-md p-0.5">
              {(["high-school", "university"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => switchKind(value)}
                  className={`press h-8 rounded-[10px] px-3 text-sm font-semibold ${
                    kind === value ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {t.institution.kinds[value]}
                </button>
              ))}
            </div>
            {highSchool && schoolCountries && (
              <>
                <label htmlFor={countryId} className="sr-only">
                  {t.institution.countryLabel}
                </label>
                <select
                  id={countryId}
                  value={country?.code ?? ""}
                  onChange={(event) => {
                    const next = schoolCountries.find((item) => item.code === event.target.value) ?? null;
                    setCountry(next);
                    if (next) rememberSchoolCountry(next.code);
                    inputRef.current?.focus();
                  }}
                  className="border-line bg-surface text-ink-900 h-9 min-w-0 flex-1 cursor-pointer rounded-md border px-2.5 text-sm sm:max-w-64"
                >
                  {schoolCountries.map((item) => (
                    <option key={item.code} value={item.code}>
                      {t.institution.countryOption(item.name, item.count)}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {manual ? (
            <ManualForm
              countries={universities?.countries ?? schoolCountries?.map((item) => item.name).sort() ?? []}
              initialKind={kind}
              initialCountry={highSchool ? (country?.name ?? "") : ""}
              onBack={() => setManual(false)}
              onDone={choose}
            />
          ) : (
            <div className="px-2 pt-2 pb-3 sm:px-2.5">
              {failed && (
                <div className="px-3 py-4">
                  <p role="alert" className="text-ink-500 text-sm">
                    {t.institution.loadError}
                  </p>
                  {/* A school is required, so hand-entry stays open. */}
                  <button type="button" onClick={() => setManual(true)} className="btn-secondary mt-3">
                    {t.institution.notListed}
                  </button>
                </div>
              )}
              {!failed && !data && (
                <p role="status" className="text-ink-500 px-3 py-4 text-sm">
                  {highSchool ? t.institution.loadingSchools : t.institution.loading}
                </p>
              )}
              {data && (
                <>
                  {trimmed ? (
                    <p role="status" className="text-ink-500 px-3 pt-1 pb-2 text-xs">
                      {total ? t.institution.resultCount(matches.length, total) : t.institution.noResults(trimmed)}
                    </p>
                  ) : (
                    <p className="text-ink-500 px-3 pt-2 pb-3 text-sm">
                      {highSchool ? t.institution.startTypingSchool(country?.name ?? "") : t.institution.startTyping}
                    </p>
                  )}
                  <ul id={listId} role="listbox" aria-label={t.institution.searchLabel} className="space-y-0.5">
                    {choices.map((choice, index) => (
                      <li key={choice.key} role="presentation">
                        {index === firstCommunity && (
                          <p role="presentation" className="text-ink-500 px-3 pt-3 pb-1 text-xs font-semibold">
                            {t.institution.addedByStudents}
                          </p>
                        )}
                        <div
                          id={`${listId}-${index}`}
                          role="option"
                          aria-selected={index === active}
                          onPointerMove={() => setActive(index)}
                          onClick={() => pick(choice)}
                          style={{ animationDelay: `${Math.min(index, 8) * 18}ms` }}
                          className={`animate-fade flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors duration-100 ${
                            index === active ? "bg-surface-hover" : ""
                          }`}
                        >
                          <InstitutionLogo name={choice.name} domain={choice.domain} className="h-8 w-8" />
                          <span className="min-w-0">
                            <span className="text-ink-700 block truncate text-sm">{choice.name}</span>
                            <span className="text-ink-500 block truncate text-xs">{choice.detail}</span>
                          </span>
                        </div>
                      </li>
                    ))}
                    <li role="presentation">
                      <div
                        id={`${listId}-${choices.length}`}
                        role="option"
                        aria-selected={active === choices.length}
                        onPointerMove={() => setActive(choices.length)}
                        onClick={() => setManual(true)}
                        className={`flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors duration-100 ${
                          active === choices.length ? "bg-surface-hover" : ""
                        }`}
                      >
                        <span className="bg-brand-50 text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                          <GraduationIcon className="h-4.5 w-4.5" />
                        </span>
                        <span className="text-accent truncate text-sm font-semibold">{t.institution.notListed}</span>
                      </div>
                    </li>
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {!manual && (
          <p className="border-line text-ink-400 flex shrink-0 flex-wrap justify-between gap-x-4 gap-y-1 border-t px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs [@media(max-height:500px)]:hidden">
            <span className="hidden sm:inline">{t.institution.keyboardHint}</span>
            <span>
              {highSchool ? t.credits.schoolSourcesNote : t.credits.pickerNote}{" "}
              {/* A new tab, so a half-filled sign-up form is not lost. */}
              <a href="/credits/logos" target="_blank" rel="noopener" className="hover:text-ink-700 underline underline-offset-2">
                {t.credits.link}
              </a>
            </span>
          </p>
        )}
      </div>
    </dialog>
  );
}

interface InstitutionPickerProps {
  label: string;
  value: InstitutionSelection | null;
  onChange: (value: InstitutionSelection) => void;
  hint?: string;
  error?: string;
  optional?: boolean;
}

/** Button + searchable dialog for choosing a school or university. */
export default function InstitutionPicker({ label, value, onChange, hint, error, optional }: InstitutionPickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className="input flex cursor-pointer items-center gap-3 text-left"
      >
        {value ? (
          <>
            <InstitutionLogo name={value.name} domain={value.domain} className="h-7 w-7" />
            <span className="min-w-0 flex-1">
              <span className="text-ink-900 block truncate text-sm font-medium">{value.name}</span>
              {value.country && <span className="text-ink-500 block truncate text-xs">{value.country}</span>}
            </span>
          </>
        ) : (
          <>
            <GraduationIcon className="text-ink-400 h-5 w-5 shrink-0" />
            <span className="text-ink-400 min-w-0 flex-1 truncate">{t.institution.placeholder}</span>
          </>
        )}
        <ChevronDownIcon className="text-ink-400 h-4 w-4 shrink-0" />
      </button>
      {open && (
        <InstitutionDialog
          initialKind={value?.kind ?? "high-school"}
          onClose={() => setOpen(false)}
          onSelect={onChange}
        />
      )}
    </FieldShell>
  );
}
